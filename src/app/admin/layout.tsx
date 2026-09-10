import { requireRole } from '@/lib/auth/session'
import { AppShell, type NavItem } from '@/components/layout/app-shell'

const NAV: NavItem[] = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/requests', label: 'Requests' },
  { href: '/admin/schedule', label: 'Schedule' },
  { href: '/admin/catalog', label: 'Catalog' },
  { href: '/admin/people', label: 'People' },
  { href: '/admin/packages', label: 'Packages' },
  { href: '/admin/inventory', label: 'Inventory' },
  { href: '/admin/rentals', label: 'Rentals' },
  { href: '/admin/reviews', label: 'Reviews' },
  { href: '/admin/settings', label: 'Settings' },
]

/** Every /admin page passes through this guard before it renders. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('admin')
  return (
    <AppShell user={user} nav={NAV} areaLabel="Administration">
      {children}
    </AppShell>
  )
}
