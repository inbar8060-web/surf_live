import { isIP } from 'node:net'

/**
 * The client address for one request, or null.
 *
 * `X-Forwarded-For` is written by the platform in front of the app (Vercel
 * puts the real client address first), but nothing stops a client from
 * sending its own copy, and the first entry can be arbitrary text. The value
 * is stored in `inet` columns and used as a rate-limit key, so it is validated
 * as an actual IP address here. Junk in a header must never be able to fail
 * an insert: a member who cannot record their own signature because of a
 * header is a denial of service against themselves at best, and against the
 * audit trail at worst.
 */
export function clientIp(headers: Headers): string | null {
  const candidates = [headers.get('x-forwarded-for')?.split(',')[0], headers.get('x-real-ip')]

  for (const raw of candidates) {
    const value = raw?.trim().replace(/^\[|\]$/g, '')
    if (value && isIP(value) !== 0) return value
  }

  return null
}
