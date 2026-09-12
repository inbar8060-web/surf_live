'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertRole, clubIdOf } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { rateLimit } from '@/lib/util/rate-limit'
import {
  AssistantUnavailable,
  assistantEnabled,
  assistantTurn,
  supportReportSchema,
  type TranscriptMessage,
} from '@/lib/support/assistant'
import { assertSameOrigin, fail, fromZod, ok, failDb, type ActionResult } from './result'
import { optionalStr, str } from './form'

/**
 * Support: the one channel between a club and the platform.
 *
 * A club administrator opens a conversation. While its kind is 'bot' the
 * assistant answers and, when it has enough, writes a structured report; the
 * administrator then hands the conversation to the platform, or closes it if
 * the assistant already answered. Once 'human', every message is read by the
 * platform operator and the two talk directly.
 *
 * The operator reads only what is in these two tables — the administrator's
 * words and the assistant's report — which carry no member data by design.
 */

const DENIED = 'You are not allowed to do that.'
const MAX_TRANSCRIPT = 40

const bodySchema = z.string().trim().min(1, 'Write something first').max(8000, 'Too long — 8000 characters at most')

/* --------------------------------------------------------- club admin side */

const openSchema = z.object({
  subject: z.string().trim().min(3, 'A few words on what this is about').max(200),
  body: bodySchema,
})

export async function openSupportConversationAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const parsed = openSchema.safeParse({ subject: str(formData, 'subject'), body: str(formData, 'body') })
  if (!parsed.success) return fromZod(parsed.error)

  const limit = await rateLimit(`support:open:${admin.id}`, 10, 60 * 60_000)
  if (!limit.ok) return fail('That is a lot of new conversations. Add to an open one instead.')

  const supabase = await createUserClient()
  const withAssistant = assistantEnabled()

  const { data: conversation, error } = await supabase
    .from('support_conversations')
    .insert({
      club_id: clubIdOf(admin),
      opened_by: admin.id,
      subject: parsed.data.subject,
      kind: withAssistant ? 'bot' : 'human',
      status: 'open',
    })
    .select('id')
    .single()
  if (error || !conversation) return failDb(error, 'Could not open the conversation.')

  // The first message goes through the caller's own client so the database
  // stamps who sent it — never trusted from the form.
  const { error: messageError } = await supabase
    .from('support_messages')
    .insert({ conversation_id: conversation.id, club_id: clubIdOf(admin), sender_role: 'admin', body: parsed.data.body })
  if (messageError) return failDb(messageError, 'Could not send the message.')

  if (withAssistant) {
    await runAssistant(conversation.id, clubIdOf(admin))
  }

  revalidatePath('/admin/support')
  return ok({ id: conversation.id }, 'Conversation opened.')
}

const replySchema = z.object({ conversationId: z.string().uuid(), body: bodySchema })

export async function sendSupportMessageAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const parsed = replySchema.safeParse({ conversationId: str(formData, 'conversationId'), body: str(formData, 'body') })
  if (!parsed.success) return fromZod(parsed.error)

  const limit = await rateLimit(`support:msg:${admin.id}`, 60, 60 * 60_000)
  if (!limit.ok) return fail('Please slow down a little.')

  const supabase = await createUserClient()
  // RLS returns only this club's conversation; a foreign id reads as "not found".
  const { data: conversation } = await supabase
    .from('support_conversations')
    .select('id, kind, status')
    .eq('id', parsed.data.conversationId)
    .maybeSingle()
  if (!conversation) return fail('That conversation could not be found.')
  if (conversation.status === 'closed') return fail('This conversation is closed. Open a new one.')

  const { error } = await supabase
    .from('support_messages')
    .insert({ conversation_id: conversation.id, club_id: clubIdOf(admin), sender_role: 'admin', body: parsed.data.body })
  if (error) return failDb(error, 'Could not send the message.')

  if (conversation.kind === 'bot') {
    await runAssistant(conversation.id, clubIdOf(admin))
  }

  revalidatePath('/admin/support')
  return ok(null)
}

/**
 * Hand the conversation to a person. The assistant's report, if it wrote one,
 * travels with it; if it did not, the operator reads the transcript.
 */
