import Link from 'next/link'
import { Download } from 'lucide-react'
import { requireClubRole } from '@/lib/auth/club-guard'
import { createUserClient } from '@/lib/supabase/server'
import { getClubSettings } from '@/lib/db/queries'
import { getClubOnboarding } from '@/lib/billing/onboarding'
import { planAllowsReport, planHasFinance, planHasFullFinance } from '@/lib/billing/plans'
import { resolvePeriod, summarisePayments } from '@/lib/finance/report'
import { AdmChip, AdmStatus, EmptyRow, PageTitle, Panel, SubTabs } from '@/components/admin/pieces'
import { Stat, Table, Td } from '@/components/platform/pieces'
import { adminButton } from '@/components/ui/button-class'
import { formatDateTime, formatMoney } from '@/lib/util/format'
import type { ReportPeriod } from '@/lib/db/types'

export const metadata = { title: 'Finance' }
export const dynamic = 'force-dynamic'

const KIND_LABEL = { reservation: 'Sessions', package: 'Packages', rental: 'Rentals', tip: 'Tips' } as const

/**
 * The club's money, by period. What the plan allows decides how much of it
 * shows: every plan gets the monthly statistics report; Ocean adds quarterly
 * and yearly reports and the payments ledger; Surfing adds the instructor
 * breakdown and export.
 */
