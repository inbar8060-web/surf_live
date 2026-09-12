import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth/session'
import { serverEnv } from '@/lib/env'
import { Alert, Card } from '@/components/ui'
import { MockConnectForm } from './form'

export const metadata = { title: 'Payout onboarding (test mode)' }
export const dynamic = 'force-dynamic'

/** Stands in for the payment partner's hosted onboarding while developing. */
export default async function MockConnectPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production' || serverEnv().PAYMENT_PROVIDER !== 'mock') notFound()
  const user = await requireRole('admin')
  const params = await searchParams
  const one = (key: string) => (typeof params[key] === 'string' ? (params[key] as string) : '')
  const account = one('account')
  if (!account || one('club') !== user.profile.club_id) notFound()

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <Card title="Test payout onboarding" description="Standing in for the payment partner's verification pages.">
        <div className="space-y-4">
          <Alert tone="info">
            In production this is the partner&rsquo;s own hosted flow: business details, identity, bank account. Here you
            choose the outcome, and a signed event reaches the same webhook.
          </Alert>
          <p className="muted text-sm">Account {account}</p>
          <MockConnectForm accountId={account} next={one('next')} />
        </div>
      </Card>
    </div>
  )
}
