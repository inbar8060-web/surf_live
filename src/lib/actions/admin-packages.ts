'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserClient } from '@/lib/supabase/server'
import { assertRole, clubIdOf } from '@/lib/auth/session'
import { recordAudit } from '@/lib/audit'
import {
  cancelPackageSchema,
  extendPackageSchema,
  grantPackageSchema,
  packageTemplateSchema,
} from '@/lib/validation/schemas'
import { assertSameOrigin, fail, fromZod, ok, failDb, type ActionResult } from './result'
import { bool, optionalStr, str } from './form'

const DENIED = 'You are not allowed to do that.'

export async function savePackageTemplateAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const parsed = packageTemplateSchema.safeParse({
    id: optionalStr(formData, 'id'),
    categoryId: optionalStr(formData, 'categoryId'),
    name: str(formData, 'name'),
    description: optionalStr(formData, 'description'),
    lessonsCount: str(formData, 'lessonsCount'),
    priceCents: str(formData, 'priceCents'),
    validityDays: str(formData, 'validityDays'),
    isActive: bool(formData, 'isActive'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  const db = createAdminClient()
  const row = {
    club_id: clubIdOf(admin),
    category_id: parsed.data.categoryId || null,
    name: parsed.data.name,
    description: parsed.data.description || null,
    lessons_count: parsed.data.lessonsCount,
    price_cents: parsed.data.priceCents,
    validity_days: parsed.data.validityDays,
    is_active: parsed.data.isActive,
  }

  const { error } = parsed.data.id
    ? await db.from('package_templates').update(row).eq('id', parsed.data.id)
    : await db.from('package_templates').insert(row)

  if (error) return failDb(error, 'Could not save the package.')

  await recordAudit({
    actorId: admin.id,
    actorRole: 'admin',
    action: parsed.data.id ? 'package_template.updated' : 'package_template.created',
    entity: 'package_template',
    entityId: parsed.data.id ?? null,
    after: row,
  })

  revalidatePath('/admin/packages')
  return ok(null, parsed.data.id ? 'Package updated.' : 'Package added.')
}

/** Attach a package to a client. Credits are issued through the ledger. */
export async function grantPackageAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const parsed = grantPackageSchema.safeParse({
    clientId: str(formData, 'clientId'),
    templateId: str(formData, 'templateId'),
    note: optionalStr(formData, 'note'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  // Called through the caller's own client on purpose: grant_client_package
  // checks app.is_admin(), which reads the JWT. Going through the service role
  // would leave auth.uid() null and the function would refuse.
  const { data, error } = await (await createUserClient()).rpc('grant_client_package', {
    p_client_id: parsed.data.clientId,
    p_template_id: parsed.data.templateId,
    p_note: parsed.data.note || null,
  })

  if (error || !data) return failDb(error, 'Could not attach the package.')

  await recordAudit({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'package.granted',
    entity: 'client_package',
    entityId: data,
    after: parsed.data,
  })

  revalidatePath(`/admin/people/${parsed.data.clientId}`)
  revalidatePath('/admin/packages')
  return ok({ id: data }, 'Package attached to the client.')
}

/** Add lessons, push the expiry date out, or both. */
export async function extendPackageAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const parsed = extendPackageSchema.safeParse({
    packageId: str(formData, 'packageId'),
    extraLessons: str(formData, 'extraLessons') || 0,
    extraDays: str(formData, 'extraDays') || 0,
    note: optionalStr(formData, 'note'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  const { error } = await (await createUserClient()).rpc('extend_client_package', {
    p_package_id: parsed.data.packageId,
    p_extra_lessons: parsed.data.extraLessons,
    p_extra_days: parsed.data.extraDays,
    p_note: parsed.data.note || null,
  })

  if (error) return failDb(error, 'Could not extend the package.')

  await recordAudit({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'package.extended',
    entity: 'client_package',
    entityId: parsed.data.packageId,
    after: parsed.data,
  })

  revalidatePath('/admin/packages')
  return ok(null, 'Package extended.')
}

/**
 * Dismiss a package outright: the remaining credits are written off through
 * the ledger and the package is closed. Nothing is deleted, so the history of
 * what the client bought and used stays intact.
 */
export async function cancelPackageAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const parsed = cancelPackageSchema.safeParse({
    packageId: str(formData, 'packageId'),
    reason: str(formData, 'reason'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  const { error } = await (await createUserClient()).rpc('cancel_client_package', {
    p_package_id: parsed.data.packageId,
    p_reason: parsed.data.reason,
  })

  if (error) return failDb(error, 'Could not cancel the package.')

  await recordAudit({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'package.cancelled',
    entity: 'client_package',
    entityId: parsed.data.packageId,
    after: parsed.data,
  })

  revalidatePath('/admin/packages')
  return ok(null, 'Package cancelled and the remaining lessons written off.')
}
