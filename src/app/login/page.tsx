import type { Metadata } from 'next'
import { Waves } from 'lucide-react'
import { getRequestArea, getRequestClub } from '@/lib/tenant'
import { safeInternalPath } from '@/lib/util/safe-path'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Sign in' }

/**
 * One sign-in screen serves all three roles: nothing is known about who is
 * arriving until the credentials are checked, so the app cannot pick the
 * instructor or admin treatment here. It uses the member's deep-water
 * direction, which is the public face of the club.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const [area, club] = await Promise.all([getRequestArea(), getRequestClub()])
  const title = area === 'platform' ? 'Surfer Live · platform' : (club?.name ?? 'Surfer Live')
  const subtitle = area === 'platform' ? 'Operator sign-in.' : `${club?.name ?? 'The club'}. Sign in to see the sea and book your next session.`

  // Reflecting an attacker-supplied URL back into the form would make this an
  // open redirect, so only a verified internal path survives.
  const safeNext = safeInternalPath(next, '')

  return (
    <div
      className="app-member relative flex min-h-screen flex-col justify-center overflow-hidden px-6"
      style={{ background: '#072f49', color: '#fff' }}
    >
      <div
        aria-hidden
        className="wave-texture pointer-events-none absolute inset-x-0 bottom-0"
        style={{ height: 180 }}
      />

      <div className="relative mx-auto w-full max-w-[390px] pb-20">
        <span
          className="mb-6 inline-flex items-center justify-center"
          style={{ width: 60, height: 60, borderRadius: 22, background: '#0b4a6d', color: '#2cc4ff' }}
        >
          <Waves size={30} strokeWidth={2} />
        </span>

        <h1
          className="display"
          style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}
        >
          {title}
        </h1>
        <p className="mt-2 mb-7" style={{ color: '#b6e8ff', fontSize: 15, lineHeight: 1.45 }}>
          {subtitle}
        </p>

        <LoginForm next={safeNext} />

        <p className="mt-9" style={{ color: '#4d7f9e', fontSize: 13, lineHeight: 1.5 }}>
          Accounts are created by the club. Ask at the desk, or open the registration link they
          sent you.
        </p>
      </div>
    </div>
  )
}
