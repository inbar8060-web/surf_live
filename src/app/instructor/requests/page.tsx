import { createUserClient } from '@/lib/supabase/server'
import { getClubSettings } from '@/lib/db/queries'
import { Badge, Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui'
import { ReservationDecision } from '@/components/reservation-decision'
import { CallButton, WhatsAppButton } from '@/components/contact-links'
import { formatDateTime, formatRelative } from '@/lib/util/format'

export const metadata = { title: 'Requests' }
export const dynamic = 'force-dynamic'

/**
 * Requests on this instructor's own sessions.
 *
 * The filtering is not done here — staff_reservation_queue only returns rows
 * for sessions the caller teaches. An instructor who tampers with the request
 * simply gets nothing back.
 */
export default async function InstructorRequestsPage() {
  const supabase = await createUserClient()
  const club = await getClubSettings()

  const { data: rows } = await supabase
    .from('staff_reservation_queue')
    .select('*')
    .in('status', ['pending', 'approved'])
    .gte('starts_at', new Date(Date.now() - 86_400_000).toISOString())
    .order('starts_at')
    .limit(150)

  const pending = (rows ?? []).filter((r) => r.status === 'pending')
  const approved = (rows ?? []).filter((r) => r.status === 'approved')

  return (
    <>
      <PageHeader
        title="Requests for your sessions"
        description="Approve or decline the members who asked to join a session you are teaching."
      />

      <Card
        title="Awaiting your approval"
        action={pending.length ? <Badge tone="warning">{pending.length}</Badge> : null}
        className="mb-4"
      >
        {pending.length ? (
          <ul className="space-y-3">
            {pending.map((row) => (
              <li key={row.reservation_id} className="rounded-lg border px-3 py-3" style={{ borderColor: 'var(--border)' }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {row.client_name}
                      <Badge tone="neutral">{row.client_level}</Badge>
                      {row.revision > 1 && <Badge tone="warning">Changed — needs re-approval</Badge>}
                      {!row.waiver_signed_at && <Badge tone="danger">No waiver</Badge>}
                    </p>
                    <p className="muted text-sm">
                      {row.service_name} · {formatDateTime(row.starts_at, club.timezone)} ·{' '}
                      {row.participants} place(s) · asked {formatRelative(row.created_at)}
                    </p>
                    {row.client_note && <p className="mt-1 text-sm">“{row.client_note}”</p>}
                    {row.medical_notes && (
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        Medical: {row.medical_notes}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-1.5">
                      <WhatsAppButton phone={row.client_phone} label="" />
                      <CallButton phone={row.client_phone} label="" />
                    </div>
                    <ReservationDecision reservationId={row.reservation_id} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>Nothing waiting on you.</EmptyState>
        )}
      </Card>

      <Card title="Already approved">
        {approved.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Session</th>
                  <th>When</th>
                  <th>Places</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {approved.map((row) => (
                  <tr key={row.reservation_id}>
                    <td>{row.client_name}</td>
                    <td>{row.service_name}</td>
                    <td className="muted text-xs">{formatDateTime(row.starts_at, club.timezone)}</td>
                    <td className="tabular-nums">{row.participants}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>Nothing approved yet.</EmptyState>
        )}
      </Card>
    </>
  )
}
