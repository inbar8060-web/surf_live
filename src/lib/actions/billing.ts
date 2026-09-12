'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertRole, clubIdOf } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { requestClubUrl } from '@/lib/tenant'
import { paymentProvider } from '@/lib/payments'
import { applyAccountState } from '@/lib/billing/accounts'
import { getClubOnboarding, listPlans } from '@/lib/billing/onboarding'
import { recordPlatformAudit } from '@/lib/audit'
import { rateLimit } from '@/lib/util/rate-limit'
import type { PlanKey } from '@/lib/db/types'
import { assertSameOrigin, fail, failDb, fromZod, ok, type ActionResult } from './result'
import { str } from './form'

/**
 * Billing: the club's plan, and the club's payout account.
 *
 * Nothing here marks anything as paid or connected. These actions open the
 * provider's hosted pages and record that they were opened; the webhook is
 * what changes state. The one exception is "refresh", which asks the
 * provider for the account's state directly — same data, same writer.
 */

const DENIED = 'You are not allowed to do that.'
const planKeySchema = z.enum(['beach', 'ocean', 'surfing'])


/* --------------------------------------------------------------- the plan */

/** Choose a plan and go to pay for it. */
export async function startPlanCheckoutAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)
  const clubId = clubIdOf(admin)

  const parsed = planKeySchema.safeParse(str(formData, 'planKey'))
  if (!parsed.success) return fail('Plan: choose one of the three plans.', { planKey: 'Choose a plan' })

  const limit = await rateLimit(`plan:checkout:${clubId}`, 10, 60 * 60_000)
  if (!limit.ok) return fail('Too many checkout attempts. Please wait a few minutes.')

  const plan = (await listPlans()).find((p) => p.key === parsed.data)
  if (!plan) return fail('Plan: that plan is not available.')

  const onboarding = await getClubOnboarding(clubId)
  if (onboarding.subscription && ['active', 'past_due'].includes(onboarding.subscription.status)) {
    return fail('The club already has a live plan. Change it under Club → Plan.')
  }

  const db = createAdminClient()
  const { data: subscription, error } = await db
    .from('club_subscriptions')
    .upsert(
      {
        club_id: clubId,
        plan_key: plan.key,
        status: 'incomplete',
        provider: paymentProvider().name,
        created_by: admin.id,
      },
      { onConflict: 'club_id' },
    )
    .select('*')
    .single()
  if (error || !subscription) return failDb(error, 'Could not start the subscription.')

  const [settings, base] = await Promise.all([getClubSettings(), requestClubUrl('')])

  let url: string
  try {
    const session = await paymentProvider().createSubscriptionCheckout({
      subscriptionId: subscription.id,
      // a new attempt every time the row is (re)written, so a cancelled and
      // re-chosen plan is a new checkout at the provider, not a replay
      attempt: String(new Date(subscription.updated_at).getTime()),
      clubId,
      clubName: settings.club_name,
      planKey: plan.key,
      planName: plan.name,
      priceCents: plan.price_cents,
      currency: plan.currency,
      customerEmail: admin.email,
      existingCustomerId: subscription.provider_customer_id,
      successUrl: `${base}/onboarding/payouts?plan=paid`,
      cancelUrl: `${base}/onboarding/plan?status=cancelled`,
    })
    await db.from('club_subscriptions').update({ provider_checkout_ref: session.reference }).eq('id', subscription.id)
    url = session.url
  } catch (cause) {
    console.error('[billing] subscription checkout failed', cause)
    return fail('Plan: the payment service could not open a checkout right now. Please try again shortly.')
  }

  await recordPlatformAudit({ actorId: admin.id, action: 'subscription.checkout_started', clubId: clubId, detail: { plan: plan.key } })
  redirect(url)
}

