import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { paymentProvider, type ConnectAccountState, type ProviderEvent } from '@/lib/payments'
import { recordAudit, recordPlatformAudit } from '@/lib/audit'
import { applyAccountState } from '@/lib/billing/accounts'
import type { PaymentStatus, PlanKey, SubscriptionStatus } from '@/lib/db/types'

/**
 * The only place a payment becomes "paid", a plan becomes "active", or a
 * payout account becomes "connected".
 *
 * Order matters here:
 *   1. read the body as raw text — a parsed body cannot be signature-checked;
 *   2. verify the signature, and reject the request if it does not check out;
 *   3. only then touch the database.
 *
 * Replays are harmless: every update is conditional on the row not already
 * being in the state the event describes.
 *
 * This route is excluded from the session middleware so the body arrives
 * untouched, and it never trusts a user session — the signature is the only
 * credential it accepts.
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Db = ReturnType<typeof createAdminClient>
const TERMINAL: PaymentStatus[] = ['succeeded', 'refunded']

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('stripe-signature') ?? request.headers.get('x-payment-signature')

  let event: ProviderEvent
  try {
    event = await paymentProvider().parseWebhook(rawBody, signature)
  } catch (error) {
    // Do not echo the reason: a precise error is a hint to whoever is probing.
    console.error('[webhook] rejected', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const db = createAdminClient()

  switch (event.kind) {
    case 'payment':
      return handlePayment(db, event)
    case 'subscription':
      return handleSubscription(db, event)
    case 'account':
      return handleAccount(db, event.state)
    default:
      return NextResponse.json({ received: true })
  }
}

/* ---------------------------------------------------------------- payments */

async function handlePayment(db: Db, event: Extract<ProviderEvent, { kind: 'payment' }>) {
  if (!event.paymentId) return NextResponse.json({ received: true })

  const { data: payment } = await db.from('payments').select('*').eq('id', event.paymentId).maybeSingle()
  if (!payment) {
    // 200 so the provider stops retrying something we will never recognise.
    console.warn('[webhook] unknown payment', event.paymentId)
    return NextResponse.json({ received: true })
  }

  // The event must come from the account the charge was made on — the club's
  // own. An event from any other account cannot settle this club's payment.
  if (event.accountId) {
    const expected =
      payment.account_id ??
      (await db.from('club_payment_accounts').select('account_id').eq('club_id', payment.club_id).maybeSingle()).data
        ?.account_id
    if (expected !== event.accountId) {
      console.error('[webhook] account mismatch', { paymentId: payment.id, expected, got: event.accountId })
      return NextResponse.json({ error: 'Account mismatch' }, { status: 400 })
    }
  }

  // A mismatch means the event does not describe the charge we created.
  if (
    event.type === 'succeeded' &&
    (event.amountCents !== payment.amount_cents || (event.currency && event.currency !== payment.currency))
  ) {
    console.error('[webhook] amount mismatch', { paymentId: payment.id, expected: payment.amount_cents, got: event.amountCents })
    await db.from('payments').update({ status: 'failed', failure_reason: 'Amount did not match the invoice' }).eq('id', payment.id)
    return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 })
  }

  if (TERMINAL.includes(payment.status) && event.type !== 'refunded') {
    return NextResponse.json({ received: true, duplicate: true })
  }

  const nextStatus: PaymentStatus =
    event.type === 'succeeded' ? 'succeeded' : event.type === 'failed' ? 'failed' : event.type === 'refunded' ? 'refunded' : 'cancelled'

  await db
    .from('payments')
    .update({
      status: nextStatus,
      provider_ref: payment.provider_ref ?? event.reference,
      succeeded_at: event.type === 'succeeded' ? new Date().toISOString() : payment.succeeded_at,
      refunded_at: event.type === 'refunded' ? new Date().toISOString() : payment.refunded_at,
      failure_reason: event.failureReason ?? null,
    })
    .eq('id', payment.id)

  if (event.type === 'succeeded') {
    await applySuccessfulPayment(db, payment)
  }

  await recordAudit({
    actorId: null,
    actorRole: null,
    clubId: payment.club_id,
    action: `payment.${nextStatus}`,
    entity: 'payment',
    entityId: payment.id,
    after: { kind: payment.kind, amount_cents: payment.amount_cents, status: nextStatus },
  })

  return NextResponse.json({ received: true })
}

