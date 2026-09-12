/**
 * Turn a Postgres/PostgREST error into a message that says exactly what was
 * wrong and where.
 *
 * Messages our own triggers raise are shown as written — they were written
 * for people. Everything Postgres generates itself is translated: the
 * constraint or column is pulled out of its wording, turned into the field's
 * label and a reason, and the rule's name is kept at the end so a report can
 * be matched to the schema. The full original is always logged server-side.
 *
 * Pure module with no framework imports, so it is unit-testable with plain node.
 */

export interface PostgrestLikeError {
  message?: string
  code?: string
  details?: string | null
  hint?: string | null
}

/** What a caller renders: one line for the top of the form, and per-field lines when a field is known. */
export interface DbFailure {
  error: string
  fieldErrors?: Record<string, string>
}

/* ------------------------------------------------------------------ labels */

/** Column → the label the person saw on the form. Anything else is humanised. */
const LABELS: Record<string, string> = {
  maps_url: 'Google Maps link',
  admin_email: 'Administrator email',
  slug: 'Address on the platform',
  club_name: 'Club name',
  contact_email: 'Club inbox',
  contact_phone: 'Club phone',
  spot_name: 'Spot name',
  spot_latitude: 'Latitude',
  spot_longitude: 'Longitude',
  opening_hours: 'Opening hours',
  address: 'Street address',
  website: 'Website',
  timezone: 'Time zone',
  currency: 'Currency',
  full_name: 'Full name',
  email: 'Email',
  phone: 'Phone',
  price_cents: 'Price',
  daily_price_cents: 'Daily price',
  duration_minutes: 'Duration',
  default_capacity: 'Capacity',
  capacity: 'Capacity',
  participants: 'Participants',
  starts_at: 'Start time',
  ends_at: 'End time',
  asset_tag: 'Asset tag',
  lessons_count: 'Number of lessons',
  validity_days: 'Validity (days)',
  cancellation_window_hours: 'Change window (hours)',
  rating: 'Rating',
  subject: 'Subject',
  body: 'Message',
  name: 'Name',
  description: 'Description',
  note: 'Note',
  reason: 'Reason',
}

