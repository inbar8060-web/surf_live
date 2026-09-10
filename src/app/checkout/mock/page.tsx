import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth/session'
import { serverEnv } from '@/lib/env'
import { formatMoney } from '@/lib/util/format'
import { Alert, Card } from '@/components/ui'
import { MockCheckoutForm } from './form'

export const metadata = { title: 'Checkout (test mode)' }
export const dynamic = 'force-dynamic'

export default async function MockCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // The page simply does not exist outside development.
  if (process.env.NODE_ENV === 'production' || serverEnv().PAYMENT_PROVIDER !== 'mock') notFound()

  await requireUser()
  const params = await searchParams

  const one = (key: string) => {
    const value = params[key]
    return typeof value === 'string' ? value : ''
  }

  const paymentId = one('payment')
  const amountCents = Number(one('amount'))
  const currency = one('currency') || 'ILS'

  if (!paymentId || !Number.isFinite(amountCents) || amountCents <= 0) notFound()

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <Card title="Test checkout" description="Standing in for the payment provider while you develop.">
        <div className="space-y-4">
          <Alert tone="info">
            No card is charged. Confirming here posts a signed event to the same webhook the real
            provider would call.
          </Alert>

          <div>
            <p className="muted text-sm">{one('label') || 'Payment'}</p>
            <p className="text-3xl font-semibold tabular-nums">
              {formatMoney(amountCents, currency)}
            </p>
          </div>

          <MockCheckoutForm
            paymentId={paymentId}
            amountCents={amountCents}
            currency={currency}
            next={one('next')}
            cancel={one('cancel')}
          />
        </div>
      </Card>
    </div>
  )
}
