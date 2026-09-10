import 'server-only'

import { cache } from 'react'
import { createUserClient } from '@/lib/supabase/server'
import type { ClubSettings } from '@/lib/db/types'

const FALLBACK: ClubSettings = {
  id: 1,
  club_name: 'Surfer Live',
  timezone: 'Asia/Jerusalem',
  currency: 'ILS',
  spot_name: 'Home break',
  spot_latitude: 32.08088,
  spot_longitude: 34.76765,
  contact_phone: null,
  cancellation_window_hours: 12,
  tips_enabled: true,
  updated_at: new Date().toISOString(),
}

/**
 * Club configuration. Readable by anonymous visitors (the landing page needs
 * the spot coordinates), so this uses the RLS-bound client. Falls back to
 * sensible defaults if the row is missing, so a fresh database still renders.
 */
export const getClubSettings = cache(async (): Promise<ClubSettings> => {
  try {
    const supabase = await createUserClient()
    const { data } = await supabase.from('club_settings').select('*').eq('id', 1).maybeSingle()
    return data ?? FALLBACK
  } catch {
    return FALLBACK
  }
})
