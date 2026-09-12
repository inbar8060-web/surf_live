import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { createUserClient } from '@/lib/supabase/server'
import { EmptyRow, PageTitle, Panel } from '@/components/admin/pieces'
import { ClubStatusChip, SeverityChip, Stat, SupportStatusChip, Table, Td } from '@/components/platform/pieces'
import { adminButton } from '@/components/ui/button-class'
import { clubUrl } from '@/lib/tenant'
import { formatDateTime, formatRelative } from '@/lib/util/format'
import { PLATFORM_TZ } from '@/lib/platform'
import { getPublicClub } from '@/lib/db/queries'
import { getClubOnboarding } from '@/lib/billing/onboarding'
import { AdmChip } from '@/components/admin/pieces'
import { EditClubForm, PlatformFeeForm, RefreshListingForm, ReissueInviteForm, StatusForm } from './forms'

export const metadata = { title: 'Club' }
export const dynamic = 'force-dynamic'

const OPERATION_LABEL: Record<string, string> = {
  reservation: 'Bookings',
  slot: 'Sessions',
  rental: 'Rentals',
  package: 'Packages',
  inventory: 'Inventory',
  inventory_item: 'Inventory',
  price: 'Prices',
  review: 'Reviews',
  document: 'Documents',
  tip: 'Tips',
  auth: 'Sign-ins',
  invite: 'Invitations',
  user: 'Accounts',
  profile: 'Profiles',
  client: 'Members',
  instructor: 'Instructors',
  settings: 'Settings',
}

