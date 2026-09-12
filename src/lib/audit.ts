import 'server-only'

import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { clientIp } from '@/lib/util/request'
import type { AppRole } from '@/lib/db/types'

interface AuditInput {
  actorId: string | null
  actorRole: AppRole | null
  /**
   * The club the event belongs to. Resolved from the actor's profile when not
   * given; required explicitly where there is no actor (a payment webhook).
   */
  clubId?: string | null
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
  // a drawn signature is a biometric-adjacent image; it never belongs in a log
  'signature', 'signatureimage', 'signature_image', 'typedname', 'typed_name',
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
    const ip = clientIp(headerList)
    const admin = createAdminClient()

    let clubId = input.clubId ?? null
    if (!clubId && input.actorId) {
      const { data } = await admin.from('profiles').select('club_id').eq('id', input.actorId).maybeSingle()
      clubId = data?.club_id ?? null
    }
    if (!clubId) {
      // The platform operator has no club: their events go to the platform's
      // own trail. A club event with no actor and no club is a bug.
      if (input.actorRole === 'super_admin' || input.action.startsWith('auth.')) {
        await recordPlatformAudit({ actorId: input.actorId, action: input.action, clubId: null, detail: input.after })
        return
      }
      console.error('[audit] no club for event', input.action)
      return
    }

    await admin
      .from('audit_log')
      .insert({
        club_id: clubId,
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

export interface PlatformAuditInput {
  actorId: string | null
  action: string
  clubId: string | null
  detail?: unknown
}

/**
 * The platform's own trail: what the operator did, and what the payment
 * service reported about a club. Scrubbed like the club trail, with the
 * caller's address when there is a request. Never throws.
 */
export async function recordPlatformAudit(input: PlatformAuditInput): Promise<void> {
  try {
    let ip: string | null = null
    try {
      ip = clientIp(await headers())
    } catch {
      // no request context (a webhook, a script) — fine
    }
    await createAdminClient().from('platform_audit_log').insert({
      actor_id: input.actorId,
      action: input.action,
      club_id: input.clubId,
      detail: (scrub(input.detail) as Record<string, unknown> | null) ?? null,
      ip,
    })
  } catch (error) {
    console.error('[platform-audit] failed to record', input.action, error)
  }
}
