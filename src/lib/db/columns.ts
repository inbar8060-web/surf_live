import type { Client, Instructor } from './types'

/**
 * Explicit column lists for the tables whose privileges are granted column by
 * column (see supabase/migrations/0007_rls.sql).
 *
 * `select('*')` MUST NOT be used against these tables with a user session:
 * Postgres expands the star to every column, including the ones deliberately
 * withheld, and the whole query fails with "permission denied". Naming the
 * columns keeps the withheld ones out and gives an accurate row type as well.
 *
 * Server code holding the service role may still use `*` — it bypasses these
 * grants — which is how the admin screens read clients.admin_notes.
 */

// Written as single literals with `as const`: supabase-js reads the select
// string as a literal type to infer the row shape, and concatenation would
// widen it to `string` and lose that.
// prettier-ignore
export const CLIENT_COLUMNS = 'profile_id, club_id, level, birth_date, emergency_contact_name, emergency_contact_phone, medical_notes, waiver_signed_at, height_cm, weight_kg, created_at, updated_at' as const

/** A client row as a browser session may read it — no internal notes. */
export type ReadableClient = Omit<Client, 'admin_notes'>

// prettier-ignore
export const INSTRUCTOR_COLUMNS = 'profile_id, club_id, bio, specialties, certifications, languages, whatsapp_phone, calendar_color, hired_at, created_at, updated_at' as const

/** An instructor row as a browser session may read it — no payout handle. */
export type ReadableInstructor = Instructor

// prettier-ignore
export const RESERVATION_COLUMNS = 'id, club_id, slot_id, client_id, status, participants, client_package_id, price_cents, currency, payment_id, client_note, rejection_reason, revision, decided_by, decided_at, created_at, updated_at' as const
