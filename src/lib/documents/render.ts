import 'server-only'

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { Block, DocumentContext, SignableDocument } from './types'

/**
 * Render a signed document to a PDF, in memory.
 *
 * Nothing here touches the filesystem or the database. The bytes are handed
 * straight to the mailer and then dropped; the member and the club keep the
 * only copies.
 */

export interface SignatureInput {
  /** PNG data URL from the signature pad, or null when the member typed instead. */
  signatureImage: string | null
  /** Typed name, used when no drawing was made and printed under either. */
  typedName: string
  signedAt: Date
  /** Answers to the document's own fields, e.g. board type. */
  answers: Record<string, string>
  acknowledgements: { label: string; accepted: boolean }[]
}

export interface RenderedDocument {
  bytes: Uint8Array
  filename: string
  /** sha256 of `bytes` — recorded so a copy can be checked later. */
  sha256: string
}

const MARGIN = 56
const PAGE = { width: 595.28, height: 841.89 } // A4 portrait
const INK = rgb(0.07, 0.14, 0.18)
const MUTED = rgb(0.35, 0.44, 0.49)
const RULE = rgb(0.86, 0.89, 0.92)

/** pdf-lib has no text wrapping, so lines are measured and broken by hand. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''

  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate
      continue
    }
    if (line) lines.push(line)

    // A single word longer than the column (a URL, say) is broken by character.
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      let chunk = ''
      for (const char of word) {
        if (font.widthOfTextAtSize(chunk + char, size) > maxWidth) {
          lines.push(chunk)
          chunk = char
        } else {
          chunk += char
        }
      }
      line = chunk
    } else {
      line = word
    }
  }

  if (line) lines.push(line)
  return lines
}

/**
 * Fonts are embedded rather than using pdf-lib's built-ins.
 *
 * The standard PDF fonts are WinAnsi-encoded and cannot draw anything outside
 * Latin-1 — a member called נעה would see their own waiver print their name as
 * "???". Noto Sans Hebrew covers Latin and Hebrew in one face.
 *
 * Read once per process: the files are ~47kB each and the bytes never change.
 */
const FONT_DIR = path.join(process.cwd(), 'src/lib/documents/fonts')
let fontBytes: { regular: Buffer; bold: Buffer } | null = null

async function loadFonts() {
  fontBytes ??= {
    regular: await readFile(path.join(FONT_DIR, 'NotoSansHebrew-Regular.ttf')),
    bold: await readFile(path.join(FONT_DIR, 'NotoSansHebrew-Bold.ttf')),
  }
  return fontBytes
}

const RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/

/**
 * Minimal right-to-left handling.
 *
 * A PDF draws glyphs in the order it is given them, and pdf-lib does not
 * implement the bidirectional algorithm, so a Hebrew name would come out
 * reversed. Each right-to-left run is flipped, which is enough for the short
 * mixed strings these documents contain — the wording itself is English, and
 * only the participant's own details can be right-to-left.
 *
 * This is not full bidi: numbers inside a right-to-left run and nested
 * direction changes are out of scope. Right-to-left document *wording* would
 * need a real shaping library.
 */
function applyBidi(text: string): string {
  if (!RTL.test(text)) return text

  return text.replace(
    /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF][\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF\s]*/gu,
    (run) => [...run].reverse().join(''),
  )
}

/** Typographic tidy-up. Nothing is dropped now that the font is Unicode. */
function prepare(text: string): string {
  return applyBidi(text.normalize('NFC').replace(/\u00a0/g, ' '))
}

class Cursor {
  page: PDFPage
  y: number

  // Written out rather than using constructor parameter properties: those need
  // a full TypeScript transpile, which keeps this module from running under
  // plain `node` for a quick render check.
  private pdf: PDFDocument
  private font: PDFFont
  private bold: PDFFont

  constructor(pdf: PDFDocument, font: PDFFont, bold: PDFFont) {
    this.pdf = pdf
    this.font = font
    this.bold = bold
    this.page = pdf.addPage([PAGE.width, PAGE.height])
    this.y = PAGE.height - MARGIN
  }

  private ensure(space: number) {
    if (this.y - space >= MARGIN) return
    this.page = this.pdf.addPage([PAGE.width, PAGE.height])
    this.y = PAGE.height - MARGIN
  }

  text(
    value: string,
    { size = 10, bold = false, color = INK, leading = 1.45, indent = 0 } = {},
  ) {
    const font = bold ? this.bold : this.font
    const width = PAGE.width - MARGIN * 2 - indent
    const lines = wrap(prepare(value), font, size, width)

    for (const line of lines) {
      this.ensure(size * leading)
      this.page.drawText(line, {
        x: MARGIN + indent,
        y: this.y - size,
        size,
        font,
        color,
      })
      this.y -= size * leading
    }
  }

  gap(space = 10) {
    this.y -= space
  }

