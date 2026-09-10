import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { paymentProvider } from '@/lib/payments'
import { recordAudit } from '@/lib/audit'
import type { PaymentStatus } from '@/lib/db/types'

/**
 * The only place a payment is allowed to become "paid".
 *
 * Order matters here:
 *   1. read the body as raw text — a parsed body cannot be signature-checked;
 *   2. verify the signature, and reject the request if it does not check out;
 *   3. only then touch the database.
 *
 * Replays are harmless: the update is conditional on the payment not already
 * being in a terminal state, and the follow-on records (a tip, a paid booking)
 * are written with a guard against a duplicate.
 *
 * This route is excluded from the session middleware so the body arrives
 * untouched, and it never trusts a user session — the signature is the only
 * credential it accepts.
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TERMINAL: PaymentStatus[] = ['succeeded', 'refunded']

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature =
    request.headers.get('stripe-signature') ?? request.headers.get('x-payment-signature')

  const provider = paymentProvider()

  let event
  try {
    event = await provider.parseWebhook(rawBody, signature)
  } catch (error) {
    // Do not echo the reason: a precise error is a hint to whoever is probing.
    console.error('[webhook] rejected', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'ignored' || !event.paymentId) {
    return NextResponse.json({ received: true })
  }

  const db = createAdminClient()

  const { data: payment } = await db
    .from('payments')
    .select('*')
    .eq('id', event.paymentId)
    .maybeSingle()

  if (!payment) {
    // 200 so the provider stops retrying something we will never recognise.
    console.warn('[webhook] unknown payment', event.paymentId)
    return NextResponse.json({ received: true })
  }

  // A mismatch means the event does not describe the charge we created.
  if (
    event.type === 'succeeded' &&
    (event.amountCents !== payment.amount_cents ||
      (event.currency && event.currency !== payment.currency))
  ) {
    console.error('[webhook] amount mismatch', {
      paymentId: payment.id,
      expected: payment.amount_cents,
      got: event.amountCents,
    })
    await db
      .from('payments')
      .update({ status: 'failed', failure_reason: 'Amount did not match the invoice' })
      .eq('id', payment.id)
    return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 })
  }

  if (TERMINAL.includes(payment.status) && event.type !== 'refunded') {
    return NextResponse.json({ received: true, duplicate: true })
  }

  const nextStatus: PaymentStatus =
    event.type === 'succeeded'
      ? 'succeeded'
      : event.type === 'failed'
        ? 'failed'
        : event.type === 'refunded'
          ? 'refunded'
          : 'cancelled'

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
    action: `payment.${nextStatus}`,
    entity: 'payment',
    entityId: payment.id,
    after: { kind: payment.kind, amount_cents: payment.amount_cents, status: nextStatus },
  })

  return NextResponse.json({ received: true })
}

/** Everything that should happen once money has actually arrived. */
async function applySuccessfulPayment(
  db: ReturnType<typeof createAdminClient>,
  payment: { id: string; client_id: string; kind: string; amount_cents: number; currency: string; metadata: Record<string, unknown> },
) {
  switch (payment.kind) {
    case 'tip': {
      const instructorId = payment.metadata?.instructor_id
      if (typeof instructorId !== 'string') break

      // The unique payment_id keeps a replayed webhook from double-recording.
      const { data: existing } = await db
        .from('tips')
        .select('id')
        .eq('payment_id', payment.id)
        .maybeSingle()
      if (existing) break

      const reservationId = payment.metadata?.reservation_id
      const message = payment.metadata?.message

      await db.from('tips').insert({
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
