import 'server-only'

import Stripe from 'stripe'
import { serverEnv } from '@/lib/env'
import {
  IGNORED,
  type CheckoutRequest,
  type CheckoutSession,
  type ConnectAccountState,
  type ConnectOnboardingRequest,
  type PaymentProvider,
  type ProviderEvent,
  type SubscriptionCheckoutRequest,
} from './provider'

/**
 * Stripe, in three roles:
 *
 *   - Connect: each club is an Express connected account. Member payments are
 *     direct charges on that account (the club is the merchant of record),
 *     with the platform's share as an application fee. Apple Pay, Google Pay
 *     and Link come with hosted Checkout.
 *   - Billing: the club's plan is a monthly subscription on the platform's
 *     own account.
 *   - Two webhook endpoints share one URL: platform events (subscriptions)
 *     are signed with STRIPE_WEBHOOK_SECRET, connected-account events
 *     (payments, account state) with STRIPE_CONNECT_WEBHOOK_SECRET.
 */

let client: Stripe | null = null

function stripe(): Stripe {
  const { STRIPE_SECRET_KEY } = serverEnv()
  if (!STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set but PAYMENT_PROVIDER=stripe')
  }
  client ??= new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion })
  return client
}

const iso = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000).toISOString() : null)

function accountState(account: Stripe.Account): ConnectAccountState {
  return {
    accountId: account.id,
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
    requirementsDue: [...(account.requirements?.currently_due ?? []), ...(account.requirements?.past_due ?? [])],
    country: account.country ?? null,
    defaultCurrency: account.default_currency?.toUpperCase() ?? null,
  }
}

function subscriptionEvent(
  type: 'activated' | 'updated' | 'past_due' | 'canceled',
  subscription: Stripe.Subscription,
  occurredAt: string | null,
): ProviderEvent {
  return {
    kind: 'subscription',
    type,
    occurredAt,
    subscriptionId: subscription.metadata?.subscription_id ?? null,
    providerSubscriptionId: subscription.id,
    providerCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    planKey: subscription.metadata?.plan_key ?? null,
    periodStart: iso(subscription.current_period_start),
    periodEnd: iso(subscription.current_period_end),
  }
}

