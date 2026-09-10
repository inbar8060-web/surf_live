import type { NextConfig } from 'next'

/**
 * Security headers applied to every response.
 * The CSP is intentionally strict: no inline scripts, no eval, no framing.
 * Supabase + the payment provider are the only permitted external origins.
 */
const SUPABASE_ORIGIN = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // Tailwind v4 injects a <style> tag; inline styles stay allowed, inline scripts do not.
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' https://js.stripe.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  [
    'connect-src',
    "'self'",
    SUPABASE_ORIGIN,
    SUPABASE_ORIGIN.replace('https://', 'wss://'),
    'https://api.stripe.com',
    'https://marine-api.open-meteo.com',
    'https://api.open-meteo.com',
  ]
    .filter(Boolean)
    .join(' '),
  'upgrade-insecure-requests',
].join('; ')

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(self)' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
