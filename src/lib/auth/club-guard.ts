import 'server-only'

import { redirect } from 'next/navigation'
import { requireRole, homeFor, type SessionUser } from '@/lib/auth/session'
import { getRequestClub, clubUrl, platformUrl, type TenantClub } from '@/lib/tenant'
import type { AppRole } from '@/lib/db/types'

/**
 * The guard every club-side layout runs.
 *
 * Two facts have to agree before a club page renders: the club the address
 * names, and the club the signed-in person belongs to. They are compared,
 * never merged. A member of club A who opens club B's address is sent to
 * their own club — not shown club B with their own data, and not shown club
 * B's data. The platform operator has no club and is sent to their own area.
 *
 * RLS would refuse the data anyway; this makes the refusal a redirect rather
 * than a page full of empty lists.
 */
export async function requireClubRole(
  ...roles: AppRole[]
): Promise<{ user: SessionUser; club: TenantClub }> {
  const [user, club] = await Promise.all([requireRole(...roles), getRequestClub()])

  if (user.profile.role === 'super_admin') redirect(platformUrl('/platform'))

  if (!club) {
    // a club address that names no active club, or the apex — send them home
    redirect(user.profile.club_id ? await ownClubUrl(user) : '/login')
  }

  if (user.profile.club_id !== club.id) {
    redirect(await ownClubUrl(user))
  }

  if (club.status === 'suspended' && user.profile.role !== 'admin') {
    redirect('/suspended')
  }

  return { user, club }
}

async function ownClubUrl(user: SessionUser): Promise<string> {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const { data } = await createAdminClient()
    .from('clubs')
    .select('slug')
    .eq('id', user.profile.club_id ?? '')
    .maybeSingle()
  return data ? clubUrl(data.slug, homeFor(user.profile.role)) : '/login'
}