export const stripeProvider: PaymentProvider = {
  name: 'stripe',

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    if (!request.connectedAccountId) {
      throw new Error('A member payment must be charged on the club’s connected account')
    }
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
          ...(request.applicationFeeCents ? { application_fee_amount: request.applicationFeeCents } : {}),
        },
      },
      // Retrying a failed request must not create a second charge; the charge
      // is made on the club's account, which makes the club the merchant.
      { idempotencyKey: `checkout:${request.paymentId}`, stripeAccount: request.connectedAccountId },
    )

    if (!session.url) throw new Error('Stripe returned a session without a URL')
    return { url: session.url, reference: session.id }
  },

  async createSubscriptionCheckout(request: SubscriptionCheckoutRequest): Promise<CheckoutSession> {
    const metadata = { subscription_id: request.subscriptionId, club_id: request.clubId, plan_key: request.planKey }
    const session = await stripe().checkout.sessions.create(
      {
        mode: 'subscription',
        client_reference_id: request.subscriptionId,
        customer: request.existingCustomerId ?? undefined,
        customer_email: request.existingCustomerId ? undefined : (request.customerEmail ?? undefined),
        success_url: request.successUrl,
        cancel_url: request.cancelUrl,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: request.currency.toLowerCase(),
              unit_amount: request.priceCents,
              recurring: { interval: 'month' },
              product_data: { name: `Surfer Live · ${request.planName}`, description: `Plan for ${request.clubName}` },
            },
          },
        ],
        metadata,
        subscription_data: { metadata },
      },
      { idempotencyKey: `subscribe:${request.subscriptionId}:${request.planKey}:${request.attempt}` },
    )
    if (!session.url) throw new Error('Stripe returned a session without a URL')
    return { url: session.url, reference: session.id }
  },

  async changeSubscriptionPlan(providerSubscriptionId, plan) {
    const current = await stripe().subscriptions.retrieve(providerSubscriptionId)
    const item = current.items.data[0]
    if (!item) throw new Error('The subscription has no item to change')
    const updated = await stripe().subscriptions.update(providerSubscriptionId, {
      items: [
        {
          id: item.id,
          price_data: {
            currency: plan.currency.toLowerCase(),
            unit_amount: plan.priceCents,
            recurring: { interval: 'month' },
            product: typeof item.price.product === 'string' ? item.price.product : item.price.product.id,
          },
        },
      ],
      proration_behavior: 'create_prorations',
      metadata: { ...current.metadata, plan_key: plan.key },
    })
    return { periodEnd: iso(updated.current_period_end) }
  },

  async cancelSubscription(providerSubscriptionId) {
    await stripe().subscriptions.update(providerSubscriptionId, { cancel_at_period_end: true })
  },

  async createConnectOnboarding(request: ConnectOnboardingRequest) {
    const accountId =
      request.existingAccountId ??
      (
        await stripe().accounts.create(
          {
            type: 'express',
            country: request.country ?? undefined,
            email: request.email,
            capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
            business_profile: { name: request.clubName },
            metadata: { club_id: request.clubId },
          },
          { idempotencyKey: `connect:${request.clubId}` },
        )
      ).id

    const link = await stripe().accountLinks.create({
      account: accountId,
      refresh_url: request.refreshUrl,
      return_url: request.returnUrl,
      type: 'account_onboarding',
    })
    return { accountId, url: link.url }
  },

  async fetchConnectAccount(accountId) {
    return accountState(await stripe().accounts.retrieve(accountId))
  },

  async createConnectLoginLink(accountId) {
    const link = await stripe().accounts.createLoginLink(accountId)
    return link.url
  },

  async parseWebhook(rawBody: string, signature: string | null): Promise<ProviderEvent> {
    const { STRIPE_WEBHOOK_SECRET, STRIPE_CONNECT_WEBHOOK_SECRET } = serverEnv()
    if (!signature) throw new Error('Missing stripe-signature header')

    // One URL, two endpoints at Stripe: whichever secret verifies is the one
    // that signed it. Both throwing is a rejection. No secret at all is a
    // deployment mistake and must read as one, not as a forged request.
    if (!STRIPE_WEBHOOK_SECRET && !STRIPE_CONNECT_WEBHOOK_SECRET) {
      throw new Error('Neither STRIPE_WEBHOOK_SECRET nor STRIPE_CONNECT_WEBHOOK_SECRET is set')
    }
    let event: Stripe.Event | null = null
    for (const secret of [STRIPE_WEBHOOK_SECRET, STRIPE_CONNECT_WEBHOOK_SECRET]) {
      if (!secret) continue
      try {
        event = stripe().webhooks.constructEvent(rawBody, signature, secret)
        break
      } catch {
        // try the other
      }
    }
    if (!event) throw new Error('Bad signature')

    const accountId = event.account ?? null
    const occurredAt = iso(event.created)

    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object
        if (session.mode === 'subscription') {
          if (event.type !== 'checkout.session.completed') return IGNORED
          const id = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
          if (!id) return IGNORED
          const subscription = await stripe().subscriptions.retrieve(id)
          return subscriptionEvent('activated', subscription, occurredAt)
        }
        // A completed session whose payment is still on its way (bank debit,
        // transfer) is not a result yet: async_payment_succeeded / _failed
        // will say. Writing "cancelled" here would bury a payment that lands.
        if (session.payment_status !== 'paid') return IGNORED
        return {
          kind: 'payment',
          type: 'succeeded',
          paymentId: session.metadata?.payment_id ?? session.client_reference_id ?? null,
          reference: session.id,
          amountCents: session.amount_total,
          currency: session.currency?.toUpperCase() ?? null,
          accountId,
        }
      }
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object
        return {
          kind: 'payment',
          type: 'failed',
          paymentId: session.metadata?.payment_id ?? session.client_reference_id ?? null,
          reference: session.id,
          amountCents: session.amount_total,
          currency: session.currency?.toUpperCase() ?? null,
          failureReason: 'The delayed payment did not complete',
          accountId,
        }
      }
      case 'checkout.session.expired': {
        const session = event.data.object
        if (session.mode === 'subscription') return IGNORED
        return {
          kind: 'payment',
          type: 'cancelled',
          paymentId: session.metadata?.payment_id ?? session.client_reference_id ?? null,
          reference: session.id,
          amountCents: session.amount_total,
          currency: session.currency?.toUpperCase() ?? null,
          accountId,
        }
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object
        return {
          kind: 'payment',
          type: 'failed',
          paymentId: intent.metadata?.payment_id ?? null,
          reference: intent.id,
          amountCents: intent.amount,
          currency: intent.currency?.toUpperCase() ?? null,
          failureReason: intent.last_payment_error?.message ?? null,
          accountId,
        }
      }
      case 'charge.refunded': {
        const charge = event.data.object
        return {
          kind: 'payment',
          type: 'refunded',
          paymentId: charge.metadata?.payment_id ?? null,
          reference: typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.id,
          amountCents: charge.amount_refunded,
          currency: charge.currency?.toUpperCase() ?? null,
          accountId,
        }
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const type =
          subscription.status === 'active' || subscription.status === 'trialing'
            ? 'updated'
            : subscription.status === 'past_due' || subscription.status === 'unpaid'
              ? 'past_due'
              : subscription.status === 'canceled' || subscription.status === 'incomplete_expired'
                ? 'canceled'
                : null
        return type ? subscriptionEvent(type, subscription, occurredAt) : IGNORED
      }
      case 'customer.subscription.deleted':
        return subscriptionEvent('canceled', event.data.object, occurredAt)
      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const id = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
        if (!id) return IGNORED
        return subscriptionEvent('past_due', await stripe().subscriptions.retrieve(id), occurredAt)
      }
      case 'account.updated':
        return { kind: 'account', state: accountState(event.data.object) }
      default:
        return IGNORED
    }
  },
}
