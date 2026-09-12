import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CircleCheck, CircleDashed, Landmark, ShieldCheck } from 'lucide-react'
import { requireClubRole } from '@/lib/auth/club-guard'
import { getClubOnboarding } from '@/lib/billing/onboarding'
import { AdmChip } from '@/components/admin/pieces'
import { adminButton } from '@/components/ui/button-class'
import { Alert } from '@/components/ui'
import { ConnectPayoutsButton, RefreshPayoutsButton } from './forms'

export const metadata = { title: 'Connect payouts' }
export const dynamic = 'force-dynamic'

/**
 * Step two: the club's own payout account. The provider hosts the whole
 * thing — identity, bank account, tax details. We keep the account id and
 * mirror its state; the desk opens when charges and payouts are both on.
 */
export default async function ConnectPayoutsPage({ searchParams }: { searchParams: Promise<{ status?: string; plan?: string }> }) {
  const { status, plan } = await searchParams
  const { club } = await requireClubRole('admin')
  const onboarding = await getClubOnboarding(club.id)
  if (onboarding.step === 'plan') redirect('/onboarding/plan')

  const account = onboarding.account
  const ready = onboarding.step === 'ready'

  return (
    <div className="app-admin min-h-screen">
      <div className="mx-auto max-w-[760px] px-5 py-10">
        <p className="a-label" style={{ color: 'var(--color-adm-ink-2)' }}>Step 2 of 2 · {club.name}</p>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', margin: '6px 0 0' }}>Connect the club&rsquo;s payouts</h1>
        <p className="a-helper" style={{ margin: '6px 0 0', fontSize: 14 }}>
          Members pay the club directly. Our payment partner opens an account in the club&rsquo;s name, verifies it,
          and pays out to the club&rsquo;s bank. The platform never holds the money and never sees the bank details.
        </p>

        {plan === 'paid' && !ready && (
          <div className="mt-4">
            <Alert tone="success">
              Plan confirmed — {onboarding.plan?.name ?? 'your plan'} is live. One step left.
            </Alert>
          </div>
        )}
        {status === 'refresh' && (
          <div className="mt-4">
            <Alert tone="info">The onboarding link expired. Continue below to open a fresh one.</Alert>
          </div>
        )}

        <section className="a-card mt-6" style={{ padding: 22 }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2" style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
              <Landmark size={18} /> Payout account
            </h2>
            {account && (
              <AdmChip tone={account.status === 'active' ? 'green' : account.status === 'restricted' ? 'amber' : 'neutral'}>
                {account.status === 'active' ? 'Connected' : account.status === 'restricted' ? 'Needs attention' : 'Not finished'}
              </AdmChip>
            )}
          </div>

          <ul className="mt-4 flex flex-col gap-2" style={{ fontSize: 13 }}>
            <li className="flex items-center gap-2">
              {account ? <CircleCheck size={16} color="var(--color-adm-accent)" /> : <CircleDashed size={16} />} Account opened
            </li>
            <li className="flex items-center gap-2">
              {account?.details_submitted ? <CircleCheck size={16} color="var(--color-adm-accent)" /> : <CircleDashed size={16} />} Business and bank details
              submitted
            </li>
            <li className="flex items-center gap-2">
              {account?.charges_enabled ? <CircleCheck size={16} color="var(--color-adm-accent)" /> : <CircleDashed size={16} />} Approved to take
              payments
            </li>
            <li className="flex items-center gap-2">
              {account?.payouts_enabled ? <CircleCheck size={16} color="var(--color-adm-accent)" /> : <CircleDashed size={16} />} Approved for payouts
            </li>
          </ul>

          {account && account.requirements_due.length > 0 && (
            <p className="a-helper" style={{ marginTop: 10 }}>
              Still needed by the payment partner: {account.requirements_due.join(', ').replace(/_/g, ' ')}.
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            {ready ? (
              <Link href="/admin" className={adminButton('primary')}>
                Open the desk
              </Link>
            ) : (
              <>
                <ConnectPayoutsButton resume={Boolean(account)} />
                {account && <RefreshPayoutsButton />}
              </>
            )}
          </div>
        </section>

        <p className="mt-5 flex items-start gap-2 a-helper" style={{ fontSize: 12 }}>
          <ShieldCheck size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Verification usually completes in minutes; some countries need a document check that takes a day or two.
            The desk opens automatically once both approvals are in — reload this page or use Refresh.
          </span>
        </p>
      </div>
    </div>
  )
}
