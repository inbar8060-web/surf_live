import { createUserClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { MemberHero, HeroBack } from '@/components/member/hero'
import { Empty, MicroLabel } from '@/components/ui/bits'
import { formatMoney, formatTime } from '@/lib/util/format'
import { BookForm, type PackageOption } from './book-form'

export const metadata = { title: 'Book a session' }
export const dynamic = 'force-dynamic'

/** Group sessions under a day divider, in club time. */
function dayKey(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone,
  }).format(new Date(iso))
}

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

  const [slotsRes, packagesRes, myBookingsRes, allCategoriesRes] = await Promise.all([
    query,
    supabase.from('my_packages').select('*').eq('is_usable', true).order('expires_at'),
    supabase.from('my_bookings').select('slot_id, status'),
    // the pill row must not collapse to one when a filter is applied
    supabase.from('slot_catalog').select('category_slug, category_name'),
  ])

  const slots = slotsRes.data ?? []
  const packages: PackageOption[] = (packagesRes.data ?? []).map((pkg) => ({
    id: pkg.id,
    name: pkg.name,
    remaining: pkg.lessons_remaining,
  }))

  // A member already holding a live booking is not offered the form again;
  // the database would reject a second one anyway.
  const alreadyBooked = new Set(
    (myBookingsRes.data ?? [])
      .filter((b) => b.status === 'pending' || b.status === 'approved')
      .map((b) => b.slot_id),
  )

  const categories = [
    ...new Map((allCategoriesRes.data ?? []).map((s) => [s.category_slug, s.category_name])).entries(),
  ]

  const days = new Map<string, typeof slots>()
  for (const slot of slots) {
    const key = dayKey(slot.starts_at, club.timezone)
    days.set(key, [...(days.get(key) ?? []), slot])
  }

  return (
    <>
      <MemberHero waves={false}>
        <HeroBack href="/client" title="Book a session" />

        {categories.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            <a
              href="/client/book"
              className="shrink-0 rounded-full"
              style={{
                background: !category ? '#2cc4ff' : '#0b4a6d',
                color: !category ? '#072f49' : '#b6e8ff',
                padding: '7px 14px',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              All
            </a>
            {categories.map(([slug, name]) => (
              <a
                key={slug}
                href={`/client/book?category=${slug}`}
                className="shrink-0 rounded-full"
                style={{
                  background: category === slug ? '#2cc4ff' : '#0b4a6d',
                  color: category === slug ? '#072f49' : '#b6e8ff',
                  padding: '7px 14px',
                  fontSize: 13,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                {name}
              </a>
            ))}
          </div>
        )}
      </MemberHero>

      <div className="px-5 pt-4">
        {packages.length > 0 && (
          <p
            className="mb-4"
            style={{
              background: '#def2ff',
              color: '#065a84',
              borderRadius: 16,
              padding: '10px 14px',
              fontSize: 13,
              lineHeight: 1.45,
            }}
          >
            {packages.reduce((n, p) => n + p.remaining, 0)} lesson(s) left on your{' '}
            {packages[0]!.name} — no payment needed.
          </p>
        )}

        {days.size > 0 ? (
          [...days.entries()].map(([day, daySlots]) => (
            <section key={day} className="mb-5">
              <div className="mb-3 flex items-center gap-3">
                <MicroLabel color="#5a6f7d">{day}</MicroLabel>
                <span style={{ flex: 1, height: 1, background: '#dbe3ea' }} />
              </div>

              <div className="flex flex-col gap-3">
                {daySlots.map((slot) => {
                  const full = slot.seats_left <= 0
                  const booked = alreadyBooked.has(slot.slot_id)
                  const tight = slot.seats_left > 0 && slot.seats_left < 3

                  return (
                    <article
                      key={slot.slot_id}
                      className="m-card-sm"
                      style={{ padding: '16px 18px' }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="display" style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
                            {slot.service_name}
                          </h2>
                          <p style={{ margin: '3px 0 0', fontSize: 13, fontWeight: 700, color: '#0087c6' }}>
                            {formatTime(slot.starts_at, club.timezone)} · {slot.duration_minutes} min
                          </p>
                          <p style={{ margin: '3px 0 0', fontSize: 13, color: '#5a6f7d' }}>
                            {slot.instructor_names.length
                              ? slot.instructor_names.join(', ')
                              : 'Instructor to be confirmed'}
                            {slot.location ? ` · ${slot.location}` : ''}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="display" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                            {formatMoney(slot.price_cents, slot.currency)}
                          </p>
                          <p
                            style={{
                              margin: '2px 0 0',
                              fontSize: 12,
                              fontWeight: 700,
                              color: full ? '#9f1239' : tight ? '#b45309' : '#0f766e',
                            }}
                          >
                            {full ? 'Full' : `${slot.seats_left} left`}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3.5 flex justify-end">
                        {booked ? (
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#065f46' }}>
                            Already requested
                          </span>
                        ) : full ? (
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#5a6f7d' }}>
                            No places left
                          </span>
                        ) : (
                          <BookForm
                            slotId={slot.slot_id}
                            seatsLeft={slot.seats_left}
                            packages={packages}
                            priceLabel={formatMoney(slot.price_cents, slot.currency)}
                          />
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          ))
        ) : (
          <Empty>Nothing on the calendar right now. Check back soon, or call the club.</Empty>
        )}
      </div>
    </>
  )
}