  rule() {
    this.ensure(14)
    this.page.drawLine({
      start: { x: MARGIN, y: this.y - 6 },
      end: { x: PAGE.width - MARGIN, y: this.y - 6 },
      thickness: 1,
      color: RULE,
    })
    this.y -= 16
  }

  async image(pdf: PDFDocument, dataUrl: string, maxWidth: number, maxHeight: number) {
    const base64 = dataUrl.split(',')[1]
    if (!base64) return
    const png = await pdf.embedPng(Buffer.from(base64, 'base64'))
    const scale = Math.min(maxWidth / png.width, maxHeight / png.height, 1)
    const width = png.width * scale
    const height = png.height * scale

    this.ensure(height + 6)
    this.page.drawImage(png, { x: MARGIN, y: this.y - height, width, height })
    this.y -= height + 6
  }
}

function drawBlock(cursor: Cursor, block: Block) {
  switch (block.kind) {
    case 'heading':
      cursor.gap(6)
      cursor.text(block.text.toUpperCase(), { size: 10, bold: true })
      cursor.gap(4)
      break
    case 'paragraph':
      cursor.text(block.text, { size: 10 })
      cursor.gap(8)
      break
    case 'emphatic':
      cursor.text(block.text.toUpperCase(), { size: 10, bold: true })
      cursor.gap(8)
      break
    case 'list':
      if (block.title) {
        cursor.gap(2)
        cursor.text(block.title, { size: 10, bold: true })
        cursor.gap(3)
      }
      for (const item of block.items) {
        cursor.text(`•  ${item}`, { size: 10, indent: 10 })
      }
      cursor.gap(8)
      break
  }
}

export async function renderSignedDocument(
  document: SignableDocument,
  context: DocumentContext,
  signature: SignatureInput,
): Promise<RenderedDocument> {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)

  const faces = await loadFonts()
  // Subset, so each document carries only the glyphs it actually uses.
  const font = await pdf.embedFont(faces.regular, { subset: true })
  const bold = await pdf.embedFont(faces.bold, { subset: true })

  pdf.setTitle(`${document.title} — ${context.signerName}`)
  pdf.setProducer(context.clubName)
  pdf.setCreationDate(signature.signedAt)

  const cursor = new Cursor(pdf, font, bold)

  // ---- header -------------------------------------------------------------
  cursor.text(context.clubName.toUpperCase(), { size: 9, bold: true, color: MUTED })
  cursor.gap(2)
  cursor.text(document.title, { size: 18, bold: true })
  cursor.gap(4)
  cursor.text(`Version ${document.version}`, { size: 9, color: MUTED })
  cursor.rule()

  // ---- who ----------------------------------------------------------------
  cursor.text('Participant', { size: 9, bold: true, color: MUTED })
  cursor.gap(3)
  cursor.text(`Name: ${context.signerName}`, { size: 10 })
  cursor.text(`Email: ${context.signerEmail}`, { size: 10 })
  if (context.signerPhone) cursor.text(`Phone: ${context.signerPhone}`, { size: 10 })

  for (const field of document.fields ?? []) {
    const answer = signature.answers[field.id]
    if (answer) cursor.text(`${field.label}: ${answer}`, { size: 10 })
  }
  cursor.rule()

  // ---- body ---------------------------------------------------------------
  for (const block of document.body(context)) drawBlock(cursor, block)

  // ---- what was agreed ----------------------------------------------------
  cursor.rule()
  cursor.text('Acknowledgements', { size: 9, bold: true, color: MUTED })
  cursor.gap(4)
  for (const ack of signature.acknowledgements) {
    cursor.text(`[${ack.accepted ? 'x' : ' '}]  ${ack.label}`, { size: 10, indent: 4 })
  }

  // ---- signature ----------------------------------------------------------
  cursor.gap(14)
  cursor.rule()
  cursor.text('Signed', { size: 9, bold: true, color: MUTED })
  cursor.gap(6)

  if (signature.signatureImage) {
    await cursor.image(pdf, signature.signatureImage, 220, 80)
  }

  cursor.text(signature.typedName, { size: 12, bold: true })
  cursor.gap(2)
  cursor.text(
    `Signed electronically on ${signature.signedAt.toISOString().replace('T', ' ').slice(0, 19)} UTC`,
    { size: 9, color: MUTED },
  )
  cursor.gap(4)
  cursor.text(
    'This copy was generated at the moment of signing and sent to the participant and to the club. ' +
      'It is not retained in any other system.',
    { size: 8, color: MUTED },
  )

  const pdfBytes = await pdf.save()
  const sha256 = createHash('sha256').update(pdfBytes).digest('hex')

  // Latin-only, so the filename survives every mail client and filesystem.
  const safeName =
    context.signerName
      .normalize('NFKD')
      .replace(/[^\x20-\x7E]/g, '')
      .replace(/[^\w]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'member'
  const day = signature.signedAt.toISOString().slice(0, 10)

  return { bytes: pdfBytes, sha256, filename: `${document.key}-${safeName}-${day}.pdf` }
}
