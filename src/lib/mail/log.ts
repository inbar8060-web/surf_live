import 'server-only'

import type { MailMessage, MailProvider, MailResult } from './provider'

/**
 * Development provider.
 *
 * Records that a message *would* have been sent and drops it. It deliberately
 * does not write the attachment anywhere — the whole point of this feature is
 * that signed documents are not retained — and it never prints the body, which
 * contains the member's own agreement.
 *
 * It refuses to load in production so a misconfigured deployment cannot
 * silently swallow a member's waiver.
 */
export const logProvider: MailProvider = {
  name: 'log',

  async send(message: MailMessage): Promise<MailResult> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('MAIL_PROVIDER=log is not allowed in production')
    }

    console.info(
      '[mail] would send %s to %s%s — %s',
      JSON.stringify(message.subject),
      message.to.join(', '),
      message.cc?.length ? ` (cc ${message.cc.join(', ')})` : '',
      (message.attachments ?? [])
        .map((a) => `${a.filename} ${(a.content.byteLength / 1024).toFixed(1)}kB`)
        .join(', ') || 'no attachments',
    )

    return { reference: null, delivered: true }
  },
}
