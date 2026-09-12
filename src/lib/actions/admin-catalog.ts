'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertRole, clubIdOf } from '@/lib/auth/session'
import { recordAudit } from '@/lib/audit'
import {
  categorySchema,
  clubSettingsSchema,
  priceChangeSchema,
  serviceSchema,
} from '@/lib/validation/schemas'
import { assertSameOrigin, fail, fromZod, ok, failDb, type ActionResult } from './result'
import { bool, optionalStr, str } from './form'

const DENIED = 'You are not allowed to do that.'

/* ------------------------------------------------------------- categories */

export async function saveCategoryAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const parsed = categorySchema.safeParse({
    id: optionalStr(formData, 'id'),
    name: str(formData, 'name'),
    slug: str(formData, 'slug'),
    kind: str(formData, 'kind'),
    description: optionalStr(formData, 'description'),
    sortOrder: str(formData, 'sortOrder') || 0,
    isActive: bool(formData, 'isActive'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  const db = createAdminClient()
  const row = {
    club_id: clubIdOf(admin),
    name: parsed.data.name,
    slug: parsed.data.slug,
    kind: parsed.data.kind,
    description: parsed.data.description || null,
    sort_order: parsed.data.sortOrder,
    is_active: parsed.data.isActive,
  }

  const { error } = parsed.data.id
    ? await db.from('categories').update(row).eq('id', parsed.data.id)
    : await db.from('categories').insert(row)

  if (error) return failDb(error, 'Could not save the category.')

  await recordAudit({
    actorId: admin.id,
    actorRole: 'admin',
    action: parsed.data.id ? 'category.updated' : 'category.created',
    entity: 'category',
    entityId: parsed.data.id ?? null,
    after: row,
  })

  revalidatePath('/admin/catalog')
  return ok(null, parsed.data.id ? 'Category updated.' : 'Category added.')
}

export async function deleteCategoryAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const id = str(formData, 'id')
  // A category with services attached is deactivated rather than deleted, so
  // historic bookings keep their meaning.
  const { count } = await createAdminClient()
    .from('services')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id)

  const db = createAdminClient()
  const { error } =
    (count ?? 0) > 0
      ? await db.from('categories').update({ is_active: false }).eq('id', id)
      : await db.from('categories').delete().eq('id', id)

  if (error) return failDb(error, 'Could not remove the category.')

  await recordAudit({
    actorId: admin.id,
    actorRole: 'admin',
    action: (count ?? 0) > 0 ? 'category.deactivated' : 'category.deleted',
    entity: 'category',
    entityId: id,
  })

  revalidatePath('/admin/catalog')
  return ok(
    null,
    (count ?? 0) > 0
      ? 'That category has services, so it was deactivated instead of deleted.'
      : 'Category removed.',
  )
}

/* --------------------------------------------------------------- services */

