import { Phone } from 'lucide-react'
import { createUserClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { ScreenTitle, Flag, NotePanel, InsChip } from '@/components/instructor/pieces'
import { instructorButton } from '@/components/ui/button-class'
import { Empty, Initials } from '@/components/ui/bits'
import { formatDateTime, formatRelative } from '@/lib/util/format'
import { telUrl } from '@/lib/util/contact'
import { InlineDecision } from '../inline-decision'

export const metadata = { title: 'Requests' }
export const dynamic = 'force-dynamic'

/**
 * `staff_reservation_queue` only returns rows for sessions the caller teaches,
 * so this page never has to filter by ownership — an instructor who tampers
 * with the request simply gets nothing back.
 */
export default async function InstructorRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const { view } = await searchParams
  await requireRole('instructor')

  const supabase = await createUserClient()
  const club = await getClubSettings()

  const { data: rows } = await supabase
    .from('staff_reservation_queue')
    .select('*')
    .in('status', ['pending', 'approved'])
    .gte('starts_at', new Date(Date.now() - 86_400_000).toISOString())
    .order('starts_at')
    .limit(150)

  const waiting = (rows ?? []).filter((r) => r.status === 'pending')
  const approved = (rows ?? []).filter((r) => r.status === 'approved')
  const showApproved = view === 'approved'
  const list = showApproved ? approved : waiting

  return (
    <>
      <ScreenTitle title="Requests" sub="Only for sessions you are teaching." />

      <div className="mb-4 flex gap-2 px-5">
        {[
          { key: '', label: `Waiting${waiting.length ? ` · ${waiting.length}` : ''}` },
          { key: 'approved', label: 'Approved' },
        ].map((tab) => {
          const active = (tab.key === 'approved') === showApproved
          return (
            <a
              key={tab.key}
              href={tab.key ? '/instructor/requests?view=approved' : '/instructor/requests'}
              style={{
                borderRadius: 999,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 800,
                background: active ? 'var(--color-ins-ink)' : '#fff',
                color: active ? '#fff' : 'var(--color-ins-ink-2)',
                border: active ? undefined : '1.5px solid var(--color-ins-line)',
              }}
            >
              {tab.label}
            </a>
          )
        })}
      </div>

      <div className="flex flex-col gap-3 px-5">
        {list.length === 0 && (
          <Empty tone="instructor">
            {showApproved ? 'Nothing approved yet.' : 'Nothing waiting on you.'}
          </Empty>
        )}

        {list.map((row) => {
          const call = telUrl(row.client_phone)

          return (
            <article key={row.reservation_id} className="i-card" style={{ padding: '15px 18px' }}>
              <div className="flex items-start gap-3">
                <Initials
                  name={row.client_name}
                  size={40}
                  background="var(--color-ins-ink)"
                  color="#fff"
                  fontSize={14}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{row.client_name}</p>
                    {!row.waiver_signed_at && <Flag tone="danger">No waiver</Flag>}
                  </div>
                  <p
                    style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 600, color: 'var(--color-ins-ink-2)' }}
                  >
                    {row.client_level} · {row.participants} place{row.participants === 1 ? '' : 's'} ·{' '}
                    {row.revision > 1 ? 'changed, needs re-approval' : `asked ${formatRelative(row.created_at)}`}
                  </p>
                </div>
                {row.revision > 1 && <InsChip tone="warn">Changed</InsChip>}
              </div>

              <p style={{ margin: '10px 0 0', fontSize: 14, fontWeight: 700 }}>
                {row.service_name} · {formatDateTime(row.starts_at, club.timezone)}
              </p>

              {row.client_note && (
                <p
                  style={{
                    margin: '10px 0 0',
                    background: 'var(--color-ins-ground)',
                    borderRadius: 12,
                    padding: '9px 12px',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  “{row.client_note}”
                </p>
              )}

              {row.medical_notes && (
                <div className="mt-3">
                  <NotePanel label="Medical">{row.medical_notes}</NotePanel>
                </div>
              )}

              <div className="mt-3.5 flex items-center gap-2">
                <div className="flex-1">
                  {row.status === 'pending' ? (
                    <InlineDecision reservationId={row.reservation_id} name={row.client_name} />
                  ) : (
                    <InsChip tone="accent">Approved</InsChip>
                  )}
                </div>
                {call && (
                  <a
                    href={call}
                    aria-label={`Call ${row.client_name}`}
                    className="flex shrink-0 items-center justify-center"
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 14,
                      border: '1.5px solid var(--color-ins-line)',
                      background: '#fff',
                    }}
                  >
                    <Phone size={18} />
                  </a>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}
