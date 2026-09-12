import 'server-only'

import { serverEnv } from '@/lib/env'
import { logProvider } from './log'
import type { MailProvider } from './provider'

export * from './provider'

/**
 * Pick the mail provider.
 *
 * Only the development `log` provider exists today — the club's real mailing
 * system is still to be chosen. To add it: write a module next to log.ts that
 * satisfies MailProvider, register it in the switch below, and set
 * MAIL_PROVIDER. Nothing else in the app needs to know.
 */
export function mailProvider(): MailProvider {
  switch (serverEnv().MAIL_PROVIDER) {
    case 'log':
    default:
      return logProvider
  }
}
