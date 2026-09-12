import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createUserClient } from '@/lib/supabase/server'
import type { AppRole, Profile } from '@/lib/db/types'

export interface SessionUser {
  id: string
  email: string | null
  profile: Profile
}

/**
 * The signed-in user, or null.
 *
 * Uses `getUser()` rather than `getSession()`: getSession only decodes the
 * cookie, while getUser revalidates the JWT with the auth server. On a server
 * that makes authorization decisions, only the verified answer is acceptable.
 *
 * `cache` dedupes this across a single render pass.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createUserClient()

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) return null

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single()

  // No profile, or a deactivated one, is treated as not signed in.
  if (profileError || !profile || !profile.is_active) return null

  return { id: authData.user.id, email: authData.user.email ?? null, profile }
})

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  return user
}

/**
 * Gate a page or server action on role. Redirects rather than throwing so the
 * user lands somewhere sensible, and never reveals whether the resource exists.
 */
export async function requireRole(...roles: AppRole[]): Promise<SessionUser> {
  const user = await requireUser()
  if (!roles.includes(user.profile.role)) {
    redirect(homeFor(user.profile.role))
  }
  return user
}

/** Where each role starts after signing in. */
export function homeFor(role: AppRole): string {
  switch (role) {
    case 'admin':
      return '/admin'
    case 'instructor':
      return '/instructor'
    case 'client':
      return '/client'
    case 'super_admin':
      return '/platform'
  }
}

/**
 * Non-redirecting role check for Server Actions.
 *
 * `requireRole` throws a redirect, which is right for a page but wrong for an
 * action that should return a rendered error. Returns null when the caller is
 * not signed in or holds the wrong role — the caller decides what to say.
 */
export async function assertRole(...roles: AppRole[]): Promise<SessionUser | null> {
  const user = await getSessionUser()
  if (!user || !roles.includes(user.profile.role)) return null
  return user
}

/**
 * Role guard for a Server Action, with a way out when the answer is "no".
 *
 * `assertRole` returning null collapses three very different situations into
 * one dead end: the session expired, the page was left open while somebody
 * signed in as a different account, or the caller genuinely has the wrong
 * role. The first two are ordinary and recoverable — a page that has been open
 * for a while is exactly what happens when someone reads a long document
 * before signing it — so they should not be answered with a flat refusal.
 *
 * Throws a redirect to sign-in when there is no session at all, and otherwise
 * hands back either the user or a message that says what went wrong.
 */
export type ActionGuard =
  | { ok: true; user: SessionUser }
  | { ok: false; error: string }

export async function requireRoleForAction(
  roles: AppRole[],
  returnTo?: string,
): Promise<ActionGuard> {
  const user = await getSessionUser()

  if (!user) {
    // No valid session: send them to sign in and come back to where they were.
    redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : '/login')
  }

  if (!roles.includes(user.profile.role)) {
    return {
      ok: false,
      error:
        `You are signed in as ${user.profile.full_name}, who is ${
          user.profile.role === 'client' ? 'a member' : `an ${user.profile.role}`
        }. ` + 'Reload the page, or sign in with the account this belongs to.',
    }
  }

  return { ok: true, user }
}


/**
 * The club a club-side user belongs to, for the few writes that go through the
 * service role and therefore must name the club themselves. Throws for the
 * platform operator, who has no club and should never reach one of those
 * writes — a thrown error here is a routing bug surfacing early, not a case
 * to handle.
 */
export function clubIdOf(user: SessionUser): string {
  if (!user.profile.club_id) {
    throw new Error(`${user.profile.role} account ${user.id} has no club`)
  }
  return user.profile.club_id
}
