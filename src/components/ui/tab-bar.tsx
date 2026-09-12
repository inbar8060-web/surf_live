'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import {
  CalendarDays,
  ClipboardList,
  House,
  Inbox,
  LayoutDashboard,
  Menu,
  Package,
  Plus,
  Star,
  Ticket,
  User,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'

/**
 * The navigation for each interface is declared here, inside the client
 * module, rather than being handed down from the area layout.
 *
 * A Lucide icon is a function component, and a function cannot be serialised
 * across the server/client boundary — passing one from a Server Component
 * layout throws "Functions cannot be passed directly to Client Components".
 * Keeping the lists on this side of the boundary avoids the problem entirely
 * and keeps each bar's shape in one place.
 */
export interface TabItem {
  href: string
  label: string
  icon: LucideIcon
  /** Renders as the raised centre action rather than a normal tab. */
  primary?: boolean
}

const MEMBER_TABS: TabItem[] = [
  { href: '/client', label: 'Home', icon: House },
  { href: '/client/bookings', label: 'Sessions', icon: CalendarDays },
  { href: '/client/book', label: 'Book', icon: Plus, primary: true },
  { href: '/client/packages', label: 'Packages', icon: Ticket },
  { href: '/client/reviews', label: 'Reviews', icon: Star },
]

const INSTRUCTOR_TABS: TabItem[] = [
  { href: '/instructor', label: 'Today', icon: CalendarDays },
  { href: '/instructor/requests', label: 'Requests', icon: Inbox },
  { href: '/instructor/groups', label: 'Groups', icon: Users },
  { href: '/instructor/profile', label: 'Profile', icon: UserRound },
]

const ADMIN_TABS: TabItem[] = [
  { href: '/admin', label: 'Desk', icon: LayoutDashboard },
  { href: '/admin/bookings', label: 'Bookings', icon: ClipboardList },
  { href: '/admin/people', label: 'People', icon: User },
  { href: '/admin/gear', label: 'Gear', icon: Package },
  { href: '#more', label: 'More', icon: Menu },
]

function isActive(pathname: string, href: string): boolean {
  // The area root should not stay lit on every child route.
  if (href === '/client' || href === '/instructor' || href === '/admin') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Member bottom bar: white, five items, with the centre item raised into a
 * circular action. Pinned, and padded clear of the home indicator.
 */
export function MemberTabBar() {
  const pathname = usePathname()
  const items = MEMBER_TABS

  return (
    <nav
      aria-label="Main"
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[430px] items-start justify-around bg-white px-2 pt-2"
      style={{ borderTop: '1px solid #def2ff' }}
    >
      {items.map((item) => {
        const active = isActive(pathname, item.href)

        if (item.primary) {
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className="flex flex-col items-center justify-center"
              style={{
                width: 60,
                height: 60,
                marginTop: -26,
                borderRadius: '50%',
                background: '#2cc4ff',
                border: '5px solid #fff',
                boxShadow: '0 8px 20px rgba(44,196,255,0.45)',
                color: '#072f49',
              }}
            >
              <item.icon size={26} strokeWidth={2} />
            </Link>
          )
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={clsx(
              'flex min-w-[56px] flex-col items-center gap-1 rounded-xl px-2 py-1',
              active ? 'text-sea-950' : 'text-[#7d95a4]',
            )}
          >
            <item.icon size={23} strokeWidth={active ? 2.2 : 1.85} />
            <span style={{ fontSize: 10, fontWeight: 700 }}>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

/**
 * Instructor bottom bar: no chrome at all — it sits straight on the page
 * ground, which keeps the screen as quiet as possible in bright sun.
 */
export function InstructorTabBar() {
  const pathname = usePathname()
  const items = INSTRUCTOR_TABS

  return (
    <nav
      aria-label="Main"
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[430px] items-start justify-around px-3 pt-2"
      style={{ background: 'var(--color-ins-ground)' }}
    >
      {items.map((item) => {
        const active = isActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className="flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-2 py-1"
            style={{ color: active ? 'var(--color-ins-ink)' : 'var(--color-ins-ink-3)' }}
          >
            <item.icon size={22} strokeWidth={active ? 2.2 : 1.85} />
            <span style={{ fontSize: 10, fontWeight: 800 }}>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

/**
 * Admin phone bar: a floating dark pill, so the dense desktop chrome collapses
 * to something thumb-sized without changing palette.
 */
export function AdminTabBar({ onMore }: { onMore?: () => void }) {
  const pathname = usePathname()
  const items = ADMIN_TABS

  return (
    <nav
      aria-label="Main"
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 lg:hidden"
    >
      <div
        className="flex items-center justify-around gap-1"
        style={{
          background: 'var(--color-adm-chrome)',
          borderRadius: 24,
          padding: '10px 14px',
          width: '100%',
          maxWidth: 420,
        }}
      >
        {items.map((item) => {
          const active = isActive(pathname, item.href)
          const isMore = item.href === '#more'

          const content = (
            <>
              <item.icon size={21} strokeWidth={active ? 2.2 : 1.85} />
              <span style={{ fontSize: 10, fontWeight: 800 }}>{item.label}</span>
            </>
          )
          const style = { color: active ? 'var(--color-adm-bright)' : 'var(--color-adm-chrome-ink)' }
          const className = 'flex min-w-[56px] flex-col items-center gap-1 rounded-xl px-2 py-1'

          return isMore ? (
            <button key={item.href} type="button" onClick={onMore} className={className} style={style}>
              {content}
            </button>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={className}
              style={style}
            >
              {content}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
