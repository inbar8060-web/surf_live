'use server'

import { redirect } from 'next/navigation'
import { createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertRole, clubIdOf, requireRoleForAction } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { recordAudit } from '@/lib/audit'
import { rateLimit } from '@/lib/util/rate-limit'
import { requestClubUrl } from '@/lib/tenant'
import { createClubCheckout, paymentProvider, PayoutsNotReady } from '@/lib/payments'
import { tipSchema } from '@/lib/validation/schemas'
import { assertSameOrigin, fail, fromZod, failDb, type ActionResult } from './result'
import { optionalStr, str } from './form'

/**
 * Tip an instructor.
 *
 * The flow is deliberately one-directional:
 *   1. create a `payments` row in state `pending` with an amount we computed;
 *   2. ask the provider for a checkout session and store its reference;
 *   3. send the browser there.
 *
 * The tip itself is only recorded when the signed webhook confirms the money
 * arrived — see /api/webhooks/payments. The browser's return trip is treated
 * as a hint about where to navigate, never as proof of payment.
 */
export async function createTipCheckoutAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const guard = await requireRoleForAction(['client'], '/client/bookings')
  if (!guard.ok) return fail(guard.error)
  const user = guard.user

  const club = await getClubSettings()
  if (!club.tips_enabled) return fail('Tipping is switched off at the moment.')

  const parsed = tipSchema.safeParse({
    instructorId: str(formData, 'instructorId'),
    reservationId: optionalStr(formData, 'reservationId'),
    amountCents: str(formData, 'amountCents'),
    message: optionalStr(formData, 'message'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  const limit = await rateLimit(`tip:${user.id}`, 10, 60 * 60_000)
  if (!limit.ok) return fail('Too many payment attempts. Please wait a few minutes.')

  // The instructor must be real, active, and one this client actually had.
  const supabase = await createUserClient()
  const { data: instructor } = await supabase
    .from('instructor_directory')
    .select('profile_id, full_name')
    .eq('profile_id', parsed.data.instructorId)
    .maybeSingle()

  if (!instructor) return fail('That instructor could not be found.')

  const db = createAdminClient()
  const provider = paymentProvider()

  const { data: payment, error: paymentError } = await db
    .from('payments')
    .insert({
      club_id: clubIdOf(user),
      client_id: user.id,
      kind: 'tip',
      amount_cents: parsed.data.amountCents,
      currency: club.currency,
      status: 'pending',
      provider: provider.name,
      description: `Tip for ${instructor.full_name}`,
      metadata: {
        instructor_id: parsed.data.instructorId,
        reservation_id: parsed.data.reservationId || null,
        message: parsed.data.message || null,
      },
    })
    .select('id')
    .single()

  if (paymentError || !payment) {
    return failDb(paymentError, 'Could not start the payment.')
  }

  const site = await requestClubUrl('')
  let checkoutUrl: string

  try {
    const session = await createClubCheckout(clubIdOf(user), {
      paymentId: payment.id,
      kind: 'tip',
      amountCents: parsed.data.amountCents,
      currency: club.currency,
      description: `Tip for ${instructor.full_name}`,
      customerEmail: user.email,
      successUrl: `${site}/client/payments?status=done`,
      cancelUrl: `${site}/client/payments?status=cancelled`,
      metadata: { instructor_id: parsed.data.instructorId },
    })

    await db
      .from('payments')
      .update({
        provider_ref: session.reference,
        status: 'processing',
        account_id: session.account.account_id,
        platform_fee_cents: session.feeCents,
      })
      .eq('id', payment.id)

    checkoutUrl = session.url
  } catch (error) {
    console.error('[payments] checkout failed', error)
    await db
      .from('payments')
      .update({ status: 'failed', failure_reason: 'Could not open a checkout session' })
      .eq('id', payment.id)
    if (error instanceof PayoutsNotReady) {
      return fail('Payments: the club has not connected its payout account yet, so tips cannot be taken online. Tip in person for now.')
    }
    return fail('The payment provider is not reachable right now. Please try again shortly.')
  }

  await recordAudit({
    actorId: user.id,
    actorRole: 'client',
    action: 'tip.checkout_started',
    entity: 'payment',
    entityId: payment.id,
    after: { amount_cents: parsed.data.amountCents, instructor_id: parsed.data.instructorId },
  })

  redirect(checkoutUrl)
}
