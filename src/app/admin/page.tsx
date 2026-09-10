import Link from 'next/link'
import { createUserClient } from '@/lib/supabase/server'
import { getClubSettings } from '@/lib/db/queries'
import { getSpotConditions } from '@/lib/surf/conditions'
import { ConditionsPanel } from '@/components/conditions-panel'
import { Card, PageHeader, EmptyState, StatusBadge } from '@/components/ui'
import { formatDateTime, formatMoney } from '@/lib/util/format'

export const metadata = { title: 'Overview' }
export const dynamic = 'force-dynamic'

function Stat({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const body = (
    <div className="surface px-4 py-3">
      <p className="muted text-xs uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
  return href ? <Link href={href}>{body}</Link> : body
}

export default async function AdminHome() {
  const supabase = await createUserClient()
  const club = await getClubSettings()

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date(startOfToday)
  endOfToday.setDate(endOfToday.getDate() + 1)

  const [pending, todaySlots, activeClients, outRentals, recent, conditions] = await Promise.all([
    supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase
      .from('staff_slot_overview')
      .select('*')
      .gte('starts_at', startOfToday.toISOString())
      .lt('starts_at', endOfToday.toISOString())
      .order('starts_at'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'client').eq('is_active', true),
    supabase.from('rentals').select('id', { count: 'exact', head: true }).in('status', ['out', 'overdue']),
    supabase
      .from('reservations')
      .select('id, status, participants, price_cents, currency, created_at, slot_id')
      .order('created_at', { ascending: false })
      .limit(8),
    getSpotConditions(Number(club.spot_latitude), Number(club.spot_longitude), club.spot_name),
  ])

  return (
    <>
      <PageHeader title={club.club_name} description="What is happening at the club right now." />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Awaiting approval" value={pending.count ?? 0} href="/admin/requests" />
        <Stat label="Sessions today" value={todaySlots.data?.length ?? 0} href="/admin/schedule" />
        <Stat label="Active members" value={activeClients.count ?? 0} href="/admin/people" />
        <Stat label="Boards out" value={outRentals.count ?? 0} href="/admin/rentals" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ConditionsPanel conditions={conditions} timeZone={club.timezone} />

        <Card title="Today's sessions" action={<Link href="/admin/schedule" className="text-sm underline">Schedule</Link>}>
          {todaySlots.data?.length ? (
            <ul className="space-y-2">
              {todaySlots.data.map((slot) => (
                <li key={slot.slot_id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium">{slot.service_name}</p>
                    <p className="muted text-xs">
                      {formatDateTime(slot.starts_at, club.timezone)} ·{' '}
                      {slot.instructor_names.length ? slot.instructor_names.join(', ') : 'No instructor yet'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="muted text-xs tabular-nums">
                      {slot.seats_taken}/{slot.capacity}
                    </span>
                    <StatusBadge status={slot.status} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Nothing scheduled today.</EmptyState>
          )}
        </Card>

        <Card
          title="Latest booking activity"
          className="lg:col-span-2"
          action={<Link href="/admin/requests" className="text-sm underline">All requests</Link>}
        >
          {recent.data?.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Places</th>
                    <th>Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.data.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDateTime(row.created_at, club.timezone)}</td>
                      <td className="tabular-nums">{row.participants}</td>
                      <td className="tabular-nums">{formatMoney(row.price_cents, row.currency)}</td>
                      <td><StatusBadge status={row.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>No bookings yet.</EmptyState>
          )}
        </Card>
      </div>
    </>
  )
}
