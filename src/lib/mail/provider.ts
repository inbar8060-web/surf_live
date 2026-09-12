import 'server-only'

/**
 * Mail provider seam.
 *
 * The rest of the app only knows this interface, so the real sending service
 * — Resend, SES, Postmark, plain SMTP — can be dropped in later by writing one
 * file and changing MAIL_PROVIDER, with no call site moving.
 *
 * Attachments are passed as bytes in memory. Nothing is written to disk or to
 * the database on the way through.
 */

export interface MailAttachment {
  filename: string
  contentType: string
  content: Uint8Array
}

export interface MailMessage {
  to: string[]
  cc?: string[]
  subject: string
  /** Plain text is required; HTML is an enhancement, never the only version. */
  text: string
  html?: string
  attachments?: MailAttachment[]
  replyTo?: string
}

export interface MailResult {
  /** Provider-side id, when the provider gives one. */
  reference: string | null
  /** False when the provider accepted nothing — the caller records the failure. */
  delivered: boolean
}

export interface MailProvider {
  readonly name: string
  send(message: MailMessage): Promise<MailResult>
}
