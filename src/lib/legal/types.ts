import type { Block } from '@/lib/documents/types'
import type { AppRole, LegalDocumentKey } from '@/lib/db/types'

/**
 * The platform's legal documents live in code, versioned, like the signing
 * documents. What is recorded against a person is the key and the version
 * they accepted — never the text, which is here for anyone to read.
 */

/** Who the platform is, printed into every document. */
export const PLATFORM = {
  name: 'Surfer Live',
  legalName: 'Surfer Live',
  contactEmail: `legal@${(process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? 'surferlive.app').replace(/:\d+$/, '').replace(/^localhost$/, 'surferlive.app')}`,
  supportEmail: `support@${(process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? 'surferlive.app').replace(/:\d+$/, '').replace(/^localhost$/, 'surferlive.app')}`,
  website: `https://${(process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? 'surferlive.app').replace(/:\d+$/, '').replace(/^localhost$/, 'surferlive.app')}`,
  governingLaw: 'the laws of the State of Israel',
  courts: 'the competent courts of Tel Aviv–Yafo, Israel',
} as const

export interface LegalContext {
  /** The club the reader belongs to, when there is one. */
  clubName: string | null
}

export interface LegalDocument {
  key: LegalDocumentKey
  version: string
  title: string
  /** One line under the title. */
  summary: string
  /** Which roles must accept it before using the platform. */
  audience: AppRole[]
  /** The checkbox wording. */
  consent: string
  body: (context: LegalContext) => Block[]
}