/** Move a live subscription to another plan. */
export async function changePlanAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)
  const clubId = clubIdOf(admin)

  const parsed = planKeySchema.safeParse(str(formData, 'planKey'))
  if (!parsed.success) return fail('Plan: choose one of the three plans.', { planKey: 'Choose a plan' })

  const onboarding = await getClubOnboarding(clubId)
  const current = onboarding.subscription
  if (!current || !['active', 'past_due'].includes(current.status) || !current.provider_subscription_id) {
    return fail('Plan: there is no live plan to change. Choose a plan first.')
  }
  if (current.plan_key === parsed.data) return ok(null, 'The club is already on that plan.')

  const plan = (await listPlans()).find((p) => p.key === parsed.data)
  if (!plan) return fail('Plan: that plan is not available.')

  // A downgrade must fit: the database would refuse the next instructor or
  // payment, but a club should not be moved into a plan it already exceeds.
  const supabase = await createUserClient()
  const { data: usageRows } = await supabase.rpc('club_plan_usage')
  const use = usageRows?.[0]
  if (use) {
    if (plan.max_instructors !== null && use.instructors > plan.max_instructors) {
      return fail(`Plan: ${plan.name} allows ${plan.max_instructors} instructors and the club has ${use.instructors}. Deactivate some first, or keep the current plan.`)
    }
    if (plan.max_new_clients_per_month !== null && use.new_clients_this_month > plan.max_new_clients_per_month) {
      return fail(`Plan: ${plan.name} allows ${plan.max_new_clients_per_month} new members a month and the club has already added ${use.new_clients_this_month} this month.`)
    }
    if (plan.max_payments_per_month !== null && use.payments_this_month > plan.max_payments_per_month) {
      return fail(`Plan: ${plan.name} allows ${plan.max_payments_per_month} payments a month and the club has already taken ${use.payments_this_month} this month.`)
    }
  }

  let periodEnd: string | null = null
  try {
    periodEnd = (
      await paymentProvider().changeSubscriptionPlan(current.provider_subscription_id, {
        key: plan.key,
        name: plan.name,
        priceCents: plan.price_cents,
        currency: plan.currency,
      })
    ).periodEnd
  } catch (cause) {
    console.error('[billing] plan change failed', cause)
    return fail('Plan: the payment service could not change the plan right now. Please try again shortly.')
  }

  const { error } = await createAdminClient()
    .from('club_subscriptions')
    .update({ plan_key: plan.key, ...(periodEnd ? { current_period_end: periodEnd } : {}) })
    .eq('id', current.id)
  if (error) return failDb(error, 'Could not record the plan change.')

  await recordPlatformAudit({ actorId: admin.id, action: 'subscription.plan_changed', clubId: clubId, detail: { from: current.plan_key, to: plan.key } })
  revalidatePath('/admin', 'layout')
  return ok(null, `The club is now on ${plan.name}. The difference is prorated on the next invoice.`)
}

export async function cancelPlanAction(_prev: ActionResult<null> | null, formData: FormData): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)
  const clubId = clubIdOf(admin)
  if (str(formData, 'confirm') !== 'CANCEL') return fail('Type CANCEL to confirm.', { confirm: 'Type CANCEL' })

  const onboarding = await getClubOnboarding(clubId)
  const current = onboarding.subscription
  if (!current || current.status === 'canceled') return fail('There is no live plan to cancel.')
  if (current.canceled_at) return fail('The plan is already set to end at the close of the paid period.')

  // Cancellation is scheduled for the end of the paid period, not now: the
  // club keeps what it paid for, and the provider's "deleted" event at period
  // end is what finally closes the desk.
  try {
    if (current.provider_subscription_id) await paymentProvider().cancelSubscription(current.provider_subscription_id)
  } catch (cause) {
    console.error('[billing] cancel failed', cause)
    return fail('The payment service could not cancel the plan right now.')
  }

  await createAdminClient().from('club_subscriptions').update({ canceled_at: new Date().toISOString() }).eq('id', current.id)
  await recordPlatformAudit({ actorId: admin.id, action: 'subscription.cancel_scheduled', clubId, detail: { plan: current.plan_key, period_end: current.current_period_end } })
  revalidatePath('/admin', 'layout')
  return ok(
    null,
    current.current_period_end
      ? `The plan ends on ${new Date(current.current_period_end).toLocaleDateString('en-GB')}. The desk stays open until then.`
      : 'The plan will end at the close of the current paid period. The desk stays open until then.',
  )
}

