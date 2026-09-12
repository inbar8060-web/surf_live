import Link from 'next/link'
import { Users } from 'lucide-react'
import { createUserClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { ScreenTitle, InsChip } from '@/components/instructor/pieces'
import { Empty, MicroLabel } from '@/components/ui/bits'
import { formatDateTime } from '@/lib/util/format'
import { isWhatsappGroupUrl } from '@/lib/util/contact'

export const metadata = { title: 'All groups' }
export const dynamic = 'force-dynamic'

/**
 * Every group in the club, read only.
 *
 * The read-only half is not a UI decision: RLS gives instructors SELECT on
 * time_slots and nothing else, so there is no write path to a session they are
 * not assigned to even if a control were added here by mistake.
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

  return (
    <>
      <ScreenTitle title="All groups" sub="What the whole club has on." />

      <div className="px-5">
        <MicroLabel color="var(--color-ins-ink-3)" className="mb-2.5">
          Yours
        </MicroLabel>

        {mine.length ? (
          <div className="flex flex-col gap-3">
            {mine.map((slot) => (
              <article
                key={slot.slot_id}
                className="i-card"
                style={{ padding: '15px 18px', borderLeft: '4px solid var(--color-ins-accent)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{slot.service_name}</p>
                    <p
                      style={{ margin: '3px 0 0', fontSize: 13, fontWeight: 600, color: 'var(--color-ins-ink-2)' }}
                    >
                      {formatDateTime(slot.starts_at, club.timezone)} · {slot.seats_taken} of {slot.capacity}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {slot.pending_count > 0 && <InsChip tone="warn">{slot.pending_count} to approve</InsChip>}
                    {isWhatsappGroupUrl(slot.whatsapp_group_url) && (
                      <a
                        href={slot.whatsapp_group_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open the group chat"
                        className="flex items-center justify-center"
                        style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--color-ins-ink)', color: '#fff' }}
                      >
                        <Users size={18} />
                      </a>
                    )}
                  </div>
                </div>

                <Link
                  href={`/instructor/session/${slot.slot_id}`}
                  className="mt-3 block"
                  style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-ins-accent)' }}
                >
                  Open roster →
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <Empty tone="instructor">You are not assigned to any upcoming sessions.</Empty>
        )}

        <MicroLabel color="var(--color-ins-ink-3)" className="mb-2.5 mt-6">
          Everyone else · read only
        </MicroLabel>

        {others.length ? (
          <div className="flex flex-col gap-3">
            {others.map((slot) => (
              <article
                key={slot.slot_id}
                style={{ background: 'var(--color-ins-muted-card)', borderRadius: 22, padding: '15px 18px' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{slot.service_name}</p>
                    <p
                      style={{ margin: '3px 0 0', fontSize: 13, fontWeight: 600, color: 'var(--color-ins-ink-2)' }}
                    >
                      {formatDateTime(slot.starts_at, club.timezone)} · {slot.seats_taken} of {slot.capacity}
                    </p>
                    <p
                      style={{ margin: '3px 0 0', fontSize: 13, fontWeight: 600, color: 'var(--color-ins-ink-3)' }}
                    >
                      {slot.instructor_names.length
                        ? slot.instructor_names.join(', ')
                        : 'No instructor assigned'}
                    </p>
                  </div>
                  <InsChip>{slot.status}</InsChip>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty tone="instructor">Nothing else scheduled.</Empty>
        )}
      </div>
    </>
  )
}
