import 'server-only'

import { serverEnv } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ClubPaymentAccount } from '@/lib/db/types'
import { mockProvider } from './mock'
import { stripeProvider } from './stripe'
import type { CheckoutRequest, CheckoutSession, PaymentProvider } from './provider'

export * from './provider'

export function paymentProvider(): PaymentProvider {
  return serverEnv().PAYMENT_PROVIDER === 'stripe' ? stripeProvider : mockProvider
}

export class PayoutsNotReady extends Error {}

/**
 * A member payment always goes through the club's own payout account. This
 * is the one place that looks the account up, refuses when it is not live,
 * and works out the platform's share from the club's fee rate — so a call
 * site cannot charge on the wrong account or forget the fee.
 */
export async function createClubCheckout(
  clubId: string,
  request: Omit<CheckoutRequest, 'connectedAccountId' | 'applicationFeeCents'>,
): Promise<CheckoutSession & { account: ClubPaymentAccount; feeCents: number }> {
  const { data: account } = await createAdminClient()
    .from('club_payment_accounts')
    .select('*')
    .eq('club_id', clubId)
    .maybeSingle()

  if (!account || account.status !== 'active' || !account.charges_enabled) {
    throw new PayoutsNotReady('The club has not finished connecting its payout account.')
  }

  const provider = paymentProvider()
  const feeCents = Math.round((request.amountCents * account.platform_fee_bps) / 10_000)

  const session = await provider.createCheckout({
    ...request,
    connectedAccountId: provider.name === 'stripe' ? account.account_id : null,
    applicationFeeCents: feeCents,
  })

  return { ...session, account, feeCents }
}
