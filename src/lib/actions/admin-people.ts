'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertRole, clubIdOf } from '@/lib/auth/session'
import { recordAudit } from '@/lib/audit'
import { publicEnv } from '@/lib/env'
import { generateInviteToken, inviteUrl } from '@/lib/util/invites'
import { rateLimit } from '@/lib/util/rate-limit'
import {
  createInviteSchema,
  createUserSchema,
  idOnly,
  updateClientSchema,
  updateInstructorSchema,
  updateProfileSchema,
} from '@/lib/validation/schemas'
import { assertSameOrigin, fail, fromZod, ok, failDb, type ActionResult } from './result'
import { bool, commaList, optionalStr, str } from './form'

const DENIED = 'You are not allowed to do that.'

/* ------------------------------------------------------------- invitations */

/**
 * Mint a single-use registration link.
 *
 * A brand new token is generated on every call — links are never reissued or
 * reused. The raw token is returned to the admin once, here; the database only
 * ever sees its SHA-256.
 */
export async function createInviteAction(
  _prev: ActionResult<{ url: string; expiresAt: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ url: string; expiresAt: string }>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const parsed = createInviteSchema.safeParse({
    role: str(formData, 'role'),
    email: optionalStr(formData, 'email'),
    phone: optionalStr(formData, 'phone'),
    fullName: optionalStr(formData, 'fullName'),
    note: optionalStr(formData, 'note'),
    expiresInHours: str(formData, 'expiresInHours') || 72,
  })
  if (!parsed.success) return fromZod(parsed.error)

  const limit = await rateLimit(`invite:create:${admin.id}`, 40, 60 * 60_000)
  if (!limit.ok) return fail('That is a lot of invitations. Please pause for a moment.')

  const { token, tokenHash } = generateInviteToken()
  const expiresAt = new Date(Date.now() + parsed.data.expiresInHours * 3_600_000).toISOString()

  const { data, error } = await createAdminClient()
    .from('registration_invites')
    .insert({
      club_id: clubIdOf(admin),
      token_hash: tokenHash,
      role: parsed.data.role,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      full_name: parsed.data.fullName || null,
      note: parsed.data.note || null,
      expires_at: expiresAt,
      created_by: admin.id,
    })
    .select('id')
    .single()

  if (error || !data) return failDb(error, 'Could not create the invitation.')

  await recordAudit({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'invite.created',
    entity: 'registration_invite',
    entityId: data.id,
    after: { role: parsed.data.role, email: parsed.data.email || null, expires_at: expiresAt },
  })

  revalidatePath('/admin/people')
  return ok(
    { url: inviteUrl(publicEnv.NEXT_PUBLIC_SITE_URL, token), expiresAt },
    'Registration link created. Copy it now — it is not shown again.',
  )
}

export async function revokeInviteAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const parsed = idOnly('inviteId').safeParse({ inviteId: str(formData, 'inviteId') })
  if (!parsed.success) return fromZod(parsed.error)
  const { inviteId } = parsed.data

  const { error } = await createAdminClient()
    .from('registration_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', inviteId)
    .is('used_at', null)

  if (error) return failDb(error, 'Could not revoke the invitation.')

  await recordAudit({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'invite.revoked',
    entity: 'registration_invite',
    entityId: inviteId,
  })

  revalidatePath('/admin/people')
  return ok(null, 'Invitation revoked.')
}

/* ------------------------------------------------- create an account by hand */

export async function createUserAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const parsed = createUserSchema.safeParse({
    role: str(formData, 'role'),
    fullName: str(formData, 'fullName'),
    email: str(formData, 'email'),
    phone: optionalStr(formData, 'phone'),
    password: str(formData, 'password'),
    level: str(formData, 'level') || 'beginner',
  })
  if (!parsed.success) return fromZod(parsed.error)

  const db = createAdminClient()

  const { data: created, error } = await db.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    app_metadata: {
      role: parsed.data.role,
      // the new account belongs to the administrator's club, and no other
      club_id: clubIdOf(admin),
      full_name: parsed.data.fullName,
      phone: parsed.data.phone || null,
    },
  })

  if (error || !created.user) {
    return fail(
      error?.message?.toLowerCase().includes('already')
        ? 'An account already exists for that email address.'
        : 'Could not create the account.',
    )
  }

  // The auth trigger creates the profile and role row; set the starting level.
  if (parsed.data.role === 'client' && parsed.data.level !== 'beginner') {
    await db.from('clients').update({ level: parsed.data.level }).eq('profile_id', created.user.id)
  }

  await recordAudit({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'user.created',
    entity: 'profile',
    entityId: created.user.id,
    after: { role: parsed.data.role, email: parsed.data.email },
  })

  revalidatePath('/admin/people')
  return ok({ id: created.user.id }, `${parsed.data.fullName} can now sign in.`)
}

/* ---------------------------------------------------------- edit an account */

