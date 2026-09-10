'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser, homeFor } from '@/lib/auth/session'
import { recordAudit } from '@/lib/audit'
import { rateLimit, callerKey } from '@/lib/util/rate-limit'
import { hashInviteToken, inviteHashMatches } from '@/lib/util/invites'
import { acceptInviteSchema, changePasswordSchema, signInSchema } from '@/lib/validation/schemas'
import { assertSameOrigin, fail, fromZod, ok, type ActionResult } from '@/lib/actions/result'
import type { AppRole } from '@/lib/db/types'

/** Never say whether the email exists — that would be a user-enumeration oracle. */
const BAD_CREDENTIALS = 'That email and password combination is not recognised.'

/* ------------------------------------------------------------------ sign in */

export async function signInAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')

  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  // Two windows: a tight one per account, a looser one per source address.
  const perAccount = await rateLimit(`signin:acct:${parsed.data.email}`, 8, 15 * 60_000)
  const perIp = await rateLimit(await callerKey('signin:ip'), 30, 15 * 60_000)
  if (!perAccount.ok || !perIp.ok) {
    const wait = Math.max(perAccount.retryAfterSeconds, perIp.retryAfterSeconds)
    return fail(`Too many attempts. Try again in ${Math.ceil(wait / 60)} minute(s).`)
  }

  const supabase = await createUserClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error || !data.user) return fail(BAD_CREDENTIALS)

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', data.user.id)
    .single()

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut()
    return fail('This account is not active. Please contact the club.')
  }

  await recordAudit({
    actorId: data.user.id,
    actorRole: profile.role,
    action: 'auth.sign_in',
    entity: 'profile',
    entityId: data.user.id,
  })

  const next = formData.get('next')
  // Only ever follow an internal path: an absolute URL here would be an open redirect.
  const target =
    typeof next === 'string' && /^\/(?!\/)/.test(next) ? next : homeFor(profile.role as AppRole)

  redirect(target)
}

/* ----------------------------------------------------------------- sign out */

export async function signOutAction(): Promise<void> {
  const user = await getSessionUser()
  const supabase = await createUserClient()
  await supabase.auth.signOut()

  if (user) {
    await recordAudit({
      actorId: user.id,
      actorRole: user.profile.role,
      action: 'auth.sign_out',
      entity: 'profile',
      entityId: user.id,
    })
  }
  redirect('/login')
}

/* ---------------------------------------------------------- change password */

/**
 * The only self-service change a client is allowed to make. The current
 * password is re-verified first, so a stolen session cannot silently take over
 * the account.
 */
export async function changePasswordAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')

  const user = await getSessionUser()
  if (!user) return fail('Please sign in again.')

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  const limit = await rateLimit(`pwchange:${user.id}`, 5, 15 * 60_000)
  if (!limit.ok) return fail('Too many attempts. Please try again shortly.')

  if (!user.email) return fail('This account has no email address. Please contact the club.')

  const supabase = await createUserClient()

  // Re-authenticate against the current password before accepting a new one.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  })
  if (reauthError) {
    return fail('Your current password is not correct.', {
      currentPassword: 'Not correct',
    })
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword })
  if (error) {
    return fail(error.message.includes('should be different')
      ? 'Choose a password you have not used here before.'
      : 'Could not update the password. Please try again.')
  }

  await recordAudit({
    actorId: user.id,
    actorRole: user.profile.role,
    action: 'auth.password_changed',
    entity: 'profile',
    entityId: user.id,
  })

  return ok(null, 'Your password has been changed.')
}

/* --------------------------------------------------------- accept an invite */

export async function acceptInviteAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')

  const parsed = acceptInviteSchema.safeParse({
    token: formData.get('token'),
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    phone: formData.get('phone') || undefined,
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    acceptedTerms: formData.get('acceptedTerms') === 'on',
  })
  if (!parsed.success) return fromZod(parsed.error)

  const limit = await rateLimit(await callerKey('invite'), 10, 10 * 60_000)
  if (!limit.ok) return fail('Too many attempts. Please try again shortly.')

  const admin = createAdminClient()
  const tokenHash = hashInviteToken(parsed.data.token)

  const { data: invite } = await admin
    .from('registration_invites')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  const invalid = 'This registration link is not valid. Ask the club for a new one.'
  if (!invite || !inviteHashMatches(invite.token_hash, tokenHash)) return fail(invalid)
  if (invite.used_at || invite.revoked_at) return fail('This registration link has already been used.')
  if (new Date(invite.expires_at) <= new Date()) return fail('This registration link has expired.')

  // An invite issued for a specific address may only be redeemed by it.
  if (invite.email && invite.email.toLowerCase() !== parsed.data.email.toLowerCase()) {
    return fail('This link was issued for a different email address.', {
      email: 'Does not match the invitation',
    })
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    // The role lives in app_metadata, which a user can never write to.
    app_metadata: {
      role: invite.role,
      full_name: parsed.data.fullName,
      phone: parsed.data.phone || null,
    },
  })

  if (createError || !created.user) {
    const duplicate = createError?.message?.toLowerCase().includes('already')
    return fail(
      duplicate
        ? 'An account already exists for that email. Try signing in instead.'
        : 'Could not create the account. Please contact the club.',
    )
  }

  // Burn the invite. Conditional so a concurrent redemption cannot reuse it.
  const { data: burned } = await admin
    .from('registration_invites')
    .update({ used_at: new Date().toISOString(), used_by: created.user.id })
    .eq('id', invite.id)
    .is('used_at', null)
    .select('id')
    .maybeSingle()

  if (!burned) {
    // Someone else redeemed it between our check and our write: undo the account.
    await admin.auth.admin.deleteUser(created.user.id)
    return fail('This registration link has already been used.')
  }

  await recordAudit({
    actorId: created.user.id,
    actorRole: invite.role,
    action: 'auth.invite_redeemed',
    entity: 'registration_invite',
    entityId: invite.id,
    after: { role: invite.role, profile_id: created.user.id },
  })

  const supabase = await createUserClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })
  if (signInError) {
    return ok(null, 'Your account is ready. Please sign in.')
  }

  revalidatePath('/', 'layout')
  redirect(homeFor(invite.role as AppRole))
}
