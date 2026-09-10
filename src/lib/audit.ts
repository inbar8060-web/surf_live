import 'server-only'

import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AppRole } from '@/lib/db/types'

interface AuditInput {
  actorId: string | null
  actorRole: AppRole | null
  action: string
  entity: string
  entityId?: string | null
  before?: unknown
  after?: unknown
}

const REDACTED = '[redacted]'
const SENSITIVE_KEYS = new Set([
  'password', 'token', 'token_hash', 'secret', 'access_token', 'refresh_token',
  'service_role_key', 'payout_account_ref', 'card', 'cvc',
])

/** Strip anything that must never be written to a log, at any nesting depth. */
function scrub(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1))

  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? REDACTED : scrub(val, depth + 1)
  }
  return out
}

/**
 * Append to the audit trail. Uses the service role because `audit_log` grants
 * no INSERT to browser sessions — entries can only originate from server code.
 *
 * Auditing must never break the operation it is recording, so failures are
 * logged and swallowed.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    const headerList = await headers()
    const forwarded = headerList.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0]?.trim() || null

    await createAdminClient()
      .from('audit_log')
      .insert({
        actor_id: input.actorId,
        actor_role: input.actorRole,
        action: input.action,
        entity: input.entity,
        entity_id: input.entityId ?? null,
        before: (scrub(input.before) as Record<string, unknown> | null) ?? null,
        after: (scrub(input.after) as Record<string, unknown> | null) ?? null,
        ip,
        user_agent: headerList.get('user-agent')?.slice(0, 500) ?? null,
      })
  } catch (error) {
    console.error('[audit] failed to record entry', input.action, error)
  }
}
