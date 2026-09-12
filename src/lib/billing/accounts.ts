import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { recordPlatformAudit } from '@/lib/audit'
import type { ConnectAccountState } from '@/lib/payments/provider'
import type { PayoutAccountStatus } from '@/lib/db/types'

/**
 * Write a payout account's state as the provider reports it. Used by the
 * webhook and by the "refresh" button alike, so both agree on what "active"
 * means: charges and payouts both enabled.
 */
export async function applyAccountState(state: ConnectAccountState): Promise<{ clubId: string; status: PayoutAccountStatus } | null> {
  const db = createAdminClient()
  const { data: account } = await db
    .from('club_payment_accounts')
    .select('club_id, status')
    .eq('account_id', state.accountId)
    .maybeSingle()
  if (!account) return null

  const status: PayoutAccountStatus =
    account.status === 'disabled'
      ? 'disabled'
      : state.chargesEnabled && state.payoutsEnabled
        ? 'active'
        : state.detailsSubmitted
          ? 'restricted'
          : 'onboarding'

  await db
    .from('club_payment_accounts')
    .update({
      charges_enabled: state.chargesEnabled,
      payouts_enabled: state.payoutsEnabled,
      details_submitted: state.detailsSubmitted,
      requirements_due: state.requirementsDue,
      ...(state.country ? { country: state.country } : {}),
      ...(state.defaultCurrency ? { default_currency: state.defaultCurrency } : {}),
      status,
    })
    .eq('club_id', account.club_id)

  await recordPlatformAudit({
    actorId: null,
    action: 'payouts.account_updated',
    clubId: account.club_id,
    detail: { status, requirements_due: state.requirementsDue.length },
  })

  return { clubId: account.club_id, status }
}
