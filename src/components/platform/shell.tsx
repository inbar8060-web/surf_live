'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { Globe, X } from 'lucide-react'
import { adminButton } from '@/components/ui/button-class'
import { signOutAction } from '@/lib/actions/auth'
import { Initials } from '@/components/ui/bits'

/**
 * The operator's chrome. Deliberately the admin desk's dark palette so the
 * platform reads as "the desk above the desks", with its own four sections.
 */
export const PLATFORM_SECTIONS = [
  { href: '/platform', label: 'Overview', blurb: 'Every club at a glance' },
  { href: '/platform/clubs', label: 'Clubs', blurb: 'Add, pause, reach a club' },
  { href: '/platform/support', label: 'Support', blurb: 'Conversations with club administrators' },
  { href: '/platform/finance', label: 'Finance', blurb: 'Plans, fees and club volume' },
  { href: '/platform/audit', label: 'Audit', blurb: 'Everything the platform did' },
] as const

function isActive(pathname: string, href: string) {
  if (href === '/platform') return pathname === '/platform'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function PlatformShell({
  userName,
  openSupport,
  children,
}: {
  userName: string
  openSupport: number
  children: ReactNode
}) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="app-admin min-h-screen">
      <header style={{ background: 'var(--color-adm-chrome)' }}>
        <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-5 py-3 lg:px-[26px]">
          <Link href="/platform" className="flex shrink-0 items-center gap-2" style={{ color: '#fff' }}>
            <Globe size={20} style={{ color: 'var(--color-adm-bright)' }} />
            <span style={{ fontSize: 15, fontWeight: 800 }}>Surfer Live</span>
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
            PLATFORM
          </span>

          <div className="ml-auto flex shrink-0 items-center gap-2.5">
            <Link href="/platform/clubs/new" className={adminButton('bright', 'sm')}>
              Add a club
            </Link>
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
            <button
              type="button"
              className={`${adminButton('onChrome', 'sm')} lg:hidden`}
              onClick={() => setMenuOpen(true)}
            >
              Menu
            </button>
          </div>
        </div>

        <nav aria-label="Sections" className="mx-auto hidden max-w-[1440px] gap-1 px-[26px] lg:flex">
          {PLATFORM_SECTIONS.map((section) => {
            const active = isActive(pathname, section.href)
            const badge = section.href === '/platform/support' && openSupport > 0 ? openSupport : null
            return (
              <Link
                key={section.href}
                href={section.href}
                aria-current={active ? 'page' : undefined}
                style={{
                  padding: '10px 12px',
                  fontSize: 14,
                  fontWeight: active ? 800 : 600,
                  color: active ? '#fff' : 'var(--color-adm-chrome-ink)',
                  borderBottom: `3px solid ${active ? 'var(--color-adm-bright)' : 'transparent'}`,
                }}
              >
                {section.label}
                {badge && (
                  <span
                    style={{
                      marginLeft: 6,
                      background: 'var(--color-adm-bright)',
                      color: '#0d1a16',
                      borderRadius: 999,
                      padding: '1px 7px',
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 py-5 lg:px-[26px] lg:py-[22px]">{children}</main>

      {menuOpen && (
        <div className="fixed inset-0 z-50 flex items-end lg:hidden">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setMenuOpen(false)}
            className="sheet-scrim absolute inset-0 h-full w-full cursor-default"
            style={{ background: 'rgba(18,33,29,0.45)' }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Sections"
            className="sheet-panel safe-bottom relative w-full bg-white px-5 pt-3"
            style={{ borderRadius: '28px 28px 0 0', maxHeight: '80vh', overflowY: 'auto' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span style={{ fontSize: 17, fontWeight: 800 }}>Sections</span>
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <ul className="flex flex-col gap-1.5">
              {PLATFORM_SECTIONS.map((section) => (
                <li key={section.href}>
                  <Link
                    href={section.href}
                    onClick={() => setMenuOpen(false)}
                    className="block"
                    style={{ borderRadius: 14, padding: '12px 14px', background: 'var(--color-adm-ground)' }}
                  >
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 800 }}>{section.label}</span>
                    <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-adm-ink-2)' }}>
                      {section.blurb}
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
