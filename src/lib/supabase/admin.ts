import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { publicEnv, serverEnv } from '@/lib/env'
import type { Database } from '@/lib/db/types'

/**
 * Service-role client. Bypasses RLS entirely.
 *
 * Rules for using it:
 *   1. Only ever inside a Server Action or Route Handler.
 *   2. Only after `requireRole(...)` has established who the caller is.
 *   3. Only where the operation genuinely needs to reach past RLS — reading
 *      protected columns (clients.admin_notes), creating auth users, or
 *      recording webhook results where there is no user session at all.
 *
 * Every call site in this codebase is preceded by a guard; grep for
 * `createAdminClient` to audit them.
 */
export function createAdminClient() {
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { headers: { 'X-Client-Info': 'surfer-live-server' } },
    },
  )
}
