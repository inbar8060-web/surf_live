import Link from 'next/link'
import { createUserClient } from '@/lib/supabase/server'
import { getClubSettings } from '@/lib/db/queries'
import { Badge, Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui'
import { formatDateTime, formatMoney } from '@/lib/util/format'
import { PriceEditor } from '@/app/admin/catalog/forms'
import { PackageControls } from '@/app/admin/people/[id]/forms'
import { PackageTemplateForm } from './forms'

export const metadata = { title: 'Packages' }
export const dynamic = 'force-dynamic'

export default async function AdminPackagesPage() {
  const supabase = await createUserClient()
  const club = await getClubSettings()

  const [templatesRes, issuedRes, categoriesRes, profilesRes] = await Promise.all([
    supabase.from('package_templates').select('*').order('name'),
    supabase
      .from('client_packages')
      .select('*')
      .order('purchased_at', { ascending: false })
      .limit(200),
    supabase.from('categories').select('id, name').order('name'),
    supabase.from('profiles').select('id, full_name').eq('role', 'client'),
  ])

  const nameOf = new Map((profilesRes.data ?? []).map((p) => [p.id, p.full_name]))
  const issued = issuedRes.data ?? []
  const live = issued.filter((p) => p.status === 'active')

  return (
    <>
      <PageHeader
        title="Lesson packages"
        description="Define what the club sells, then attach a package to a member from their profile."
      />

      <div className="mb-4">
        <PackageTemplateForm categories={categoriesRes.data ?? []} />
      </div>

      <div className="space-y-4">
        <Card title="Package types">
          {templatesRes.data?.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Lessons</th>
                    <th>Valid for</th>
                    <th>Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {templatesRes.data.map((template) => (
                    <tr key={template.id}>
                      <td>
                        <p className="font-medium">{template.name}</p>
                        {template.description && <p className="muted text-xs">{template.description}</p>}
                      </td>
                      <td className="tabular-nums">{template.lessons_count}</td>
                      <td className="tabular-nums">{template.validity_days} days</td>
                      <td>
                        <p className="muted mb-1 text-xs">
                          {formatMoney(template.price_cents, template.currency)}
                        </p>
                        <PriceEditor
                          entityType="package_template"
                          entityId={template.id}
                          priceCents={template.price_cents}
                        />
                      </td>
                      <td>
                        {template.is_active ? <Badge tone="success">On sale</Badge> : <Badge tone="neutral">Off</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>No package types yet.</EmptyState>
          )}
        </Card>

        <Card
          title="Live packages"
          description={`${live.length} member package(s) currently active.`}
        >
          {issued.length ? (
            <div className="space-y-3">
              {issued.map((pkg) => (
                <div key={pkg.id} className="rounded-lg border px-3 py-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        <Link href={`/admin/people/${pkg.client_id}`} className="underline">
                          {nameOf.get(pkg.client_id) ?? 'Unknown member'}
                        </Link>{' '}
                        — {pkg.name}
                      </p>
                      <p className="muted text-sm">
                        {pkg.lessons_remaining} of {pkg.lessons_total} left · expires{' '}
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
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>No packages have been issued yet.</EmptyState>
          )}
        </Card>
      </div>
    </>
  )
}