/** Everything that should happen once money has actually arrived. */
async function applySuccessfulPayment(
  db: Db,
  payment: { id: string; club_id: string; client_id: string; kind: string; amount_cents: number; currency: string; metadata: Record<string, unknown> },
) {
  switch (payment.kind) {
    case 'tip': {
      const instructorId = payment.metadata?.instructor_id
      if (typeof instructorId !== 'string') break

      // The unique payment_id keeps a replayed webhook from double-recording.
      const { data: existing } = await db.from('tips').select('id').eq('payment_id', payment.id).maybeSingle()
      if (existing) break

      const reservationId = payment.metadata?.reservation_id
      const message = payment.metadata?.message

      await db.from('tips').insert({
        club_id: payment.club_id,
        client_id: payment.client_id,
        instructor_id: instructorId,
        reservation_id: typeof reservationId === 'string' ? reservationId : null,
        payment_id: payment.id,
        amount_cents: payment.amount_cents,
        currency: payment.currency,
        message: typeof message === 'string' ? message : null,
      })
      break
    }

    case 'reservation': {
      const reservationId = payment.metadata?.reservation_id
      if (typeof reservationId === 'string') {
        await db.from('reservations').update({ payment_id: payment.id }).eq('id', reservationId)
      }
      break
    }

    case 'package': {
      const packageId = payment.metadata?.client_package_id
      if (typeof packageId === 'string') {
        await db.from('client_packages').update({ payment_id: payment.id }).eq('id', packageId)
      }
      break
    }

    case 'rental': {
      const rentalId = payment.metadata?.rental_id
      if (typeof rentalId === 'string') {
        await db.from('rentals').update({ payment_id: payment.id }).eq('id', rentalId)
      }
      break
    }
  }
}

/* ----------------------------------------------------------- subscriptions */

async function handleSubscription(db: Db, event: Extract<ProviderEvent, { kind: 'subscription' }>) {
  // Our row id from the metadata we attached; failing that, the provider's id.
  let query = db.from('club_subscriptions').select('*')
  query = event.subscriptionId
    ? query.eq('id', event.subscriptionId)
    : query.eq('provider_subscription_id', event.providerSubscriptionId ?? '')
  const { data: subscription } = await query.maybeSingle()

  if (!subscription) {
    console.warn('[webhook] unknown subscription', event.subscriptionId ?? event.providerSubscriptionId)
    return NextResponse.json({ received: true })
  }

  // Providers retry and do not promise order. Nothing reopens a cancelled
  // subscription except a fresh checkout ('activated'), and nothing older
  // than the row's last write is applied.
  if (subscription.status === 'canceled' && event.type !== 'activated') {
    return NextResponse.json({ received: true, stale: true })
  }
  if (event.occurredAt && new Date(event.occurredAt) < new Date(subscription.updated_at) && event.type !== 'activated') {
    return NextResponse.json({ received: true, stale: true })
  }

  const status: SubscriptionStatus =
    event.type === 'canceled' ? 'canceled' : event.type === 'past_due' ? 'past_due' : 'active'

  const { data: planRow } = event.planKey
    ? await db.from('plans').select('key').eq('key', event.planKey as PlanKey).maybeSingle()
    : { data: null }

  await db
    .from('club_subscriptions')
    .update({
      status,
      plan_key: planRow?.key ?? subscription.plan_key,
      provider_subscription_id: event.providerSubscriptionId ?? subscription.provider_subscription_id,
      provider_customer_id: event.providerCustomerId ?? subscription.provider_customer_id,
      current_period_start: event.periodStart ?? subscription.current_period_start,
      current_period_end: event.periodEnd ?? subscription.current_period_end,
      // a scheduled cancellation stays scheduled; a new checkout clears it
      canceled_at:
        status === 'canceled' ? (subscription.canceled_at ?? new Date().toISOString()) : event.type === 'activated' ? null : subscription.canceled_at,
    })
    .eq('id', subscription.id)

  await recordPlatformAudit({
    actorId: null,
    action: `subscription.${event.type}`,
    clubId: subscription.club_id,
    detail: { plan: planRow?.key ?? subscription.plan_key, status, period_end: event.periodEnd },
  })

  return NextResponse.json({ received: true })
}

/* ---------------------------------------------------------- payout account */

async function handleAccount(_db: Db, state: ConnectAccountState) {
  const applied = await applyAccountState(state)
  if (!applied) console.warn('[webhook] unknown account', state.accountId)
  return NextResponse.json({ received: true })
}
