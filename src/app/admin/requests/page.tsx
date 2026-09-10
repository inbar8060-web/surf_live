import { createUserClient } from '@/lib/supabase/server'
import { getClubSettings } from '@/lib/db/queries'
import { Card, EmptyState, PageHeader, StatusBadge, Badge } from '@/components/ui'
import { ReservationDecision } from '@/components/reservation-decision'
import { CallButton, WhatsAppButton } from '@/components/contact-links'
import { formatDateTime, formatMoney, formatRelative } from '@/lib/util/format'
import type { ReservationStatus } from '@/lib/db/types'

export const metadata = { title: 'Booking requests' }
export const dynamic = 'force-dynamic'

const FILTERS: { key: string; label: string; statuses: ReservationStatus[] }[] = [
  { key: 'pending', label: 'Awaiting approval', statuses: ['pending'] },
  { key: 'approved', label: 'Approved', statuses: ['approved'] },
  { key: 'closed', label: 'Closed', statuses: ['rejected', 'cancelled', 'completed', 'no_show'] },
]

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const { view } = await searchParams
  const filter = FILTERS.find((f) => f.key === view) ?? FILTERS[0]!

  const supabase = await createUserClient()
  const club = await getClubSettings()

  const { data: rows } = await supabase
    .from('staff_reservation_queue')
    .select('*')
    .in('status', filter.statuses)
    .order('starts_at', { ascending: true })
    .limit(200)

  return (
    <>
      <PageHeader
        title="Booking requests"
        description="Approve or decline what members have asked for."
      />

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filter">
        {FILTERS.map((f) => (
          <a
            key={f.key}
            href={`/admin/requests?view=${f.key}`}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              f.key === filter.key ? 'bg-sea-600 text-white' : 'surface'
            }`}
          >
            {f.label}
          </a>
        ))}
      </nav>

      {rows?.length ? (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.reservation_id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{row.client_name}</h3>
                    <Badge tone="neutral">{row.client_level}</Badge>
                    <StatusBadge status={row.status} />
                    {row.revision > 1 && <Badge tone="warning">Changed by the member</Badge>}
                    {!row.waiver_signed_at && <Badge tone="danger">No waiver</Badge>}
                  </div>

                  <p className="muted mt-1 text-sm">
                    {row.service_name} · {formatDateTime(row.starts_at, club.timezone)}
                    {row.location ? ` · ${row.location}` : ''}
                  </p>
                  <p className="muted text-sm">
                    {row.participants} place(s) · {formatMoney(row.price_cents, row.currency)}
                    {row.client_package_id ? ' · paid from a package' : ''} · asked{' '}
                    {formatRelative(row.created_at)}
                  </p>
                  <p className="muted text-sm">
                    {row.instructor_names.length
                      ? `Instructor: ${row.instructor_names.join(', ')}`
                      : 'No instructor assigned yet'}
                  </p>

                  {row.client_note && (
                    <p className="mt-2 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--surface-muted)' }}>
                      “{row.client_note}”
                    </p>
                  )}
                  {row.medical_notes && (
                    <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                      Medical: {row.medical_notes}
                    </p>
                  )}
                  {row.rejection_reason && (
                    <p className="muted mt-2 text-sm">Declined: {row.rejection_reason}</p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="flex gap-2">
                    <WhatsAppButton
                      phone={row.client_phone}
                      message={`Hi ${row.client_name.split(' ')[0]}, about your ${row.service_name} booking…`}
                    />
                    <CallButton phone={row.client_phone} />
                  </div>
                  {row.status === 'pending' && (
                    <ReservationDecision reservationId={row.reservation_id} />
                  )}
                  {row.status === 'approved' && (
                    <ReservationDecision reservationId={row.reservation_id} allowComplete />
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState>Nothing here right now.</EmptyState>
      )}
    </>
  )
}
