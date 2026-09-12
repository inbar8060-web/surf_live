import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { parseHost } from '@/lib/tenant-host'

/**
 * Build the Content-Security-Policy for one request.
 *
 * A fresh nonce per request is what allows Next.js's inline bootstrap scripts
 * to run while `unsafe-inline` stays off. `strict-dynamic` then lets those
 * trusted scripts pull in the chunks they need, so the policy does not have to
 * enumerate every asset path.
 *
 * Development additionally needs `unsafe-eval`: the dev compiler and
 * hot reloading both evaluate code at runtime. It is never sent in production.
 */
function contentSecurityPolicy(nonce: string, supabaseUrl: string, host: string | null): string {
  const dev = process.env.NODE_ENV !== 'production'

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // next/font self-hosts the faces, so no external stylesheet host is needed
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    [
      'connect-src',
      "'self'",
      supabaseUrl,
      supabaseUrl.replace('https://', 'wss://').replace('http://', 'ws://'),
      'https://api.stripe.com',
      'https://marine-api.open-meteo.com',
      'https://api.open-meteo.com',
      // hot reload opens a websocket back to whatever address the page came
      // from — localhost on the Mac, the LAN address on a phone
      dev ? 'ws://localhost:*' : '',
      dev && host ? `ws://${host}` : '',
    ]
      .filter(Boolean)
      .join(' '),
    /*
     * Production only. On a plain-HTTP LAN address — a phone testing the dev
     * server — this upgrades every script and stylesheet to https, which the
     * dev server does not speak, and the page loads with nothing working.
     * Browsers only exempt localhost from it, which is why it looked fine there.
     */
    dev ? '' : 'upgrade-insecure-requests',
  ]
    .filter(Boolean)
    .join('; ')
}

/**
 * Runs before every matched request (Next 16's `proxy` convention, formerly
 * `middleware`). Two jobs, both cheap:
 *
 *   1. Refresh the Supabase session so an expiring access token is rotated
 *      before a Server Component tries to use it.
 *   2. Bounce anonymous visitors away from the signed-in areas.
 *
 * Role checks deliberately do NOT happen here. Middleware runs on the edge
 * without a database round trip we would want to pay on every request, and a
 * check here would be advisory anyway. Authorization is enforced twice where
 * it counts: `requireRole()` in each area's layout, and RLS in Postgres.
 */

const PROTECTED_PREFIXES = ['/admin', '/instructor', '/client', '/account']
const AUTH_PAGES = ['/login', '/forgot-password']

export async function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, '')
  const csp = contentSecurityPolicy(
    nonce,
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    request.headers.get('host'),
  )

  // Next.js reads the nonce back off the request's CSP header and stamps it
  // onto the scripts it injects, so both headers have to carry the same value.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('content-security-policy', csp)

  /*
   * Which club, or which part of the platform, this address names. Decided
   * once here from the Host header and handed down; nothing downstream parses
   * a host again. A signed-in user's own club lives on their profile and is
   * compared against this in the area layouts — the address never overrides it.
   */
  const target = parseHost(request.headers.get('host'), process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? 'localhost:3000', {
    devClubSlug: process.env.NODE_ENV !== 'production' ? process.env.NEXT_PUBLIC_DEV_CLUB_SLUG : null,
  })
  requestHeaders.set('x-platform-area', target.kind)
  requestHeaders.delete('x-club-slug') // never trust a value that arrived from outside
  if (target.kind === 'club') requestHeaders.set('x-club-slug', target.slug)

  let response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('content-security-policy', csp)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request: { headers: requestHeaders } })
          response.headers.set('content-security-policy', csp)
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, {
              ...options,
              httpOnly: true,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
              path: '/',
            })
          }
        },
      },
    },
  )

  // Revalidates the token with the auth server and rotates cookies if needed.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // The operator area exists only on its own subdomain, and club areas only on
  // a club's. A club member's URL pasted into the operator subdomain — or the
  // reverse — is refused here before any page code runs.
  const isPlatformPath = pathname.startsWith('/platform')
  const isClubPath = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) || pathname.startsWith('/onboarding')
  if ((isPlatformPath && target.kind !== 'platform') || (isClubPath && target.kind !== 'club')) {
    return new NextResponse('Not found', { status: 404 })
  }

  if (!user && (isClubPath || isPlatformPath)) {
    const login = request.nextUrl.clone()
    login.pathname = '/login'
    // Only ever round-trip an internal path, so this cannot become an open redirect.
    login.search = pathname.startsWith('/') && !pathname.startsWith('//')
      ? `?next=${encodeURIComponent(pathname)}`
      : ''
    return NextResponse.redirect(login)
  }

  if (user && AUTH_PAGES.includes(pathname)) {
    const home = request.nextUrl.clone()
    home.pathname = '/'
    home.search = ''
    return NextResponse.redirect(home)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and the payment webhook, which must
     * reach the route handler with its body untouched.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
