import Link from 'next/link'
import { ArrowRight, Bell, CalendarDays, Download } from 'lucide-react'
import { createUserClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { getSpotConditions } from '@/lib/surf/conditions'
import { ScreenTitle, Flag, InsChip } from '@/components/instructor/pieces'
import { instructorButton } from '@/components/ui/button-class'
import { Empty, Initials } from '@/components/ui/bits'
import { dayRangeInZone, formatTime, todayInZone } from '@/lib/util/format'
import type { InstructorRosterRow } from '@/lib/db/types'
import { DayPicker } from './day-picker'
import { InlineDecision } from './inline-decision'

export const metadata = { title: 'Today' }
export const dynamic = 'force-dynamic'

function groupBySlot(rows: InstructorRosterRow[]) {
  const bySlot = new Map<string, { slot: InstructorRosterRow; members: InstructorRosterRow[] }>()
  for (const row of rows) {
    const entry = bySlot.get(row.slot_id) ?? { slot: row, members: [] }
    if (row.reservation_id && row.client_id) entry.members.push(row)
    bySlot.set(row.slot_id, entry)
  }
  return [...bySlot.values()].sort(
    (a, b) => new Date(a.slot.starts_at).getTime() - new Date(b.slot.starts_at).getTime(),
  )
}

function minutesUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 60_000)
}

