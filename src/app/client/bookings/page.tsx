import { createUserClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { Badge, Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui'
import { GroupChatButton, WhatsAppButton } from '@/components/contact-links'
import { formatDateTime, formatMoney } from '@/lib/util/format'
import {
  AmendForm,
  CancelBookingButton,
  InstructorReviewForm,
  SessionReviewForm,
  TipForm,
} from './forms'

export const metadata = { title: 'My sessions' }
export const dynamic = 'force-dynamic'

export default async function ClientBookingsPage() {
  await requireRole('client')
  const supabase = await createUserClient()
  const club = await getClubSettings()

  const { data: bookings } = await supabase
    .from('my_bookings')
    .select('*')
    .order('starts_at', { ascending: false })
    .limit(100)

  const now = Date.now()
  const upcoming = (bookings ?? []).filter(
    (b) => new Date(b.starts_at).getTime() >= now && ['pending', 'approved'].includes(b.status),
  )
  const past = (bookings ?? []).filter((b) => !upcoming.includes(b))

  return (
    <>
      <PageHeader
        title="My sessions"
        description={`You can change or cancel up to ${club.cancellation_window_hours} hours before a session starts.`}
      />

      <div className="space-y-4">
        <Card title="Coming up">
          {upcoming.length ? (
            <ul className="space-y-3">
              {upcoming.map((booking) => (
                <li
                  key={booking.reservation_id}
                  className="rounded-lg border px-3 py-3"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        {booking.service_name}
                        <StatusBadge status={booking.status} />
                        {booking.revision > 1 && booking.status === 'pending' && (
                          <Badge tone="warning">Waiting for re-approval</Badge>
                        )}
                      </p>
                      <p className="muted mt-1 text-sm">
                        {formatDateTime(booking.starts_at, club.timezone)} ·{' '}
                        {booking.duration_minutes} min
                        {booking.location ? ` · ${booking.location}` : ''}
                      </p>
                      <p className="muted text-sm">
                        {booking.participants} place(s) ·{' '}
                        {booking.client_package_id
                          ? 'from your package'
                          : formatMoney(booking.price_cents, booking.currency)}
                        {booking.instructor_name ? ` · with ${booking.instructor_name}` : ''}
                      </p>
                      {booking.client_note && <p className="mt-1 text-sm">“{booking.client_note}”</p>}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {booking.instructor_whatsapp && (
                          <WhatsAppButton
                            phone={booking.instructor_whatsapp}
                            message={`Hi ${booking.instructor_name?.split(' ')[0] ?? ''}, this is about my ${booking.service_name} on ${formatDateTime(booking.starts_at, club.timezone)}.`}
                            label="Message instructor"
                          />
                        )}
                        <GroupChatButton url={booking.whatsapp_group_url} label="Group" />
                      </div>

                      {booking.can_modify ? (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <AmendForm
                            reservationId={booking.reservation_id}
                            participants={booking.participants}
                            clientNote={booking.client_note ?? ''}
                            isApproved={booking.status === 'approved'}
                          />
                          <CancelBookingButton reservationId={booking.reservation_id} />
                        </div>
                      ) : (
                        <p className="muted text-xs">
                          Too close to the start to change — call the club if you need to.
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Nothing booked yet — have a look at what is on.</EmptyState>
          )}
        </Card>

        <Card title="Past sessions" description="Leave a review, or say thanks with a tip.">
          {past.length ? (
            <ul className="space-y-3">
              {past.map((booking) => {
                const attended = booking.status === 'approved' || booking.status === 'completed'
                const isPast = new Date(booking.starts_at).getTime() < now

                return (
                  <li
                    key={booking.reservation_id}
                    className="rounded-lg border px-3 py-3"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          {booking.service_name}
                          <StatusBadge status={booking.status} />
                        </p>
                        <p className="muted text-sm">
                          {formatDateTime(booking.starts_at, club.timezone)}
                          {booking.instructor_name ? ` · with ${booking.instructor_name}` : ''}
                        </p>
                        {booking.rejection_reason && (
                          <p className="muted mt-1 text-sm">Declined: {booking.rejection_reason}</p>
                        )}
                      </div>

                      {attended && isPast && (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {!booking.has_session_review && (
                            <SessionReviewForm slotId={booking.slot_id} />
                          )}
                          {booking.instructor_id && booking.instructor_name && (
                            <>
                              <InstructorReviewForm
                                instructorId={booking.instructor_id}
                                instructorName={booking.instructor_name}
                                reservationId={booking.reservation_id}
                              />
                              {club.tips_enabled && (
                                <TipForm
                                  instructorId={booking.instructor_id}
                                  instructorName={booking.instructor_name}
                                  reservationId={booking.reservation_id}
                                  currency={club.currency}
                                />
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState>No past sessions yet.</EmptyState>
          )}
        </Card>
      </div>
    </>
  )
}
