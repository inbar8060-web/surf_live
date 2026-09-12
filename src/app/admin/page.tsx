import Link from 'next/link'
import { CalendarDays, Inbox, Link as LinkIcon, Plus, TriangleAlert, Waves } from 'lucide-react'
import { createUserClient } from '@/lib/supabase/server'
import { getClubSettings } from '@/lib/db/queries'
import { getSpotConditions } from '@/lib/surf/conditions'
import { AdmChip, AdmStatus, CapacityBar, EmptyRow, PageTitle, Panel } from '@/components/admin/pieces'
import { ReservationDecision } from '@/components/reservation-decision'
import { adminButton } from '@/components/ui/button-class'
import { Initials } from '@/components/ui/bits'
import { dayRangeInZone, formatMoney, formatRelative, formatTime, todayInZone } from '@/lib/util/format'

export const metadata = { title: 'Desk' }
export const dynamic = 'force-dynamic'

export default async function AdminDeskPage() {
  const supabase = await createUserClient()
  const club = await getClubSettings()

  // Today at the club, not on the server clock.
  const { from, to } = dayRangeInZone(todayInZone(club.timezone), club.timezone)
  const today = new Date().toISOString().slice(0, 10)

  const [pendingRes, todaySlots, membersRes, rentalsRes, reviewsRes, auditRes, conditions] =
    await Promise.all([
      supabase
        .from('staff_reservation_queue')
        .select('*')
        .eq('status', 'pending')
        .order('starts_at')
        .limit(20),
      supabase.from('staff_slot_overview').select('*').gte('starts_at', from).lt('starts_at', to).order('starts_at'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'client').eq('is_active', true),
      supabase.from('rentals').select('*').in('status', ['out', 'overdue']),
      supabase.from('instructor_reviews').select('id').is('admin_read_at', null),
      supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(6),
      getSpotConditions(Number(club.spot_latitude), Number(club.spot_longitude), club.spot_name),
    ])

  const pending = pendingRes.data ?? []
  const slots = todaySlots.data ?? []

  /*
   * "Fix before opening" is derived from data already fetched above — no new
   * endpoint, no extra round trip. Each entry names the consequence, because
   * "unstaffed session" on its own does not tell anyone why it matters.
   */
  const problems: { tone: 'amber' | 'rose'; title: string; detail: string; href: string; cta: string }[] = []

  const unstaffed = slots.filter((s) => s.instructor_ids.length === 0 && s.status === 'open')
  if (unstaffed.length > 0) {
    problems.push({
      tone: 'amber',
      title: `${unstaffed.length} session${unstaffed.length === 1 ? '' : 's'} today with no instructor`,
      detail:
        'Only an assigned instructor can approve requests for a session, so these will sit unanswered.',
      href: '/admin/schedule',
      cta: 'Assign an instructor',
    })
  }

  const overdue = (rentalsRes.data ?? []).filter((r) => r.end_date < today)
  if (overdue.length > 0) {
    problems.push({
      tone: 'rose',
      title: `${overdue.length} board${overdue.length === 1 ? '' : 's'} past the return date`,
      detail: 'They stay out of stock, so nobody else can be given them until they are booked in.',
      href: '/admin/gear',
      cta: 'Book one in',
    })
  }

  const unreadReviews = reviewsRes.data?.length ?? 0
  if (unreadReviews > 0) {
    problems.push({
      tone: 'amber',
      title: `${unreadReviews} piece${unreadReviews === 1 ? '' : 's'} of private feedback unread`,
      detail: 'Instructors cannot see these, so nothing happens until someone here reads them.',
      href: '/admin/people?tab=feedback',
      cta: 'Read the feedback',
    })
  }

  const heading = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: club.timezone,
  }).format(new Date())

  return (
    <>
      <PageTitle
        title={heading}
        sub={`${slots.length} session${slots.length === 1 ? '' : 's'} · ${membersRes.count ?? 0} active members · ${
          conditions.now.waveHeightM === null ? 'no reading' : `${conditions.now.waveHeightM.toFixed(1)} m`
        } at ${club.spot_name}`}
        actions={
          <>
            <Link href="/admin/people?tab=invites" className={adminButton('secondary')}>
              <LinkIcon size={15} /> Invite link
            </Link>
            <Link href="/admin/schedule" className={adminButton('primary')}>
              <Plus size={15} /> New session
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-4">
          <Panel
            title={
              <span className="flex items-center gap-2">
                <span
                  className="flex items-center justify-center"
                  style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--color-adm-amber-row)' }}
                >
                  <Inbox size={15} style={{ color: 'var(--color-adm-amber-ink)' }} />
                </span>
                {pending.length} request{pending.length === 1 ? '' : 's'} waiting
              </span>
            }
            helpTitle="Approving holds the place"
            help="The member is charged, or one package lesson is spent, only when you approve. Declining frees the seat immediately."
            action={
              <Link href="/admin/bookings" style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-adm-accent)' }}>
                All bookings →
              </Link>
            }
          >
            {pending.length ? (
              <ul className="flex flex-col">
                {pending.slice(0, 5).map((row, i) => (
                  <li
                    key={row.reservation_id}
                    className="flex flex-wrap items-center gap-3 py-3"
                    style={{
                      borderTop: i === 0 ? undefined : '1px solid var(--color-adm-rule)',
                      background: !row.waiver_signed_at ? 'var(--color-adm-rose-bg)' : undefined,
                      borderRadius: !row.waiver_signed_at ? 10 : undefined,
                      paddingInline: !row.waiver_signed_at ? 10 : undefined,
                    }}
                  >
                    <Initials
                      name={row.client_name}
                      size={40}
                      background="var(--color-adm-neutral-chip)"
                      color="var(--color-adm-ink-2)"
                      fontSize={14}
                    />
                    <div className="min-w-[180px] flex-1">
                      <p className="flex flex-wrap items-center gap-1.5" style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
                        {row.client_name}
                        <span style={{ fontWeight: 500, color: 'var(--color-adm-ink-2)' }}>
                          · {row.participants} place{row.participants === 1 ? '' : 's'}
                        </span>
                        {!row.waiver_signed_at && <AdmChip tone="rose">No waiver</AdmChip>}
                        {row.revision > 1 && <AdmChip tone="amber">Changed by the member</AdmChip>}
                        {row.client_package_id && <AdmChip tone="blue">Pays from package</AdmChip>}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-adm-ink-2)' }}>
                        {row.service_name}, {formatTime(row.starts_at, club.timezone)} ·{' '}
                        {formatMoney(row.price_cents, row.currency)} · asked {formatRelative(row.created_at)}
                      </p>
                    </div>
                    {/* on a phone the buttons take their own line rather than
                        squeezing the name into a two-word column */}
                    <div className="w-full lg:w-auto">
                      <ReservationDecision reservationId={row.reservation_id} clientName={row.client_name} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyRow>Nothing waiting on you.</EmptyRow>
            )}
          </Panel>

          <Panel
            title={
              <span className="flex items-center gap-2">
                <CalendarDays size={16} /> Today on the beach
              </span>
            }
            helpTitle="Today's sessions"
            help="The bar shows how full each session is. Blocking one takes it off the members' booking list straight away."
            action={
              <Link href="/admin/schedule" style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-adm-accent)' }}>
                Schedule →
              </Link>
            }
          >
            {slots.length ? (
              <ul className="flex flex-col">
                {slots.map((slot, i) => (
                  <li
                    key={slot.slot_id}
                    className="flex flex-wrap items-center gap-3 py-3"
                    style={{ borderTop: i === 0 ? undefined : '1px solid var(--color-adm-rule)' }}
                  >
                    <span style={{ fontSize: 15, fontWeight: 800, minWidth: 52 }}>
                      {formatTime(slot.starts_at, club.timezone)}
                    </span>
                    <div className="min-w-[150px] flex-1">
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{slot.service_name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-adm-ink-2)' }}>
                        {slot.instructor_names.length ? slot.instructor_names.join(', ') : 'No instructor assigned'}
                      </p>
                    </div>
                    {/* the bar and chip take their own line once the row is narrow */}
                    <div className="flex w-full items-center gap-3 lg:w-auto">
                      <CapacityBar taken={slot.seats_taken} capacity={slot.capacity} />
                      <AdmStatus status={slot.status} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyRow>Nothing scheduled today.</EmptyRow>
            )}
          </Panel>
        </div>

        {/* ------------------------------------------------------- right rail */}
        <div className="flex flex-col gap-4">
          <section
            className="a-card"
            style={{ padding: '16px 18px', background: 'var(--color-adm-chrome)', color: '#fff' }}
          >
            <p
              className="a-label"
              style={{ margin: 0, color: 'var(--color-adm-chrome-ink)' }}
            >
              {club.spot_name}
            </p>
            <p className="mt-2 flex items-baseline gap-2" style={{ margin: '8px 0 0' }}>
              <Waves size={22} style={{ color: 'var(--color-adm-bright)' }} />
              <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em' }}>
                {conditions.now.waveHeightM === null ? '—' : `${conditions.now.waveHeightM.toFixed(1)} m`}
              </span>
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-adm-chrome-ink-2)', lineHeight: 1.45 }}>
              {conditions.summary.detail}
            </p>
          </section>

          <Panel
            title={
              <span className="flex items-center gap-2">
                <TriangleAlert size={16} /> Fix before opening
              </span>
            }
          >
            {problems.length ? (
              <ul className="flex flex-col gap-2.5">
                {problems.map((problem) => (
                  <li
                    key={problem.title}
                    style={{
                      borderRadius: 12,
                      padding: '12px 14px',
                      background:
                        problem.tone === 'rose' ? 'var(--color-adm-rose-bg)' : 'var(--color-adm-amber-bg)',
                      border: `1px solid ${
                        problem.tone === 'rose' ? 'var(--color-adm-rose-line)' : 'var(--color-adm-amber-line)'
                      }`,
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        fontWeight: 800,
                        color:
                          problem.tone === 'rose' ? 'var(--color-adm-rose-ink)' : 'var(--color-adm-amber-ink)',
                      }}
                    >
                      {problem.title}
                    </p>
                    <p style={{ margin: '4px 0 8px', fontSize: 12, color: 'var(--color-adm-ink-2)', lineHeight: 1.45 }}>
                      {problem.detail}
                    </p>
                    <Link
                      href={problem.href}
                      style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-adm-accent)' }}
                    >
                      {problem.cta} →
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyRow>Nothing needs attention.</EmptyRow>
            )}
          </Panel>

          <Panel
            title="Recent changes"
            action={
              <Link href="/admin/club?tab=audit" style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-adm-accent)' }}>
                Audit log →
              </Link>
            }
          >
            {auditRes.data?.length ? (
              <ul className="flex flex-col gap-2">
                {auditRes.data.map((entry) => (
                  <li key={entry.id} style={{ fontSize: 12, color: 'var(--color-adm-ink-2)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-adm-ink)' }}>
                      {entry.action.replace(/[._]/g, ' ')}
                    </span>{' '}
                    · {formatRelative(entry.created_at)}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyRow>Nothing recorded yet.</EmptyRow>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}