export default async function PlatformClubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) notFound()

  const supabase = await createUserClient()
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)

  const [clubRes, statsRes, activityRes, supportRes, auditRes] = await Promise.all([
    supabase.from('clubs').select('*').eq('id', id).maybeSingle(),
    supabase.from('club_statistics').select('*').eq('club_id', id).maybeSingle(),
    supabase.from('club_activity').select('*').eq('club_id', id).gte('day', since),
    supabase
      .from('support_conversations')
      .select('id, subject, status, severity, last_message_at')
      .eq('club_id', id)
      .order('last_message_at', { ascending: false })
      .limit(10),
    supabase.from('platform_audit_log').select('*').eq('club_id', id).order('created_at', { ascending: false }).limit(30),
  ])

  const club = clubRes.data
  if (!club) notFound()
  const stats = statsRes.data
  // The listing's public facts — what a visitor to the club's page sees, and
  // no more; the operator has no read on the settings row itself.
  const [listing, onboarding] = await Promise.all([getPublicClub(club.slug), getClubOnboarding(club.id)])

  // Volume by operation over the last 30 days, grouped by the first segment
  // of the audit action ("reservation.requested" → Bookings).
  const volume = new Map<string, number>()
  let total = 0
  for (const row of activityRes.data ?? []) {
    const label = OPERATION_LABEL[row.operation] ?? row.operation
    volume.set(label, (volume.get(label) ?? 0) + row.events)
    total += row.events
  }
  const volumeRows = [...volume.entries()].sort((a, b) => b[1] - a[1])

  return (
    <>
      <PageTitle
        title={club.name}
        sub={
          <>
            <a href={clubUrl(club.slug)} target="_blank" rel="noreferrer" style={{ color: 'var(--color-adm-accent)' }}>
              {clubUrl(club.slug)}
            </a>{' '}
            · since {formatDateTime(club.created_at, PLATFORM_TZ)}
          </>
        }
        actions={
          <>
            <ClubStatusChip status={club.status} />
            <Link href="/platform/clubs" className={adminButton('secondary', 'sm')}>
              All clubs
            </Link>
          </>
        }
      />

      {club.status === 'suspended' && (
        <Panel tone="amber" className="mb-4">
          <p style={{ fontSize: 13, margin: 0 }}>
            <strong>Paused</strong> {club.suspended_at && `since ${formatDateTime(club.suspended_at, PLATFORM_TZ)}`}
            {club.suspended_reason && <> — {club.suspended_reason}</>}. Members see a holding page; administrators can still sign in.
          </p>
        </Panel>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Members" value={stats?.members ?? 0} hint={`${stats?.instructors ?? 0} instructors · ${stats?.admins ?? 0} admins`} />
        <Stat label="Sessions ahead" value={stats?.sessions_upcoming ?? 0} hint={`${stats?.sessions_total ?? 0} ever`} />
        <Stat
          label="Bookings"
          value={stats?.bookings_approved ?? 0}
          hint={`${stats?.bookings_pending ?? 0} pending · ${stats?.bookings_completed ?? 0} attended`}
        />
        <Stat label="Open rentals" value={stats?.rentals_open ?? 0} hint={`${stats?.packages_active ?? 0} active packages`} />
        <Stat label="Public reviews" value={stats?.reviews_public ?? 0} />
        <Stat
          label="Documents signed"
          value={stats?.documents_signed ?? 0}
          hint={stats?.documents_undelivered ? `${stats.documents_undelivered} not yet emailed` : 'all delivered'}
          tone={stats?.documents_undelivered ? 'amber' : undefined}
        />
        <Stat label="Failed payments" value={stats?.payments_failed ?? 0} tone={stats?.payments_failed ? 'rose' : undefined} />
        <Stat label="Last activity" value={stats?.last_activity_at ? formatRelative(stats.last_activity_at) : '—'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <div className="flex flex-col gap-4">
          <Panel
            title="Volume by operation"
            helper={`What the club did in the last 30 days — ${total} recorded actions. Counts only; the rows themselves stay inside the club.`}
          >
            {volumeRows.length === 0 ? (
              <EmptyRow>Nothing recorded in the last 30 days.</EmptyRow>
            ) : (
              <ul className="flex flex-col gap-2">
                {volumeRows.map(([label, n]) => (
                  <li key={label} className="flex items-center gap-3" style={{ fontSize: 13 }}>
                    <span style={{ width: 110, fontWeight: 700 }}>{label}</span>
                    <span
                      aria-hidden
                      style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--color-adm-rule)', overflow: 'hidden' }}
                    >
                      <span
                        style={{
                          display: 'block',
                          height: '100%',
                          width: `${Math.max(2, Math.round((n / (volumeRows[0]?.[1] ?? 1)) * 100))}%`,
                          background: 'var(--color-adm-accent)',
                        }}
                      />
                    </span>
                    <span style={{ width: 48, textAlign: 'right', fontWeight: 800 }}>{n}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Support with this club">
            {supportRes.data?.length ? (
              <Table head={['Subject', 'Status', 'Severity', 'Last message']}>
                {supportRes.data.map((c) => (
                  <tr key={c.id}>
                    <Td strong>
                      <Link href={`/platform/support/${c.id}`}>{c.subject}</Link>
                    </Td>
                    <Td>
                      <SupportStatusChip status={c.status} />
                    </Td>
                    <Td>
                      <SeverityChip severity={c.severity} />
                    </Td>
                    <Td>{formatRelative(c.last_message_at)}</Td>
                  </tr>
                ))}
              </Table>
            ) : (
              <EmptyRow>No conversations with this club yet.</EmptyRow>
            )}
          </Panel>

          <Panel title="Platform actions on this club">
            {auditRes.data?.length ? (
              <ul className="flex flex-col gap-2">
                {auditRes.data.map((entry) => (
                  <li key={entry.id} style={{ fontSize: 12, color: 'var(--color-adm-ink-2)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-adm-ink)' }}>{entry.action.replace(/[._]/g, ' ')}</span> ·{' '}
                    {formatDateTime(entry.created_at, PLATFORM_TZ)}
                    {entry.detail && typeof entry.detail.reason === 'string' && <> — {entry.detail.reason}</>}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyRow>Nothing yet.</EmptyRow>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel
            title="Plan & payouts"
            action={
              <AdmChip tone={onboarding.step === 'ready' ? 'green' : 'amber'}>
                {onboarding.step === 'ready' ? 'Open' : onboarding.step === 'plan' ? 'Awaiting plan' : 'Awaiting payouts'}
              </AdmChip>
            }
          >
            <dl className="grid gap-x-3 gap-y-1.5" style={{ gridTemplateColumns: '90px 1fr', fontSize: 13 }}>
              <dt className="a-label" style={{ color: 'var(--color-adm-ink-2)' }}>Plan</dt>
              <dd style={{ margin: 0 }}>
                {onboarding.plan ? `${onboarding.plan.name} · ${onboarding.subscription?.status.replace('_', ' ')}` : 'none yet'}
                {onboarding.subscription?.current_period_end && <> · renews {formatDateTime(onboarding.subscription.current_period_end, PLATFORM_TZ)}</>}
              </dd>
              <dt className="a-label" style={{ color: 'var(--color-adm-ink-2)' }}>Payouts</dt>
              <dd style={{ margin: 0 }}>
                {onboarding.account
                  ? `${onboarding.account.status}${onboarding.account.default_currency ? ` · ${onboarding.account.default_currency}` : ''}${onboarding.account.requirements_due.length ? ` · ${onboarding.account.requirements_due.length} requirement(s) due` : ''}`
                  : 'not started'}
              </dd>
              <dt className="a-label" style={{ color: 'var(--color-adm-ink-2)' }}>Fee</dt>
              <dd style={{ margin: 0 }}>
                <PlatformFeeForm clubId={club.id} feePercent={(onboarding.account?.platform_fee_bps ?? 0) / 100} disabled={!onboarding.account} />
              </dd>
            </dl>
          </Panel>

          <Panel title="Details">
            <EditClubForm club={club} />
          </Panel>

          <Panel
            title="From the Google Maps listing"
            helper="What visitors see on the club's page. The club can correct these in its own settings; refreshing re-reads the listing."
            action={<RefreshListingForm clubId={club.id} />}
          >
            <dl className="grid gap-x-3 gap-y-1.5" style={{ gridTemplateColumns: '80px 1fr', fontSize: 13 }}>
              <dt className="a-label" style={{ color: 'var(--color-adm-ink-2)' }}>Address</dt>
              <dd style={{ margin: 0 }}>{listing?.address ?? '—'}</dd>
              <dt className="a-label" style={{ color: 'var(--color-adm-ink-2)' }}>Phone</dt>
              <dd style={{ margin: 0 }}>{listing?.contact_phone ?? '—'}</dd>
              <dt className="a-label" style={{ color: 'var(--color-adm-ink-2)' }}>Website</dt>
              <dd style={{ margin: 0, wordBreak: 'break-all' }}>
                {listing?.website ? (
                  <a href={listing.website} target="_blank" rel="noreferrer" style={{ color: 'var(--color-adm-accent)' }}>
                    {listing.website}
                  </a>
                ) : (
                  '—'
                )}
              </dd>
              <dt className="a-label" style={{ color: 'var(--color-adm-ink-2)' }}>Hours</dt>
              <dd style={{ margin: 0 }}>
                {listing?.opening_hours.length ? (
                  <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                    {listing.opening_hours.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  '—'
                )}
              </dd>
              <dt className="a-label" style={{ color: 'var(--color-adm-ink-2)' }}>Pin</dt>
              <dd style={{ margin: 0 }}>
                {listing?.spot_latitude !== null && listing?.spot_latitude !== undefined
                  ? `${Number(listing.spot_latitude).toFixed(5)}, ${Number(listing.spot_longitude).toFixed(5)} · ${listing.timezone ?? ''}`
                  : '—'}
              </dd>
            </dl>
          </Panel>

          {club.status !== 'archived' && (
            <Panel
              title="Administrator access"
              helper="Issue a fresh registration link to the administrator address on file — for a link that expired, or a club that lost its administrator. Each link works once."
            >
              <ReissueInviteForm clubId={club.id} adminEmail={club.admin_email} />
            </Panel>
          )}

          <Panel title="Lifecycle" tone={club.status === 'archived' ? 'plain' : 'rose'}>
            <StatusForm clubId={club.id} status={club.status} />
          </Panel>
        </div>
      </div>
    </>
  )
}
