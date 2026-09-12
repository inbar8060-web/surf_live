import Link from 'next/link'
import { createUserClient } from '@/lib/supabase/server'
import { EmptyRow, PageTitle, Panel, SubTabs } from '@/components/admin/pieces'
import { SeverityChip, SupportStatusChip, Table, Td } from '@/components/platform/pieces'
import { formatRelative } from '@/lib/util/format'

export const metadata = { title: 'Support' }
export const dynamic = 'force-dynamic'

export default async function PlatformSupportPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  const view = ['all', 'closed'].includes(tab ?? '') ? tab! : ''

  const supabase = await createUserClient()
  let query = supabase
    .from('support_conversations')
    .select('id, club_id, subject, kind, status, category, severity, last_message_at')
    .order('last_message_at', { ascending: false })
    .limit(200)
  if (view === '') query = query.neq('status', 'closed')
  if (view === 'closed') query = query.eq('status', 'closed')

  const [convRes, clubsRes] = await Promise.all([query, supabase.from('clubs').select('id, name')])
  const nameOf = new Map((clubsRes.data ?? []).map((c) => [c.id, c.name]))
  const conversations = convRes.data ?? []
  const waiting = conversations.filter((c) => c.status === 'awaiting_platform')

  return (
    <>
      <PageTitle
        title="Support"
        sub="What club administrators asked, in their words and the assistant's report. Nothing here comes from a club's own tables."
      />

      <SubTabs
        base="/platform/support"
        current={view}
        tabs={[
          { key: '', label: 'Open', count: waiting.length },
          { key: 'all', label: 'Everything' },
          { key: 'closed', label: 'Closed' },
        ]}
      />

      <Panel>
        {conversations.length === 0 ? (
          <EmptyRow>Nothing here.</EmptyRow>
        ) : (
          <Table head={['Subject', 'Club', 'Status', 'Category', 'Severity', 'Last message']}>
            {conversations.map((c) => (
              <tr key={c.id} style={{ background: c.status === 'awaiting_platform' ? 'var(--color-adm-amber-row)' : undefined }}>
                <Td strong>
                  <Link href={`/platform/support/${c.id}`}>{c.subject}</Link>
                </Td>
                <Td>{nameOf.get(c.club_id) ?? '—'}</Td>
                <Td>
                  <SupportStatusChip status={c.status} />
                </Td>
                <Td>{c.category ?? '—'}</Td>
                <Td>
                  <SeverityChip severity={c.severity} />
                </Td>
                <Td>{formatRelative(c.last_message_at)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </>
  )
}
