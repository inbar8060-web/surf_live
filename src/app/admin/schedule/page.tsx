import { createUserClient } from '@/lib/supabase/server'
import { getClubSettings } from '@/lib/db/queries'
import { AdmChip, AdmStatus, CapacityBar, EmptyRow, PageTitle, Panel } from '@/components/admin/pieces'
import { GroupChatButton } from '@/components/contact-links'
import { formatMoney, formatTime, todayInZone } from '@/lib/util/format'
import { SlotForm, type InstructorOption, type ServiceOption } from './slot-form'
import { SlotControls } from './slot-controls'

export const metadata = { title: 'Schedule' }
export const dynamic = 'force-dynamic'

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>
}) {
  const { day } = await searchParams
  const supabase = await createUserClient()
  const club = await getClubSettings()

  const since = new Date()
  since.setHours(0, 0, 0, 0)

  const [servicesRes, instructorsRes, slotsRes, categoriesRes] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, duration_minutes, default_capacity, price_cents, currency, category_id, is_active')
      .eq('is_active', true)
      .order('name'),
    supabase.from('instructor_directory').select('profile_id, full_name').order('full_name'),
    supabase
      .from('staff_slot_overview')
      .select('*')
      .gte('starts_at', since.toISOString())
      .order('starts_at')
      .limit(200),
    supabase.from('categories').select('id, name'),
  ])

  const categoryName = new Map((categoriesRes.data ?? []).map((c) => [c.id, c.name]))

  const services: ServiceOption[] = (servicesRes.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    durationMinutes: s.duration_minutes,
    defaultCapacity: s.default_capacity,
    categoryName: categoryName.get(s.category_id) ?? 'Uncategorised',
    price: formatMoney(s.price_cents, s.currency),
  }))

  const instructors: InstructorOption[] = (instructorsRes.data ?? []).map((i) => ({
    id: i.profile_id,
    name: i.full_name,
  }))

  const priceOf = new Map(
    (servicesRes.data ?? []).map((s) => [s.id, { cents: s.price_cents, currency: s.currency }]),
  )

  // A day strip built from the days that actually have sessions.
  const allSlots = slotsRes.data ?? []
  const days = [...new Set(allSlots.map((s) => s.starts_at.slice(0, 10)))].slice(0, 10)
  const activeDay = day && days.includes(day) ? day : (days[0] ?? todayInZone(club.timezone))
  const slots = allSlots.filter((s) => s.starts_at.slice(0, 10) === activeDay)

  return (
    <>
      <PageTitle title="Schedule" sub="Sessions from today onward." />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div>
          {days.length > 0 && (
            <nav aria-label="Day" className="mb-4 flex flex-wrap gap-1.5">
              {days.map((d) => {
                const active = d === activeDay
                return (
                  <a
                    key={d}
                    href={`/admin/schedule?day=${d}`}
                    aria-current={active ? 'page' : undefined}
                    style={{
                      borderRadius: 10,
                      padding: '8px 12px',
                      fontSize: 13,
                      fontWeight: active ? 800 : 600,
                      background: active ? 'var(--color-adm-chrome)' : '#fff',
                      color: active ? '#fff' : 'var(--color-adm-ink-2)',
                      border: active ? undefined : '1.5px solid var(--color-adm-line)',
                    }}
                  >
                    {new Intl.DateTimeFormat('en-GB', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      timeZone: club.timezone,
                    }).format(new Date(`${d}T12:00:00Z`))}
                  </a>
                )
              })}
            </nav>
          )}

          <Panel helper="The three dots hold block, reopen and cancel.">
            {slots.length ? (
              <ul className="flex flex-col">
                {slots.map((slot, i) => {
                  const price = priceOf.get(slot.service_id)
                  const blocked = slot.status !== 'open'

                  return (
                    <li
                      key={slot.slot_id}
                      className="flex flex-wrap items-start gap-3 py-3.5"
                      style={{
                        borderTop: i === 0 ? undefined : '1px solid var(--color-adm-rule)',
                        background: blocked ? 'var(--color-adm-amber-bg)' : undefined,
                        borderRadius: blocked ? 10 : undefined,
                        paddingInline: blocked ? 10 : undefined,
                      }}
                    >
                      <span style={{ fontSize: 15, fontWeight: 800, width: 96, flexShrink: 0 }}>
                        {formatTime(slot.starts_at, club.timezone)}–{formatTime(slot.ends_at, club.timezone)}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5" style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>
                          {slot.service_name}
                          <AdmStatus status={slot.status} />
                          {slot.pending_count > 0 && (
                            <AdmChip tone="amber">{slot.pending_count} awaiting approval</AdmChip>
                          )}
                          {slot.instructor_ids.length === 0 && <AdmChip tone="rose">No instructor</AdmChip>}
                        </p>
                        <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--color-adm-ink-2)' }}>
                          {[
                            slot.location,
                            slot.instructor_names.length ? slot.instructor_names.join(', ') : 'unstaffed',
                            price ? formatMoney(price.cents, price.currency) : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        {slot.block_reason && (
                          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-adm-amber-ink)' }}>
                            {slot.block_reason}
                          </p>
                        )}
                        {slot.notes && (
                          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-adm-ink-2)' }}>
                            {slot.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex w-full items-center gap-2 lg:w-auto lg:shrink-0">
                        <CapacityBar taken={slot.seats_taken} capacity={slot.capacity} />
                        <GroupChatButton url={slot.whatsapp_group_url} label="" />
                        {slot.status !== 'cancelled' && (
                          <SlotControls slotId={slot.slot_id} isBlocked={slot.status === 'blocked'} />
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <EmptyRow>Nothing on the calendar for this day.</EmptyRow>
            )}
          </Panel>
        </div>

        <div>
          {instructors.length === 0 && (
            <div className="mb-4">
              <Panel tone="amber">
                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-adm-amber-ink)' }}>
                  There are no instructors yet. Add one under People first — only an assigned instructor
                  can approve requests for a session.
                </p>
              </Panel>
            </div>
          )}

          <Panel title="New session">
            <SlotForm services={services} instructors={instructors} timeZoneLabel={club.timezone} />
          </Panel>
        </div>
      </div>
    </>
  )
}