export default async function AdminFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; at?: string }>
}) {
  const { period: periodParam, at } = await searchParams
  const { club: tenant } = await requireClubRole('admin')
  const [settings, onboarding] = await Promise.all([getClubSettings(), getClubOnboarding(tenant.id)])
  const plan = onboarding.plan

  const requested = (['monthly', 'quarterly', 'yearly'] as ReportPeriod[]).includes(periodParam as ReportPeriod)
    ? (periodParam as ReportPeriod)
    : 'monthly'
  const period: ReportPeriod = planAllowsReport(plan, requested) ? requested : 'monthly'
  const range = resolvePeriod(period, at, settings.timezone)

  const supabase = await createUserClient()
  const [paymentsRes, reservationsRes, membersRes, slotsRes, tipsRes] = await Promise.all([
    supabase
      .from('payments')
      .select('id, client_id, kind, status, amount_cents, currency, platform_fee_cents, description, succeeded_at, created_at')
      .gte('created_at', range.from)
      .lt('created_at', range.to)
      .order('created_at', { ascending: false })
      .limit(2000),
    supabase.from('reservations').select('id, status, price_cents, slot_id, client_id').gte('created_at', range.from).lt('created_at', range.to),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'client').gte('created_at', range.from).lt('created_at', range.to),
    supabase.from('time_slots').select('id, service_id, status').gte('starts_at', range.from).lt('starts_at', range.to),
    supabase.from('tips').select('instructor_id, amount_cents').gte('created_at', range.from).lt('created_at', range.to),
  ])

  const payments = paymentsRes.data ?? []
  const summary = summarisePayments(payments, settings.currency)
  const reservations = reservationsRes.data ?? []
  const bookedValue = reservations.filter((r) => ['approved', 'completed'].includes(r.status)).reduce((n, r) => n + r.price_cents, 0)
  const slots = slotsRes.data ?? []

  // Bookings by service — the club's "what sells" line.
  const serviceIds = [...new Set(slots.map((s) => s.service_id))]
  const { data: services } = serviceIds.length
    ? await supabase.from('services').select('id, name').in('id', serviceIds)
    : { data: [] }
  const serviceName = new Map((services ?? []).map((s) => [s.id, s.name]))
  const slotService = new Map(slots.map((s) => [s.id, s.service_id]))
  const byService = new Map<string, { bookings: number; cents: number }>()
  for (const r of reservations) {
    if (!['approved', 'completed'].includes(r.status)) continue
    const name = serviceName.get(slotService.get(r.slot_id) ?? '') ?? 'Other'
    const entry = byService.get(name) ?? { bookings: 0, cents: 0 }
    entry.bookings += 1
    entry.cents += r.price_cents
    byService.set(name, entry)
  }

  // Instructor breakdown (full plan): tips received.
  const tipsByInstructor = new Map<string, number>()
  for (const t of tipsRes.data ?? []) tipsByInstructor.set(t.instructor_id, (tipsByInstructor.get(t.instructor_id) ?? 0) + t.amount_cents)
  const instructorIds = [...tipsByInstructor.keys()]
  const { data: instructorNames } = instructorIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', instructorIds)
    : { data: [] }
  const instructorName = new Map((instructorNames ?? []).map((p) => [p.id, p.full_name]))

  const money = (cents: number) => formatMoney(cents, settings.currency)
  const nav = (key: string) => `/admin/finance?period=${period}&at=${key}`

  return (
    <>
      <PageTitle
        title="Finance"
        sub={`${range.label} · in ${settings.currency}, on the club's clock.`}
        actions={
          <>
            <Link href={nav(range.prevKey)} className={adminButton('secondary', 'sm')}>
              ← Previous
            </Link>
            <Link href={nav(range.nextKey)} className={adminButton('secondary', 'sm')}>
              Next →
            </Link>
            {planHasFullFinance(plan) && (
              <a href={`/admin/finance/export?period=${period}&at=${range.key}`} className={adminButton('primary', 'sm')}>
                <Download size={14} style={{ marginRight: 6 }} /> Export CSV
              </a>
            )}
          </>
        }
      />

      <SubTabs
        base="/admin/finance"
        param="period"
        current={period}
        tabs={[
          { key: 'monthly', label: 'Monthly' },
          ...(planAllowsReport(plan, 'quarterly') ? [{ key: 'quarterly', label: 'Quarterly' }] : []),
          ...(planAllowsReport(plan, 'yearly') ? [{ key: 'yearly', label: 'Yearly' }] : []),
        ]}
      />

      {plan && !planAllowsReport(plan, 'quarterly') && (
        <p className="a-helper" style={{ margin: '-8px 0 14px' }}>
          Quarterly and yearly reports, and the payments ledger, come with Ocean Vibes and above —{' '}
          <Link href="/admin/club?tab=plan" className="underline">
            see plans
          </Link>
          .
        </p>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Taken online" value={money(summary.grossCents)} hint={`${summary.succeeded} payment${summary.succeeded === 1 ? '' : 's'}`} />
        <Stat label="Net to the club" value={money(summary.netCents)} hint={`after ${money(summary.refundedCents)} refunds and ${money(summary.feeCents)} platform fees`} />
        <Stat label="Booked value" value={money(bookedValue)} hint={`${reservations.filter((r) => ['approved', 'completed'].includes(r.status)).length} approved bookings`} />
        <Stat label="New members" value={membersRes.count ?? 0} hint={`${slots.length} sessions scheduled`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="By what was paid for">
          <Table head={['Kind', 'Payments', 'Amount']}>
            {(Object.keys(summary.byKind) as (keyof typeof KIND_LABEL)[]).map((kind) => (
              <tr key={kind}>
                <Td strong>{KIND_LABEL[kind]}</Td>
                <Td right>{summary.byKind[kind].count}</Td>
                <Td right>{money(summary.byKind[kind].cents)}</Td>
              </tr>
            ))}
            <tr>
              <Td strong>Refunded</Td>
              <Td right>{summary.refunded}</Td>
              <Td right>−{money(summary.refundedCents)}</Td>
            </tr>
            <tr>
              <Td strong>Failed</Td>
              <Td right>{summary.failed}</Td>
              <Td right>—</Td>
            </tr>
          </Table>
        </Panel>

        <Panel title="What sells" helper="Approved and attended bookings by service, at the price booked.">
          {byService.size === 0 ? (
            <EmptyRow>No approved bookings in this period.</EmptyRow>
          ) : (
            <Table head={['Service', 'Bookings', 'Value']}>
              {[...byService.entries()]
                .sort((a, b) => b[1].cents - a[1].cents)
                .map(([name, v]) => (
                  <tr key={name}>
                    <Td strong>{name}</Td>
                    <Td right>{v.bookings}</Td>
                    <Td right>{money(v.cents)}</Td>
                  </tr>
                ))}
            </Table>
          )}
        </Panel>

        {planHasFullFinance(plan) && (
          <Panel title="Instructors" helper="Tips members left through the platform, per instructor.">
            {tipsByInstructor.size === 0 ? (
              <EmptyRow>No tips in this period.</EmptyRow>
            ) : (
              <Table head={['Instructor', 'Tips']}>
                {[...tipsByInstructor.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([id, cents]) => (
                    <tr key={id}>
                      <Td strong>{instructorName.get(id) ?? 'Instructor'}</Td>
                      <Td right>{money(cents)}</Td>
                    </tr>
                  ))}
              </Table>
            )}
          </Panel>
        )}

        {planHasFinance(plan) && (
          <Panel title="Payments ledger" className="lg:col-span-2" helper="Every online payment in the period. Member details stay on the People screen.">
            {payments.length === 0 ? (
              <EmptyRow>No payments in this period.</EmptyRow>
            ) : (
              <Table head={['When', 'Kind', 'Description', 'Status', 'Amount', 'Platform fee']}>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <Td>{formatDateTime(p.succeeded_at ?? p.created_at, settings.timezone)}</Td>
                    <Td>
                      <AdmChip>{KIND_LABEL[p.kind]}</AdmChip>
                    </Td>
                    <Td>{p.description ?? '—'}</Td>
                    <Td>
                      <AdmStatus status={p.status} />
                    </Td>
                    <Td right strong>
                      {formatMoney(p.amount_cents, p.currency)}
                    </Td>
                    <Td right>{p.platform_fee_cents ? formatMoney(p.platform_fee_cents, p.currency) : '—'}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>
        )}
      </div>
    </>
  )
}
