import { MessageCircle, Phone } from 'lucide-react'
import { createUserClient } from '@/lib/supabase/server'
import { getClubSettings } from '@/lib/db/queries'
import { AdmChip, AdmStatus, EmptyRow, PageTitle, Panel, SubTabs } from '@/components/admin/pieces'
import { ReservationDecision } from '@/components/reservation-decision'
import { Initials } from '@/components/ui/bits'
import { formatDateTime, formatMoney, formatRelative } from '@/lib/util/format'
import { telUrl, whatsappChatUrl } from '@/lib/util/contact'
import type { ReservationStatus } from '@/lib/db/types'

export const metadata = { title: 'Bookings' }
export const dynamic = 'force-dynamic'

const VIEWS: Record<string, ReservationStatus[]> = {
  '': ['pending'],
  approved: ['approved'],
  closed: ['rejected', 'cancelled', 'completed', 'no_show'],
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const view = tab && tab in VIEWS ? tab : ''
  const statuses = VIEWS[view]!

  const supabase = await createUserClient()
  const club = await getClubSettings()

  const [rowsRes, pendingCount] = await Promise.all([
    supabase
      .from('staff_reservation_queue')
      .select('*')
      .in('status', statuses)
      .order('starts_at')
      .limit(200),
    supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  const rows = rowsRes.data ?? []

  return (
    <>
      <PageTitle title="Bookings" sub="Approve or decline what members have asked for." />

      <SubTabs
        base="/admin/bookings"
        current={view}
        tabs={[
          { key: '', label: 'Awaiting approval', count: pendingCount.count ?? 0 },
          { key: 'approved', label: 'Approved' },
          { key: 'closed', label: 'Closed' },
        ]}
      />

      <Panel helper="Closed covers declined, cancelled, attended and no-show.">
        {rows.length ? (
          <ul className="flex flex-col">
            {rows.map((row, i) => {
              const chat = whatsappChatUrl(
                row.client_phone,
                `Hi ${row.client_name.split(' ')[0]}, about your ${row.service_name} booking…`,
              )
              const call = telUrl(row.client_phone)
              const problem = !row.waiver_signed_at

              return (
                <li
                  key={row.reservation_id}
                  className="flex flex-wrap items-start gap-3 py-3.5"
                  style={{
                    borderTop: i === 0 ? undefined : '1px solid var(--color-adm-rule)',
                    background: problem ? 'var(--color-adm-rose-bg)' : undefined,
                    borderRadius: problem ? 10 : undefined,
                    paddingInline: problem ? 10 : undefined,
                  }}
                >
                  <Initials
                    name={row.client_name}
                    size={40}
                    background="var(--color-adm-neutral-chip)"
                    color="var(--color-adm-ink-2)"
                    fontSize={14}
                  />

                  <div className="min-w-[200px] flex-1">
                    <p className="flex flex-wrap items-center gap-1.5" style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
                      {row.client_name}
                      <AdmChip>{row.client_level}</AdmChip>
                      {problem && <AdmChip tone="rose">No waiver</AdmChip>}
                      {row.revision > 1 && <AdmChip tone="amber">Changed by the member</AdmChip>}
                      {row.client_package_id && <AdmChip tone="blue">Pays from package</AdmChip>}
                      {row.slot_status !== 'open' && <AdmChip tone="amber">Session {row.slot_status}</AdmChip>}
                      {view !== '' && <AdmStatus status={row.status} />}
                    </p>

                    <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--color-adm-ink-2)' }}>
                      {row.service_name} · {formatDateTime(row.starts_at, club.timezone)}
                      {row.location ? ` · ${row.location}` : ''}
                      {row.instructor_names.length ? ` · ${row.instructor_names.join(', ')}` : ' · no instructor'}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-adm-ink-2)' }}>
                      {row.participants} place{row.participants === 1 ? '' : 's'} ·{' '}
                      {row.client_package_id ? 'from a package' : formatMoney(row.price_cents, row.currency)} ·
                      asked {formatRelative(row.created_at)}
                    </p>

                    {row.client_note && (
                      <p
                        style={{
                          margin: '8px 0 0',
                          background: 'var(--color-adm-ground)',
                          borderRadius: 9,
                          padding: '8px 10px',
                          fontSize: 13,
                        }}
                      >
                        “{row.client_note}”
                      </p>
                    )}
                    {row.medical_notes && (
                      <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-adm-amber-ink)' }}>
                        Medical: {row.medical_notes}
                      </p>
                    )}
                    {row.rejection_reason && (
                      <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-adm-rose-ink)' }}>
                        Declined: {row.rejection_reason}
                      </p>
                    )}
                  </div>

                  <div className="flex w-full flex-wrap items-start gap-1.5 lg:w-auto lg:shrink-0">
                    {chat && (
                      <a
                        href={chat}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Message ${row.client_name}`}
                        className="flex items-center justify-center"
                        style={{ width: 35, height: 35, borderRadius: 9, border: '1.5px solid var(--color-adm-line)', background: '#fff' }}
                      >
                        <MessageCircle size={16} />
                      </a>
                    )}
                    {call && (
                      <a
                        href={call}
                        aria-label={`Call ${row.client_name}`}
                        className="flex items-center justify-center"
                        style={{ width: 35, height: 35, borderRadius: 9, border: '1.5px solid var(--color-adm-line)', background: '#fff' }}
                      >
                        <Phone size={16} />
                      </a>
                    )}
                    {row.status === 'pending' && (
                      <ReservationDecision reservationId={row.reservation_id} clientName={row.client_name} />
                    )}
                    {row.status === 'approved' && (
                      <ReservationDecision
                        reservationId={row.reservation_id}
                        clientName={row.client_name}
                        allowComplete
                      />
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyRow>Nothing here right now.</EmptyRow>
        )}
      </Panel>
    </>
  )
}
