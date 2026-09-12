'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertRole, clubIdOf } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { recordAudit } from '@/lib/audit'
import { blockSlotSchema, cancelSlotSchema, timeSlotSchema } from '@/lib/validation/schemas'
import { assertSameOrigin, fail, fromZod, ok, failDb, type ActionResult } from './result'
import { bool, isoFromLocal, optionalStr, str, strList } from './form'

const DENIED = 'You are not allowed to do that.'

/**
 * Create or update a session, including which instructors are on it.
 *
 * Instructor assignment is replaced wholesale rather than diffed: the set is
 * small, and a single replace cannot leave a half-applied roster behind. The
 * database's overlap trigger rejects an instructor who is already teaching at
 * that time.
 */
export async function saveTimeSlotAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const club = await getClubSettings()

  const parsed = timeSlotSchema.safeParse({
    id: optionalStr(formData, 'id'),
    serviceId: str(formData, 'serviceId'),
    startsAt: isoFromLocal(formData, 'startsAt', club.timezone),
    endsAt: isoFromLocal(formData, 'endsAt', club.timezone),
    capacity: str(formData, 'capacity'),
    location: optionalStr(formData, 'location'),
    priceCentsOverride: optionalStr(formData, 'priceCentsOverride'),
    whatsappGroupUrl: optionalStr(formData, 'whatsappGroupUrl'),
    notes: optionalStr(formData, 'notes'),
    instructorIds: strList(formData, 'instructorIds'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  const db = createAdminClient()
  const row = {
    club_id: clubIdOf(admin),
    service_id: parsed.data.serviceId,
    starts_at: parsed.data.startsAt,
    ends_at: parsed.data.endsAt,
    capacity: parsed.data.capacity,
    location: parsed.data.location || null,
    price_cents_override: parsed.data.priceCentsOverride ?? null,
    whatsapp_group_url: parsed.data.whatsappGroupUrl || null,
    notes: parsed.data.notes || null,
    created_by: admin.id,
  }

  // Shrinking capacity below what is already booked would silently oversell,
  // so this is checked before the write, not after it.
  if (parsed.data.id) {
    const { data: booked } = await db
      .from('reservations')
      .select('participants')
      .eq('slot_id', parsed.data.id)
      .in('status', ['pending', 'approved'])

    const taken = (booked ?? []).reduce((sum, r) => sum + r.participants, 0)
    if (taken > parsed.data.capacity) {
      return fail(`There are already ${taken} places booked. Capacity cannot go below that.`, {
        capacity: `At least ${taken}`,
      })
    }
  }

  const { data: slot, error } = parsed.data.id
    ? await db.from('time_slots').update(row).eq('id', parsed.data.id).select('id').single()
    : await db.from('time_slots').insert(row).select('id').single()

  if (error || !slot) return failDb(error, 'Could not save the session.')

  const { error: clearError } = await db
    .from('time_slot_instructors')
    .delete()
    .eq('slot_id', slot.id)
  if (clearError) return failDb(clearError, 'Could not update the instructors.')

  if (parsed.data.instructorIds.length > 0) {
    const { error: assignError } = await db.from('time_slot_instructors').insert(
      parsed.data.instructorIds.map((instructorId, index) => ({
        club_id: clubIdOf(admin),
        slot_id: slot.id,
        instructor_id: instructorId,
        is_lead: index === 0,
        assigned_by: admin.id,
      })),
    )
    if (assignError) return failDb(assignError, 'Could not assign those instructors.')
  }

  await recordAudit({
    actorId: admin.id,
    actorRole: 'admin',
    action: parsed.data.id ? 'slot.updated' : 'slot.created',
    entity: 'time_slot',
    entityId: slot.id,
    after: { ...row, instructors: parsed.data.instructorIds },
  })

  revalidatePath('/admin/schedule')
  revalidatePath('/instructor')
  revalidatePath('/client/book')
  return ok({ id: slot.id }, parsed.data.id ? 'Session updated.' : 'Session added to the calendar.')
}

/**
 * Block or unblock a session. Blocking takes it off the client-facing catalog
 * immediately; bookings already made are left alone so staff can decide what
 * to do with them.
 */
export async function blockSlotAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const parsed = blockSlotSchema.safeParse({
    slotId: str(formData, 'slotId'),
    blocked: bool(formData, 'blocked'),
    reason: optionalStr(formData, 'reason'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  const { error } = await createAdminClient()
    .from('time_slots')
    .update({
      status: parsed.data.blocked ? 'blocked' : 'open',
      block_reason: parsed.data.blocked ? parsed.data.reason || 'Blocked by the club' : null,
    })
    .eq('id', parsed.data.slotId)

  if (error) return failDb(error, 'Could not change the session.')

  await recordAudit({
    actorId: admin.id,
    actorRole: 'admin',
    action: parsed.data.blocked ? 'slot.blocked' : 'slot.unblocked',
    entity: 'time_slot',
    entityId: parsed.data.slotId,
    after: { reason: parsed.data.reason ?? null },
  })

  revalidatePath('/admin/schedule')
  revalidatePath('/client/book')
  return ok(null, parsed.data.blocked ? 'Session blocked.' : 'Session reopened.')
}

/**
 * Cancel a session outright. The database trigger cancels every live booking
 * on it, so clients see the change straight away.
 */
export async function cancelSlotAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const parsed = cancelSlotSchema.safeParse({
    slotId: str(formData, 'slotId'),
    reason: optionalStr(formData, 'reason'),
  })
  if (!parsed.success) return fromZod(parsed.error)
  const { slotId } = parsed.data
  const reason = parsed.data.reason ?? ''

  const { error } = await createAdminClient()
    .from('time_slots')
    .update({ status: 'cancelled', block_reason: reason || 'Cancelled by the club' })
    .eq('id', slotId)

  if (error) return failDb(error, 'Could not cancel the session.')

  await recordAudit({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'slot.cancelled',
    entity: 'time_slot',
    entityId: slotId,
    after: { reason },
  })

  revalidatePath('/admin/schedule')
  revalidatePath('/client')
  return ok(null, 'Session cancelled and every booking on it released.')
}
