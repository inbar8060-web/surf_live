import 'server-only'

import { cache } from 'react'
import { createUserClient } from '@/lib/supabase/server'
import type { ClubPublicProfile, ClubSettings } from '@/lib/db/types'

const FALLBACK: ClubSettings = {
  club_id: '',
  club_name: 'Surfer Live',
  timezone: 'Asia/Jerusalem',
  currency: 'ILS',
  spot_name: 'Home break',
  spot_latitude: 32.08088,
  spot_longitude: 34.76765,
  contact_phone: null,
  contact_email: null,
  cancellation_window_hours: 12,
  tips_enabled: true,
  address: null,
  website: null,
  opening_hours: [],
  place_id: null,
  updated_at: new Date().toISOString(),
}

/**
 * The signed-in user's own club's configuration.
 *
 * No club id is passed in: the RLS policy on club_settings returns exactly the
 * caller's club's row and nothing else, so there is no parameter that could be
 * got wrong. Anonymous pages use `getPublicClub()` instead. Falls back to
 * defaults so a fresh club still renders.
 */
export const getClubSettings = cache(async (): Promise<ClubSettings> => {
  try {
    const supabase = await createUserClient()
    const { data } = await supabase.from('club_settings').select('*').limit(1).maybeSingle()
    return data ?? FALLBACK
  } catch {
    return FALLBACK
  }
})


/**
 * What an anonymous visitor to a club's address may know about it. Goes
 * through `club_public_profile()`, a security-definer function that returns
 * only the columns a sign on the beach would carry — never the settings row.
 */
export const getPublicClub = cache(async (slug: string): Promise<ClubPublicProfile | null> => {
  try {
    const supabase = await createUserClient()
    const { data } = await supabase.rpc('club_public_profile', { p_slug: slug })
    return data?.[0] ?? null
  } catch {
    return null
  }
})
