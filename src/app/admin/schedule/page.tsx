import { createUserClient } from '@/lib/supabase/server'
import { getClubSettings } from '@/lib/db/queries'
import { Card, EmptyState, PageHeader, StatusBadge, Badge } from '@/components/ui'
import { GroupChatButton } from '@/components/contact-links'
import { formatDateTime, formatMoney } from '@/lib/util/format'
import { SlotForm, type InstructorOption, type ServiceOption } from './slot-form'
import { SlotControls } from './slot-controls'

export const metadata = { title: 'Schedule' }
export const dynamic = 'force-dynamic'

export default async function AdminSchedulePage() {
  const supabase = await createUserClient()
  const club = await getClubSettings()

  const since = new Date()
  since.setHours(0, 0, 0, 0)

  const [servicesRes, instructorsRes, slotsRes] = await Promise.all([
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
  ])

  const { data: categories } = await supabase.from('categories').select('id, name')
  const categoryName = new Map((categories ?? []).map((c) => [c.id, c.name]))

  const services: ServiceOption[] = (servicesRes.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    durationMinutes: s.duration_minutes,
    defaultCapacity: s.default_capacity,
    categoryName: categoryName.get(s.category_id) ?? 'Uncategorised',
  }))

  const instructors: InstructorOption[] = (instructorsRes.data ?? []).map((i) => ({
    id: i.profile_id,
    name: i.full_name,
  }))

  const priceOf = new Map((servicesRes.data ?? []).map((s) => [s.id, { cents: s.price_cents, currency: s.currency }]))

  return (
    <>
      <PageHeader
        title="Schedule"
        description="Sessions from today onward. Blocking one takes it off the members' booking list straight away."
      />

      <div className="mb-4">
        <SlotForm services={services} instructors={instructors} timeZoneLabel={club.timezone} />
      </div>

      {instructors.length === 0 && (
        <div className="mb-4">
          <Card>
            <p className="text-sm">
              There are no instructors yet. Add one from <strong>People</strong> before scheduling
              sessions, otherwise nobody can approve the requests that come in.
            </p>
          </Card>
        </div>
      )}

      {slotsRes.data?.length ? (
        <div className="space-y-3">
          {slotsRes.data.map((slot) => {
            const price = priceOf.get(slot.service_id)
            return (
              <Card key={slot.slot_id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{slot.service_name}</h3>
                      <StatusBadge status={slot.status} />
                      {slot.pending_count > 0 && (
                        <Badge tone="warning">{slot.pending_count} awaiting approval</Badge>
                      )}
                    </div>

                    <p className="muted mt-1 text-sm">
                      {formatDateTime(slot.starts_at, club.timezone)} –{' '}
                      {formatDateTime(slot.ends_at, club.timezone)}
                      {slot.location ? ` · ${slot.location}` : ''}
                    </p>
                    <p className="muted text-sm">
                      {slot.seats_taken}/{slot.capacity} places ·{' '}
                      {slot.instructor_names.length
                        ? slot.instructor_names.join(', ')
                        : 'no instructor assigned'}
                      {price ? ` · ${formatMoney(price.cents, price.currency)}` : ''}
                    </p>
                    {slot.block_reason && (
                      <p className="muted mt-1 text-sm">Reason: {slot.block_reason}</p>
                    )}
                    {slot.notes && <p className="muted mt-1 text-sm">Note: {slot.notes}</p>}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <GroupChatButton url={slot.whatsapp_group_url} />
                    {slot.status !== 'cancelled' && (
                      <SlotControls slotId={slot.slot_id} isBlocked={slot.status === 'blocked'} />
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <EmptyState>No sessions scheduled yet.</EmptyState>
      )}
    </>
  )
}
