import os from 'node:os'
import type { NextConfig } from 'next'

const isProduction = process.env.NODE_ENV === 'production'

/**
 * This machine's own network addresses, for testing on a phone.
 *
 * Next.js blocks dev-only assets (JS chunks, hot reload) from any origin other
 * than localhost. Opening the app from a phone at http://<mac-ip>:3000 would
 * then load the HTML but none of the JavaScript — every button dead. Read
 * fresh at startup, so a new Wi-Fi or hotspot address works after a restart
 * without editing this file. Never applied to a production build.
 */
function lanAddresses(): string[] {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i): i is os.NetworkInterfaceInfo => Boolean(i) && i!.family === 'IPv4' && !i!.internal)
    .map((i) => i.address)
}

/**
 * Static security headers.
 *
 * The Content-Security-Policy is NOT set here — it is built per request in
 * src/proxy.ts, because it needs a fresh nonce each time. Next.js injects
 * inline bootstrap scripts to stream the page, and a static
 * `script-src 'self'` blocks every one of them: the page renders but nothing
 * ever hydrates, so no client component works. The nonce is what lets those
 * scripts run without opening the policy up to 'unsafe-inline'.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: isProduction ? [] : lanAddresses(),
  // The signed-document renderer reads these font files at runtime, so they
  // have to be traced into the serverless bundle — they are data, not imports,
  // and would otherwise be left behind on deploy.
  outputFileTracingIncludes: {
    '/**': ['./src/lib/documents/fonts/*.ttf'],
  },
  async headers() {
    const headers = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(self)' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    ]

    // HSTS only means anything over HTTPS, and pinning a bare IP or localhost
    // to HTTPS during development only causes trouble later.
    if (isProduction) {
      headers.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      })
    }

    return [{ source: '/:path*', headers }]
  },
}

export default nextConfig
