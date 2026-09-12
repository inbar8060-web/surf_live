'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserClient } from '@/lib/supabase/server'
import { assertRole, clubIdOf } from '@/lib/auth/session'
import { recordAudit } from '@/lib/audit'
import {
  createRentalSchema,
  inventoryTypeSchema,
  itemStatusSchema,
  rentalStatusSchema,
  returnRentalSchema,
  setQuantitySchema,
} from '@/lib/validation/schemas'
import { assertSameOrigin, fail, fromZod, ok, failDb, type ActionResult } from './result'
import { bool, optionalStr, str } from './form'

const DENIED = 'You are not allowed to do that.'

/* --------------------------------------------------------- inventory types */

export async function saveInventoryTypeAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const parsed = inventoryTypeSchema.safeParse({
    id: optionalStr(formData, 'id'),
    categoryId: optionalStr(formData, 'categoryId'),
    name: str(formData, 'name'),
    kind: str(formData, 'kind'),
    brand: optionalStr(formData, 'brand'),
    sizeLabel: optionalStr(formData, 'sizeLabel'),
    dailyPriceCents: str(formData, 'dailyPriceCents'),
    isActive: bool(formData, 'isActive'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  const db = createAdminClient()
  const row = {
    club_id: clubIdOf(admin),
    category_id: parsed.data.categoryId || null,
    name: parsed.data.name,
    kind: parsed.data.kind,
    brand: parsed.data.brand || null,
    size_label: parsed.data.sizeLabel || null,
    daily_price_cents: parsed.data.dailyPriceCents,
    is_active: parsed.data.isActive,
  }

  const { error } = parsed.data.id
    ? await db.from('inventory_types').update(row).eq('id', parsed.data.id)
    : await db.from('inventory_types').insert(row)

  if (error) return failDb(error, 'Could not save that gear type.')

  await recordAudit({
    actorId: admin.id,
    actorRole: 'admin',
    action: parsed.data.id ? 'inventory_type.updated' : 'inventory_type.created',
    entity: 'inventory_type',
    entityId: parsed.data.id ?? null,
    after: row,
  })

  revalidatePath('/admin/inventory')
  return ok(null, parsed.data.id ? 'Gear type updated.' : 'Gear type added.')
}

/**
 * Set how many units of a type the club holds.
 *
 * Delegates to the set_inventory_quantity function so adding or retiring units
 * happens in one transaction, and so a unit that is currently out on rental is
 * never removed from under a client.
 */
export async function setQuantityAction(
  _prev: ActionResult<{ total: number; available: number }> | null,
  formData: FormData,
): Promise<ActionResult<{ total: number; available: number }>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const parsed = setQuantitySchema.safeParse({
    typeId: str(formData, 'typeId'),
    quantity: str(formData, 'quantity'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  const { data, error } = await (await createUserClient()).rpc('set_inventory_quantity', {
    p_type_id: parsed.data.typeId,
    p_desired: parsed.data.quantity,
  })

  if (error) return failDb(error, 'Could not change the quantity.')

  const result = Array.isArray(data) ? data[0] : null
  const total = result?.total_units ?? parsed.data.quantity
  const available = result?.available_units ?? 0

  await recordAudit({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'inventory.quantity_set',
    entity: 'inventory_type',
    entityId: parsed.data.typeId,
    after: { requested: parsed.data.quantity, total, available },
  })

  revalidatePath('/admin/inventory')
  return ok({ total, available }, `Stock is now ${total} unit(s), ${available} available.`)
}

export async function setItemStatusAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const parsed = itemStatusSchema.safeParse({
    itemId: str(formData, 'itemId'),
    status: str(formData, 'status'),
    notes: optionalStr(formData, 'notes'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  const db = createAdminClient()

  // A unit that is out with a client cannot be moved by an edit here.
  const { data: item } = await db
    .from('inventory_items')
    .select('status, asset_tag')
    .eq('id', parsed.data.itemId)
    .maybeSingle()

  if (item?.status === 'rented') {
    return fail(`${item.asset_tag} is out on a rental. Book it back in first.`)
  }

  const { error } = await db
    .from('inventory_items')
    .update({ status: parsed.data.status, notes: parsed.data.notes || null })
    .eq('id', parsed.data.itemId)

  if (error) return failDb(error, 'Could not update that unit.')

  await recordAudit({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'inventory_item.status_changed',
    entity: 'inventory_item',
    entityId: parsed.data.itemId,
    before: item,
    after: { status: parsed.data.status },
  })

  revalidatePath('/admin/inventory')
  return ok(null, 'Unit updated.')
}

/* ----------------------------------------------------------------- rentals */

/**
 * Put a board out with a client. The rental's price comes from the gear type
 * (in a trigger), and the overlap constraint refuses a double booking of the
 * same physical unit.
 */
export async function createRentalAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const parsed = createRentalSchema.safeParse({
    clientId: str(formData, 'clientId'),
    itemId: str(formData, 'itemId'),
    startDate: str(formData, 'startDate'),
    endDate: str(formData, 'endDate'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  const handOverNow = bool(formData, 'handOverNow')

  const { data, error } = await createAdminClient()
    .from('rentals')
    .insert({
      club_id: clubIdOf(admin),
      client_id: parsed.data.clientId,
      item_id: parsed.data.itemId,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      status: handOverNow ? 'out' : 'reserved',
      created_by: admin.id,
    })
    .select('id, price_cents, currency')
    .single()

  if (error || !data) return failDb(error, 'Could not create the rental.')

  await recordAudit({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'rental.created',
    entity: 'rental',
    entityId: data.id,
    after: { ...parsed.data, status: handOverNow ? 'out' : 'reserved', price_cents: data.price_cents },
  })

  revalidatePath('/admin/rentals')
  revalidatePath('/admin/inventory')
  return ok(
    { id: data.id },
    handOverNow
      ? 'Rental opened — that board is now out of stock.'
      : 'Rental reserved. Mark it as handed over on pick-up.',
  )
}

export async function setRentalStatusAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const parsed = rentalStatusSchema.safeParse({
    rentalId: str(formData, 'rentalId'),
    status: str(formData, 'status'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  const { error } = await createAdminClient()
    .from('rentals')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.rentalId)

  if (error) return failDb(error, 'Could not update the rental.')

  await recordAudit({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'rental.status_changed',
    entity: 'rental',
    entityId: parsed.data.rentalId,
    after: { status: parsed.data.status },
  })

  revalidatePath('/admin/rentals')
  revalidatePath('/admin/inventory')
  return ok(null, 'Rental updated.')
}

/**
 * Hand a board back. The trigger returns the unit to stock, or routes it to
 * maintenance when it comes back in poor condition.
 */
export async function returnRentalAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const parsed = returnRentalSchema.safeParse({
    rentalId: str(formData, 'rentalId'),
    conditionIn: str(formData, 'conditionIn'),
    damageNote: optionalStr(formData, 'damageNote'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  const { error } = await createAdminClient()
    .from('rentals')
    .update({
      status: 'returned',
      condition_in: parsed.data.conditionIn,
      damage_note: parsed.data.damageNote || null,
      returned_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.rentalId)

  if (error) return failDb(error, 'Could not book that board back in.')

  await recordAudit({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'rental.returned',
    entity: 'rental',
    entityId: parsed.data.rentalId,
    after: parsed.data,
  })

  revalidatePath('/admin/rentals')
  revalidatePath('/admin/inventory')
  return ok(
    null,
    parsed.data.conditionIn === 'poor'
      ? 'Booked back in and sent to maintenance.'
      : 'Booked back in and available again.',
  )
}
