import { RENTAL_AGREEMENT } from './rental-agreement'
import { WAIVER } from './waiver'
import type { SignableDocument } from './types'

export * from './types'
export { WAIVER, RENTAL_AGREEMENT }

/**
 * The documents a member must sign before they can use the club, in the order
 * they are presented. Adding one here adds a step to registration; nothing
 * else needs to change.
 */
export const REQUIRED_DOCUMENTS: readonly SignableDocument[] = [WAIVER, RENTAL_AGREEMENT]

export type DocumentKey = SignableDocument['key']

export function documentByKey(key: string): SignableDocument | undefined {
  return REQUIRED_DOCUMENTS.find((doc) => doc.key === key)
}

/** Which of the required documents this member still has to sign. */
export function outstandingDocuments(
  signed: { document_key: string; version: string }[],
): SignableDocument[] {
  return REQUIRED_DOCUMENTS.filter(
    (doc) => !signed.some((s) => s.document_key === doc.key && s.version === doc.version),
  )
}
