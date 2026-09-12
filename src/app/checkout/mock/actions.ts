'use server'

import { redirect } from 'next/navigation'
import { publicEnv, serverEnv } from '@/lib/env'
import { signMockPayload } from '@/lib/payments/mock'
import { assertRole } from '@/lib/auth/session'
import { createUserClient } from '@/lib/supabase/server'
import { assertSameOrigin, fail, type ActionResult } from '@/lib/actions/result'
import { str } from '@/lib/actions/form'
import { safeInternalPath } from '@/lib/util/safe-path'

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

  // Even a stand-in must not let one member settle another member's invoice.
  // RLS lets a member read only their own payments, so a foreign id comes
  // back empty; an administrator can see any.
  const paymentId = str(formData, 'paymentId')
  const { data: own } = await (await createUserClient())
    .from('payments')
    .select('id')
    .eq('id', paymentId)
    .maybeSingle()
  if (!own) return fail('That payment is not yours to confirm.')

  const outcome = str(formData, 'outcome') === 'failed' ? 'failed' : 'succeeded'
  const payload = JSON.stringify({
    kind: 'payment',
    type: outcome,
    paymentId,
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

  redirect(safeInternalPath(str(formData, 'next'), '/client/payments?status=done'))
}

/** The subscription twin: activates the club's plan through the webhook. */
export async function completeMockSubscriptionAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (process.env.NODE_ENV === 'production') return fail('Not available.')
  if (!(await assertSameOrigin())) return fail('Request blocked.')

  const user = await assertRole('admin')
  if (!user) return fail('Please sign in again.')
  if (serverEnv().PAYMENT_PROVIDER !== 'mock') return fail('The mock checkout is switched off.')

  // RLS: an administrator reads only their own club's subscription row.
  const subscriptionId = str(formData, 'subscriptionId')
  const { data: own } = await (await createUserClient())
    .from('club_subscriptions')
    .select('id, plan_key')
    .eq('id', subscriptionId)
    .maybeSingle()
  if (!own) return fail('That subscription is not yours to confirm.')

  const payload = JSON.stringify({
    kind: 'subscription',
    type: 'activated',
    subscriptionId,
    planKey: str(formData, 'planKey') || own.plan_key,
  })
  const response = await postSignedWebhook(payload)
  if (!response.ok) return fail('The simulated subscription could not be confirmed.')

  redirect(safeInternalPath(str(formData, 'next'), '/onboarding/payouts?plan=paid'))
}

async function postSignedWebhook(payload: string): Promise<Response> {
  return fetch(`${publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}/api/webhooks/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-payment-signature': signMockPayload(payload) },
    body: payload,
    cache: 'no-store',
  })
}
