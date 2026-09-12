'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertRole, requireRoleForAction } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { recordAudit } from '@/lib/audit'
import { rateLimit } from '@/lib/util/rate-limit'
import { clientIp } from '@/lib/util/request'
import { serverEnv } from '@/lib/env'
import { mailProvider, type MailAttachment } from '@/lib/mail'
import {
  documentByKey,
  outstandingDocuments,
  REQUIRED_DOCUMENTS,
  type DocumentContext,
  type DocumentKey,
  type SignableDocument,
} from '@/lib/documents'
import { renderSignedDocument, type RenderedDocument } from '@/lib/documents/render'
import { assertSameOrigin, fail, fromZod, ok, failDb, type ActionResult } from './result'
import { bool, optionalStr, str } from './form'

/**
 * A drawn signature arrives as a PNG data URL. It is bounded hard: anything
 * that is not a modest PNG is refused rather than passed to the renderer.
 */
const signatureImageSchema = z
  .string()
  .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, 'That signature could not be read')
  .max(400_000, 'That signature is too large')

const signSchema = z.object({
  documentKey: z.enum(['waiver', 'rental_agreement']),
  version: z.string().min(1).max(40),
  typedName: z.string().trim().min(2, 'Please type your full name').max(120),
  signatureImage: signatureImageSchema.optional().or(z.literal('')),
  boardType: z.string().trim().max(40).optional().or(z.literal('')),
  mediaConsent: z.coerce.boolean().default(false),
})

/* -------------------------------------------------------------- delivery */

function plainTextBody(clubName: string, signerName: string, documents: SignableDocument[]): string {
  return [
    `Hello ${signerName.split(' ')[0]},`,
    '',
    `Attached are the documents you signed for ${clubName}:`,
    ...documents.map((doc) => `  - ${doc.title} (version ${doc.version})`),
    '',
    'Please keep this email. The club does not store a copy of the signed documents in its system,',
    'so this attachment and the club’s own copy are the only ones that exist.',
    '',
    `If anything here is wrong, reply to this email or call ${clubName}.`,
    '',
    clubName,
  ].join('\n')
}

/**
 * Where the club's copy goes: the configured inbox, or every active
 * administrator when none is set, so a signed waiver is never sent into a void.
 */
async function clubRecipients(configured: string | null): Promise<string[]> {
  if (configured) return [configured]

  const { data } = await createAdminClient()
    .from('profiles')
    .select('email')
    .eq('role', 'admin')
    .eq('is_active', true)

  return (data ?? []).map((row) => row.email).filter((email): email is string => Boolean(email))
}

/* ------------------------------------------------------------------ sign */

/**
 * Record one signature.
 *
 * Order matters: the signature is recorded first, then — once every required
 * document is signed — all of them are re-rendered and emailed together. The
 * rendered PDFs exist only for the length of this function; nothing is written
 * to disk or to the database except the fact that signing happened.
 */
