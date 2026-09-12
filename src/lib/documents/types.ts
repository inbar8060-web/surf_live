/**
 * Signing documents live in code, not in the database.
 *
 * They are versioned modules: editing the wording means bumping `version`, and
 * the version a member signed is the only thing recorded against them. The
 * rendered, signed document itself is never persisted — it is built in memory,
 * emailed to the member and the club, and discarded.
 *
 * `clubName`, `currency` and the like are injected at render time so the same
 * document serves any club without a second copy of the text.
 */

export interface DocumentContext {
  clubName: string
  spotName: string
  /** Full name as the club holds it — printed under the signature. */
  signerName: string
  signerEmail: string
  signerPhone: string | null
}

export type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  /** Rendered in capitals — used for the release clause, as on the source form. */
  | { kind: 'emphatic'; text: string }
  | { kind: 'list'; title?: string; items: string[] }

export interface Acknowledgement {
  id: string
  label: string
  /**
   * A required acknowledgement blocks submission until it is ticked. An
   * optional one (media consent) must never be pre-ticked or forced — consent
   * that cannot be withheld is not consent.
   */
  required: boolean
}

export interface SignableDocument {
  key: 'waiver' | 'rental_agreement'
  version: string
  title: string
  /** One line under the title explaining what signing does. */
  summary: string
  /** Extra details collected on the form, beyond name/email/phone. */
  fields?: {
    id: string
    label: string
    kind: 'select'
    options: string[]
    required: boolean
  }[]
  body: (context: DocumentContext) => Block[]
  acknowledgements: Acknowledgement[]
}
