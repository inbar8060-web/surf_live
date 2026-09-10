import type { Metadata } from 'next'
import Link from 'next/link'
import { getClubSettings } from '@/lib/db/queries'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const club = await getClubSettings()

  // Reflecting an attacker-supplied absolute URL back into the form would make
  // this an open redirect, so only internal paths survive.
  const safeNext = typeof next === 'string' && /^\/(?!\/)/.test(next) ? next : ''

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <p className="text-3xl" aria-hidden>🌊</p>
        <h1 className="mt-2 text-2xl font-semibold">{club.club_name}</h1>
        <p className="muted mt-1 text-sm">Sign in to manage your sessions</p>
      </div>

      <div className="surface p-5">
        <LoginForm next={safeNext} />
      </div>

      <p className="muted mt-5 text-center text-xs">
        Accounts are issued by the club.{' '}
        <Link href="/" className="underline">
          Back to the home page
        </Link>
      </p>
    </div>
  )
}