export async function saveServiceAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const parsed = serviceSchema.safeParse({
    id: optionalStr(formData, 'id'),
    categoryId: str(formData, 'categoryId'),
    name: str(formData, 'name'),
    description: optionalStr(formData, 'description'),
    durationMinutes: str(formData, 'durationMinutes'),
    defaultCapacity: str(formData, 'defaultCapacity'),
    priceCents: str(formData, 'priceCents'),
    minLevel: optionalStr(formData, 'minLevel'),
    isActive: bool(formData, 'isActive'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  const db = createAdminClient()
  const row = {
    club_id: clubIdOf(admin),
    category_id: parsed.data.categoryId,
    name: parsed.data.name,
    description: parsed.data.description || null,
    duration_minutes: parsed.data.durationMinutes,
    default_capacity: parsed.data.defaultCapacity,
    price_cents: parsed.data.priceCents,
    min_level: parsed.data.minLevel || null,
    is_active: parsed.data.isActive,
  }

  const { error } = parsed.data.id
    ? await db.from('services').update(row).eq('id', parsed.data.id)
    : await db.from('services').insert(row)

  if (error) return failDb(error, 'Could not save the service.')

  await recordAudit({
    actorId: admin.id,
    actorRole: 'admin',
    action: parsed.data.id ? 'service.updated' : 'service.created',
    entity: 'service',
    entityId: parsed.data.id ?? null,
    after: row,
  })

  revalidatePath('/admin/catalog')
  return ok(null, parsed.data.id ? 'Service updated.' : 'Service added.')
}

/* ---------------------------------------------------------------- pricing */

/**
 * One entry point for every price change in the app. The matching database
 * trigger appends to price_history, so the old figure is never lost.
 */
export async function changePriceAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const parsed = priceChangeSchema.safeParse({
    entityType: str(formData, 'entityType'),
    entityId: str(formData, 'entityId'),
    priceCents: str(formData, 'priceCents'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  const db = createAdminClient()
  const { entityType, entityId, priceCents } = parsed.data

  const result =
    entityType === 'service'
      ? await db.from('services').update({ price_cents: priceCents }).eq('id', entityId)
      : entityType === 'inventory_type'
        ? await db.from('inventory_types').update({ daily_price_cents: priceCents }).eq('id', entityId)
        : entityType === 'package_template'
          ? await db.from('package_templates').update({ price_cents: priceCents }).eq('id', entityId)
          : await db.from('time_slots').update({ price_cents_override: priceCents }).eq('id', entityId)

  if (result.error) return failDb(result.error, 'Could not change the price.')

  await recordAudit({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'price.changed',
    entity: entityType,
    entityId,
    after: { price_cents: priceCents },
  })

  revalidatePath('/admin/catalog')
  revalidatePath('/admin/inventory')
  revalidatePath('/admin/packages')
  return ok(null, 'Price updated.')
}

/* --------------------------------------------------------------- settings */

export async function saveClubSettingsAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const parsed = clubSettingsSchema.safeParse({
    clubName: str(formData, 'clubName'),
    timezone: str(formData, 'timezone'),
    currency: str(formData, 'currency'),
    spotName: str(formData, 'spotName'),
    spotLatitude: str(formData, 'spotLatitude'),
    spotLongitude: str(formData, 'spotLongitude'),
    contactPhone: optionalStr(formData, 'contactPhone'),
    contactEmail: optionalStr(formData, 'contactEmail'),
    cancellationWindowHours: str(formData, 'cancellationWindowHours'),
    tipsEnabled: bool(formData, 'tipsEnabled'),
    address: optionalStr(formData, 'address'),
    website: optionalStr(formData, 'website'),
    openingHours: str(formData, 'openingHours'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  // A bad IANA zone would break every date on every screen.
  try {
    new Intl.DateTimeFormat('en', { timeZone: parsed.data.timezone })
  } catch {
    return fail('That is not a recognised time zone.', {
      timezone: 'Use an IANA name such as Asia/Jerusalem',
    })
  }

  const { error } = await createAdminClient()
    .from('club_settings')
    .update({
      club_name: parsed.data.clubName,
      timezone: parsed.data.timezone,
      currency: parsed.data.currency,
      spot_name: parsed.data.spotName,
      spot_latitude: parsed.data.spotLatitude,
      spot_longitude: parsed.data.spotLongitude,
      contact_phone: parsed.data.contactPhone || null,
      contact_email: parsed.data.contactEmail || null,
      cancellation_window_hours: parsed.data.cancellationWindowHours,
      tips_enabled: parsed.data.tipsEnabled,
      address: parsed.data.address || null,
      website: parsed.data.website || null,
      opening_hours: parsed.data.openingHours,
    })
    .eq('club_id', clubIdOf(admin))

  if (error) return failDb(error, 'Could not save the settings.')

  await recordAudit({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'settings.updated',
    entity: 'club_settings',
    entityId: '1',
    after: parsed.data,
  })

  revalidatePath('/', 'layout')
  return ok(null, 'Settings saved.')
}
