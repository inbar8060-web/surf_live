'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertRole } from '@/lib/auth/session'
import { clubUrl } from '@/lib/tenant'
import { RESERVED_SLUGS, slugify } from '@/lib/tenant-host'
import { parseMapsUrl } from '@/lib/places/maps-link'
import { generateInviteToken, inviteUrl } from '@/lib/util/invites'
import { clientIp } from '@/lib/util/request'
import { MapsLinkError, resolveClubPlace, type ClubPlace } from '@/lib/places/resolve'
import { mailProvider } from '@/lib/mail'
import { emailSchema, openingHoursSchema, phoneSchema } from '@/lib/validation/schemas'
import type { ClubSettings } from '@/lib/db/types'
import { assertSameOrigin, describeDbError, fail, fromZod, ok, failDb, type ActionResult } from './result'
import { optionalStr, str } from './form'

/**
 * Platform operator actions.
 *
 * Everything here is about clubs as units — creating one, pausing one,
 * reaching its administrator. Nothing here reads a club's members, bookings
 * or money, and the database enforces that independently: no policy on a
 * tenant table names the operator, so even a bug in this file could not
 * return such a row.
 */

const DENIED = 'Platform operator role required.'

/** Everything the operator does is written to their own trail, never a club's. */
async function platformAudit(actorId: string, action: string, clubId: string | null, detail?: unknown) {
  const headerList = await headers()
  await createAdminClient().from('platform_audit_log').insert({
    actor_id: actorId,
    action,
    club_id: clubId,
    detail: (detail as Record<string, unknown>) ?? null,
    ip: clientIp(headerList),
  })
}

/* ------------------------------------------------------------ provisioning */

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Lower-case letters, digits and hyphens only')
  .min(3)
  .max(40)
  .refine((s) => !RESERVED_SLUGS.has(s), 'That name is reserved by the platform')

const mapsSchema = z
  .string()
  .trim()
  .url()
  .max(2000)
  .refine((u) => parseMapsUrl(u) !== null, 'Paste a Google Maps link')

/** The listing's facts, as the form carries them between look-up and create. */
const detailsSchema = {
  address: z.string().trim().max(300).optional().or(z.literal('')),
  phone: phoneSchema.optional().or(z.literal('')),
  website: z.string().trim().url().max(300).optional().or(z.literal('')),
  openingHours: openingHoursSchema,
  latitude: z.coerce.number().min(-90).max(90).optional().or(z.literal('')),
  longitude: z.coerce.number().min(-180).max(180).optional().or(z.literal('')),
  placeId: z.string().trim().max(200).optional().or(z.literal('')),
}

const provisionSchema = z.object({
  name: z.string().trim().min(2).max(120).regex(/^[^\x00-\x1F\x7F]*$/),
  slug: slugSchema,
  mapsUrl: mapsSchema,
  adminEmail: emailSchema,
  timezone: z.string().trim().min(3).max(64).default('Asia/Jerusalem'),
  ...detailsSchema,
})

/**
 * Read a club's listing from its Google Maps link.
 *
 * Called directly from the Add-a-club form, before anything is created, so
 * the operator sees what the listing says and can correct it. The link is the
 * only input; the resolver refuses to follow it anywhere but Google.
 */
export async function lookupPlaceAction(mapsUrl: string): Promise<ActionResult<ClubPlace>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const operator = await assertRole('super_admin')
  if (!operator) return fail(DENIED)

  const parsed = mapsSchema.safeParse(mapsUrl)
  if (!parsed.success) return fail('Paste a Google Maps link (google.com/maps/… or maps.app.goo.gl/…).', { mapsUrl: 'Not a Google Maps link' })

  try {
    const place = await resolveClubPlace(parsed.data)
    return ok(
      place,
      place.source === 'places'
        ? 'Read from the Google Maps listing. Check the details, then create the club.'
        : 'Read what the link itself says. Add GOOGLE_MAPS_API_KEY to pull the address, hours and contact details from the listing.',
    )
  } catch (cause) {
    if (cause instanceof MapsLinkError) return fail(cause.message, { mapsUrl: cause.message })
    console.error('[platform] place lookup failed', cause)
    return fail('Could not read that link right now. You can still fill the details in by hand.')
  }
}

