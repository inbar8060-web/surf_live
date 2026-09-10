import 'server-only'

import Stripe from 'stripe'
import { serverEnv } from '@/lib/env'
import type { CheckoutRequest, CheckoutSession, PaymentEvent, PaymentProvider } from './provider'

let client: Stripe | null = null

function stripe(): Stripe {
  const { STRIPE_SECRET_KEY } = serverEnv()
  if (!STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set but PAYMENT_PROVIDER=stripe')
  }
  client ??= new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion })
  return client
}

export const stripeProvider: PaymentProvider = {
  name: 'stripe',

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    const session = await stripe().checkout.sessions.create(
      {
        mode: 'payment',
        client_reference_id: request.paymentId,
        customer_email: request.customerEmail ?? undefined,
        success_url: request.successUrl,
        cancel_url: request.cancelUrl,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: request.currency.toLowerCase(),
              unit_amount: request.amountCents,
              product_data: { name: request.description.slice(0, 250) },
            },
          },
        ],
        metadata: { ...request.metadata, payment_id: request.paymentId, kind: request.kind },
        payment_intent_data: {
          metadata: { payment_id: request.paymentId, kind: request.kind },
        },
      },
      // Retrying a failed request must not create a second charge.
      { idempotencyKey: `checkout:${request.paymentId}` },
    )

    if (!session.url) throw new Error('Stripe returned a session without a URL')
    return { url: session.url, reference: session.id }
  },

  async parseWebhook(rawBody: string, signature: string | null): Promise<PaymentEvent> {
    const { STRIPE_WEBHOOK_SECRET } = serverEnv()
    if (!STRIPE_WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET is not set')
    if (!signature) throw new Error('Missing stripe-signature header')

    // Throws on a bad signature or a stale timestamp — both are rejections.
    const event = stripe().webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        return {
          type: session.payment_status === 'paid' ? 'succeeded' : 'ignored',
          paymentId: session.metadata?.payment_id ?? session.client_reference_id ?? null,
          reference: session.id,
          amountCents: session.amount_total,
          currency: session.currency?.toUpperCase() ?? null,
        }
      }
      case 'checkout.session.expired': {
        const session = event.data.object
        return {
          type: 'cancelled',
          paymentId: session.metadata?.payment_id ?? session.client_reference_id ?? null,
          reference: session.id,
          amountCents: session.amount_total,
          currency: session.currency?.toUpperCase() ?? null,
        }
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object
        return {
          type: 'failed',
          paymentId: intent.metadata?.payment_id ?? null,
          reference: intent.id,
          amountCents: intent.amount,
          currency: intent.currency?.toUpperCase() ?? null,
          failureReason: intent.last_payment_error?.message ?? null,
        }
      }
      case 'charge.refunded': {
        const charge = event.data.object
        return {
          type: 'refunded',
          paymentId: charge.metadata?.payment_id ?? null,
          reference: typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.id,
          amountCents: charge.amount_refunded,
          currency: charge.currency?.toUpperCase() ?? null,
        }
      }
      default:
        return { type: 'ignored', paymentId: null, reference: null, amountCents: null, currency: null }
    }
  },
}
