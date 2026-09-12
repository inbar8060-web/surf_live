import type { AppRole, LegalDocumentKey } from '@/lib/db/types'
import { CLUB_AGREEMENT } from './club-agreement'
import { INSTRUCTOR_AGREEMENT } from './instructor-agreement'
import { PRIVACY } from './privacy'
import { TERMS } from './terms'
import type { LegalDocument } from './types'

export * from './types'
export { TERMS, PRIVACY, CLUB_AGREEMENT, INSTRUCTOR_AGREEMENT }

/** Every document, in the order it is presented. */
export const LEGAL_DOCUMENTS: readonly LegalDocument[] = [CLUB_AGREEMENT, INSTRUCTOR_AGREEMENT, TERMS, PRIVACY]

export function legalDocumentByKey(key: string): LegalDocument | undefined {
  return LEGAL_DOCUMENTS.find((doc) => doc.key === key)
}

/** The documents a role must have accepted, in order. */
export function legalDocumentsFor(role: AppRole): LegalDocument[] {
  return LEGAL_DOCUMENTS.filter((doc) => doc.audience.includes(role))
}

/** Which of a role's documents this person has not accepted at the current version. */
export function outstandingLegal(
  role: AppRole,
  accepted: { document_key: string; version: string }[],
): LegalDocument[] {
  return legalDocumentsFor(role).filter(
    (doc) => !accepted.some((a) => a.document_key === doc.key && a.version === doc.version),
  )
}

export const LEGAL_KEYS: LegalDocumentKey[] = ['terms', 'privacy', 'club_agreement', 'instructor_agreement']
