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
