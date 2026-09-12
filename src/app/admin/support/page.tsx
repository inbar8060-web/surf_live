import Link from 'next/link'
import { z } from 'zod'
import { createUserClient } from '@/lib/supabase/server'
import { getClubSettings } from '@/lib/db/queries'
import { EmptyRow, PageTitle, Panel } from '@/components/admin/pieces'
import { SeverityChip, SupportStatusChip } from '@/components/platform/pieces'
import { Report, Thread } from '@/components/support/thread'
import { adminButton } from '@/components/ui/button-class'
import { assistantEnabled } from '@/lib/support/assistant'
import { formatRelative } from '@/lib/util/format'
import { CloseForm, EscalateForm, MessageForm, OpenForm } from './forms'

export const metadata = { title: 'Support' }
export const dynamic = 'force-dynamic'

/**
 * The club's line to the platform. The list on the left is every conversation
 * this club has opened; the pane on the right is one of them, or the form to
 * start a new one.
 */
export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams
  const selected = z.string().uuid().safeParse(c).success ? c! : null

  const supabase = await createUserClient()
  const club = await getClubSettings()
  const withAssistant = assistantEnabled()

  const { data: conversations } = await supabase
    .from('support_conversations')
    .select('*')
    .order('last_message_at', { ascending: false })
    .limit(100)

  const current = selected ? (conversations ?? []).find((x) => x.id === selected) ?? null : null
  const { data: messages } = current
    ? await supabase
        .from('support_messages')
        .select('id, sender_role, body, created_at')
        .eq('conversation_id', current.id)
        .order('created_at', { ascending: true })
        .limit(500)
    : { data: [] }

  return (
    <>
      <PageTitle
        title="Support"
        sub={
          withAssistant
            ? 'Ask the assistant first — it answers what it can and writes up the rest for the platform. A person is one click away.'
            : 'Write to the platform. They reply here.'
        }
        actions={
          current && (
            <Link href="/admin/support" className={adminButton('primary', 'sm')}>
              New conversation
            </Link>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Panel title="Conversations">
          {conversations?.length ? (
            <ul className="flex flex-col gap-1.5">
              {conversations.map((x) => (
                <li key={x.id}>
                  <Link
                    href={`/admin/support?c=${x.id}`}
                    className="block"
                    style={{
                      borderRadius: 12,
                      padding: '10px 12px',
                      background: x.id === current?.id ? 'var(--color-adm-ground)' : undefined,
                      border: x.id === current?.id ? '1.5px solid var(--color-adm-line)' : '1.5px solid transparent',
                    }}
                  >
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 800 }}>{x.subject}</span>
                    <span className="a-helper" style={{ display: 'block', marginBottom: 4 }}>
                      {formatRelative(x.last_message_at)}
                    </span>
                    <SupportStatusChip status={x.status} viewer="admin" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyRow>Nothing yet.</EmptyRow>
          )}
        </Panel>

        {current ? (
          <div className="flex flex-col gap-4">
            <Panel
              title={current.subject}
              action={
                <span className="flex gap-1.5">
                  <SupportStatusChip status={current.status} viewer="admin" />
                  <SeverityChip severity={current.severity} />
                </span>
              }
            >
              <Thread messages={messages ?? []} viewer="admin" timeZone={club.timezone} />

              {current.status !== 'closed' && (
                <div className="mt-4 flex flex-col gap-3">
                  {current.kind === 'bot' && (
                    <div
                      className="a-card flex flex-wrap items-center justify-between gap-3"
                      style={{ padding: '10px 14px', background: 'var(--color-adm-amber-bg)', border: '1px solid var(--color-adm-amber-line)' }}
                    >
                      <span style={{ fontSize: 13 }}>
                        {current.report
                          ? 'The assistant has written its report. Send it to the platform, or keep talking.'
                          : 'You are talking to the assistant. Prefer a person?'}
                      </span>
                      <EscalateForm conversationId={current.id} />
                    </div>
                  )}
                  <MessageForm conversationId={current.id} />
                </div>
              )}
            </Panel>

            {current.report && (
              <Panel title="The report the platform will see" helper="Written by the assistant from what you said. It never includes a member's details.">
                <Report report={current.report} />
              </Panel>
            )}

            {current.status !== 'closed' && (
              <Panel title="Done?">
                <CloseForm conversationId={current.id} />
              </Panel>
            )}
          </div>
        ) : (
          <Panel title="Start a conversation">
            <OpenForm />
          </Panel>
        )}
      </div>
    </>
  )
}
