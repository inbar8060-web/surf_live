import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { createUserClient } from '@/lib/supabase/server'
import { PageTitle, Panel } from '@/components/admin/pieces'
import { SeverityChip, SupportStatusChip } from '@/components/platform/pieces'
import { Report, Thread } from '@/components/support/thread'
import { adminButton } from '@/components/ui/button-class'
import { PLATFORM_TZ } from '@/lib/platform'
import { PlatformCloseForm, PlatformReplyForm } from './forms'

export const metadata = { title: 'Conversation' }
export const dynamic = 'force-dynamic'

export default async function PlatformConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) notFound()

  const supabase = await createUserClient()
  const { data: conversation } = await supabase.from('support_conversations').select('*').eq('id', id).maybeSingle()
  if (!conversation) notFound()

  const [messagesRes, clubRes] = await Promise.all([
    supabase
      .from('support_messages')
      .select('id, sender_role, body, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
      .limit(500),
    supabase.from('clubs').select('id, name').eq('id', conversation.club_id).maybeSingle(),
  ])

  return (
    <>
      <PageTitle
        title={conversation.subject}
        sub={
          <>
            {clubRes.data ? (
              <Link href={`/platform/clubs/${clubRes.data.id}`} style={{ fontWeight: 700 }}>
                {clubRes.data.name}
              </Link>
            ) : (
              'Club'
            )}{' '}
            · {conversation.category ?? 'uncategorised'}
          </>
        }
        actions={
          <>
            <SupportStatusChip status={conversation.status} />
            <SeverityChip severity={conversation.severity} />
            <Link href="/platform/support" className={adminButton('secondary', 'sm')}>
              Inbox
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Panel title="Conversation">
          <Thread messages={messagesRes.data ?? []} viewer="super_admin" timeZone={PLATFORM_TZ} />
          {conversation.status !== 'closed' ? (
            <div style={{ marginTop: 16 }}>
              <PlatformReplyForm conversationId={conversation.id} />
            </div>
          ) : (
            <p className="a-helper" style={{ marginTop: 16, textAlign: 'center' }}>
              Closed.
            </p>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Assistant's report">
            {conversation.report ? (
              <Report report={conversation.report} />
            ) : (
              <p className="a-helper" style={{ margin: 0 }}>
                {conversation.kind === 'bot'
                  ? 'The assistant is still gathering details with the administrator.'
                  : 'No report — the administrator went straight to a person. Read the thread.'}
              </p>
            )}
          </Panel>
          {conversation.status !== 'closed' && (
            <Panel title="Close">
              <PlatformCloseForm conversationId={conversation.id} />
            </Panel>
          )}
        </div>
      </div>
    </>
  )
}
