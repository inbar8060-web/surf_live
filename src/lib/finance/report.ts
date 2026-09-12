import type { PaymentKind, ReportPeriod } from '@/lib/db/types'
import { fromZonedTime } from 'date-fns-tz'

/**
 * Finance reports: a period in the club's own clock, and sums over payment
 * rows. Pure, so both dashboards and the tests use exactly the same numbers.
 */

export interface PeriodRange {
  period: ReportPeriod
  /** "2026-09", "2026-Q3", "2026" */
  key: string
  label: string
  from: string
  to: string
  prevKey: string
  nextKey: string
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** Midnight at the club on a calendar day, as an instant. */
function midnight(isoDate: string, timeZone: string): string {
  return fromZonedTime(`${isoDate}T00:00:00`, timeZone).toISOString()
}

/** Today's year and month in the club's zone. */
function nowParts(timeZone: string, now: Date): { year: number; month: number } {
  const text = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone }).format(now)
  const [y, m] = text.split('-').map(Number)
  return { year: y!, month: m! }
}

export function resolvePeriod(period: ReportPeriod, at: string | undefined, timeZone: string, now = new Date()): PeriodRange {
  const today = nowParts(timeZone, now)

  if (period === 'yearly') {
    const year = /^\d{4}$/.test(at ?? '') ? Number(at) : today.year
    return {
      period,
      key: String(year),
      label: String(year),
      from: midnight(`${year}-01-01`, timeZone),
      to: midnight(`${year + 1}-01-01`, timeZone),
      prevKey: String(year - 1),
      nextKey: String(year + 1),
    }
  }

  if (period === 'quarterly') {
    const m = at?.match(/^(\d{4})-Q([1-4])$/)
    const year = m ? Number(m[1]) : today.year
    const quarter = m ? Number(m[2]) : Math.ceil(today.month / 3)
    const firstMonth = (quarter - 1) * 3 + 1
    const next = quarter === 4 ? { year: year + 1, quarter: 1 } : { year, quarter: quarter + 1 }
    const prev = quarter === 1 ? { year: year - 1, quarter: 4 } : { year, quarter: quarter - 1 }
    return {
      period,
      key: `${year}-Q${quarter}`,
      label: `Q${quarter} ${year}`,
      from: midnight(`${year}-${pad(firstMonth)}-01`, timeZone),
      to: midnight(`${next.year}-${pad((next.quarter - 1) * 3 + 1)}-01`, timeZone),
      prevKey: `${prev.year}-Q${prev.quarter}`,
      nextKey: `${next.year}-Q${next.quarter}`,
    }
  }

  const m = at?.match(/^(\d{4})-(0[1-9]|1[0-2])$/)
  const year = m ? Number(m[1]) : today.year
  const month = m ? Number(m[2]) : today.month
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
  return {
    period: 'monthly',
    key: `${year}-${pad(month)}`,
    label: `${MONTHS[month - 1]} ${year}`,
    from: midnight(`${year}-${pad(month)}-01`, timeZone),
    to: midnight(`${next.year}-${pad(next.month)}-01`, timeZone),
    prevKey: `${prev.year}-${pad(prev.month)}`,
    nextKey: `${next.year}-${pad(next.month)}`,
  }
}

export interface PaymentLike {
  kind: PaymentKind
  status: string
  amount_cents: number
  platform_fee_cents?: number
  currency: string
}

export interface PaymentSummary {
  currency: string
  /** Payments that were taken, including ones refunded afterwards. */
  succeeded: number
  failed: number
  refunded: number
  grossCents: number
  refundedCents: number
  netCents: number
  feeCents: number
  averageCents: number
  byKind: Record<PaymentKind, { count: number; cents: number }>
}

export function summarisePayments(payments: PaymentLike[], currency = 'ILS'): PaymentSummary {
  const byKind: PaymentSummary['byKind'] = {
    reservation: { count: 0, cents: 0 },
    package: { count: 0, cents: 0 },
    rental: { count: 0, cents: 0 },
    tip: { count: 0, cents: 0 },
  }
  let succeeded = 0
  let failed = 0
  let refunded = 0
  let grossCents = 0
  let refundedCents = 0
  let feeCents = 0

  for (const p of payments) {
    if (p.status === 'succeeded' || p.status === 'refunded') {
      // a refunded payment was taken first: it belongs in gross and comes off again below
      succeeded += 1
      grossCents += p.amount_cents
      feeCents += p.platform_fee_cents ?? 0
      byKind[p.kind].count += 1
      byKind[p.kind].cents += p.amount_cents
    }
    if (p.status === 'refunded') {
      refunded += 1
      refundedCents += p.amount_cents
    } else if (p.status === 'failed') {
      failed += 1
    }
  }

  return {
    currency: payments[0]?.currency ?? currency,
    succeeded,
    failed,
    refunded,
    grossCents,
    refundedCents,
    netCents: grossCents - refundedCents - feeCents,
    feeCents,
    averageCents: succeeded ? Math.round(grossCents / succeeded) : 0,
    byKind,
  }
}

/** RFC 4180 CSV: quoted where needed, CRLF line ends, UTF-8 BOM for spreadsheets. */
export function toCsv(rows: Record<string, string | number | null | undefined>[], columns: string[]): string {
  const cell = (v: string | number | null | undefined) => {
    const text = v === null || v === undefined ? '' : String(v)
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const lines = [columns.map(cell).join(','), ...rows.map((row) => columns.map((c) => cell(row[c])).join(','))]
  return `﻿${lines.join('\r\n')}\r\n`
}
