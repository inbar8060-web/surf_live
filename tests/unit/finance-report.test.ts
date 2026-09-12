import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolvePeriod, summarisePayments, toCsv } from '../../src/lib/finance/report.ts'

const now = new Date('2026-09-12T10:00:00Z')

test('resolvePeriod builds month, quarter and year ranges in the club zone', () => {
  const month = resolvePeriod('monthly', undefined, 'Asia/Jerusalem', now)
  assert.equal(month.key, '2026-09')
  assert.equal(month.label, 'September 2026')
  assert.equal(month.from, '2026-08-31T21:00:00.000Z') // midnight Israel, UTC+3
  assert.equal(month.prevKey, '2026-08')
  assert.equal(month.nextKey, '2026-10')

  const q = resolvePeriod('quarterly', '2026-Q4', 'UTC', now)
  assert.equal(q.from, '2026-10-01T00:00:00.000Z')
  assert.equal(q.to, '2027-01-01T00:00:00.000Z')
  assert.equal(q.nextKey, '2027-Q1')

  const y = resolvePeriod('yearly', 'garbage', 'UTC', now)
  assert.equal(y.key, '2026')
  assert.equal(y.to, '2027-01-01T00:00:00.000Z')
})

test('summarisePayments counts only what actually happened', () => {
  const s = summarisePayments(
    [
      { kind: 'tip', status: 'succeeded', amount_cents: 1000, platform_fee_cents: 50, currency: 'ILS' },
      { kind: 'reservation', status: 'succeeded', amount_cents: 18000, platform_fee_cents: 900, currency: 'ILS' },
      { kind: 'reservation', status: 'refunded', amount_cents: 18000, currency: 'ILS' },
      { kind: 'package', status: 'failed', amount_cents: 80000, currency: 'ILS' },
      { kind: 'rental', status: 'pending', amount_cents: 12000, currency: 'ILS' },
    ],
  )
  // three payments were taken (one later refunded): gross counts all three,
  // the refund comes off once, fees stay with the platform
  assert.equal(s.succeeded, 3)
  assert.equal(s.grossCents, 37000)
  assert.equal(s.refundedCents, 18000)
  assert.equal(s.feeCents, 950)
  assert.equal(s.netCents, 37000 - 18000 - 950)
  assert.equal(s.averageCents, Math.round(37000 / 3))
  assert.equal(s.failed, 1)
  assert.deepEqual(s.byKind.tip, { count: 1, cents: 1000 })
})

test('toCsv quotes what needs quoting', () => {
  const csv = toCsv([{ a: 'x,y', b: 'say "hi"', c: 3 }], ['a', 'b', 'c'])
  assert.equal(csv, '﻿a,b,c\r\n"x,y","say ""hi""",3\r\n')
})

test('a single refunded payment nets to zero, not to minus the refund', () => {
  const s = summarisePayments([{ kind: 'reservation', status: 'refunded', amount_cents: 18000, currency: 'ILS' }])
  assert.equal(s.grossCents, 18000)
  assert.equal(s.netCents, 0)
})
