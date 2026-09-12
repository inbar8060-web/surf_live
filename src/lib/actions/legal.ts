'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createUserClient } from '@/lib/supabase/server'
import { requireRoleForAction, homeFor } from '@/lib/auth/session'
import { recordAudit } from '@/lib/audit'
import { clientIp } from '@/lib/util/request'
import { legalDocumentsFor, outstandingLegal } from '@/lib/legal'
import { assertSameOrigin, fail, failDb, type ActionResult } from './result'
import { strList } from './form'

/**
 * Accept the platform's legal documents. Each accepted document becomes one
 * row: who, which document, which version, when, from where. The text is not
 * stored — it is the versioned module in src/lib/legal.
 */
export async function acceptLegalAction(_prev: ActionResult<null> | null, formData: FormData): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const guard = await requireRoleForAction(['admin', 'instructor', 'client'], '/onboarding/legal')
  if (!guard.ok) return fail(guard.error)
  const user = guard.user

  const required = legalDocumentsFor(user.profile.role)
  const ticked = new Set(strList(formData, 'accepted'))
  const missing = required.filter((doc) => !ticked.has(`${doc.key}@${doc.version}`))
  if (missing.length > 0) {
    return fail(
      `Please accept every document to continue: ${missing.map((d) => d.title).join(', ')}.`,
      Object.fromEntries(missing.map((d) => [d.key, 'Please tick this one'])),
    )
  }

  const parsed = z.array(z.string().regex(/^[a-z_]+@[0-9A-Za-z.-]+$/)).safeParse([...ticked])
  if (!parsed.success) return fail('Something in the form was not recognised. Reload and try again.')

  const supabase = await createUserClient()
  const { data: already } = await supabase.from('legal_acceptances').select('document_key, version').eq('user_id', user.id)
  const outstanding = outstandingLegal(user.profile.role, already ?? [])

  if (outstanding.length > 0) {
    const headerList = await headers()
    const { error } = await supabase.from('legal_acceptances').insert(
      outstanding.map((doc) => ({
        club_id: user.profile.club_id ?? '',
        user_id: user.id,
        document_key: doc.key,
        version: doc.version,
        ip: clientIp(headerList),
        user_agent: headerList.get('user-agent')?.slice(0, 300) ?? null,
      })),
    )
    if (error) return failDb(error, 'Could not record your acceptance.')

    await recordAudit({
      actorId: user.id,
      actorRole: user.profile.role,
      action: 'legal.accepted',
      entity: 'legal_acceptance',
      entityId: user.id,
      after: { documents: outstanding.map((d) => `${d.key}@${d.version}`) },
    })
  }

  revalidatePath('/', 'layout')
  redirect(homeFor(user.profile.role))
}
