import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

/** Small readers that turn FormData into the shapes the Zod schemas expect. */

export function str(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

/** Empty string means "not provided" for optional fields. */
export function optionalStr(formData: FormData, key: string): string | undefined {
  const value = str(formData, key)
  return value === '' ? undefined : value
}

export function bool(formData: FormData, key: string): boolean {
  const value = formData.get(key)
  return value === 'on' || value === 'true' || value === '1'
}

export function strList(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .filter((v): v is string => typeof v === 'string' && v !== '')
}

/** Split a comma separated free-text field into a trimmed array. */
export function commaList(formData: FormData, key: string): string[] {
  return str(formData, key)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 20)
}

/**
 * A <input type="datetime-local"> value carries no zone. When an admin types
 * "09:00" they mean nine in the morning at the club, so the value is resolved
 * against the club's timezone — not the server's, which on Vercel is UTC.
 */
export function isoFromLocal(formData: FormData, key: string, timeZone: string): string {
  const raw = str(formData, key)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(raw)) return ''

  const instant = fromZonedTime(raw, timeZone)
  return Number.isNaN(instant.getTime()) ? '' : instant.toISOString()
}

/** The inverse, for rendering an existing timestamp back into the input. */
export function localFromIso(iso: string, timeZone: string): string {
  return formatInTimeZone(new Date(iso), timeZone, "yyyy-MM-dd'T'HH:mm")
}
