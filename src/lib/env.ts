import { z } from 'zod'

/**
 * Environment is validated once, at module load. A missing or malformed value
 * fails the build/boot loudly instead of surfacing as a confusing runtime 500.
 *
 * Anything not prefixed NEXT_PUBLIC_ is stripped from the client bundle by
 * Next.js; `serverEnv` is additionally guarded so importing it from a client
 * component throws rather than silently shipping a secret.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
})

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  APP_SECRET: z.string().min(32, 'APP_SECRET must be at least 32 characters'),
  PAYMENT_PROVIDER: z.enum(['stripe', 'mock']).default('mock'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  MARINE_API_BASE: z.string().url().default('https://marine-api.open-meteo.com/v1/marine'),
  WEATHER_API_BASE: z.string().url().default('https://api.open-meteo.com/v1/forecast'),
})

function parse<T extends z.ZodTypeAny>(schema: T, raw: unknown, label: string): z.infer<T> {
  const result = schema.safeParse(raw)
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid ${label} environment:\n${detail}`)
  }
  return result.data
}

// Next.js inlines these at build time, so they must be referenced literally.
export const publicEnv = parse(
  publicSchema,
  {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  },
  'public',
)

let cachedServerEnv: z.infer<typeof serverSchema> | null = null

export function serverEnv(): z.infer<typeof serverSchema> {
  if (typeof window !== 'undefined') {
    throw new Error('serverEnv() was called in the browser — this would leak secrets')
  }
  cachedServerEnv ??= parse(serverSchema, process.env, 'server')
  return cachedServerEnv
}
