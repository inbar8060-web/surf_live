import 'server-only'

import { headers } from 'next/headers'
import { z } from 'zod'
import { publicEnv } from '@/lib/env'

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

/** Flatten a Zod error into one message per field. */
export function fromZod(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form'
    fieldErrors[key] ??= issue.message
  }
  return fail('Please check the highlighted fields.', fieldErrors)
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

/**
 * Turn a Postgres/PostgREST error into something a person can act on.
 *
 * The rule is: constraint violations raised deliberately by our triggers carry
 * a human-readable message and are shown as-is; everything else is logged
 * server-side and replaced with a generic line, so internal detail (table
 * names, SQL fragments) never reaches the browser.
 */
interface PostgrestLikeError {
  message?: string
  code?: string
  details?: string | null
  hint?: string | null
}

const SAFE_CODES = new Set([
  '23514', // check_violation — our business rules
  '42501', // insufficient_privilege — "you may not do that"
  '23505', // unique_violation
  '23503', // foreign_key_violation
  'P0001', // raise exception without an explicit errcode
])

const FRIENDLY_UNIQUE: Record<string, string> = {
  reservations_one_live_per_slot: 'You already have a booking for this session.',
  session_reviews_once: 'You have already reviewed this session.',
  instructor_reviews_once: 'You have already reviewed this lesson.',
  profiles_phone_key: 'That phone number is already registered.',
  inventory_items_asset_tag_key: 'That asset tag is already in use.',
  rentals_no_overlap: 'That board is already booked for those dates.',
  tsi_single_lead_idx: 'That session already has a lead instructor.',
}

export function describeDbError(error: unknown, fallback = 'Something went wrong.'): string {
  const err = error as PostgrestLikeError | null
  if (!err) return fallback

  if (err.code === '23505' || err.code === '23P01') {
    for (const [constraint, message] of Object.entries(FRIENDLY_UNIQUE)) {
      if (err.message?.includes(constraint) || err.details?.includes(constraint)) return message
    }
    return 'That record already exists.'
  }

  if (err.code && SAFE_CODES.has(err.code) && err.message) {
    // Strip the PL/pgSQL context prefix if present.
    return err.message.replace(/^.*?:\s*/, '').slice(0, 300)
  }

  console.error('[db]', err.code, err.message, err.details)
  return fallback
}
