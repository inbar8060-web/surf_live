'use server'

import { revalidatePath } from 'next/cache'
import { createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertRole, getSessionUser } from '@/lib/auth/session'
import { recordAudit } from '@/lib/audit'
import { rateLimit } from '@/lib/util/rate-limit'
import {
  amendReservationSchema,
  createReservationSchema,
  decideReservationSchema,
} from '@/lib/validation/schemas'
import { assertSameOrigin, describeDbError, fail, fromZod, ok, type ActionResult } from './result'
import { optionalStr, str } from './form'

const DENIED = 'You are not allowed to do that.'

/**
 * A client asks for a place on a session.
 *
 * Written through the *user* client, not the service role: the request must be
 * subject to RLS and to the reservation trigger, which decides the price,
 * checks capacity under a row lock and forces the status to 'pending'. Nothing
 * the browser sends can change any of that.
 */
export async function requestReservationAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const user = await assertRole('client')
  if (!user) return fail(DENIED)

  const parsed = createReservationSchema.safeParse({
    slotId: str(formData, 'slotId'),
    participants: str(formData, 'participants') || 1,
    clientPackageId: optionalStr(formData, 'clientPackageId'),
    clientNote: optionalStr(formData, 'clientNote'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  const limit = await rateLimit(`booking:${user.id}`, 20, 60 * 60_000)
  if (!limit.ok) return fail('That is a lot of booking requests. Please pause for a moment.')

  const supabase = await createUserClient()
  const { data, error } = await supabase
    .from('reservations')
    .insert({
      slot_id: parsed.data.slotId,
      client_id: user.id,
      participants: parsed.data.participants,
      client_package_id: parsed.data.clientPackageId || null,
      client_note: parsed.data.clientNote || null,
    })
    .select('id')
    .single()

  if (error || !data) return fail(describeDbError(error, 'Could not send that request.'))

  await recordAudit({
    actorId: user.id,
    actorRole: 'client',
    action: 'reservation.requested',
    entity: 'reservation',
    entityId: data.id,
    after: parsed.data,
  })

  revalidatePath('/client')
  revalidatePath('/client/book')
  revalidatePath('/instructor/requests')
  revalidatePath('/admin/requests')
  return ok({ id: data.id }, 'Request sent. You will hear back once it is reviewed.')
}

/**
 * A client changes an existing booking. An approved booking drops back to
 * pending automatically — that rule lives in the database trigger, so it holds
 * regardless of what this action does.
 */
export async function amendReservationAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const user = await assertRole('client')
  if (!user) return fail(DENIED)

  const parsed = amendReservationSchema.safeParse({
    reservationId: str(formData, 'reservationId'),
    participants: str(formData, 'participants'),
    clientNote: optionalStr(formData, 'clientNote'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  const supabase = await createUserClient()
  const { data, error } = await supabase
    .from('reservations')
    .update({
      participants: parsed.data.participants,
      client_note: parsed.data.clientNote || null,
    })
    .eq('id', parsed.data.reservationId)
    .eq('client_id', user.id)
    .select('id, status, revision')
    .maybeSingle()

  if (error) return fail(describeDbError(error, 'Could not change that booking.'))
  if (!data) return fail('That booking could not be found.')

  await recordAudit({
    actorId: user.id,
    actorRole: 'client',
    action: 'reservation.amended',
    entity: 'reservation',
    entityId: parsed.data.reservationId,
    after: { ...parsed.data, status: data.status, revision: data.revision },
  })

  revalidatePath('/client')
  revalidatePath('/instructor/requests')
  return ok(
    null,
    data.status === 'pending'
      ? 'Booking updated. It needs to be approved again.'
      : 'Booking updated.',
  )
}

/** A client withdraws a booking. */
export async function cancelReservationAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const user = await assertRole('client')
  if (!user) return fail(DENIED)

  const reservationId = str(formData, 'reservationId')
  const supabase = await createUserClient()

  const { data, error } = await supabase
    .from('reservations')
    .update({ status: 'cancelled' })
    .eq('id', reservationId)
    .eq('client_id', user.id)
    .select('id')
    .maybeSingle()

  if (error) return fail(describeDbError(error, 'Could not cancel that booking.'))
  if (!data) return fail('That booking could not be found.')

  await recordAudit({
    actorId: user.id,
    actorRole: 'client',
    action: 'reservation.cancelled',
    entity: 'reservation',
    entityId: reservationId,
  })

  revalidatePath('/client')
  revalidatePath('/instructor/requests')
  return ok(null, 'Booking cancelled.')
}

/**
 * Staff decide a request.
 *
 * An instructor may only decide requests on their own sessions. That is
 * enforced by the RLS policy on reservations (app.teaches_slot), so this runs
 * through the user client and lets Postgres be the judge — an instructor
 * posting another session's id gets zero rows back, not a decision.
 */
export async function decideReservationAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const user = await assertRole('admin', 'instructor')
  if (!user) return fail(DENIED)

  const parsed = decideReservationSchema.safeParse({
    reservationId: str(formData, 'reservationId'),
    decision: str(formData, 'decision'),
    reason: optionalStr(formData, 'reason'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  if (parsed.data.decision === 'rejected' && !parsed.data.reason) {
    return fail('Please give the client a reason.', { reason: 'Required when declining' })
  }

  const supabase = await createUserClient()
  const { data, error } = await supabase
    .from('reservations')
    .update({
      status: parsed.data.decision,
      rejection_reason: parsed.data.decision === 'rejected' ? parsed.data.reason || null : null,
    })
    .eq('id', parsed.data.reservationId)
    .select('id, client_id, slot_id, status')
    .maybeSingle()

  if (error) return fail(describeDbError(error, 'Could not record that decision.'))
  if (!data) return fail('That request is not one you can decide.')

  await recordAudit({
    actorId: user.id,
    actorRole: user.profile.role,
    action: `reservation.${parsed.data.decision}`,
    entity: 'reservation',
    entityId: parsed.data.reservationId,
    after: { decision: parsed.data.decision, reason: parsed.data.reason ?? null },
  })

  revalidatePath('/instructor/requests')
  revalidatePath('/instructor')
  revalidatePath('/admin/requests')
  revalidatePath('/client')
  return ok(null, `Request ${parsed.data.decision === 'approved' ? 'approved' : parsed.data.decision}.`)
}

/**
 * A staff note on a booking. reservations.staff_note has its UPDATE privilege
 * revoked from browser sessions, so this deliberately goes through the service
 * role after the role check above.
 */
export async function setStaffNoteAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const user = await assertRole('admin', 'instructor')
  if (!user) return fail(DENIED)

  const reservationId = str(formData, 'reservationId')
  const note = str(formData, 'staffNote').slice(0, 1000)

  // An instructor may only annotate a session they actually teach.
  if (user.profile.role === 'instructor') {
    const supabase = await createUserClient()
    const { data: visible } = await supabase
      .from('reservations')
      .select('id')
      .eq('id', reservationId)
      .maybeSingle()
    if (!visible) return fail(DENIED)
  }

  const { error } = await createAdminClient()
    .from('reservations')
    .update({ staff_note: note || null })
    .eq('id', reservationId)

  if (error) return fail(describeDbError(error, 'Could not save that note.'))

  await recordAudit({
    actorId: user.id,
    actorRole: user.profile.role,
    action: 'reservation.note_set',
    entity: 'reservation',
    entityId: reservationId,
  })

  revalidatePath('/instructor')
  revalidatePath('/admin/requests')
  return ok(null, 'Note saved.')
}

/** Staff book a client onto a session directly, skipping the request step. */
export async function staffBookClientAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const clientId = str(formData, 'clientId')
  const slotId = str(formData, 'slotId')
  const participants = Number(str(formData, 'participants') || 1)
  const clientPackageId = optionalStr(formData, 'clientPackageId')

  if (!clientId || !slotId) return fail('Pick both a client and a session.')
  if (!Number.isInteger(participants) || participants < 1 || participants > 20) {
    return fail('That is not a valid number of places.')
  }

  const { data, error } = await createAdminClient()
    .from('reservations')
    .insert({
      client_id: clientId,
      slot_id: slotId,
      participants,
      client_package_id: clientPackageId || null,
      status: 'approved',
      decided_by: admin.id,
      decided_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !data) return fail(describeDbError(error, 'Could not book that client in.'))

  await recordAudit({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'reservation.staff_booked',
    entity: 'reservation',
    entityId: data.id,
    after: { clientId, slotId, participants },
  })

  revalidatePath('/admin/requests')
  revalidatePath('/admin/schedule')
  return ok({ id: data.id }, 'Client booked in and approved.')
}

/** Used by the client screens to offer "pay with a package". */
export async function getUsablePackages() {
  const user = await getSessionUser()
  if (!user || user.profile.role !== 'client') return []

  const supabase = await createUserClient()
  const { data } = await supabase
    .from('my_packages')
    .select('*')
    .eq('is_usable', true)
    .order('expires_at', { ascending: true })

  return data ?? []
}
