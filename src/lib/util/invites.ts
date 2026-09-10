import 'server-only'

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Registration links.
 *
 * A fresh 256-bit token is minted per invite and shown to the admin once. Only
 * its SHA-256 is stored, so a database leak yields no usable links. Lookups go
 * through the hash, and the comparison is constant-time.
 */

export interface GeneratedInvite {
  /** Raw token — goes in the link, is never persisted. */
  token: string
  /** SHA-256 hex — what the database holds. */
  tokenHash: string
}

export function generateInviteToken(): GeneratedInvite {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashInviteToken(token) }
}

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/** Constant-time hash comparison, tolerant of malformed input. */
export function inviteHashMatches(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export function inviteUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/$/, '')}/invite/${encodeURIComponent(token)}`
}
