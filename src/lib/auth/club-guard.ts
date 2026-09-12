import 'server-only'

import { redirect } from 'next/navigation'
import { requireRole, homeFor, type SessionUser } from '@/lib/auth/session'
import { getRequestClub, ownClubUrl, platformUrl, type TenantClub } from '@/lib/tenant'
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

  if (!club || user.profile.club_id !== club.id) {
    // The address names no live club, or not this person's. Send them to
    // their own club — and if that club is no longer live, to a page that
    // says so, never back to the address that just refused them.
    const home = await ownClubUrl(user.profile.club_id, homeFor(user.profile.role))
    redirect(home ?? '/closed')
  }

  if (club.status === 'suspended' && user.profile.role !== 'admin') {
    redirect('/suspended')
  }

  return { user, club }
}

