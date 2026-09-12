import Link from 'next/link'
import { createUserClient } from '@/lib/supabase/server'
import { EmptyRow, PageTitle, Panel } from '@/components/admin/pieces'
import { ClubStatusChip, Stat, SupportStatusChip, Table, Td } from '@/components/platform/pieces'
import { adminButton } from '@/components/ui/button-class'
import { formatRelative } from '@/lib/util/format'

export const metadata = { title: 'Platform' }
export const dynamic = 'force-dynamic'

/**
 * The operator's overview. Everything on it is a count from `club_statistics`
 * or a row from the two tables the operator owns; there is no query here that
 * could return a member, a booking or an amount of money, because the
 * database exposes none to this role.
 */
export default async function PlatformOverviewPage() {
  const supabase = await createUserClient()

  const [statsRes, supportRes, auditRes] = await Promise.all([
    supabase.from('club_statistics').select('*').order('created_at', { ascending: true }),
    supabase
      .from('support_conversations')
      .select('id, club_id, subject, status, severity, last_message_at')
      .neq('status', 'closed')
      .order('last_message_at', { ascending: false })
      .limit(8),
    supabase.from('platform_audit_log').select('*').order('created_at', { ascending: false }).limit(8),
  ])

  const clubs = statsRes.data ?? []
  const live = clubs.filter((c) => c.status === 'active')
  const sum = (key: keyof (typeof clubs)[number]) => clubs.reduce((n, c) => n + Number(c[key] ?? 0), 0)
  const nameOf = new Map(clubs.map((c) => [c.club_id, c.name]))
  const needsReply = (supportRes.data ?? []).filter((c) => c.status === 'awaiting_platform')
  const attention = clubs.filter((c) => c.payments_failed > 0 || c.documents_undelivered > 0)

  return (
    <>
      <PageTitle
        title="Overview"
        sub="Every club on the platform, in numbers. No member data appears here — by design and by database rule."
        actions={
          <Link href="/platform/clubs/new" className={adminButton('primary')}>
            Add a club
          </Link>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Clubs" value={clubs.length} hint={`${live.length} active`} />
        <Stat label="Members" value={sum('members')} hint="registered across all clubs" />
        <Stat label="Instructors" value={sum('instructors')} />
        <Stat label="Upcoming sessions" value={sum('sessions_upcoming')} hint={`${sum('bookings_pending')} bookings awaiting approval`} />
        <Stat
          label="Support"
          value={needsReply.length}
          hint="conversations waiting on you"
          tone={needsReply.length > 0 ? 'amber' : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Panel
          title="Clubs"
          action={
            <Link href="/platform/clubs" className={adminButton('secondary', 'sm')}>
              All clubs
            </Link>
          }
        >
          {clubs.length === 0 ? (
            <EmptyRow>No clubs yet. Add the first one.</EmptyRow>
          ) : (
            <Table head={['Club', 'Status', 'Members', 'Sessions ahead', 'Pending', 'Last activity']}>
              {clubs.map((c) => (
                <tr key={c.club_id}>
                  <Td strong>
                    <Link href={`/platform/clubs/${c.club_id}`}>{c.name}</Link>
                    <span className="a-helper" style={{ display: 'block', fontWeight: 500 }}>
                      {c.slug}
                    </span>
                  </Td>
                  <Td>
                    <ClubStatusChip status={c.status} />
                  </Td>
                  <Td right>{c.members}</Td>
                  <Td right>{c.sessions_upcoming}</Td>
                  <Td right>{c.bookings_pending}</Td>
                  <Td>{c.last_activity_at ? formatRelative(c.last_activity_at) : '—'}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          {attention.length > 0 && (
            <Panel title="Needs a look" tone="amber">
              <ul className="flex flex-col gap-2">
                {attention.map((c) => (
                  <li key={c.club_id} style={{ fontSize: 13 }}>
                    <Link href={`/platform/clubs/${c.club_id}`} style={{ fontWeight: 800 }}>
                      {c.name}
                    </Link>
                    <span className="a-helper" style={{ display: 'block' }}>
                      {[
                        c.payments_failed > 0 && `${c.payments_failed} failed payment${c.payments_failed === 1 ? '' : 's'}`,
                        c.documents_undelivered > 0 && `${c.documents_undelivered} signed document${c.documents_undelivered === 1 ? '' : 's'} not yet emailed`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel
            title="Open support"
            action={
              <Link href="/platform/support" className={adminButton('secondary', 'sm')}>
                Inbox
              </Link>
            }
          >
            {supportRes.data?.length ? (
              <ul className="flex flex-col gap-2.5">
                {supportRes.data.map((c) => (
                  <li key={c.id} style={{ fontSize: 13 }}>
                    <Link href={`/platform/support/${c.id}`} style={{ fontWeight: 800 }}>
                      {c.subject}
                    </Link>
                    <span className="a-helper" style={{ display: 'block' }}>
                      {nameOf.get(c.club_id) ?? 'Club'} · {formatRelative(c.last_message_at)}
                    </span>
                    <span style={{ display: 'inline-block', marginTop: 4 }}>
                      <SupportStatusChip status={c.status} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyRow>Nothing open.</EmptyRow>
            )}
          </Panel>

          <Panel
            title="Recent platform actions"
            action={
              <Link href="/platform/audit" className={adminButton('secondary', 'sm')}>
                Audit
              </Link>
            }
          >
            {auditRes.data?.length ? (
              <ul className="flex flex-col gap-2">
                {auditRes.data.map((entry) => (
                  <li key={entry.id} style={{ fontSize: 12, color: 'var(--color-adm-ink-2)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-adm-ink)' }}>{entry.action.replace(/[._]/g, ' ')}</span>
                    {entry.club_id && nameOf.get(entry.club_id) && <> · {nameOf.get(entry.club_id)}</>} · {formatRelative(entry.created_at)}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyRow>No actions recorded yet.</EmptyRow>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}
