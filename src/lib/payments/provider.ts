import 'server-only'

import type { PaymentKind } from '@/lib/db/types'

/**
 * Payment provider seam.
 *
 * The rest of the application only knows this interface. It covers three
 * things a multi-club platform needs from a payment service:
 *
 *   1. charging a member, through the *club's own* connected account, with
 *      the platform's share taken at the same time;
 *   2. billing the club for its plan (a monthly subscription to the platform);
 *   3. connecting the club's payout account — hosted onboarding, and the
 *      account's state afterwards.
 *
 * Two invariants hold for every implementation:
 *   - The amount is decided by our server, never posted from the browser.
 *   - Nothing becomes "paid", "active" or "connected" except from a
 *     signature-verified webhook. The browser's return trip is a hint.
 */

export interface CheckoutRequest {
  /** Our payments row id; travels with the charge so the webhook can match it. */
  paymentId: string
  kind: PaymentKind
  amountCents: number
  currency: string
  description: string
  customerEmail?: string | null
  successUrl: string
  cancelUrl: string
  metadata?: Record<string, string>
  /** The club's connected account. The charge is made *on* it; the club is the merchant. */
  connectedAccountId?: string | null
  /** The platform's share, already computed from the club's fee rate. */
  applicationFeeCents?: number
}

export interface CheckoutSession {
  /** Where to send the browser to pay. */
  url: string
  /** Provider-side identifier, stored as payments.provider_ref. */
  reference: string
}

export interface SubscriptionCheckoutRequest {
  /** Our club_subscriptions row id; comes back in the webhook. */
  subscriptionId: string
  /** Changes on every checkout start, so retries dedupe but a re-subscribe does not replay. */
  attempt: string
  clubId: string
  clubName: string
  planKey: string
  planName: string
  priceCents: number
  currency: string
  customerEmail?: string | null
  existingCustomerId?: string | null
  successUrl: string
  cancelUrl: string
}

export interface ConnectOnboardingRequest {
  clubId: string
  clubName: string
  email: string
  country?: string | null
  /** Resume an account that was started but not finished. */
  existingAccountId?: string | null
  /** Where the provider sends the browser if the onboarding link expires. */
  refreshUrl: string
  returnUrl: string
}

export interface ConnectAccountState {
  accountId: string
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  requirementsDue: string[]
  country: string | null
  defaultCurrency: string | null
}

/** Everything a verified webhook can tell us, normalised. */
export type ProviderEvent =
  | {
      kind: 'payment'
      type: 'succeeded' | 'failed' | 'cancelled' | 'refunded'
      paymentId: string | null
      reference: string | null
      amountCents: number | null
      currency: string | null
      failureReason?: string | null
      /** The connected account the event arrived from, when it did. */
      accountId: string | null
    }
  | {
      kind: 'subscription'
      /** When the provider says it happened — to refuse an older event after a newer one. */
      occurredAt: string | null
      type: 'activated' | 'updated' | 'past_due' | 'canceled'
      /** Our club_subscriptions row id, from the metadata we attached. */
      subscriptionId: string | null
      providerSubscriptionId: string | null
      providerCustomerId: string | null
      planKey: string | null
      periodStart: string | null
      periodEnd: string | null
    }
  | { kind: 'account'; state: ConnectAccountState }
  | { kind: 'ignored' }

export const IGNORED: ProviderEvent = { kind: 'ignored' }

export interface PaymentProvider {
  readonly name: 'stripe' | 'mock'

  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>

  createSubscriptionCheckout(request: SubscriptionCheckoutRequest): Promise<CheckoutSession>
  /** Move a live subscription to another plan, prorated. Returns the new period end when known. */
  changeSubscriptionPlan(
    providerSubscriptionId: string,
    plan: { key: string; name: string; priceCents: number; currency: string },
  ): Promise<{ periodEnd: string | null }>
  /** Schedule the subscription to end at the close of the current paid period. */
  cancelSubscription(providerSubscriptionId: string): Promise<void>

  createConnectOnboarding(request: ConnectOnboardingRequest): Promise<{ accountId: string; url: string }>
  /** The account's current state, or null when the provider holds none (the mock). */
  fetchConnectAccount(accountId: string): Promise<ConnectAccountState | null>
  /** A one-time link into the club's own dashboard at the provider, when it offers one. */
  createConnectLoginLink(accountId: string): Promise<string | null>

  /**
   * Verify the signature and normalise the payload. Must throw if the
   * signature does not check out — an unverified webhook is an attacker
   * telling us an invoice was paid.
   */
  parseWebhook(rawBody: string, signature: string | null): Promise<ProviderEvent>
}
