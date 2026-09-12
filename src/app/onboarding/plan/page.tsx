import { redirect } from 'next/navigation'
import { Check } from 'lucide-react'
import { requireClubRole } from '@/lib/auth/club-guard'
import { getClubOnboarding, listPlans } from '@/lib/billing/onboarding'
import { planFeatures } from '@/lib/billing/plans'
import { formatMoney } from '@/lib/util/format'
import { Alert } from '@/components/ui'
import { ChoosePlanButton } from './forms'

export const metadata = { title: 'Choose a plan' }
export const dynamic = 'force-dynamic'

/**
 * Step one for a new club's administrator: the three plans. Choosing one
 * opens the payment page; the plan becomes live when the payment service
 * confirms it, and the next step (payouts) opens then.
 */
export default async function ChoosePlanPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams
  const { club } = await requireClubRole('admin')
  const onboarding = await getClubOnboarding(club.id)
  if (onboarding.step === 'payouts') redirect('/onboarding/payouts')
  if (onboarding.step === 'ready') redirect('/admin')

  const plans = await listPlans()
  const pending = onboarding.subscription?.status === 'incomplete'

  return (
    <div className="app-admin min-h-screen">
      <div className="mx-auto max-w-[1100px] px-5 py-10">
        <p className="a-label" style={{ color: 'var(--color-adm-ink-2)' }}>Step 1 of 2 · {club.name}</p>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', margin: '6px 0 0' }}>Choose the club&rsquo;s plan</h1>
        <p className="a-helper" style={{ margin: '6px 0 0', maxWidth: 640, fontSize: 14 }}>
          Billed monthly in US dollars; change or cancel at any time from Club → Plan. Once the payment is confirmed
          you connect the club&rsquo;s payout account, and the desk opens.
        </p>

        {status === 'cancelled' && (
          <div className="mt-4">
            <Alert tone="info">The payment was not completed. Choose a plan to try again.</Alert>
          </div>
        )}
        {pending && status !== 'cancelled' && (
          <div className="mt-4">
            <Alert tone="info">
              A payment for {plans.find((p) => p.key === onboarding.subscription?.plan_key)?.name ?? 'a plan'} was started but not
              confirmed yet. If you completed it, give it a moment and reload; otherwise choose again below.
            </Alert>
          </div>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {plans.map((plan) => {
            const highlight = plan.key === 'ocean'
            return (
              <section
                key={plan.key}
                className="a-card flex flex-col"
                style={{
                  padding: '22px 22px 20px',
                  border: highlight ? '2px solid var(--color-adm-accent)' : '1.5px solid var(--color-adm-line)',
                }}
              >
                {highlight && (
                  <span className="a-label" style={{ color: 'var(--color-adm-accent)', marginBottom: 6 }}>
                    Most clubs
                  </span>
                )}
                <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{plan.name}</h2>
                {plan.tagline && (
                  <p className="a-helper" style={{ margin: '2px 0 0' }}>
                    {plan.tagline}
                  </p>
                )}
                <p style={{ margin: '14px 0 0', fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em' }}>
                  {formatMoney(plan.price_cents, plan.currency, 'en-US')}
                  <span className="a-helper" style={{ fontSize: 13, marginLeft: 6 }}>
                    / month
                  </span>
                </p>
                <ul className="mt-4 flex flex-col gap-2" style={{ fontSize: 13, flex: 1 }}>
                  {planFeatures(plan).map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <Check size={15} style={{ flexShrink: 0, marginTop: 2, color: 'var(--color-adm-accent)' }} />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5">
                  <ChoosePlanButton planKey={plan.key} planName={plan.name} highlight={highlight} />
                </div>
              </section>
            )
          })}
        </div>

        <p className="a-helper" style={{ marginTop: 18, fontSize: 12 }}>
          Prices exclude taxes where they apply. Payment is handled by our payment partner; the platform never sees
          card details. By subscribing the club enters the{' '}
          <a href="/legal/club_agreement" target="_blank" rel="noreferrer" className="underline">
            Club Service Agreement
          </a>
          .
        </p>
      </div>
    </div>
  )
}
