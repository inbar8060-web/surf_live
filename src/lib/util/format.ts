import { fromZonedTime } from 'date-fns-tz'

/**
 * Money is stored and moved as integer minor units. It is only ever turned
 * into a decimal string here, at the edge, so no arithmetic ever touches a
 * floating point number.
 */
export function formatMoney(cents: number, currency = 'ILS', locale = 'en-IL'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

/** Parse a user-typed amount ("120", "120.50") into integer minor units. */
export function parseMoneyToCents(input: string): number | null {
  const trimmed = input.trim().replace(/[^\d.,-]/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null
  const cents = Math.round(Number(trimmed) * 100)
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null
}

export function formatDateTime(iso: string, timeZone: string, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(iso))
}

export function formatTime(iso: string, timeZone: string, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, { timeStyle: 'short', timeZone }).format(new Date(iso))
}

export function formatDate(iso: string, timeZone: string, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone }).format(new Date(iso))
}

/** "in 3 days" / "2 hours ago" */
export function formatRelative(iso: string, locale = 'en'): string {
  const diffMs = new Date(iso).getTime() - Date.now()
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ]
  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms) return rtf.format(Math.round(diffMs / ms), unit)
  }
  return rtf.format(Math.round(diffMs / 1000), 'second')
}

/* ---------------------------------------------------------------- day math */

/**
 * "Today" at the club, as YYYY-MM-DD.
 *
 * Deliberately not `new Date().toISOString().slice(0, 10)`: that is the UTC
 * date, so an instructor opening the app at half past midnight in Israel would
 * be shown yesterday's sessions. The club's own clock is the only one that
 * matters for a day's schedule.
 */
export function todayInZone(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).format(new Date())
}

/**
 * The half-open instant range covering one club-local day, for querying
 * timestamptz columns. Midnight at the club is not midnight on the server.
 */
export function dayRangeInZone(isoDate: string, timeZone: string): { from: string; to: string } {
  const start = fromZonedTime(`${isoDate}T00:00:00`, timeZone)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { from: start.toISOString(), to: end.toISOString() }
}
