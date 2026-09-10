import { createUserClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui'
import { formatDateTime, formatMoney } from '@/lib/util/format'
import { BookForm } from './book-form'

export const metadata = { title: 'Book a session' }
export const dynamic = 'force-dynamic'

export default async function ClientBookPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category } = await searchParams
  await requireRole('client')

  const supabase = await createUserClient()
  const club = await getClubSettings()

  let query = supabase.from('slot_catalog').select('*').order('starts_at').limit(100)
  if (category) query = query.eq('category_slug', category)

  const [slotsRes, packagesRes, myBookingsRes] = await Promise.all([
    query,
    supabase.from('my_packages').select('*').eq('is_usable', true).order('expires_at'),
    supabase.from('my_bookings').select('reservation_id, slot_id, status'),
  ])

  const slots = slotsRes.data ?? []
  const packages = (packagesRes.data ?? []).map((pkg) => ({
    id: pkg.id,
    label: `${pkg.name} — ${pkg.lessons_remaining} lesson(s) left`,
  }))

  // A member already holding a live booking for a session should not be
  // offered the form again; the database would reject it anyway.
  const alreadyBooked = new Set(
    (myBookingsRes.data ?? [])
      .filter((b) => b.status === 'pending' || b.status === 'approved')
      .map((b) => b.slot_id),
  )

  const categories = [...new Map(slots.map((s) => [s.category_slug, s.category_name])).entries()]

  return (
    <>
      <PageHeader
        title="Book a session"
        description="Pick a session and send a request. The club or your instructor confirms it."
      />

      {categories.length > 1 && (
        <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filter by category">
          <a
            href="/client/book"
            className={`rounded-lg px-3 py-1.5 text-sm ${!category ? 'bg-sea-600 text-white' : 'surface'}`}
          >
            Everything
          </a>
          {categories.map(([slug, name]) => (
            <a
              key={slug}
              href={`/client/book?category=${slug}`}
              className={`rounded-lg px-3 py-1.5 text-sm ${category === slug ? 'bg-sea-600 text-white' : 'surface'}`}
            >
              {name}
            </a>
          ))}
        </nav>
      )}

      {packages.length > 0 && (
        <div className="mb-4">
          <Card>
            <p className="text-sm">
              You have {packages.length} package(s) with lessons left — choose one when you request a
              place and no payment is needed.
            </p>
          </Card>
        </div>
      )}

      {slots.length ? (
        <div className="space-y-3">
          {slots.map((slot) => {
            const full = slot.seats_left <= 0
            const booked = alreadyBooked.has(slot.slot_id)

            return (
              <Card key={slot.slot_id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{slot.service_name}</h3>
                      <Badge tone="neutral">{slot.category_name}</Badge>
                      {slot.min_level && <Badge tone="info">{slot.min_level}+</Badge>}
                      {full && <Badge tone="danger">Full</Badge>}
                    </div>

                    <p className="muted mt-1 text-sm">
                      {formatDateTime(slot.starts_at, club.timezone)} · {slot.duration_minutes} min
                      {slot.location ? ` · ${slot.location}` : ''}
                    </p>
                    <p className="muted text-sm">
                      {slot.instructor_names.length
                        ? `With ${slot.instructor_names.join(', ')}`
                        : 'Instructor to be confirmed'}{' '}
                      · {slot.seats_left} of {slot.capacity} places left
                    </p>
                    {slot.service_description && (
                      <p className="mt-1 text-sm">{slot.service_description}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <p className="text-lg font-semibold tabular-nums">
                      {formatMoney(slot.price_cents, slot.currency)}
                    </p>
                    {booked ? (
                      <Badge tone="success">Already requested</Badge>
                    ) : full ? (
                      <span className="muted text-sm">No places left</span>
                    ) : (
                      <BookForm slotId={slot.slot_id} seatsLeft={slot.seats_left} packages={packages} />
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <EmptyState>
          Nothing on the calendar right now. Check back soon, or call the club.
        </EmptyState>
      )}
    </>
  )
}
