import Link from 'next/link'
import { createUserClient } from '@/lib/supabase/server'
import { listPlans } from '@/lib/billing/onboarding'
import { EmptyRow, PageTitle, Panel } from '@/components/admin/pieces'
import { ClubStatusChip, Stat, Table, Td } from '@/components/platform/pieces'
import { AdmChip } from '@/components/admin/pieces'
import { formatDate, formatMoney } from '@/lib/util/format'
import { PLATFORM_TZ } from '@/lib/platform'

export const metadata = { title: 'Platform finance' }
export const dynamic = 'force-dynamic'

/**
 * The platform's money: what clubs pay for their plans, what the platform
 * earns on their payments, and each club's volume by month. Everything is a
 * subscription row or a monthly aggregate — no payment row, no member.
 */
export default async function PlatformFinancePage() {
  const supabase = await createUserClient()
  const [plans, subsRes, accountsRes, financeRes, clubsRes] = await Promise.all([
    listPlans(),
    supabase.from('club_subscriptions').select('*'),
    supabase.from('club_payment_accounts').select('club_id, status, platform_fee_bps, default_currency'),
    supabase.from('platform_club_finance').select('*').order('month', { ascending: false }).limit(2000),
    supabase.from('clubs').select('id, name, slug, status'),
  ])

  const clubs = clubsRes.data ?? []
  const clubName = new Map(clubs.map((c) => [c.id, c.name]))
  const subs = subsRes.data ?? []
  const accounts = new Map((accountsRes.data ?? []).map((a) => [a.club_id, a]))
  const planByKey = new Map(plans.map((p) => [p.key, p]))
  const finance = financeRes.data ?? []

  const live = subs.filter((s) => s.status === 'active' || s.status === 'past_due')
  const mrr = live.reduce((n, s) => n + (planByKey.get(s.plan_key)?.price_cents ?? 0), 0)
  const perPlan = plans.map((p) => ({ plan: p, count: live.filter((s) => s.plan_key === p.key).length }))

  const thisMonth = new Date().toISOString().slice(0, 7)
  const monthRows = finance.filter((r) => r.month.slice(0, 7) === thisMonth)
  const feesByCurrency = new Map<string, number>()
  const grossByCurrency = new Map<string, number>()
  for (const r of monthRows) {
    feesByCurrency.set(r.currency, (feesByCurrency.get(r.currency) ?? 0) + r.platform_fee_cents)
    grossByCurrency.set(r.currency, (grossByCurrency.get(r.currency) ?? 0) + r.gross_cents)
  }
  const moneyList = (m: Map<string, number>) =>
    m.size === 0 ? '—' : [...m.entries()].map(([cur, cents]) => formatMoney(cents, cur)).join(' + ')

  // per club: last 12 months aggregated
  const twelveMonthsAgo = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10)
  const byClub = new Map<string, { gross: Map<string, number>; fees: Map<string, number>; payments: number }>()
  for (const r of finance) {
    if (r.month < twelveMonthsAgo) continue
    const entry = byClub.get(r.club_id) ?? { gross: new Map(), fees: new Map(), payments: 0 }
    entry.gross.set(r.currency, (entry.gross.get(r.currency) ?? 0) + r.gross_cents)
    entry.fees.set(r.currency, (entry.fees.get(r.currency) ?? 0) + r.platform_fee_cents)
    entry.payments += r.payments_succeeded
    byClub.set(r.club_id, entry)
  }

  return (
    <>
      <PageTitle
        title="Finance"
        sub="Plan revenue and the platform's share of club payments. Club totals only — no individual payment, no member."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Monthly recurring revenue" value={formatMoney(mrr, 'USD', 'en-US')} hint={`${live.length} paying club${live.length === 1 ? '' : 's'}`} />
        <Stat label="Platform fees this month" value={moneyList(feesByCurrency)} hint="from club payments" />
        <Stat label="Club payment volume this month" value={moneyList(grossByCurrency)} hint="taken by all clubs online" />
        <Stat
          label="Overdue plans"
          value={subs.filter((s) => s.status === 'past_due').length}
          tone={subs.some((s) => s.status === 'past_due') ? 'amber' : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Panel title="By plan">
          <Table head={['Plan', 'Clubs', 'MRR']}>
            {perPlan.map(({ plan, count }) => (
              <tr key={plan.key}>
                <Td strong>{plan.name}</Td>
                <Td right>{count}</Td>
                <Td right>{formatMoney(count * plan.price_cents, plan.currency, 'en-US')}</Td>
              </tr>
            ))}
          </Table>
        </Panel>

        <Panel title="Clubs">
          {clubs.length === 0 ? (
            <EmptyRow>No clubs yet.</EmptyRow>
          ) : (
            <Table head={['Club', 'Plan', 'Billing', 'Next invoice', 'Payouts', 'Fee', 'Volume (12 mo)', 'Fees (12 mo)', 'Payments']}>
              {clubs.map((c) => {
                const sub = subs.find((s) => s.club_id === c.id)
                const account = accounts.get(c.id)
                const totals = byClub.get(c.id)
                return (
                  <tr key={c.id}>
                    <Td strong>
                      <Link href={`/platform/clubs/${c.id}`}>{c.name}</Link>
                      <span style={{ display: 'block', marginTop: 2 }}>
                        <ClubStatusChip status={c.status} />
                      </span>
                    </Td>
                    <Td>{sub ? (planByKey.get(sub.plan_key)?.name ?? sub.plan_key) : '—'}</Td>
                    <Td>
                      {sub ? (
                        <AdmChip tone={sub.status === 'active' ? 'green' : sub.status === 'past_due' ? 'amber' : 'neutral'}>{sub.status.replace('_', ' ')}</AdmChip>
                      ) : (
                        <AdmChip tone="neutral">not started</AdmChip>
                      )}
                    </Td>
                    <Td>{sub?.current_period_end ? formatDate(sub.current_period_end, PLATFORM_TZ) : '—'}</Td>
                    <Td>
                      {account ? (
                        <AdmChip tone={account.status === 'active' ? 'green' : account.status === 'restricted' ? 'amber' : 'neutral'}>{account.status}</AdmChip>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td right>{account ? `${account.platform_fee_bps / 100}%` : '—'}</Td>
                    <Td right>{totals ? moneyList(totals.gross) : '—'}</Td>
                    <Td right>{totals ? moneyList(totals.fees) : '—'}</Td>
                    <Td right>{totals?.payments ?? 0}</Td>
                  </tr>
                )
              })}
            </Table>
          )}
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Volume by month" helper="Every club, every month, from the payments they took online.">
          {finance.length === 0 ? (
            <EmptyRow>No online payments yet.</EmptyRow>
          ) : (
            <Table head={['Month', 'Club', 'Currency', 'Payments', 'Gross', 'Refunded', 'Tips', 'Platform fee', 'Failed']}>
              {finance.slice(0, 120).map((r) => (
                <tr key={`${r.club_id}-${r.month}-${r.currency}`}>
                  <Td>{r.month.slice(0, 7)}</Td>
                  <Td strong>{clubName.get(r.club_id) ?? '—'}</Td>
                  <Td>{r.currency}</Td>
                  <Td right>{r.payments_succeeded}</Td>
                  <Td right>{formatMoney(r.gross_cents, r.currency)}</Td>
                  <Td right>{r.refunded_cents ? `−${formatMoney(r.refunded_cents, r.currency)}` : '—'}</Td>
                  <Td right>{r.tips_cents ? formatMoney(r.tips_cents, r.currency) : '—'}</Td>
                  <Td right>{r.platform_fee_cents ? formatMoney(r.platform_fee_cents, r.currency) : '—'}</Td>
                  <Td right>{r.payments_failed || '—'}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      </div>
    </>
  )
}