export async function updateProfileAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const parsed = updateProfileSchema.safeParse({
    profileId: str(formData, 'profileId'),
    fullName: str(formData, 'fullName'),
    email: optionalStr(formData, 'email'),
    phone: optionalStr(formData, 'phone'),
    isActive: bool(formData, 'isActive'),
    role: str(formData, 'role'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  const db = createAdminClient()
  const { data: before } = await db
    .from('profiles')
    .select('*')
    .eq('id', parsed.data.profileId)
    .single()

  if (!before) return fail('That account no longer exists.')
  if (before.club_id !== clubIdOf(admin)) return fail(DENIED)

  // Deactivating yourself would lock you out mid-session.
  if (parsed.data.profileId === admin.id && !parsed.data.isActive) {
    return fail('You cannot deactivate your own account.')
  }

  const { error } = await db
    .from('profiles')
    .update({
      full_name: parsed.data.fullName,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      is_active: parsed.data.isActive,
      role: parsed.data.role,
    })
    .eq('id', parsed.data.profileId)

  if (error) return failDb(error, 'Could not save those changes.')

  // Keep the auth record in step so the role in the JWT and the login email match.
  if (parsed.data.email && parsed.data.email !== before.email) {
    await db.auth.admin.updateUserById(parsed.data.profileId, { email: parsed.data.email })
  }
  if (parsed.data.role !== before.role) {
    await db.auth.admin.updateUserById(parsed.data.profileId, {
      app_metadata: { role: parsed.data.role, club_id: before.club_id },
    })
  }

  await recordAudit({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'profile.updated',
    entity: 'profile',
    entityId: parsed.data.profileId,
    before,
    after: parsed.data,
  })

  revalidatePath('/admin/people')
  revalidatePath(`/admin/people/${parsed.data.profileId}`)
  return ok(null, 'Account updated.')
}

export async function updateClientAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const parsed = updateClientSchema.safeParse({
    profileId: str(formData, 'profileId'),
    level: str(formData, 'level'),
    birthDate: optionalStr(formData, 'birthDate'),
    emergencyContactName: optionalStr(formData, 'emergencyContactName'),
    emergencyContactPhone: optionalStr(formData, 'emergencyContactPhone'),
    medicalNotes: optionalStr(formData, 'medicalNotes'),
    adminNotes: optionalStr(formData, 'adminNotes'),
    waiverSigned: bool(formData, 'waiverSigned'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  const db = createAdminClient()
  const { data: before } = await db
    .from('clients')
    .select('*')
    .eq('profile_id', parsed.data.profileId)
    .maybeSingle()

  const { error } = await db
    .from('clients')
    .update({
      level: parsed.data.level,
      birth_date: parsed.data.birthDate || null,
      emergency_contact_name: parsed.data.emergencyContactName || null,
      emergency_contact_phone: parsed.data.emergencyContactPhone || null,
      medical_notes: parsed.data.medicalNotes || null,
      admin_notes: parsed.data.adminNotes || null,
      waiver_signed_at: parsed.data.waiverSigned
        ? (before?.waiver_signed_at ?? new Date().toISOString())
        : null,
    })
    .eq('profile_id', parsed.data.profileId)

  if (error) return failDb(error, 'Could not save those changes.')

  await recordAudit({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'client.updated',
    entity: 'client',
    entityId: parsed.data.profileId,
    before,
    after: parsed.data,
  })

  revalidatePath(`/admin/people/${parsed.data.profileId}`)
  return ok(null, 'Client record updated.')
}

/**
 * Instructors maintain their own bio and contact number; an admin may edit any
 * instructor. The role check therefore allows both, then narrows by identity.
 */
export async function updateInstructorAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const user = await assertRole('admin', 'instructor')
  if (!user) return fail(DENIED)

  const parsed = updateInstructorSchema.safeParse({
    profileId: str(formData, 'profileId'),
    bio: optionalStr(formData, 'bio'),
    specialties: optionalStr(formData, 'specialties'),
    languages: optionalStr(formData, 'languages'),
    whatsappPhone: optionalStr(formData, 'whatsappPhone'),
    calendarColour: str(formData, 'calendarColour') || '#0ea5e9',
  })
  if (!parsed.success) return fromZod(parsed.error)

  if (user.profile.role === 'instructor' && user.id !== parsed.data.profileId) {
    return fail(DENIED)
  }

  const { error } = await createAdminClient()
    .from('instructors')
    .update({
      bio: parsed.data.bio || null,
      specialties: commaList(formData, 'specialties'),
      languages: commaList(formData, 'languages'),
      whatsapp_phone: parsed.data.whatsappPhone || null,
      calendar_color: parsed.data.calendarColour,
    })
    .eq('profile_id', parsed.data.profileId)

  if (error) return failDb(error, 'Could not save those changes.')

  await recordAudit({
    actorId: user.id,
    actorRole: user.profile.role,
    action: 'instructor.updated',
    entity: 'instructor',
    entityId: parsed.data.profileId,
    after: parsed.data,
  })

  revalidatePath('/admin/people')
  revalidatePath('/instructor/profile')
  return ok(null, 'Profile updated.')
}
