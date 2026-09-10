import Link from 'next/link'
import { createUserClient } from '@/lib/supabase/server'
import { getClubSettings } from '@/lib/db/queries'
import { Card, EmptyState, PageHeader } from '@/components/ui'
import { formatDateTime } from '@/lib/util/format'
import { SettingsForm } from './settings-form'

export const metadata = { title: 'Settings' }
export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  const club = await getClubSettings()
  const supabase = await createUserClient()

  const { data: audit } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(40)

  return (
    <>
      <PageHeader
        title="Club settings"
        description="Applies everywhere: the surf report, the currency on every price, and how late a member may change a booking."
      />

      <div className="space-y-4">
        <Card title="Club">
          <SettingsForm settings={club} />
        </Card>

        <Card
          title="Audit trail"
          description="Every privileged action, appended and never editable."
          action={<Link href="/admin/people" className="text-sm underline">People</Link>}
        >
          {audit?.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Actor</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((entry) => (
                    <tr key={entry.id}>
                      <td className="muted text-xs whitespace-nowrap">
                        {formatDateTime(entry.created_at, club.timezone)}
                      </td>
                      <td className="font-mono text-xs">{entry.action}</td>
                      <td className="text-xs">
                        {entry.entity}
                        {entry.entity_id && (
                          <span className="muted"> · {entry.entity_id.slice(0, 8)}</span>
                        )}
                      </td>
                      <td className="muted text-xs">{entry.actor_role ?? 'system'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>Nothing recorded yet.</EmptyState>
          )}
        </Card>
      </div>
    </>
  )
}
