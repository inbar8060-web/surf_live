import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
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
 * Development provider. Renders in-app stand-ins for the provider's hosted
 * pages — checkout, subscription checkout, payout onboarding — and signs its
 * "webhooks" with APP_SECRET so the same signature-verification path is
 * exercised as in production.
 *
 * It refuses to load outside development, so a misconfigured deployment
 * cannot quietly accept fake payments.
 */
function assertNotProduction() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('PAYMENT_PROVIDER=mock is not allowed in production')
  }
}

export function signMockPayload(payload: string): string {
  return createHmac('sha256', serverEnv().APP_SECRET).update(payload).digest('hex')
}

export const mockProvider: PaymentProvider = {
  name: 'mock',

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    assertNotProduction()
    const params = new URLSearchParams({
      payment: request.paymentId,
      amount: String(request.amountCents),
      currency: request.currency,
      label: request.description.slice(0, 120),
      next: request.successUrl,
      cancel: request.cancelUrl,
    })
    if (request.connectedAccountId) params.set('account', request.connectedAccountId)
    return { url: `/checkout/mock?${params.toString()}`, reference: `mock_${request.paymentId}` }
  },

  async createSubscriptionCheckout(request: SubscriptionCheckoutRequest): Promise<CheckoutSession> {
    assertNotProduction()
    const params = new URLSearchParams({
      subscription: request.subscriptionId,
      plan: request.planKey,
      amount: String(request.priceCents),
      currency: request.currency,
      label: `${request.planName} — monthly`,
      next: request.successUrl,
      cancel: request.cancelUrl,
    })
    return { url: `/checkout/mock?${params.toString()}`, reference: `mock_sub_${request.subscriptionId}` }
  },

  async changeSubscriptionPlan(): Promise<{ periodEnd: string | null }> {
    assertNotProduction()
    return { periodEnd: new Date(Date.now() + 30 * 86_400_000).toISOString() }
  },

  async cancelSubscription(): Promise<void> {
    assertNotProduction()
  },

  async createConnectOnboarding(request: ConnectOnboardingRequest): Promise<{ accountId: string; url: string }> {
    assertNotProduction()
    const accountId = request.existingAccountId ?? `mock_acct_${request.clubId}`
    const params = new URLSearchParams({ club: request.clubId, account: accountId, next: request.returnUrl })
    return { accountId, url: `/checkout/mock-connect?${params.toString()}` }
  },

  async fetchConnectAccount(): Promise<ConnectAccountState | null> {
    // the mock holds no state of its own; what the simulated webhook wrote stands
    return null
  },

  async createConnectLoginLink(): Promise<string | null> {
    return null
  },

  async parseWebhook(rawBody: string, signature: string | null): Promise<ProviderEvent> {
    assertNotProduction()
    if (!signature) throw new Error('Missing signature header')

    const expected = signMockPayload(rawBody)
    const a = Buffer.from(expected, 'utf8')
    const b = Buffer.from(signature, 'utf8')
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error('Bad signature')
    }

    const parsed = JSON.parse(rawBody) as Record<string, unknown>
    const str = (key: string) => (typeof parsed[key] === 'string' ? (parsed[key] as string) : null)
    const num = (key: string) => (typeof parsed[key] === 'number' ? (parsed[key] as number) : null)
    const bool = (key: string) => parsed[key] === true

    switch (parsed.kind) {
      case 'payment': {
        const allowed = new Set(['succeeded', 'failed', 'cancelled', 'refunded'])
        const type = str('type') ?? ''
        if (!allowed.has(type)) return IGNORED
        const paymentId = str('paymentId')
        return {
          kind: 'payment',
          type: type as 'succeeded' | 'failed' | 'cancelled' | 'refunded',
          paymentId,
          reference: paymentId ? `mock_${paymentId}` : null,
          amountCents: num('amountCents'),
          currency: str('currency'),
          accountId: str('accountId'),
        }
      }
      case 'subscription': {
        const type = str('type') ?? ''
        if (!['activated', 'updated', 'past_due', 'canceled'].includes(type)) return IGNORED
        const subscriptionId = str('subscriptionId')
        const start = new Date()
        const end = new Date(start.getTime() + 30 * 86_400_000)
        return {
          kind: 'subscription',
          type: type as 'activated' | 'updated' | 'past_due' | 'canceled',
          subscriptionId,
          providerSubscriptionId: subscriptionId ? `mock_sub_${subscriptionId}` : null,
          providerCustomerId: null,
          planKey: str('planKey'),
          periodStart: start.toISOString(),
          periodEnd: end.toISOString(),
        }
      }
      case 'account': {
        const accountId = str('accountId')
        if (!accountId) return IGNORED
        return {
          kind: 'account',
          state: {
            accountId,
            chargesEnabled: bool('chargesEnabled'),
            payoutsEnabled: bool('payoutsEnabled'),
            detailsSubmitted: true,
            requirementsDue: [],
            country: str('country'),
            defaultCurrency: str('currency'),
          },
        }
      }
      default:
        return IGNORED
    }
  },
}
