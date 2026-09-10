import Link from 'next/link'
import { signOutAction } from '@/lib/actions/auth'
import { buttonClass } from '@/components/ui/button-class'
import type { SessionUser } from '@/lib/auth/session'

export interface NavItem {
  href: string
  label: string
}

/**
 * Shared frame for the three signed-in areas. The navigation is passed in by
 * each area's layout rather than derived from the role here, so a nav item can
 * never appear for a role whose layout did not put it there.
 */
export function AppShell({
  user,
  nav,
  areaLabel,
  children,
}: {
  user: SessionUser
  nav: NavItem[]
  areaLabel: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-20 border-b backdrop-blur"
              style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--surface) 88%, transparent)' }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span aria-hidden>🌊</span>
            <span>Surfer Live</span>
          </Link>
          <span className="muted hidden text-xs uppercase tracking-wide sm:inline">{areaLabel}</span>

          <nav className="order-3 flex w-full flex-wrap gap-1 sm:order-none sm:w-auto" aria-label="Main">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-2.5 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/10"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/account" className="muted hidden text-sm hover:underline sm:block">
              {user.profile.full_name}
            </Link>
            <form action={signOutAction}>
              <button type="submit" className={buttonClass('secondary', 'sm')}>
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
