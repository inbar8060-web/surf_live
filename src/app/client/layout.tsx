import { requireRole } from '@/lib/auth/session'
import { AppShell, type NavItem } from '@/components/layout/app-shell'

const NAV: NavItem[] = [
  { href: '/client', label: 'Home' },
  { href: '/client/book', label: 'Book' },
  { href: '/client/bookings', label: 'My sessions' },
  { href: '/client/packages', label: 'Packages' },
  { href: '/client/rentals', label: 'Rentals' },
  { href: '/client/reviews', label: 'Reviews' },
]

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('client')
  return (
    <AppShell user={user} nav={NAV} areaLabel="Member">
      {children}
    </AppShell>
  )
}
