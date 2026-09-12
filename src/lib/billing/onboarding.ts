import 'server-only'

import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ClubPaymentAccount, ClubSubscription, Plan } from '@/lib/db/types'

/**
 * Where a club is on the road from "administrator has an account" to "the
 * desk is open":
 *
 *   plan     no paid plan yet — choose one and pay
 *   payouts  plan paid, payout account not yet connected and approved
 *   ready    both done; the admin interface is available
 *
 * Read with the service role because it is consulted from the admin layout
 * on every request and must not depend on which policies the caller has.
 * The rows it reads carry no member data.
 */
export type OnboardingStep = 'plan' | 'payouts' | 'ready'

export interface ClubOnboarding {
  step: OnboardingStep
  subscription: ClubSubscription | null
  plan: Plan | null
  account: ClubPaymentAccount | null
}

export const getClubOnboarding = cache(async (clubId: string): Promise<ClubOnboarding> => {
  const db = createAdminClient()
  const [{ data: subscription }, { data: account }, { data: plans }] = await Promise.all([
    db.from('club_subscriptions').select('*').eq('club_id', clubId).maybeSingle(),
    db.from('club_payment_accounts').select('*').eq('club_id', clubId).maybeSingle(),
    db.from('plans').select('*'),
  ])

  const plan = subscription ? (plans ?? []).find((p) => p.key === subscription.plan_key) ?? null : null

  const paid = subscription?.status === 'active' || subscription?.status === 'past_due'
  const connected = account?.status === 'active'

  return {
    step: !paid ? 'plan' : !connected ? 'payouts' : 'ready',
    subscription: subscription ?? null,
    plan: plan ?? null,
    account: account ?? null,
  }
})

export const listPlans = cache(async (): Promise<Plan[]> => {
  const { data } = await createAdminClient().from('plans').select('*').eq('is_active', true).order('sort_order')
  return data ?? []
})
