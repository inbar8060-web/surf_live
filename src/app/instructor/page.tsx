import Link from 'next/link'
import { createUserClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { getSpotConditions } from '@/lib/surf/conditions'
import { ConditionsPanel } from '@/components/conditions-panel'
import { Badge, Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui'
import { CallButton, GroupChatButton, WhatsAppButton } from '@/components/contact-links'
import { buttonClass } from '@/components/ui/button-class'
import { formatDate, formatTime } from '@/lib/util/format'
import type { InstructorRosterRow } from '@/lib/db/types'

export const metadata = { title: 'Today' }
export const dynamic = 'force-dynamic'

/** Group the flat roster rows into one entry per session. */
function groupBySlot(rows: InstructorRosterRow[]) {
  const bySlot = new Map<string, { slot: InstructorRosterRow; clients: InstructorRosterRow[] }>()

  for (const row of rows) {
    const entry = bySlot.get(row.slot_id) ?? { slot: row, clients: [] }
    if (row.reservation_id && row.client_id) entry.clients.push(row)
    bySlot.set(row.slot_id, entry)
  }

  return [...bySlot.values()].sort(
    (a, b) => new Date(a.slot.starts_at).getTime() - new Date(b.slot.starts_at).getTime(),
  )
}

export default async function InstructorTodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const { date } = await searchParams
  const user = await requireRole('instructor')
  const supabase = await createUserClient()
  const club = await getClubSettings()

  // A plain YYYY-MM-DD is the only accepted override, so the range below can
  // never be widened by a crafted query string.
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? new Date(`${date}T00:00:00`) : new Date()
  day.setHours(0, 0, 0, 0)
  const nextDay = new Date(day)
  nextDay.setDate(nextDay.getDate() + 1)

  const [rosterRes, conditions] = await Promise.all([
    supabase
      .from('instructor_roster')
      .select('*')
      .gte('starts_at', day.toISOString())
      .lt('starts_at', nextDay.toISOString())
      .order('starts_at'),
    getSpotConditions(Number(club.spot_latitude), Number(club.spot_longitude), club.spot_name),
  ])

  const sessions = groupBySlot(rosterRes.data ?? [])
  const isoDay = day.toISOString().slice(0, 10)

  return (
    <>
      <PageHeader
        title={`Your day — ${formatDate(day.toISOString(), club.timezone)}`}
        description={`${sessions.length} session(s) on your schedule.`}
        action={
          <div className="no-print flex flex-wrap gap-2">
            <a href={`/instructor/export?date=${isoDay}`} className={buttonClass('secondary')}>
              Export CSV
            </a>
            <Link href={`/instructor?date=${isoDay}`} className={buttonClass('ghost')}>
              Refresh
            </Link>
          </div>
        }
      />

      <div className="no-print mb-4">
        <ConditionsPanel conditions={conditions} timeZone={club.timezone} />
      </div>

      {sessions.length ? (
        <div className="space-y-4">
          {sessions.map(({ slot, clients }) => (
            <Card
              key={slot.slot_id}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  {formatTime(slot.starts_at, club.timezone)}–{formatTime(slot.ends_at, club.timezone)}{' '}
                  {slot.service_name}
                  <StatusBadge status={slot.slot_status} />
                </span>
              }
              description={[slot.location, `${clients.length} member(s)`].filter(Boolean).join(' · ')}
              action={<GroupChatButton url={slot.whatsapp_group_url} />}
            >
              {slot.slot_notes && <p className="muted mb-3 text-sm">Note: {slot.slot_notes}</p>}

              {clients.length ? (
                <ul className="space-y-2">
                  {clients.map((client) => (
                    <li
                      key={client.reservation_id}
                      className="flex flex-wrap items-start justify-between gap-2 rounded-lg px-3 py-2"
                      style={{ background: 'var(--surface-muted)' }}
                    >
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          {client.client_name}
                          <Badge tone="neutral">{client.client_level}</Badge>
                          <StatusBadge status={client.reservation_status ?? 'pending'} />
                          {!client.waiver_signed_at && <Badge tone="danger">No waiver</Badge>}
                        </p>
                        <p className="muted text-xs">
                          {client.participants} place(s)
                          {client.client_phone ? ` · ${client.client_phone}` : ''}
                        </p>
                        {client.medical_notes && (
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            Medical: {client.medical_notes}
                          </p>
                        )}
                        {client.emergency_contact_phone && (
                          <p className="muted text-xs">
                            Emergency: {client.emergency_contact_name ?? '—'} ·{' '}
                            {client.emergency_contact_phone}
                          </p>
                        )}
                        {client.client_note && <p className="mt-1 text-xs">“{client.client_note}”</p>}
                      </div>

                      <div className="no-print flex shrink-0 gap-1.5">
                        <WhatsAppButton
                          phone={client.client_phone}
                          message={`Hi ${client.client_name?.split(' ')[0] ?? ''}, it's ${user.profile.full_name} from ${club.club_name}. About today's ${slot.service_name}…`}
                          label=""
                        />
                        <CallButton phone={client.client_phone} label="" />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState>Nobody booked in yet.</EmptyState>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState>You have no sessions on this day.</EmptyState>
      )}
    </>
  )
}
