import { createUserClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { Badge, Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui'
import { GroupChatButton } from '@/components/contact-links'
import { formatDateTime } from '@/lib/util/format'

export const metadata = { title: 'All groups' }
export const dynamic = 'force-dynamic'

/**
 * Every group in the club, read only.
 *
 * Instructors can see what the whole club is running, but the page offers no
 * controls for sessions that are not theirs — and the database agrees: RLS
 * gives instructors SELECT on time_slots and nothing else, so there is no
 * write path to abuse even if a control were added here by mistake.
 */
export default async function InstructorGroupsPage() {
  const user = await requireRole('instructor')
  const supabase = await createUserClient()
  const club = await getClubSettings()

  const since = new Date()
  since.setHours(0, 0, 0, 0)

  const { data: slots } = await supabase
    .from('staff_slot_overview')
    .select('*')
    .gte('starts_at', since.toISOString())
    .order('starts_at')
    .limit(200)

  const mine = (slots ?? []).filter((s) => s.instructor_ids.includes(user.id))
  const others = (slots ?? []).filter((s) => !s.instructor_ids.includes(user.id))

  const renderSlot = (slot: (typeof mine)[number], editable: boolean) => (
    <li
      key={slot.slot_id}
      className="flex flex-wrap items-start justify-between gap-3 rounded-lg border px-3 py-3"
      style={{ borderColor: 'var(--border)' }}
    >
      <div>
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {slot.service_name}
          <StatusBadge status={slot.status} />
          {editable && <Badge tone="info">Yours</Badge>}
          {slot.pending_count > 0 && <Badge tone="warning">{slot.pending_count} to approve</Badge>}
        </p>
        <p className="muted text-sm">
          {formatDateTime(slot.starts_at, club.timezone)}
          {slot.location ? ` · ${slot.location}` : ''} · {slot.seats_taken}/{slot.capacity} places
        </p>
        <p className="muted text-sm">
          {slot.instructor_names.length ? slot.instructor_names.join(', ') : 'No instructor assigned'}
        </p>
        {slot.notes && <p className="muted mt-1 text-sm">Note: {slot.notes}</p>}
      </div>

      {editable && <GroupChatButton url={slot.whatsapp_group_url} />}
    </li>
  )

  return (
    <>
      <PageHeader
        title="All groups"
        description="What the whole club has on. You can act on your own sessions; the rest are here for context."
      />

      <div className="space-y-4">
        <Card title="Your sessions">
          {mine.length ? (
            <ul className="space-y-2">{mine.map((slot) => renderSlot(slot, true))}</ul>
          ) : (
            <EmptyState>You are not assigned to any upcoming sessions.</EmptyState>
          )}
        </Card>

        <Card title="Everyone else" description="Read only.">
          {others.length ? (
            <ul className="space-y-2">{others.map((slot) => renderSlot(slot, false))}</ul>
          ) : (
            <EmptyState>Nothing else scheduled.</EmptyState>
          )}
        </Card>
      </div>
    </>
  )
}