export default async function InstructorTodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const { date } = await searchParams
  await requireRole('instructor')
  const supabase = await createUserClient()
  const club = await getClubSettings()

  // Only a plain YYYY-MM-DD is accepted, so the range cannot be widened by a
  // crafted query string. The default is today *at the club*, not in UTC.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? date! : todayInZone(club.timezone)
  const { from, to } = dayRangeInZone(iso, club.timezone)
  const day = new Date(`${iso}T12:00:00Z`) // midday, so formatting never slips a day

  const [rosterRes, conditions, monthRes, overviewRes] = await Promise.all([
    supabase
      .from('instructor_roster')
      .select('*')
      .gte('starts_at', from)
      .lt('starts_at', to)
      .order('starts_at'),
    getSpotConditions(Number(club.spot_latitude), Number(club.spot_longitude), club.spot_name),
    // which days this month carry a session, for the picker's dots
    supabase
      .from('instructor_roster')
      .select('starts_at')
      .gte('starts_at', new Date(day.getFullYear(), day.getMonth(), 1).toISOString())
      .lt('starts_at', new Date(day.getFullYear(), day.getMonth() + 2, 1).toISOString()),
    // capacity lives on the overview view, not on the roster
    supabase
      .from('staff_slot_overview')
      .select('slot_id, capacity, seats_taken')
      .gte('starts_at', from)
      .lt('starts_at', to),
  ])

  const capacityOf = new Map((overviewRes.data ?? []).map((s) => [s.slot_id, s.capacity]))
  const takenOf = new Map((overviewRes.data ?? []).map((s) => [s.slot_id, s.seats_taken]))

  const sessions = groupBySlot(rosterRes.data ?? [])
  const [first, ...later] = sessions
  const busyDays = [
    ...new Set((monthRes.data ?? []).map((r) => r.starts_at.slice(0, 10))),
  ]

  const isToday = iso === todayInZone(club.timezone)
  const heading = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: club.timezone,
  }).format(day)

  return (
    <>
      <ScreenTitle
        title={isToday ? 'Today' : heading}
        sub={`${heading} · ${sessions.length} session${sessions.length === 1 ? '' : 's'}`}
        action={<DayPicker selected={iso} busyDays={busyDays} timeZone={club.timezone} today={todayInZone(club.timezone)} />}
      />

      <div className="flex flex-col gap-3 px-5">
        {/* ---- next session, dark ---- */}
        {first && (
          <section style={{ background: '#17191a', borderRadius: 24, padding: '16px 18px', color: '#fff' }}>
            <div className="flex items-center justify-between gap-2">
              <span
                style={{
                  background: '#2c2f31',
                  borderRadius: 999,
                  padding: '5px 11px',
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                }}
              >
                {isToday && minutesUntil(first.slot.starts_at) > 0 && minutesUntil(first.slot.starts_at) < 120
                  ? `NEXT · IN ${minutesUntil(first.slot.starts_at)} MIN`
                  : 'NEXT'}
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-ins-ink-3)' }}>
                {takenOf.get(first.slot.slot_id) ?? 0}/{capacityOf.get(first.slot.slot_id) ?? '—'}
              </span>
            </div>

            <p style={{ margin: '12px 0 0', fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em' }}>
              {formatTime(first.slot.starts_at, club.timezone)}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 700 }}>{first.slot.service_name}</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 600, color: 'var(--color-ins-ink-3)' }}>
              {[
                first.slot.location,
                `${Math.round(
                  (new Date(first.slot.ends_at).getTime() - new Date(first.slot.starts_at).getTime()) / 60000,
                )} min`,
                conditions.now.waveHeightM === null ? null : `${conditions.now.waveHeightM.toFixed(1)} m`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>

            {first.members.length > 0 && (
              <ul className="mt-3.5 flex flex-col gap-2">
                {first.members.map((member) => (
                  <li
                    key={member.reservation_id}
                    className="flex items-center gap-2.5"
                    style={{ background: '#232628', borderRadius: 14, padding: '9px 12px' }}
                  >
                    <Initials
                      name={member.client_name ?? '?'}
                      size={30}
                      background="#3a3e41"
                      color="#fff"
                      fontSize={11}
                    />
                    <span style={{ fontSize: 14, fontWeight: 700, flex: 1, minWidth: 0 }}>
                      {member.client_name}
                      {(member.participants ?? 1) > 1 ? ` ×${member.participants}` : ''}
                    </span>
                    {member.medical_notes && (
                      <Flag tone="warn" onDark>
                        Medical
                      </Flag>
                    )}
                    {!member.waiver_signed_at && (
                      <Flag tone="danger" onDark>
                        No waiver
                      </Flag>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <Link
              href={`/instructor/session/${first.slot.slot_id}`}
              className={`${instructorButton('onDark')} mt-3.5 w-full`}
            >
              Open roster <ArrowRight size={17} />
            </Link>
          </section>
        )}

        {/* ---- later sessions ---- */}
        {later.map(({ slot, members }) => {
          const pending = members.filter((m) => m.reservation_status === 'pending')
          const taken = members.reduce((n, m) => n + (m.participants ?? 0), 0)

          return (
            <section key={slot.slot_id} className="i-card" style={{ padding: '15px 18px' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>
                    {formatTime(slot.starts_at, club.timezone)}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 700 }}>{slot.service_name}</p>
                  <p style={{ margin: '3px 0 0', fontSize: 13, fontWeight: 600, color: 'var(--color-ins-ink-2)' }}>
                    {taken} of {capacityOf.get(slot.slot_id) ?? '—'}
                    {slot.location ? ` · ${slot.location}` : ''}
                  </p>
                </div>
                {pending.length > 0 && (
                  <InsChip tone="warn">
                    <Bell size={11} style={{ display: 'inline', marginRight: 3 }} />
                    {pending.length} request
                  </InsChip>
                )}
              </div>

              {pending.length > 0 && pending[0]!.reservation_id && (
                <div className="mt-3">
                  <InlineDecision reservationId={pending[0]!.reservation_id} />
                </div>
              )}

              <Link
                href={`/instructor/session/${slot.slot_id}`}
                className="mt-3 block"
                style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-ins-accent)' }}
              >
                Open roster →
              </Link>
            </section>
          )
        })}

        {sessions.length === 0 && <Empty tone="instructor">You have no sessions on this day.</Empty>}

        {/* ---- export + conditions ---- */}
        <a
          href={`/instructor/export?date=${iso}`}
          className="flex items-center justify-between"
          style={{ background: '#e9e9e6', borderRadius: 18, padding: '14px 18px', fontSize: 14, fontWeight: 800 }}
        >
          <span className="flex items-center gap-2">
            <Download size={18} /> Export {isToday ? 'today' : 'the day'} as CSV
          </span>
          <ArrowRight size={17} />
        </a>

        <div className="i-card flex items-center justify-between" style={{ padding: '14px 18px' }}>
          <div className="flex items-baseline gap-4">
            <span style={{ fontSize: 20, fontWeight: 800 }}>
              {conditions.now.waveHeightM === null ? '—' : `${conditions.now.waveHeightM.toFixed(1)} m`}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-ins-ink-2)' }}>
              {conditions.now.windSpeedKph === null
                ? '—'
                : `${Math.round(conditions.now.windSpeedKph)} km/h`}
            </span>
          </div>
          <InsChip tone={conditions.summary.tone === 'good' ? 'accent' : 'neutral'}>
            {conditions.summary.label}
          </InsChip>
        </div>
      </div>
    </>
  )
}
