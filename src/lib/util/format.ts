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