export async function escalateSupportConversationAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const parsed = z.object({ conversationId: z.string().uuid() }).safeParse({
    conversationId: str(formData, 'conversationId'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  const supabase = await createUserClient()
  const { data: updated, error } = await supabase
    .from('support_conversations')
    .update({ kind: 'human', status: 'awaiting_platform' })
    .eq('id', parsed.data.conversationId)
    .neq('status', 'closed')
    .select('id')
    .maybeSingle()
  if (error) return failDb(error, 'Could not send this to the platform.')
  if (!updated) return fail('That conversation could not be found, or is closed.')

  revalidatePath('/admin/support')
  return ok(null, 'Sent to the platform. You will see their reply here.')
}

/* ------------------------------------------------------------- either side */

const closeSchema = z.object({ conversationId: z.string().uuid(), note: z.string().trim().max(2000).optional() })

export async function closeSupportConversationAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const user = await assertRole('admin', 'super_admin')
  if (!user) return fail(DENIED)

  const parsed = closeSchema.safeParse({
    conversationId: str(formData, 'conversationId'),
    note: optionalStr(formData, 'note'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  const supabase = await createUserClient()

  if (parsed.data.note) {
    const { error } = await supabase.from('support_messages').insert({
      conversation_id: parsed.data.conversationId,
      // stamped by the database from the conversation; the value here is only a placeholder
      club_id: user.profile.club_id ?? '00000000-0000-0000-0000-000000000000',
      sender_role: user.profile.role === 'super_admin' ? 'super_admin' : 'admin',
      body: parsed.data.note,
    })
    if (error) return failDb(error, 'Could not post the closing note.')
  }

  const { data: updated, error } = await supabase
    .from('support_conversations')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', parsed.data.conversationId)
    .neq('status', 'closed')
    .select('id')
    .maybeSingle()
  if (error) return failDb(error, 'Could not close the conversation.')
  if (!updated) return fail('That conversation could not be found, or is already closed.')

  revalidatePath('/admin/support')
  revalidatePath('/platform/support')
  revalidatePath(`/platform/support/${parsed.data.conversationId}`)
  return ok(null, 'Conversation closed.')
}

/* ------------------------------------------------------------ operator side */

export async function replyAsPlatformAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const operator = await assertRole('super_admin')
  if (!operator) return fail('Platform operator role required.')

  const parsed = replySchema.safeParse({ conversationId: str(formData, 'conversationId'), body: str(formData, 'body') })
  if (!parsed.success) return fromZod(parsed.error)

  const supabase = await createUserClient()
  const { data: conversation } = await supabase
    .from('support_conversations')
    .select('id, club_id, status')
    .eq('id', parsed.data.conversationId)
    .maybeSingle()
  if (!conversation) return fail('That conversation could not be found.')
  if (conversation.status === 'closed') return fail('This conversation is closed.')

  // A reply from the platform always makes the conversation a human one.
  const { error } = await supabase
    .from('support_messages')
    .insert({ conversation_id: conversation.id, club_id: conversation.club_id, sender_role: 'super_admin', body: parsed.data.body })
  if (error) return failDb(error, 'Could not send the reply.')

  await supabase.from('support_conversations').update({ kind: 'human' }).eq('id', conversation.id)

  revalidatePath('/platform/support')
  revalidatePath(`/platform/support/${conversation.id}`)
  return ok(null)
}

/* ---------------------------------------------------------------- assistant */

/**
 * Let the assistant answer the latest administrator message.
 *
 * Runs with the service role because the assistant is not a person: it has no
 * session, and its rows are stamped 'bot' by the database. It is given the
 * club's *name* and the transcript, nothing else. Any failure degrades the
 * conversation to a human one with a note — the administrator's message is
 * never lost to a model hiccup.
 */
async function runAssistant(conversationId: string, clubId: string): Promise<void> {
  const admin = createAdminClient()

  const [{ data: rows }, settings] = await Promise.all([
    admin
      .from('support_messages')
      .select('sender_role, body')
      .eq('conversation_id', conversationId)
      .eq('club_id', clubId)
      // the newest MAX_TRANSCRIPT rows, then back into reading order
      .order('created_at', { ascending: false })
      .limit(MAX_TRANSCRIPT),
    getClubSettings(),
  ])

  const transcript: TranscriptMessage[] = (rows ?? [])
    .reverse()
    .filter((m) => m.sender_role !== 'super_admin')
    .map((m) => ({ role: m.sender_role === 'bot' ? 'bot' : 'admin', body: m.body }))

  let reply: string
  let report: z.infer<typeof supportReportSchema> | null = null

  try {
    const turn = await assistantTurn(settings.club_name, transcript)
    reply = turn.reply
    report = turn.report
  } catch (cause) {
    if (!(cause instanceof AssistantUnavailable)) throw cause
    console.warn('[support] assistant unavailable:', cause.message)
    await admin
      .from('support_conversations')
      .update({ kind: 'human', status: 'awaiting_platform' })
      .eq('id', conversationId)
      .eq('club_id', clubId)
    reply = 'The assistant is not available right now, so your message has gone straight to the platform. They will reply here.'
  }

  await admin.from('support_messages').insert({
    conversation_id: conversationId,
    club_id: clubId,
    sender_role: 'bot',
    sender_id: null,
    body: reply,
  })

  if (report) {
    await admin
      .from('support_conversations')
      .update({ report, category: report.category, severity: report.severity })
      .eq('id', conversationId)
      .eq('club_id', clubId)
  }
}
