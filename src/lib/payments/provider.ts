import 'server-only'

import type { PaymentKind } from '@/lib/db/types'

/**
 * Payment provider seam.
 *
 * The rest of the application only knows this interface, so swapping Stripe
 * for a local acquirer (Tranzila, Cardcom, PayPlus …) means writing one file
 * and changing PAYMENT_PROVIDER — no call site moves.
 *
 * Two invariants hold for every implementation:
 *   1. The amount is decided by our server, never posted from the browser.
 *   2. A charge is only ever marked paid from a signature-verified webhook,
 *      never from the browser's return trip.
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
}

export interface CheckoutSession {
  /** Where to send the browser to pay. */
  url: string
  /** Provider-side identifier, stored as payments.provider_ref. */
  reference: string
}

/** Normalised webhook outcome. */
export interface PaymentEvent {
  type: 'succeeded' | 'failed' | 'cancelled' | 'refunded' | 'ignored'
  paymentId: string | null
  reference: string | null
  amountCents: number | null
  currency: string | null
  failureReason?: string | null
}

export interface PaymentProvider {
  readonly name: 'stripe' | 'mock'
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>
  /**
   * Verify the signature and normalise the payload. Must throw if the
   * signature does not check out — an unverified webhook is an attacker
   * telling us an invoice was paid.
   */
  parseWebhook(rawBody: string, signature: string | null): Promise<PaymentEvent>
}