/* ------------------------------------------------------------- payouts */

/** Open (or resume) the provider's hosted payout onboarding. */
export async function startPayoutOnboardingAction(): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)
  const clubId = clubIdOf(admin)

  const onboarding = await getClubOnboarding(clubId)
  if (onboarding.step === 'plan') return fail('Choose and pay for a plan before connecting payouts.')

  const [settings, base] = await Promise.all([getClubSettings(), requestClubUrl('')])
  const provider = paymentProvider()

  let result: { accountId: string; url: string }
  try {
    result = await provider.createConnectOnboarding({
      clubId,
      clubName: settings.club_name,
      email: admin.email ?? '',
      existingAccountId: onboarding.account?.account_id ?? null,
      refreshUrl: `${base}/onboarding/payouts?status=refresh`,
      returnUrl: `${base}/onboarding/payouts?status=returned`,
    })
  } catch (cause) {
    console.error('[billing] connect onboarding failed', cause)
    return fail('Payouts: the payment service could not open onboarding right now. Please try again shortly.')
  }

  if (!onboarding.account) {
    const { error } = await createAdminClient().from('club_payment_accounts').insert({
      club_id: clubId,
      provider: provider.name === 'stripe' ? 'stripe_connect' : 'mock',
      account_id: result.accountId,
      status: 'onboarding',
    })
    if (error) return failDb(error, 'Could not record the payout account.')
  }

  await recordPlatformAudit({ actorId: admin.id, action: 'payouts.onboarding_started', clubId: clubId, detail: undefined })
  redirect(result.url)
}

/** Ask the provider how the account stands now. */
export async function refreshPayoutStatusAction(): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const onboarding = await getClubOnboarding(clubIdOf(admin))
  if (!onboarding.account) return fail('Payouts: nothing to refresh — the club has not started connecting an account.')

  try {
    const state = await paymentProvider().fetchConnectAccount(onboarding.account.account_id)
    if (state) await applyAccountState(state)
  } catch (cause) {
    console.error('[billing] refresh failed', cause)
    return fail('Payouts: the payment service did not answer. Try again in a moment.')
  }

  revalidatePath('/onboarding/payouts')
  revalidatePath('/admin', 'layout')
  return ok(null, 'Payout status refreshed.')
}

export async function openPayoutDashboardAction(): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const onboarding = await getClubOnboarding(clubIdOf(admin))
  if (!onboarding.account) return fail('Payouts: no account yet.')
  const url = await paymentProvider().createConnectLoginLink(onboarding.account.account_id)
  if (!url) return fail('The payment service does not offer a dashboard for this account.')
  redirect(url)
}

/* --------------------------------------------------------------- operator */

export async function setPlatformFeeAction(_prev: ActionResult<null> | null, formData: FormData): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const operator = await assertRole('super_admin')
  if (!operator) return fail('Platform operator role required.')

  const parsed = z
    .object({ clubId: z.string().uuid(), feePercent: z.coerce.number().min(0).max(30) })
    .safeParse({ clubId: str(formData, 'clubId'), feePercent: str(formData, 'feePercent') })
  if (!parsed.success) return fromZod(parsed.error)

  const bps = Math.round(parsed.data.feePercent * 100)
  const supabase = await createUserClient()
  const { data: updated, error } = await supabase
    .from('club_payment_accounts')
    .update({ platform_fee_bps: bps })
    .eq('club_id', parsed.data.clubId)
    .select('club_id')
    .maybeSingle()
  if (error) return failDb(error, 'Could not save the fee.')
  if (!updated) return fail('Platform fee: this club has not started connecting a payout account yet, so there is nothing to set the fee on.')

  await recordPlatformAudit({ actorId: operator.id, action: 'payouts.fee_set', clubId: parsed.data.clubId, detail: { fee_bps: bps } })
  revalidatePath(`/platform/clubs/${parsed.data.clubId}`)
  return ok(null, `Platform fee set to ${parsed.data.feePercent}% for this club.`)
}

export type { PlanKey }
