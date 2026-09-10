import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

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
  let response = NextResponse.next({ request })

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
          response = NextResponse.next({ request })
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

  if (!user && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
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