/**
 * Create a club.
 *
 * Three things happen, in order, and the first is atomic in the database:
 *   1. `provision_club()` writes the club, its settings row and the audit line
 *      in one transaction — a club never exists half-made.
 *   2. A single-use registration link for its first administrator is minted
 *      against that club, so the account it produces belongs to it and to no
 *      other.
 *   3. The link is emailed to the administrator address given. If mail is
 *      not configured the link is returned to the operator instead, shown once.
 */
export async function provisionClubAction(
  _prev: ActionResult<{ slug: string; url: string; inviteUrl: string | null }> | null,
  formData: FormData,
): Promise<ActionResult<{ slug: string; url: string; inviteUrl: string | null }>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const operator = await assertRole('super_admin')
  if (!operator) return fail(DENIED)

  const parsed = provisionSchema.safeParse({
    name: str(formData, 'name'),
    slug: str(formData, 'slug') || slugify(str(formData, 'name')),
    mapsUrl: str(formData, 'mapsUrl'),
    adminEmail: str(formData, 'adminEmail'),
    timezone: str(formData, 'timezone') || 'Asia/Jerusalem',
    address: optionalStr(formData, 'address'),
    phone: optionalStr(formData, 'phone'),
    website: optionalStr(formData, 'website'),
    openingHours: str(formData, 'openingHours'),
    latitude: optionalStr(formData, 'latitude'),
    longitude: optionalStr(formData, 'longitude'),
    placeId: optionalStr(formData, 'placeId'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  try {
    new Intl.DateTimeFormat('en', { timeZone: parsed.data.timezone })
  } catch {
    return fail('That is not a recognised time zone.', { timezone: 'Use an IANA name such as Asia/Jerusalem' })
  }

  // Through the operator's own client: provision_club() checks is_super_admin()
  // itself, so the caller's JWT is what proves the right, not the service role.
  const supabase = await createUserClient()
  const { data: club, error } = await supabase.rpc('provision_club', {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_maps_url: parsed.data.mapsUrl,
    p_admin_email: parsed.data.adminEmail,
    p_timezone: parsed.data.timezone,
    p_details: {
      address: parsed.data.address || null,
      phone: parsed.data.phone || null,
      website: parsed.data.website || null,
      opening_hours: parsed.data.openingHours,
      latitude: parsed.data.latitude === '' ? null : parsed.data.latitude,
      longitude: parsed.data.longitude === '' ? null : parsed.data.longitude,
      place_id: parsed.data.placeId || null,
    },
  })

  if (error || !club) {
    if (error?.code === '23505') {
      return fail('Address on the platform: a club already lives at that address — choose another name (rule clubs_slug_key).', {
        slug: 'Already taken',
      })
    }
    return failDb(error, 'Could not create the club.')
  }

  // The first administrator's way in: a single-use link bound to this club.
  const admin = createAdminClient()
  const { token, tokenHash } = generateInviteToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 3_600_000).toISOString()

  const { error: inviteError } = await admin.from('registration_invites').insert({
    club_id: club.id,
    token_hash: tokenHash,
    role: 'admin',
    email: parsed.data.adminEmail,
    full_name: null,
    note: 'First administrator, issued at provisioning',
    expires_at: expiresAt,
    created_by: null,
  })
  if (inviteError) return failDb(inviteError, 'The club was created but its invitation could not be.')

  // Once the link exists the club is open for its administrator to arrive.
  await admin.from('clubs').update({ status: 'active' }).eq('id', club.id)

  const link = inviteUrl(clubUrl(club.slug, ''), token)
  const mail = mailProvider()
  let delivered = false
  try {
    const result = await mail.send({
      to: [parsed.data.adminEmail],
      subject: `Your club on Surfer Live: ${club.name}`,
      text: [
        `Hello,`,
        ``,
        `${club.name} has been set up on Surfer Live. Your club's address is:`,
        `  ${clubUrl(club.slug)}`,
        ``,
        `Open this link to create your administrator account (it works once, for seven days):`,
        `  ${link}`,
        ``,
        `Once in, you can add instructors, sessions, prices and gear, and invite your members.`,
      ].join('\n'),
    })
    delivered = result.delivered
  } catch (cause) {
    console.error('[platform] could not send the provisioning email', cause)
  }

  await platformAudit(operator.id, 'club.created', club.id, {
    slug: club.slug,
    admin_email: parsed.data.adminEmail,
    invite_delivered: delivered,
  })

  // The development provider records the send and drops it, so in that case
  // the link is shown to the operator as well — otherwise nobody would have it.
  const showLink = !delivered || mail.name === 'log'

  revalidatePath('/platform')
  return ok(
    { slug: club.slug, url: clubUrl(club.slug), inviteUrl: showLink ? link : null },
    showLink
      ? `${club.name} is live. The administrator's link is shown below — copy it now, it is not shown again.`
      : `${club.name} is live at ${clubUrl(club.slug)}. The administrator has been emailed their registration link.`,
  )
}

/* ------------------------------------------------------------- lifecycle */

const statusSchema = z.object({
  clubId: z.string().uuid(),
  status: z.enum(['active', 'suspended', 'archived']),
  reason: z.string().trim().max(500).optional().or(z.literal('')),
})

/**
 * Pause, resume or archive a club.
 *
 * Suspending is reversible and immediate: members are shown a calm holding
 * page and the landing page stops offering bookings. Nothing is deleted.
 * Archiving is for a club that has left; it is hidden from every address but
 * its data stays exactly where it is, for the record.
 */
export async function setClubStatusAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const operator = await assertRole('super_admin')
  if (!operator) return fail(DENIED)

  const parsed = statusSchema.safeParse({
    clubId: str(formData, 'clubId'),
    status: str(formData, 'status'),
    reason: optionalStr(formData, 'reason'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  if (parsed.data.status !== 'active' && !parsed.data.reason) {
    return fail('Please give a reason — it is kept on the record.', { reason: 'Required' })
  }

  const supabase = await createUserClient()
  const { error } = await supabase
    .from('clubs')
    .update({
      status: parsed.data.status,
      suspended_at: parsed.data.status === 'active' ? null : new Date().toISOString(),
      suspended_reason: parsed.data.status === 'active' ? null : parsed.data.reason || null,
    })
    .eq('id', parsed.data.clubId)

  if (error) return failDb(error, 'Could not change the club.')

  await platformAudit(operator.id, `club.${parsed.data.status}`, parsed.data.clubId, {
    reason: parsed.data.reason ?? null,
  })

  revalidatePath('/platform')
  revalidatePath(`/platform/clubs/${parsed.data.clubId}`)
  return ok(null, { active: 'Club reactivated.', suspended: 'Club paused.', archived: 'Club archived.' }[parsed.data.status])
}

const editSchema = z.object({
  clubId: z.string().uuid(),
  name: z.string().trim().min(2).max(120).regex(/^[^\x00-\x1F\x7F]*$/),
  mapsUrl: mapsSchema,
  adminEmail: emailSchema,
})

export async function updateClubAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const operator = await assertRole('super_admin')
  if (!operator) return fail(DENIED)

  const parsed = editSchema.safeParse({
    clubId: str(formData, 'clubId'),
    name: str(formData, 'name'),
    mapsUrl: optionalStr(formData, 'mapsUrl'),
    adminEmail: str(formData, 'adminEmail'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  const supabase = await createUserClient()
  const { error } = await supabase
    .from('clubs')
    .update({
      name: parsed.data.name,
      maps_url: parsed.data.mapsUrl,
      admin_email: parsed.data.adminEmail,
    })
    .eq('id', parsed.data.clubId)

  if (error) return failDb(error, 'Could not save the club.')

  await platformAudit(operator.id, 'club.updated', parsed.data.clubId, parsed.data)
  revalidatePath(`/platform/clubs/${parsed.data.clubId}`)
  return ok(null, 'Club updated.')
}

/**
 * A fresh administrator link for a club — when the first one expired, or the
 * club has lost access to its only administrator. Bound to the club and to
 * the address on file; a new token every time.
 */
export async function reissueAdminInviteAction(
  _prev: ActionResult<{ inviteUrl: string | null }> | null,
  formData: FormData,
): Promise<ActionResult<{ inviteUrl: string | null }>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const operator = await assertRole('super_admin')
  if (!operator) return fail(DENIED)

  const parsed = z.object({ clubId: z.string().uuid() }).safeParse({ clubId: str(formData, 'clubId') })
  if (!parsed.success) return fromZod(parsed.error)

  const admin = createAdminClient()
  const { data: club } = await admin
    .from('clubs')
    .select('id, slug, name, admin_email, status')
    .eq('id', parsed.data.clubId)
    .maybeSingle()
  if (!club) return fail('That club could not be found.')
  if (club.status === 'archived') return fail('An archived club cannot issue invitations.')

  const { token, tokenHash } = generateInviteToken()
  const { error } = await admin.from('registration_invites').insert({
    club_id: club.id,
    token_hash: tokenHash,
    role: 'admin',
    email: club.admin_email,
    note: 'Administrator link reissued by the platform',
    expires_at: new Date(Date.now() + 7 * 24 * 3_600_000).toISOString(),
    created_by: null,
  })
  if (error) return failDb(error, 'Could not create the invitation.')

  const link = inviteUrl(clubUrl(club.slug, ''), token)
  const mail = mailProvider()
  let delivered = false
  try {
    delivered = (
      await mail.send({
        to: [club.admin_email],
        subject: `Administrator access to ${club.name} on Surfer Live`,
        text: `Open this link to create your administrator account for ${club.name} (works once, for seven days):\n\n  ${link}\n`,
      })
    ).delivered
  } catch (cause) {
    console.error('[platform] could not send the reissued invite', cause)
  }

  const showLink = !delivered || mail.name === 'log'
  await platformAudit(operator.id, 'club.admin_invite_reissued', club.id, { delivered })
  revalidatePath(`/platform/clubs/${club.id}`)
  return ok(
    { inviteUrl: showLink ? link : null },
    showLink ? 'Copy the link below now — it is not shown again.' : `A new link has been emailed to ${club.admin_email}.`,
  )
}

/**
 * Re-read a club's Google Maps listing and bring the public facts up to date —
 * hours changed for the season, a new phone number. Only what the listing
 * supplies is written; a field the listing does not have is left alone, and
 * nothing the club typed in other settings is touched.
 */
export async function refreshClubFromMapsAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const operator = await assertRole('super_admin')
  if (!operator) return fail(DENIED)

  const parsed = z.object({ clubId: z.string().uuid() }).safeParse({ clubId: str(formData, 'clubId') })
  if (!parsed.success) return fromZod(parsed.error)

  const admin = createAdminClient()
  const { data: club } = await admin.from('clubs').select('id, slug, maps_url').eq('id', parsed.data.clubId).maybeSingle()
  if (!club) return fail('That club could not be found.')
  if (!club.maps_url) return fail('This club has no Google Maps link on file. Add one under Details first.')

  let place: ClubPlace
  try {
    place = await resolveClubPlace(club.maps_url)
  } catch (cause) {
    if (cause instanceof MapsLinkError) return fail(cause.message)
    console.error('[platform] place refresh failed', cause)
    return fail('Could not read the listing right now.')
  }
  if (place.source !== 'places') {
    return fail('Reading the listing needs GOOGLE_MAPS_API_KEY; only the link itself could be read.')
  }

  const patch: Partial<ClubSettings> = {}
  if (place.address) patch.address = place.address
  if (place.phone) patch.contact_phone = place.phone
  if (place.website) patch.website = place.website
  if (place.openingHours.length) patch.opening_hours = place.openingHours
  if (place.latitude !== null && place.longitude !== null) {
    patch.spot_latitude = place.latitude
    patch.spot_longitude = place.longitude
  }
  if (place.placeId) patch.place_id = place.placeId

  const { error } = await admin.from('club_settings').update(patch).eq('club_id', club.id)
  if (error) return failDb(error, 'Could not save the listing.')

  await platformAudit(operator.id, 'club.listing_refreshed', club.id, { fields: Object.keys(patch) })
  revalidatePath(`/platform/clubs/${club.id}`)
  return ok(null, `Updated ${Object.keys(patch).length} field(s) from the listing.`)
}
