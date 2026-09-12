import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth/session'
import { getRequestArea, platformUrl } from '@/lib/tenant'
import { createUserClient } from '@/lib/supabase/server'
import { PlatformShell } from '@/components/platform/shell'

/**
 * The operator area. Two checks, both repeated by the database: the caller
 * holds the platform role, and the request arrived at the platform's own
 * address. A club address that somehow reaches this layout is sent to the
 * right one rather than served.
 */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const [user, area] = await Promise.all([requireRole('super_admin'), getRequestArea()])
  if (area !== 'platform') redirect(platformUrl('/platform'))

  const supabase = await createUserClient()
  const { count } = await supabase
    .from('support_conversations')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'awaiting_platform')

  return (
    <PlatformShell userName={user.profile.full_name} openSupport={count ?? 0}>
      {children}
    </PlatformShell>
  )
}
