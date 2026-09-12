import { createUserClient } from '@/lib/supabase/server'
import { getClubOnboarding, listPlans } from '@/lib/billing/onboarding'
import { planFeatures, usage } from '@/lib/billing/plans'
import { AdmChip, Panel } from '@/components/admin/pieces'
import { formatDate, formatMoney } from '@/lib/util/format'
import { OpenPayoutDashboardButton, RefreshPayoutsButton } from '@/app/onboarding/payouts/forms'
import { CancelPlanForm, ChangePlanButton } from './plan-forms'

/** Club → Plan: what the club is on, how much of it is used, and the other plans. */
export async function PlanPanel({ clubId, timeZone }: { clubId: string; timeZone: string }) {
  const [onboarding, plans, usageRes] = await Promise.all([
    getClubOnboarding(clubId),
    listPlans(),
    (await createUserClient()).rpc('club_plan_usage'),
  ])
  const plan = onboarding.plan
  const sub = onboarding.subscription
  const use = usageRes.data?.[0]
  const account = onboarding.account

  const bars = plan && use
    ? [
        { label: 'Instructors', ...usage(use.instructors, plan.max_instructors) },
        { label: 'New members this month', ...usage(use.new_clients_this_month, plan.max_new_clients_per_month) },
        { label: 'Payments this month', ...usage(use.payments_this_month, plan.max_payments_per_month) },
      ]
    : []

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-4">
        <Panel
          title={plan ? plan.name : 'No plan'}
          action={
            sub && (
              <AdmChip tone={sub.status === 'active' ? 'green' : sub.status === 'past_due' ? 'amber' : 'neutral'}>
                {sub.status === 'active' ? 'Active' : sub.status === 'past_due' ? 'Payment overdue' : sub.status}
              </AdmChip>
            )
          }
        >
          {plan && sub ? (
            <>
              <p style={{ fontSize: 13, margin: '0 0 12px' }}>
                {formatMoney(plan.price_cents, plan.currency, 'en-US')} a month
                {sub.current_period_end && <> · next invoice {formatDate(sub.current_period_end, timeZone)}</>}
                {sub.status === 'past_due' && (
                  <span style={{ color: 'var(--color-adm-amber-ink)', fontWeight: 700 }}> · the last payment failed; update the card at the payment service</span>
                )}
              </p>
              <ul className="flex flex-col gap-2.5">
                {bars.map((bar) => (
                  <li key={bar.label} style={{ fontSize: 13 }}>
                    <div className="flex justify-between">
                      <span style={{ fontWeight: 700 }}>{bar.label}</span>
                      <span style={{ color: bar.atLimit ? 'var(--color-adm-rose-ink)' : 'var(--color-adm-ink-2)', fontWeight: 700 }}>
                        {bar.used}
                        {bar.limit !== null ? ` / ${bar.limit}` : ' · unlimited'}
                      </span>
                    </div>
                    {bar.pct !== null && (
                      <span aria-hidden style={{ display: 'block', height: 6, borderRadius: 3, background: 'var(--color-adm-rule)', marginTop: 4 }}>
                        <span
                          style={{
                            display: 'block',
                            height: '100%',
                            width: `${bar.pct}%`,
                            borderRadius: 3,
                            background: bar.atLimit ? 'var(--color-adm-rose-ink)' : bar.pct > 80 ? 'var(--color-adm-amber-ink)' : 'var(--color-adm-accent)',
                          }}
                        />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="a-helper" style={{ margin: 0 }}>
              The club has no live plan.
            </p>
          )}
        </Panel>

        <Panel title="Other plans" helper="Upgrades apply at once and are prorated. A downgrade must fit within the lower plan's limits.">
          <div className="grid gap-3 sm:grid-cols-3">
            {plans.map((p) => (
              <div key={p.key} className="a-card" style={{ padding: 14, border: p.key === plan?.key ? '2px solid var(--color-adm-accent)' : '1.5px solid var(--color-adm-line)' }}>
                <p style={{ fontWeight: 800, margin: 0 }}>{p.name}</p>
                <p style={{ fontSize: 20, fontWeight: 800, margin: '2px 0 8px' }}>
                  {formatMoney(p.price_cents, p.currency, 'en-US')}
                  <span className="a-helper" style={{ fontSize: 11 }}>
                    {' '}
                    / mo
                  </span>
                </p>
                <ul className="a-helper" style={{ margin: '0 0 10px', paddingLeft: 16 }}>
                  {planFeatures(p).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {p.key !== plan?.key && <ChangePlanButton planKey={p.key} planName={p.name} />}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        <Panel
          title="Payouts"
          action={
            account && (
              <AdmChip tone={account.status === 'active' ? 'green' : account.status === 'restricted' ? 'amber' : 'neutral'}>
                {account.status === 'active' ? 'Connected' : account.status}
              </AdmChip>
            )
          }
        >
          {account ? (
            <>
              <p className="a-helper" style={{ margin: '0 0 10px' }}>
                {account.provider === 'stripe_connect' ? 'Stripe' : 'Test'} account {account.account_id}
                {account.default_currency && <> · payouts in {account.default_currency}</>}
                {account.platform_fee_bps > 0 && <> · platform fee {account.platform_fee_bps / 100}% per payment</>}
              </p>
              {account.requirements_due.length > 0 && (
                <p className="a-helper" style={{ margin: '0 0 10px', color: 'var(--color-adm-amber-ink)' }}>
                  Still needed: {account.requirements_due.join(', ').replace(/_/g, ' ')}.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <RefreshPayoutsButton />
                <OpenPayoutDashboardButton />
              </div>
            </>
          ) : (
            <p className="a-helper" style={{ margin: 0 }}>
              No payout account yet.
            </p>
          )}
        </Panel>

        {sub && sub.status !== 'canceled' && (
          <Panel title="Cancel the plan" tone="rose">
            <CancelPlanForm />
          </Panel>
        )}
      </div>
    </div>
  )
}
