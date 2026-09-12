import Link from 'next/link'
import { createUserClient } from '@/lib/supabase/server'
import { EmptyRow, PageTitle, Panel, SubTabs } from '@/components/admin/pieces'
import { ClubStatusChip, Table, Td } from '@/components/platform/pieces'
import { adminButton } from '@/components/ui/button-class'
import { clubUrl } from '@/lib/tenant'
import { formatDate, formatRelative } from '@/lib/util/format'
import { PLATFORM_TZ } from '@/lib/platform'

export const metadata = { title: 'Clubs' }
export const dynamic = 'force-dynamic'

export default async function PlatformClubsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  const view = ['paused', 'archived'].includes(tab ?? '') ? tab! : ''

  const supabase = await createUserClient()
  const { data } = await supabase.from('club_statistics').select('*').order('name')
  const all = data ?? []
  const clubs = all.filter((c) =>
    view === 'paused' ? c.status === 'suspended' : view === 'archived' ? c.status === 'archived' : c.status !== 'archived',
  )

  return (
    <>
      <PageTitle
        title="Clubs"
        sub="Each club is its own address, its own administrators and its own data."
        actions={
          <Link href="/platform/clubs/new" className={adminButton('primary')}>
            Add a club
          </Link>
        }
      />

      <SubTabs
        base="/platform/clubs"
        current={view}
        tabs={[
          { key: '', label: 'Live' },
          { key: 'paused', label: 'Paused', count: all.filter((c) => c.status === 'suspended').length },
          { key: 'archived', label: 'Archived', count: all.filter((c) => c.status === 'archived').length },
        ]}
      />

      <Panel>
        {clubs.length === 0 ? (
          <EmptyRow>Nothing here.</EmptyRow>
        ) : (
          <Table head={['Club', 'Address', 'Status', 'Members', 'Instructors', 'Admins', 'Sessions', 'Since', 'Last activity']}>
            {clubs.map((c) => (
              <tr key={c.club_id}>
                <Td strong>
                  <Link href={`/platform/clubs/${c.club_id}`}>{c.name}</Link>
                </Td>
                <Td>
                  <a href={clubUrl(c.slug)} target="_blank" rel="noreferrer" style={{ color: 'var(--color-adm-accent)' }}>
                    {c.slug}
                  </a>
                </Td>
                <Td>
                  <ClubStatusChip status={c.status} />
                </Td>
                <Td right>{c.members}</Td>
                <Td right>{c.instructors}</Td>
                <Td right>{c.admins}</Td>
                <Td right>
                  {c.sessions_upcoming} <span className="a-helper">/ {c.sessions_total}</span>
                </Td>
                <Td>{formatDate(c.created_at, PLATFORM_TZ)}</Td>
                <Td>{c.last_activity_at ? formatRelative(c.last_activity_at) : '—'}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </>
  )
}