export async function signDocumentAction(
  _prev: ActionResult<{ done: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ done: boolean }>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')

  // A member may have had this page open for several minutes reading the
  // document. If the session lapsed or the browser has since been used by
  // someone else, send them back to sign in rather than refusing flatly.
  const guard = await requireRoleForAction(['client'], '/onboarding/documents')
  if (!guard.ok) return fail(guard.error)
  const user = guard.user

  const parsed = signSchema.safeParse({
    documentKey: str(formData, 'documentKey'),
    version: str(formData, 'version'),
    typedName: str(formData, 'typedName'),
    signatureImage: optionalStr(formData, 'signatureImage'),
    boardType: optionalStr(formData, 'boardType'),
    mediaConsent: bool(formData, 'mediaConsent'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  const limit = await rateLimit(`sign:${user.id}`, 20, 60 * 60_000)
  if (!limit.ok) return fail('Too many attempts. Please try again shortly.')

  const document = documentByKey(parsed.data.documentKey)
  if (!document) return fail('That document could not be found.')
  if (document.version !== parsed.data.version) {
    return fail('This document has been updated. Please reload the page and read it again.')
  }

  // Required acknowledgements are checked here as well as in the browser: a
  // tick box is a claim about what someone agreed to, so it has to be verified
  // somewhere they cannot edit.
  for (const ack of document.acknowledgements) {
    if (ack.required && !bool(formData, `ack_${ack.id}`)) {
      return fail('Please confirm you have read and agree to the document.', {
        [`ack_${ack.id}`]: 'Required',
      })
    }
  }

  for (const field of document.fields ?? []) {
    if (field.required && !str(formData, field.id)) {
      return fail(`Please choose a ${field.label.toLowerCase()}.`, { [field.id]: 'Required' })
    }
  }

  const headerList = await headers()
  const supabase = await createUserClient()

  const { error: insertError } = await supabase.from('document_signatures').insert({
    client_id: user.id,
    document_key: document.key,
    version: document.version,
    media_consent: document.key === 'waiver' ? parsed.data.mediaConsent : null,
    ip: clientIp(headerList),
    user_agent: headerList.get('user-agent')?.slice(0, 500) ?? null,
  })

  // Signing the same version twice is a no-op, not an error. It also means
  // this request did not add anything, so it must not be the one that sends
  // the email: two submissions racing on the last document would otherwise
  // both find the set complete and both deliver it.
  const duplicate = insertError?.code === '23505'
  if (insertError && !duplicate) {
    return failDb(insertError, 'Could not record your signature.')
  }

  await recordAudit({
    actorId: user.id,
    actorRole: 'client',
    action: 'document.signed',
    entity: 'document_signature',
    entityId: document.key,
    // The wording, the answers and the signature itself are deliberately not
    // copied into the audit trail — only the fact and the version.
    after: { version: document.version, media_consent: parsed.data.mediaConsent },
  })

  const { data: signed } = await supabase
    .from('document_signatures')
    .select('document_key, version')
    .eq('client_id', user.id)

  const outstanding = outstandingDocuments(signed ?? [])
  if (outstanding.length > 0) {
    revalidatePath('/onboarding/documents')
    return ok({ done: false }, `${document.title} signed.`)
  }

  // Everything is signed. Only the request that actually recorded the final
  // signature renders and sends the set; a duplicate just reports completion.
  if (!duplicate) {
    await deliverSignedSet(user.id, {
      typedName: parsed.data.typedName,
      signatureImage: parsed.data.signatureImage || null,
      boardType: parsed.data.boardType || '',
      mediaConsent: parsed.data.mediaConsent,
    })
  }

  revalidatePath('/client', 'layout')
  return ok({ done: true }, 'Both documents are signed. A copy is on its way to your inbox.')
}

interface SigningDetails {
  typedName: string
  signatureImage: string | null
  boardType: string
  mediaConsent: boolean
}

/**
 * Build the PDFs and hand them to the mailer.
 *
 * Delivery failure never rolls the signature back: the member did sign, and
 * losing that because an SMTP host was down would be worse than a missing
 * email. The failure is recorded on the row so it can be retried.
 */
async function deliverSignedSet(clientId: string, details: SigningDetails): Promise<void> {
  const club = await getClubSettings()
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, email, phone')
    .eq('id', clientId)
    .single()

  if (!profile?.email) {
    await admin
      .from('document_signatures')
      .update({ delivery_error: 'No email address on the member record' })
      .eq('client_id', clientId)
      .is('delivered_at', null)
    return
  }

  const context: DocumentContext = {
    clubName: club.club_name,
    spotName: club.spot_name,
    signerName: profile.full_name,
    signerEmail: profile.email,
    signerPhone: profile.phone,
  }

  const signedAt = new Date()
  const rendered: (RenderedDocument & { key: DocumentKey })[] = []

  /*
   * Rendering parses the member's own signature PNG. A malformed image must
   * not turn into an unhandled exception here: the signature is already
   * recorded, so the honest outcome is "signed, copy not delivered", written
   * to the row so it can be retried — not a 500 that hides both facts.
   */
  try {
    for (const document of REQUIRED_DOCUMENTS) {
      const file = await renderSignedDocument(document, context, {
        signatureImage: details.signatureImage,
        typedName: details.typedName || profile.full_name,
        signedAt,
        answers: document.key === 'rental_agreement' ? { board_type: details.boardType } : {},
        acknowledgements: document.acknowledgements.map((ack) => ({
          label: ack.label,
          accepted: ack.required ? true : ack.id === 'media_consent' ? details.mediaConsent : false,
        })),
      })
      rendered.push({ ...file, key: document.key })
    }
  } catch (cause) {
    console.error('[documents] render failed', cause)
    await admin
      .from('document_signatures')
      .update({ delivery_error: 'The signed copy could not be generated' })
      .eq('client_id', clientId)
      .is('delivered_at', null)
    return
  }

  const attachments: MailAttachment[] = rendered.map((file) => ({
    filename: file.filename,
    contentType: 'application/pdf',
    content: file.bytes,
  }))

  const club_to = await clubRecipients(club.contact_email)
  let delivered = false
  let error: string | null = null

  try {
    const result = await mailProvider().send({
      to: [profile.email],
      cc: club_to,
      subject: `${club.club_name} — your signed documents`,
      text: plainTextBody(club.club_name, profile.full_name, [...REQUIRED_DOCUMENTS]),
      attachments,
      replyTo: club.contact_email ?? undefined,
    })
    delivered = result.delivered
    if (!delivered) error = 'The mail provider did not accept the message'
  } catch (cause) {
    console.error('[documents] delivery failed', cause)
    error = 'The mail provider could not be reached'
  }

  // Record the outcome and the digest of exactly what was sent. The result is
  // checked: a silent failure here would leave a delivered document looking
  // undelivered forever, and nobody would know to retry it.
  for (const file of rendered) {
    const { error: updateError, data: updated } = await admin
      .from('document_signatures')
      .update({
        document_sha256: file.sha256,
        delivered_at: delivered ? new Date().toISOString() : null,
        delivery_error: error,
      })
      .eq('client_id', clientId)
      .eq('document_key', file.key)
      .select('id')

    if (updateError || !updated?.length) {
      console.error(
        '[documents] could not record delivery for %s/%s: %s',
        clientId,
        file.key,
        updateError?.message ?? 'no row matched',
      )
    }
  }

  await recordAudit({
    actorId: clientId,
    actorRole: 'client',
    action: delivered ? 'document.delivered' : 'document.delivery_failed',
    entity: 'document_signature',
    entityId: clientId,
    after: { recipients: [profile.email, ...club_to].length, provider: mailProvider().name, error },
  })
}

/** Used by the onboarding screen to know where the member is up to. */
export async function signingProgress() {
  const user = await assertRole('client')
  if (!user) redirect('/login')

  const supabase = await createUserClient()
  const { data } = await supabase
    .from('document_signatures')
    .select('document_key, version')
    .eq('client_id', user.id)

  return { signed: data ?? [], outstanding: outstandingDocuments(data ?? []) }
}

/** Exposed so the layout gate can check without duplicating the query. */
export async function hasOutstandingDocuments(clientId: string): Promise<boolean> {
  const supabase = await createUserClient()
  const { data } = await supabase
    .from('document_signatures')
    .select('document_key, version')
    .eq('client_id', clientId)

  return outstandingDocuments(data ?? []).length > 0
}

export async function mailProviderName(): Promise<string> {
  return serverEnv().MAIL_PROVIDER
}
