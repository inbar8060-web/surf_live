import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CLIENT_COLUMNS, INSTRUCTOR_COLUMNS } from '@/lib/db/columns'
import { requireRole } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { Badge, Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui'
import { CallButton, WhatsAppButton } from '@/components/contact-links'
import { formatDateTime, formatMoney } from '@/lib/util/format'
import {
  ClientRecordForm,
  GrantPackageForm,
  InstructorRecordForm,
  PackageControls,
  ProfileForm,
} from './forms'

export const dynamic = 'force-dynamic'

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await requireRole('admin')

  const supabase = await createUserClient()
  const club = await getClubSettings()

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
  if (!profile) notFound()

  const [clientRes, instructorRes] = await Promise.all([
    profile.role === 'client'
      ? supabase.from('clients').select(CLIENT_COLUMNS).eq('profile_id', id).maybeSingle()
      : Promise.resolve({ data: null }),
    profile.role === 'instructor'
      ? supabase.from('instructors').select(INSTRUCTOR_COLUMNS).eq('profile_id', id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  /*
   * clients.admin_notes has its column privilege revoked from browser sessions,
   * so even an admin's own token cannot select it. Reading it needs the service
   * role — which is safe here because requireRole('admin') has already run.
   */
  let adminNotes = ''
  if (profile.role === 'client') {
    const { data } = await createAdminClient()
      .from('clients')
      .select('admin_notes')
      .eq('profile_id', id)
      .maybeSingle()
    adminNotes = data?.admin_notes ?? ''
  }

  const [packagesRes, bookingsRes, rentalsRes, templatesRes] = await Promise.all([
    supabase
      .from('client_packages')
      .select('*')
      .eq('client_id', id)
      .order('purchased_at', { ascending: false }),
    supabase
      .from('staff_reservation_queue')
      .select('*')
      .eq('client_id', id)
      .order('starts_at', { ascending: false })
      .limit(25),
    supabase.from('rentals').select('*').eq('client_id', id).order('start_date', { ascending: false }).limit(15),
    supabase.from('package_templates').select('*').eq('is_active', true).order('name'),
  ])

  const templates = (templatesRes.data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    lessons: t.lessons_count,
    price: formatMoney(t.price_cents, t.currency),
  }))

  return (
    <>
      <PageHeader
        title={profile.full_name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={profile.role === 'admin' ? 'danger' : profile.role === 'instructor' ? 'info' : 'neutral'}>
              {profile.role}
            </Badge>
            {profile.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Disabled</Badge>}
            <span className="muted text-sm">Joined {formatDateTime(profile.created_at, club.timezone)}</span>
          </span>
        }
        action={
          <div className="flex gap-2">
            <WhatsAppButton phone={profile.phone} />
            <CallButton phone={profile.phone} />
            <Link href="/admin/people" className="text-sm underline">
              Back
            </Link>
          </div>
        }
      />

      <div className="space-y-4">
        <Card title="Account details">
          <ProfileForm profile={profile} isSelf={profile.id === admin.id} />
        </Card>

        {clientRes.data && (
          <Card title="Member record">
            <ClientRecordForm client={clientRes.data} adminNotes={adminNotes} />
          </Card>
        )}

        {instructorRes.data && (
          <Card title="Instructor profile">
            <InstructorRecordForm instructor={instructorRes.data} />
          </Card>
        )}

        {profile.role === 'client' && (
          <Card
            title="Lesson packages"
            description="Attach a package, extend it, or dismiss what is left."
          >
            <div className="mb-4">
              {templates.length ? (
                <GrantPackageForm clientId={id} templates={templates} />
              ) : (
                <EmptyState>No package types defined yet — add one under Packages.</EmptyState>
              )}
            </div>

            {packagesRes.data?.length ? (
              <ul className="space-y-3">
                {packagesRes.data.map((pkg) => (
                  <li key={pkg.id} className="rounded-lg border px-3 py-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{pkg.name}</p>
                        <p className="muted text-sm">
                          {pkg.lessons_remaining} of {pkg.lessons_total} lessons left · expires{' '}
                          {formatDateTime(pkg.expires_at, club.timezone)}
                        </p>
                        {pkg.cancelled_reason && (
                          <p className="muted text-sm">Cancelled: {pkg.cancelled_reason}</p>
                        )}
                      </div>
                      <StatusBadge status={pkg.status} />
                    </div>

                    {pkg.status !== 'cancelled' && (
                      <div className="mt-3">
                        <PackageControls packageId={pkg.id} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState>No packages attached to this member.</EmptyState>
            )}
          </Card>
        )}

        {profile.role === 'client' && (
          <Card title="Booking history">
            {bookingsRes.data?.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Session</th>
                      <th>When</th>
                      <th>Places</th>
                      <th>Price</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookingsRes.data.map((booking) => (
                      <tr key={booking.reservation_id}>
                        <td>{booking.service_name}</td>
                        <td className="muted text-xs">{formatDateTime(booking.starts_at, club.timezone)}</td>
                        <td className="tabular-nums">{booking.participants}</td>
                        <td className="tabular-nums">{formatMoney(booking.price_cents, booking.currency)}</td>
                        <td>
                          <StatusBadge status={booking.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState>No bookings yet.</EmptyState>
            )}
          </Card>
        )}

        {profile.role === 'client' && rentalsRes.data && rentalsRes.data.length > 0 && (
          <Card title="Rentals">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>From</th>
                    <th>To</th>
                    <th>Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rentalsRes.data.map((rental) => (
                    <tr key={rental.id}>
                      <td>{rental.start_date}</td>
                      <td>{rental.end_date}</td>
                      <td className="tabular-nums">{formatMoney(rental.price_cents, rental.currency)}</td>
                      <td>
                        <StatusBadge status={rental.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </>
  )
}
