import 'server-only'

import { cache } from 'react'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { publicEnv } from '@/lib/env'

/**
 * Which club a request is for, from the address it arrived at.
 *
 *   surfer-live.<platform domain>  → the club with slug "surfer-live"
 *   admin.<platform domain>        → the platform operator's own area
 *   <platform domain>              → the platform's front door
 *
 * The slug is parsed once in src/proxy.ts and handed down as a header; this
 * module turns it into a club. The subdomain says which club a *visitor* is
 * looking at. It never decides which club a *signed-in user* belongs to — that
 * is fixed on their profile, and the two are compared, never merged.
 */

export interface TenantClub {
  id: string
  slug: string
  name: string
  status: 'provisioning' | 'active' | 'suspended' | 'archived'
  mapsUrl: string | null
}

export { RESERVED_SLUGS, PLATFORM_SLUG, bareHost, parseHost, type HostTarget } from './tenant-host'
import { PLATFORM_SLUG } from './tenant-host'

/** The address a club lives at, for links and redirects. */
export function clubUrl(slug: string, path = '/'): string {
  const { NEXT_PUBLIC_PLATFORM_DOMAIN } = publicEnv
  const protocol = NEXT_PUBLIC_PLATFORM_DOMAIN.startsWith('localhost') ? 'http' : 'https'
  return `${protocol}://${slug}.${NEXT_PUBLIC_PLATFORM_DOMAIN}${path}`
}

export function platformUrl(path = '/'): string {
  return clubUrl(PLATFORM_SLUG, path)
}

/**
 * An absolute URL on the club this request is for — the only correct base
 * for anything a third party will send the browser back to (invite links,
 * checkout return pages). Throws off a club address: a caller there has no
 * club to build a link for, and a link on the apex would 404 at the proxy.
 */
export async function requestClubUrl(path = '/'): Promise<string> {
  const club = await getRequestClub()
  if (!club) throw new Error('requestClubUrl() called outside a club address')
  return clubUrl(club.slug, path)
}

/**
 * The address of the club a signed-in person belongs to, or null when that
 * club is no longer live (archived, or gone). Callers decide what to do with
 * null; sending the person back to the same dead address is never it.
 */
export async function ownClubUrl(clubId: string | null, path = '/'): Promise<string | null> {
  if (!clubId) return null
  const { data } = await createAdminClient()
    .from('clubs')
    .select('slug')
    .eq('id', clubId)
    .in('status', ['active', 'suspended'])
    .maybeSingle()
  return data ? clubUrl(data.slug, path) : null
}

/**
 * The club this request's address names, or null on the apex, the operator
 * area, or an address that names no club.
 *
 * Looked up with the service role because an anonymous visitor has no rights
 * on `clubs` at all — and only the columns a visitor may know are returned.
 * Cached per request.
 */
export const getRequestClub = cache(async (): Promise<TenantClub | null> => {
  const headerList = await headers()
  const slug = headerList.get('x-club-slug')
  if (!slug) return null

  const { data } = await createAdminClient()
    .from('clubs')
    .select('id, slug, name, status, maps_url')
    .eq('slug', slug)
    .in('status', ['active', 'suspended'])
    .maybeSingle()

  if (!data) return null
  return { id: data.id, slug: data.slug, name: data.name, status: data.status, mapsUrl: data.maps_url }
})

/** Which area of the platform this request is addressed to. */
export const getRequestArea = cache(async (): Promise<'apex' | 'platform' | 'club' | 'unknown'> => {
  const headerList = await headers()
  const area = headerList.get('x-platform-area')
  return area === 'platform' || area === 'club' || area === 'apex' ? area : 'unknown'
})
