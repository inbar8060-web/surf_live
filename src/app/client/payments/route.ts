import { NextResponse } from 'next/server'

/**
 * Payment history now lives on the account screen, as the redesign specifies.
 * The route is kept as a redirect so the return URLs already handed to the
 * payment provider — and any link a member has bookmarked — still land
 * somewhere sensible.
 */
export function GET(request: Request) {
  const status = new URL(request.url).searchParams.get('status')
  const target = new URL('/account', request.url)
  if (status === 'done' || status === 'cancelled') target.searchParams.set('status', status)
  return NextResponse.redirect(target)
}
