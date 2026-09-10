import Link from 'next/link'
import { createUserClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { getSpotConditions } from '@/lib/surf/conditions'
import { ConditionsPanel } from '@/components/conditions-panel'
import { Badge, Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui'
import { GroupChatButton, WhatsAppButton } from '@/components/contact-links'
import { buttonClass } from '@/components/ui/button-class'
import { formatDateTime, formatRelative } from '@/lib/util/format'

export const metadata = { title: 'Home' }
export const dynamic = 'force-dynamic'

export default async function ClientHomePage() {
  const user = await requireRole('client')
  const supabase = await createUserClient()
  const club = await getClubSettings()

  const [bookingsRes, packagesRes, rentalsRes, conditions] = await Promise.all([
    supabase
      .from('my_bookings')
      .select('*')
      .gte('starts_at', new Date().toISOString())
      .in('status', ['pending', 'approved'])
      .order('starts_at')
      .limit(5),
    supabase.from('my_packages').select('*').eq('is_usable', true).order('expires_at'),
    supabase.from('my_rentals').select('*').in('status', ['reserved', 'out', 'overdue']),
    getSpotConditions(Number(club.spot_latitude), Number(club.spot_longitude), club.spot_name),
  ])

  const next = bookingsRes.data?.[0]

  return (
    <>
      <PageHeader
        title={`Hi ${user.profile.full_name.split(' ')[0]}`}
        description="The sea today, and what you have coming up."
        action={
          <Link href="/client/book" className={buttonClass('primary')}>
            Book a session
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ConditionsPanel conditions={conditions} timeZone={club.timezone} />

        <Card
          title="Your next session"
          action={<Link href="/client/bookings" className="text-sm underline">All sessions</Link>}
        >
          {next ? (
            <div className="space-y-3">
              <div>
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {next.service_name}
                  <StatusBadge status={next.status} />
                </p>
                <p className="muted mt-1 text-sm">
                  {formatDateTime(next.starts_at, club.timezone)} ({formatRelative(next.starts_at)})
                </p>
                <p className="muted text-sm">
                  {next.location ?? 'Location to be confirmed'}
                  {next.instructor_name ? ` · with ${next.instructor_name}` : ''}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {next.instructor_whatsapp && (
                  <WhatsAppButton
                    phone={next.instructor_whatsapp}
                    message={`Hi ${next.instructor_name?.split(' ')[0] ?? ''}, about my ${next.service_name}…`}
                    label="Message instructor"
                  />
                )}
                <GroupChatButton url={next.whatsapp_group_url} label="Session group" />
              </div>

              {next.status === 'pending' && (
                <p className="muted text-sm">
                  Waiting for the club to confirm. You will see it here once it is approved.
                </p>
              )}
            </div>
          ) : (
            <EmptyState>Nothing booked. Pick a session and send a request.</EmptyState>
          )}
        </Card>

        {(bookingsRes.data?.length ?? 0) > 1 && (
          <Card title="Also coming up">
            <ul className="space-y-2 text-sm">
              {bookingsRes.data!.slice(1).map((booking) => (
                <li key={booking.reservation_id} className="flex flex-wrap justify-between gap-2">
                  <span>{booking.service_name}</span>
                  <span className="muted">{formatDateTime(booking.starts_at, club.timezone)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card
          title="Your packages"
          action={<Link href="/client/packages" className="text-sm underline">Details</Link>}
        >
          {packagesRes.data?.length ? (
            <ul className="space-y-2 text-sm">
              {packagesRes.data.map((pkg) => (
                <li key={pkg.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>{pkg.name}</span>
                  <Badge tone="success">{pkg.lessons_remaining} left</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No lesson packages at the moment.</EmptyState>
          )}
        </Card>

        {rentalsRes.data && rentalsRes.data.length > 0 && (
          <Card title="Gear you have out" action={<Link href="/client/rentals" className="text-sm underline">Details</Link>}>
            <ul className="space-y-2 text-sm">
              {rentalsRes.data.map((rental) => (
                <li key={rental.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {rental.item_name} <span className="muted">({rental.asset_tag})</span>
                  </span>
                  <span className="muted">due back {rental.end_date}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  )
}
