import { MessageCircle } from 'lucide-react'
import { createUserClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { MemberHero, MemberStatus } from '@/components/member/hero'
import { Chip, Empty } from '@/components/ui/bits'
import { memberButton } from '@/components/ui/button-class'
import { formatDateTime, formatMoney } from '@/lib/util/format'
import { whatsappChatUrl } from '@/lib/util/contact'
import { AmendSheet, CancelBookingButton, ReviewSheet, TipSheet } from './sheets'

export const metadata = { title: 'My sessions' }
export const dynamic = 'force-dynamic'

export default async function ClientBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const { view } = await searchParams
  await requireRole('client')

  const supabase = await createUserClient()
  const club = await getClubSettings()

  const [bookingsRes, catalogRes] = await Promise.all([
    supabase.from('my_bookings').select('*').order('starts_at', { ascending: false }).limit(100),
    // seats_left for the change sheet's "N free" hint
    supabase.from('slot_catalog').select('slot_id, seats_left'),
  ])

  const seatsFree = new Map((catalogRes.data ?? []).map((s) => [s.slot_id, s.seats_left]))
  const now = Date.now()

  const upcoming = (bookingsRes.data ?? []).filter(
    (b) => new Date(b.starts_at).getTime() >= now && ['pending', 'approved'].includes(b.status),
  )
  const past = (bookingsRes.data ?? []).filter((b) => !upcoming.includes(b))
  const showPast = view === 'past'
  const rows = showPast ? past : upcoming

  return (
    <>
      <MemberHero waves={false}>
        <h1 className="display" style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          My sessions
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#b6e8ff', lineHeight: 1.45 }}>
          Change or cancel up to {club.cancellation_window_hours} hours before the start.
        </p>

        <div className="mt-4 flex gap-2">
          {[
            { key: '', label: `Coming up${upcoming.length ? ` · ${upcoming.length}` : ''}` },
            { key: 'past', label: 'Past' },
          ].map((tab) => {
            const active = (tab.key === 'past') === showPast
            return (
              <a
                key={tab.key}
                href={tab.key ? '/client/bookings?view=past' : '/client/bookings'}
                className="rounded-full"
                style={{
                  background: active ? '#2cc4ff' : '#0b4a6d',
                  color: active ? '#072f49' : '#b6e8ff',
                  padding: '7px 16px',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {tab.label}
              </a>
            )
          })}
        </div>
      </MemberHero>

      <div className="flex flex-col gap-3 px-5 pt-4">
        {rows.length === 0 && (
          <Empty>
            {showPast ? 'No past sessions yet.' : 'Nothing booked yet — have a look at what is on.'}
          </Empty>
        )}

        {rows.map((booking) => {
          const chat = whatsappChatUrl(
            booking.instructor_whatsapp,
            `Hi ${booking.instructor_name?.split(' ')[0] ?? ''}, about my ${booking.service_name} on ${formatDateTime(booking.starts_at, club.timezone)}.`,
          )
          const attended = booking.status === 'approved' || booking.status === 'completed'
          const isPast = new Date(booking.starts_at).getTime() < now

          return (
            <article key={booking.reservation_id} className="m-card-sm" style={{ padding: '16px 18px' }}>
              <div className="flex flex-wrap items-center gap-2">
                <MemberStatus status={booking.status} />
                {booking.revision > 1 && booking.status === 'pending' && (
                  <Chip bg="#fef3c7" ink="#78350f" size="sm">
                    Waiting for re-approval
                  </Chip>
                )}
              </div>

              <h2 className="display" style={{ fontSize: 17, fontWeight: 700, margin: '10px 0 0' }}>
                {booking.service_name}
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: 13, fontWeight: 700, color: '#0087c6' }}>
                {formatDateTime(booking.starts_at, club.timezone)} · {booking.duration_minutes} min
              </p>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: '#5a6f7d' }}>
                {booking.participants} place{booking.participants === 1 ? '' : 's'} ·{' '}
                {booking.client_package_id
                  ? 'from your package'
                  : formatMoney(booking.price_cents, booking.currency)}
                {booking.instructor_name ? ` · ${booking.instructor_name}` : ''}
              </p>

              {booking.client_note && (
                <p
                  className="mt-3"
                  style={{ background: '#f1f5f9', borderRadius: 14, padding: '9px 12px', fontSize: 13 }}
                >
                  “{booking.client_note}”
                </p>
              )}

              {booking.rejection_reason && (
                <p className="mt-3" style={{ fontSize: 13, color: '#9f1239' }}>
                  Declined: {booking.rejection_reason}
                </p>
              )}

              {/* ---- actions ---- */}
              {!showPast && (
                <div className="mt-3.5">
                  {booking.can_modify ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <AmendSheet
                        reservationId={booking.reservation_id}
                        participants={booking.participants}
                        clientNote={booking.client_note ?? ''}
                        isApproved={booking.status === 'approved'}
                        sessionLine={`${booking.service_name} · ${formatDateTime(booking.starts_at, club.timezone)}`}
                        seatsFree={seatsFree.get(booking.slot_id) ?? 0}
                      />
                      <CancelBookingButton reservationId={booking.reservation_id} />
                      {chat && (
                        <a
                          href={chat}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Message your instructor"
                          className="ml-auto flex items-center justify-center"
                          style={{ width: 38, height: 38, borderRadius: 13, background: '#eff9ff', color: '#0087c6' }}
                        >
                          <MessageCircle size={18} />
                        </a>
                      )}
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: '#5a6f7d', lineHeight: 1.45 }}>
                      Too close to the start to change — call the club if you need to.
                    </p>
                  )}
                </div>
              )}

              {showPast && attended && isPast && (
                <div className="mt-3.5 flex flex-wrap gap-2">
                  {!booking.has_session_review && (
                    <ReviewSheet
                      slotId={booking.slot_id}
                      instructorId={booking.instructor_id}
                      instructorName={booking.instructor_name}
                      reservationId={booking.reservation_id}
                      currency={club.currency}
                      tipsEnabled={club.tips_enabled}
                    />
                  )}
                  {club.tips_enabled && booking.instructor_id && booking.instructor_name && (
                    <TipSheet
                      instructorId={booking.instructor_id}
                      instructorName={booking.instructor_name}
                      reservationId={booking.reservation_id}
                      currency={club.currency}
                    />
                  )}
                  {booking.has_session_review && booking.instructor_id && (
                    <ReviewSheet
                      slotId={booking.slot_id}
                      instructorId={booking.instructor_id}
                      instructorName={booking.instructor_name}
                      reservationId={booking.reservation_id}
                      currency={club.currency}
                      tipsEnabled={club.tips_enabled}
                      label="Private feedback to the club"
                    />
                  )}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </>
  )
}
