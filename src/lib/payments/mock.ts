import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import { serverEnv } from '@/lib/env'
import type { CheckoutRequest, CheckoutSession, PaymentEvent, PaymentProvider } from './provider'

/**
 * Development provider. Renders an in-app confirmation page instead of calling
 * out to an acquirer, and signs its "webhook" with APP_SECRET so the same
 * signature-verification path is exercised as in production.
 *
 * It refuses to load outside development, so a misconfigured deployment cannot
 * quietly accept fake payments.
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
    const reference = `mock_${request.paymentId}`
    const params = new URLSearchParams({
      payment: request.paymentId,
      amount: String(request.amountCents),
      currency: request.currency,
      label: request.description.slice(0, 120),
      next: request.successUrl,
      cancel: request.cancelUrl,
    })
    return { url: `/checkout/mock?${params.toString()}`, reference }
  },

  async parseWebhook(rawBody: string, signature: string | null): Promise<PaymentEvent> {
    assertNotProduction()
    if (!signature) throw new Error('Missing signature header')

    const expected = signMockPayload(rawBody)
    const a = Buffer.from(expected, 'utf8')
    const b = Buffer.from(signature, 'utf8')
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error('Bad signature')
    }

    const parsed = JSON.parse(rawBody) as {
      type?: string
      paymentId?: string
      amountCents?: number
      currency?: string
    }

    const allowed = new Set(['succeeded', 'failed', 'cancelled', 'refunded'])
    return {
      type: allowed.has(parsed.type ?? '') ? (parsed.type as PaymentEvent['type']) : 'ignored',
      paymentId: parsed.paymentId ?? null,
      reference: parsed.paymentId ? `mock_${parsed.paymentId}` : null,
      amountCents: parsed.amountCents ?? null,
      currency: parsed.currency ?? null,
    }
  },
}
