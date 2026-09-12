import 'server-only'

import { headers } from 'next/headers'
import { z } from 'zod'
import { publicEnv } from '@/lib/env'
import { plainMessage } from '@/lib/validation/messages'

/**
 * The single shape every Server Action returns. Pages render `error` and
 * `fieldErrors` directly; nothing throws across the action boundary, so an
 * internal message can never leak into the browser by accident.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message }
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors }
}

/** "adminEmail" → "Administrator email", "spotLatitude" → "Spot latitude". */
function fieldLabel(key: string): string {
  const special: Record<string, string> = {
    adminEmail: 'Administrator email',
    mapsUrl: 'Google Maps link',
    slug: 'Address on the platform',
    form: 'Form',
  }
  if (special[key]) return special[key]
  const words = key.replace(/([A-Z])/g, ' $1').replace(/\./g, ' › ').toLowerCase().trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * Flatten a Zod error into one message per field, and a top line that names
 * every field and what is wrong with it — so the answer is complete even when
 * a field has no room of its own to show it.
 */
export function fromZod(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form'
    fieldErrors[key] ??= plainMessage(issue.message)
  }
  const summary = Object.entries(fieldErrors)
    .map(([key, message]) => `${fieldLabel(key)} — ${message}`)
    .join('; ')
  return fail(`Please fix: ${summary}.`, fieldErrors)
}

/** A failed database write, explained: which field, what rule, and why. */
export function failDb(error: unknown, fallback: string): ActionResult<never> {
  const described = describeDbFailure(error, fallback)
  return fail(described.error, described.fieldErrors)
}

/**
 * Cross-origin check for Server Actions.
 *
 * Next.js already compares Origin against Host for actions; this repeats the
 * check explicitly so the guarantee survives a config change, and so the same
 * helper can protect route handlers that post JSON.
 */
export async function assertSameOrigin(): Promise<boolean> {
  const headerList = await headers()
  const origin = headerList.get('origin')
  if (!origin) return true // same-origin form posts may omit it

  const allowed = new Set([publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')])
  const host = headerList.get('host')
  if (host) {
    allowed.add(`https://${host}`)
    if (process.env.NODE_ENV !== 'production') allowed.add(`http://${host}`)
  }
  return allowed.has(origin.replace(/\/$/, ''))
}

export { describeDbError } from '@/lib/db/errors'
import { describeDbFailure } from '@/lib/db/errors'
