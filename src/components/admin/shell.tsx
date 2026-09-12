'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { Search, Waves, X } from 'lucide-react'
import { AdminTabBar } from '@/components/ui/tab-bar'
import { adminButton } from '@/components/ui/button-class'
import { signOutAction } from '@/lib/actions/auth'
import { Initials } from '@/components/ui/bits'

/**
 * The admin routes are grouped into eight named categories. Sub-tabs
 * inside a category pick the area, and they live in the URL (`?tab=`) exactly
 * as `?view=` already does — so a staff member can bookmark or share the exact
 * screen they are looking at, and a Server Action's revalidate lands back on it.
 */
export const CATEGORIES = [
  { href: '/admin', label: 'Desk', blurb: 'What is happening right now' },
  { href: '/admin/bookings', label: 'Bookings', blurb: 'Approve or decline what members asked for' },
  { href: '/admin/schedule', label: 'Schedule', blurb: 'Sessions, instructors, blocking' },
  { href: '/admin/catalog', label: 'Catalog', blurb: 'Services, prices and lesson packages' },
  { href: '/admin/people', label: 'People', blurb: 'Members, instructors, invites and feedback' },
  { href: '/admin/gear', label: 'Gear', blurb: 'Stock levels and rentals' },
  { href: '/admin/finance', label: 'Finance', blurb: 'Money in, by month, quarter and year' },
  { href: '/admin/club', label: 'Club', blurb: 'Settings, the review wall and the audit log' },
  { href: '/admin/support', label: 'Support', blurb: 'Ask the platform for help' },
] as const

function isActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AdminShell({
  clubName,
  userName,
  action,
  children,
}: {
  clubName: string
  userName: string
  action?: ReactNode
  children: ReactNode
}) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <div className="app-admin min-h-screen">
      {/* ---------------------------------------------------- desktop chrome */}
      <header style={{ background: 'var(--color-adm-chrome)' }}>
        <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-5 py-3 lg:px-[26px]">
          <Link href="/admin" className="flex shrink-0 items-center gap-2" style={{ color: '#fff' }}>
            <Waves size={20} style={{ color: 'var(--color-adm-bright)' }} />
            <span style={{ fontSize: 15, fontWeight: 800 }}>{clubName}</span>
          </Link>

          <span
            className="hidden shrink-0 sm:inline"
            style={{
              background: 'var(--color-adm-chrome-3)',
              color: 'var(--color-adm-chrome-ink-2)',
              borderRadius: 7,
              padding: '4px 9px',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.08em',
            }}
          >
            ADMIN DESK
          </span>

          <form action="/admin/people" className="ml-auto hidden lg:block">
            <div className="relative" style={{ width: 300 }}>
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--color-adm-chrome-ink-3)' }}
              />
              <input
                name="q"
                placeholder="Search people"
                aria-label="Search people"
                style={{
                  width: '100%',
                  height: 36,
                  borderRadius: 10,
                  background: 'var(--color-adm-chrome-2)',
                  border: '1px solid var(--color-adm-chrome-3)',
                  color: '#fff',
                  padding: '0 12px 0 32px',
                  fontSize: 13,
                }}
              />
            </div>
          </form>

          <div className="ml-auto flex shrink-0 items-center gap-2.5 lg:ml-0">
            {action}
            <Link href="/account" aria-label="Your account">
              <Initials
                name={userName}
                size={34}
                background="var(--color-adm-chrome-3)"
                color="var(--color-adm-chrome-ink-2)"
                fontSize={12}
              />
            </Link>
            <form action={signOutAction} className="hidden sm:block">
              <button type="submit" className={adminButton('onChrome', 'sm')}>
                Sign out
              </button>
            </form>
          </div>
        </div>

        {/* category tabs — desktop only */}
        <nav aria-label="Sections" className="mx-auto hidden max-w-[1440px] gap-1 px-[26px] lg:flex">
          {CATEGORIES.map((category) => {
            const active = isActive(pathname, category.href)
            return (
              <Link
                key={category.href}
                href={category.href}
                aria-current={active ? 'page' : undefined}
                style={{
                  padding: '10px 12px',
                  fontSize: 14,
                  fontWeight: active ? 800 : 600,
                  color: active ? '#fff' : 'var(--color-adm-chrome-ink)',
                  borderBottom: `3px solid ${active ? 'var(--color-adm-bright)' : 'transparent'}`,
                }}
              >
                {category.label}
              </Link>
            )
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 py-5 pb-[110px] lg:px-[26px] lg:py-[22px] lg:pb-[22px]">
        {children}
      </main>

      {/* ------------------------------------------------------ phone chrome */}
      <AdminTabBar onMore={() => setMoreOpen(true)} />

      {moreOpen && (
        <div className="fixed inset-0 z-50 flex items-end lg:hidden">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setMoreOpen(false)}
            className="sheet-scrim absolute inset-0 h-full w-full cursor-default"
            style={{ background: 'rgba(18,33,29,0.45)' }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="All sections"
            className="sheet-panel safe-bottom relative w-full bg-white px-5 pt-3"
            style={{ borderRadius: '28px 28px 0 0', maxHeight: '80vh', overflowY: 'auto' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span style={{ fontSize: 17, fontWeight: 800 }}>All sections</span>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <ul className="flex flex-col gap-1.5">
              {CATEGORIES.map((category) => (
                <li key={category.href}>
                  <Link
                    href={category.href}
                    onClick={() => setMoreOpen(false)}
                    className="block"
                    style={{
                      borderRadius: 14,
                      padding: '12px 14px',
                      background: 'var(--color-adm-ground)',
                    }}
                  >
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 800 }}>{category.label}</span>
                    <span
                      style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-adm-ink-2)' }}
                    >
                      {category.blurb}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <form action={signOutAction} className="mt-3">
              <button type="submit" className={`${adminButton('secondary', 'phone')} w-full`}>
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
