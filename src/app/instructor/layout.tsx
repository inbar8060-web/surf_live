import { requireRole } from '@/lib/auth/session'
import { AppShell, type NavItem } from '@/components/layout/app-shell'

const NAV: NavItem[] = [
  { href: '/instructor', label: 'Today' },
  { href: '/instructor/requests', label: 'Requests' },
  { href: '/instructor/groups', label: 'All groups' },
  { href: '/instructor/profile', label: 'My profile' },
]

export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('instructor')
  return (
    <AppShell user={user} nav={NAV} areaLabel="Instructor">
      {children}
    </AppShell>
  )
}
