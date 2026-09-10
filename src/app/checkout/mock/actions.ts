'use server'

import { redirect } from 'next/navigation'
import { publicEnv, serverEnv } from '@/lib/env'
import { signMockPayload } from '@/lib/payments/mock'
import { assertRole } from '@/lib/auth/session'
import { assertSameOrigin, fail, type ActionResult } from '@/lib/actions/result'
import { str } from '@/lib/actions/form'

/**
 * Development-only stand-in for the payment provider's hosted page.
 *
 * It posts a properly signed event to the real webhook route rather than
 * writing to the database itself, so the production confirmation path — the
 * only path that can mark a payment as paid — is what gets exercised in
 * testing too.
 */
export async function completeMockPaymentAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (process.env.NODE_ENV === 'production') return fail('Not available.')
  if (!(await assertSameOrigin())) return fail('Request blocked.')

  const user = await assertRole('client', 'admin')
  if (!user) return fail('Please sign in again.')

  const env = serverEnv()
  if (env.PAYMENT_PROVIDER !== 'mock') return fail('The mock checkout is switched off.')

  const outcome = str(formData, 'outcome') === 'failed' ? 'failed' : 'succeeded'
  const payload = JSON.stringify({
    type: outcome,
    paymentId: str(formData, 'paymentId'),
    amountCents: Number(str(formData, 'amountCents')),
    currency: str(formData, 'currency'),
  })

  const response = await fetch(
    `${publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}/api/webhooks/payments`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-payment-signature': signMockPayload(payload),
      },
      body: payload,
      cache: 'no-store',
    },
  )

  if (!response.ok) return fail('The simulated payment could not be confirmed.')

  const next = str(formData, 'next')
  redirect(/^\/(?!\/)/.test(next) ? next : '/client/payments?status=done')
}
