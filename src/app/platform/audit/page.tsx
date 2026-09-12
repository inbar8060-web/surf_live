import { createUserClient } from '@/lib/supabase/server'
import { EmptyRow, PageTitle, Panel } from '@/components/admin/pieces'
import { Table, Td } from '@/components/platform/pieces'
import { formatDateTime } from '@/lib/util/format'
import { PLATFORM_TZ } from '@/lib/platform'

export const metadata = { title: 'Platform audit' }
export const dynamic = 'force-dynamic'

export default async function PlatformAuditPage() {
  const supabase = await createUserClient()
  const [auditRes, clubsRes, profilesRes] = await Promise.all([
    supabase.from('platform_audit_log').select('*').order('created_at', { ascending: false }).limit(300),
    supabase.from('clubs').select('id, name'),
    supabase.from('profiles').select('id, full_name'),
  ])
  const clubName = new Map((clubsRes.data ?? []).map((c) => [c.id, c.name]))
  const actorName = new Map((profilesRes.data ?? []).map((p) => [p.id, p.full_name]))

  return (
    <>
      <PageTitle
        title="Platform audit"
        sub="Every action taken at platform level. Append-only: rows cannot be edited or removed, by database trigger."
      />
      <Panel>
        {auditRes.data?.length ? (
          <Table head={['When', 'Action', 'Club', 'By', 'Detail']}>
            {auditRes.data.map((entry) => (
              <tr key={entry.id}>
                <Td>{formatDateTime(entry.created_at, PLATFORM_TZ)}</Td>
                <Td strong>{entry.action.replace(/[._]/g, ' ')}</Td>
                <Td>{entry.club_id ? (clubName.get(entry.club_id) ?? 'removed') : '—'}</Td>
                <Td>{entry.actor_id ? (actorName.get(entry.actor_id) ?? 'operator') : 'system'}</Td>
                <Td>
                  {entry.detail && (
                    <code style={{ fontSize: 11, wordBreak: 'break-word' }}>{JSON.stringify(entry.detail)}</code>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyRow>Nothing recorded yet.</EmptyRow>
        )}
      </Panel>
    </>
  )
}
