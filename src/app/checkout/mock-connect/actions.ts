'use server'

import { redirect } from 'next/navigation'
import { publicEnv, serverEnv } from '@/lib/env'
import { signMockPayload } from '@/lib/payments/mock'
import { assertRole } from '@/lib/auth/session'
import { createUserClient } from '@/lib/supabase/server'
import { assertSameOrigin, fail, type ActionResult } from '@/lib/actions/result'
import { str } from '@/lib/actions/form'
import { safeInternalPath } from '@/lib/util/safe-path'

/** Posts a signed account event, exactly as the partner's webhook would. */
export async function completeMockConnectAction(_prev: ActionResult<null> | null, formData: FormData): Promise<ActionResult<null>> {
  if (process.env.NODE_ENV === 'production') return fail('Not available.')
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const user = await assertRole('admin')
  if (!user) return fail('Please sign in again.')
  if (serverEnv().PAYMENT_PROVIDER !== 'mock') return fail('The mock onboarding is switched off.')

  const accountId = str(formData, 'accountId')
  const { data: own } = await (await createUserClient())
    .from('club_payment_accounts')
    .select('account_id')
    .eq('account_id', accountId)
    .maybeSingle()
  if (!own) return fail('That account is not yours to confirm.')

  const approved = str(formData, 'outcome') === 'approved'
  const payload = JSON.stringify({
    kind: 'account',
    accountId,
    chargesEnabled: approved,
    payoutsEnabled: approved,
    country: 'IL',
    currency: 'ILS',
  })
  const response = await fetch(`${publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}/api/webhooks/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-payment-signature': signMockPayload(payload) },
    body: payload,
    cache: 'no-store',
  })
  if (!response.ok) return fail('The simulated onboarding could not be confirmed.')

  redirect(safeInternalPath(str(formData, 'next'), '/onboarding/payouts?status=returned'))
}
