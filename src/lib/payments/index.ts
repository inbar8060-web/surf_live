import 'server-only'

import { serverEnv } from '@/lib/env'
import { mockProvider } from './mock'
import { stripeProvider } from './stripe'
import type { PaymentProvider } from './provider'

export * from './provider'

export function paymentProvider(): PaymentProvider {
  return serverEnv().PAYMENT_PROVIDER === 'stripe' ? stripeProvider : mockProvider
}