function humanise(identifier: string): string {
  const words = identifier.replace(/_/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function label(column: string): string {
  return LABELS[column] ?? humanise(column)
}

/** snake_case column → the camelCase key forms use for the same field. */
function formKey(column: string): string {
  return column.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

/* ------------------------------------------------------------------- rules */

/** Constraints whose rule is known well enough to say what would satisfy it. */
const CHECK_RULES: Record<string, { column?: string; reason: string }> = {
  clubs_maps_url_check: {
    column: 'maps_url',
    reason: 'must be a Google Maps link — https://www.google.com/maps/…, https://maps.google.com/… or https://maps.app.goo.gl/…',
  },
  clubs_slug_check: { column: 'slug', reason: 'lower-case letters, digits and single hyphens only, 3–40 characters' },
  clubs_slug_not_reserved: { column: 'slug', reason: 'that name is reserved by the platform' },
  clubs_name_check: { column: 'name', reason: 'between 2 and 120 characters' },
  club_settings_opening_hours_check: { column: 'opening_hours', reason: 'at most seven lines, one per day' },
  club_settings_website_check: { column: 'website', reason: 'must start with http:// or https:// and be under 300 characters' },
  club_settings_address_check: { column: 'address', reason: 'at most 300 characters' },
  time_slots_time_order: { column: 'ends_at', reason: 'the session must end after it starts' },
  time_slots_sane_length: { column: 'ends_at', reason: 'the session length is outside the allowed range' },
  rentals_date_order: { reason: 'the return date must be after the start date' },
  client_packages_remaining_le_total: { reason: 'remaining lessons cannot exceed the total' },
  invite_not_used_and_revoked: { reason: 'an invitation cannot be both used and revoked' },
}

const FRIENDLY_UNIQUE: Record<string, { column?: string; reason: string }> = {
  reservations_one_live_per_slot: { reason: 'you already have a booking for this session' },
  session_reviews_once: { reason: 'you have already reviewed this session' },
  instructor_reviews_once: { reason: 'you have already reviewed this lesson' },
  document_signatures_once: { reason: 'you have already signed this document' },
  profiles_phone_key: { column: 'phone', reason: 'that phone number is already registered in this club' },
  inventory_items_asset_tag_key: { column: 'asset_tag', reason: 'that asset tag is already in use' },
  inventory_items_club_asset_tag_key: { column: 'asset_tag', reason: 'that asset tag is already in use' },
  categories_club_slug_key: { column: 'name', reason: 'a category with that name already exists' },
  clubs_slug_key: { column: 'slug', reason: 'a club already lives at that address' },
  rentals_no_overlap: { reason: 'that board is already booked for those dates' },
  tsi_single_lead_idx: { reason: 'that session already has a lead instructor' },
}

/** Codes under which our triggers raise messages meant for people. */
const TRIGGER_CODES = new Set(['23514', '42501', '23503', 'P0001'])

/** Postgres's own phrasing under those same codes — generated, not written by us. */
const NATIVE_PHRASING = [
  /violates (check|foreign key|not-null|unique|exclusion) constraint/i,
  /^insert or update on table/i,
  /^update or delete on table/i,
  /^null value in column/i,
  /^permission denied/i,
  /^new row violates row-level security/i,
  /^value too long for type/i,
  /^invalid input syntax/i,
]

function isNative(message: string): boolean {
  return NATIVE_PHRASING.some((re) => re.test(message))
}

const quoted = (text: string, after: RegExp) => text.match(after)?.[1] ?? null

/** `reservations_slot_id_fkey` on table `reservations` → `slot_id`. */
function columnFromConstraint(constraint: string, table: string | null, suffix: string): string | null {
  let name = constraint.endsWith(suffix) ? constraint.slice(0, -suffix.length) : constraint
  if (table && name.startsWith(`${table}_`)) name = name.slice(table.length + 1)
  // the longest known label that the remainder ends with wins ("club_slug" → slug)
  const known = Object.keys(LABELS)
    .filter((c) => name === c || name.endsWith(`_${c}`))
    .sort((a, b) => b.length - a.length)[0]
  return known ?? (name || null)
}

function failure(column: string | null, reason: string, rule: string | null): DbFailure {
  const where = column ? label(column) : 'This form'
  const error = `${where}: ${reason}${rule ? ` (rule ${rule})` : ''}.`
  return column ? { error, fieldErrors: { [formKey(column)]: reason } } : { error }
}

/* ----------------------------------------------------------------- public */

export function describeDbFailure(error: unknown, fallback = 'Something went wrong.'): DbFailure {
  const err = error as PostgrestLikeError | null
  if (!err) return { error: fallback }

  const message = err.message ?? ''
  const text = `${message} ${err.details ?? ''}`
  const table = quoted(text, /(?:relation|table) "([^"]+)"/)
  console.error('[db]', err.code, message, err.details ?? '')

  // duplicates and exclusion (overlap) constraints
  if (err.code === '23505' || err.code === '23P01') {
    const constraint = quoted(text, /constraint "([^"]+)"/)
    const known = constraint ? FRIENDLY_UNIQUE[constraint] : undefined
    if (known) return failure(known.column ?? null, known.reason, constraint)
    // PostgREST's details carry the column outright: Key (slug)=(reef) already exists.
    const column = quoted(text, /Key \(([^),]+)\)=/) ?? (constraint ? columnFromConstraint(constraint, table, '_key') : null)
    return failure(column, 'that value is already taken', constraint)
  }

  if (err.code && TRIGGER_CODES.has(err.code) && message) {
    if (!isNative(message)) {
      // our own trigger, written for people — already says what and where
      // strip only a server-added "ERROR:" prefix — the message's own colons are ours
      return { error: message.replace(/^ERROR:\s*/i, '').slice(0, 300) }
    }

    if (err.code === '23514') {
      const constraint = quoted(text, /check constraint "([^"]+)"/)
      const known = constraint ? CHECK_RULES[constraint] : undefined
      if (known) return failure(known.column ?? null, known.reason, constraint)
      const column = constraint ? columnFromConstraint(constraint, table, '_check') : null
      return failure(column, 'the value does not satisfy the rule', constraint)
    }

    if (err.code === '23503') {
      const constraint = quoted(text, /foreign key constraint "([^"]+)"/)
      const column = constraint ? columnFromConstraint(constraint, table, '_fkey') : null
      return failure(column, 'refers to something that does not exist, or belongs to another club', constraint)
    }

    if (err.code === '42501') {
      if (/row-level security/i.test(message)) {
        return {
          error: `You are not allowed to write this ${table ? humanise(table).toLowerCase() : 'record'}: it would belong to another club, or your role may not change it (rule row-level security${table ? ` on ${table}` : ''}).`,
        }
      }
      return { error: `Your role has no access to ${table ?? 'that'} (rule permission denied).` }
    }
  }

  if (err.code === '23502') {
    const column = quoted(text, /null value in column "([^"]+)"/)
    return failure(column, 'is required', 'not null')
  }
  if (err.code === '22001') {
    const limit = message.match(/\((\d+)\)/)?.[1]
    return { error: `A value is too long${limit ? ` — at most ${limit} characters` : ''} (rule value too long).` }
  }
  if (err.code === '22P02') {
    const type = message.match(/for type ([a-z ]+):/)?.[1]
    const value = message.match(/: "([^"]*)"$/)?.[1]
    return { error: `${value !== undefined ? `"${value}"` : 'A value'} is not a valid ${type ?? 'value'} (rule input syntax).` }
  }
  if (err.code === '22003') return { error: 'A number is out of range for its field (rule numeric range).' }

  return { error: `${fallback}${err.code ? ` (database error ${err.code}${message ? `: ${message.slice(0, 200)}` : ''})` : ''}` }
}

/** The one-line form, for places that only have room for a sentence. */
export function describeDbError(error: unknown, fallback = 'Something went wrong.'): string {
  return describeDbFailure(error, fallback).error
}
