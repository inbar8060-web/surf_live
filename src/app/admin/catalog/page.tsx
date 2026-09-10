import { createUserClient } from '@/lib/supabase/server'
import { getClubSettings } from '@/lib/db/queries'
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui'
import { formatMoney, formatDateTime } from '@/lib/util/format'
import { CategoryForm, DeleteCategoryButton, PriceEditor, ServiceForm } from './forms'

export const metadata = { title: 'Catalog' }
export const dynamic = 'force-dynamic'

export default async function AdminCatalogPage() {
  const supabase = await createUserClient()
  const club = await getClubSettings()

  const [categoriesRes, servicesRes, historyRes] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order').order('name'),
    supabase.from('services').select('*').order('name'),
    supabase.from('price_history').select('*').order('created_at', { ascending: false }).limit(15),
  ])

  const categories = categoriesRes.data ?? []
  const services = servicesRes.data ?? []
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))
  const options = categories.map((c) => ({ id: c.id, name: c.name }))

  return (
    <>
      <PageHeader
        title="Catalog"
        description="Categories, services and what each one costs. Price changes are always recorded."
      />

      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <CategoryForm />
        <ServiceForm categories={options} />
      </div>

      <div className="space-y-4">
        <Card title="Categories">
          {categories.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Kind</th>
                    <th>Services</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id}>
                      <td>
                        <p className="font-medium">{category.name}</p>
                        <p className="muted text-xs">/{category.slug}</p>
                      </td>
                      <td>{category.kind}</td>
                      <td className="tabular-nums">
                        {services.filter((s) => s.category_id === category.id).length}
                      </td>
                      <td>
                        {category.is_active ? (
                          <Badge tone="success">Visible</Badge>
                        ) : (
                          <Badge tone="neutral">Hidden</Badge>
                        )}
                      </td>
                      <td>
                        <DeleteCategoryButton id={category.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>No categories yet — add the first one above.</EmptyState>
          )}
        </Card>

        <Card title="Services and prices">
          {services.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Category</th>
                    <th>Duration</th>
                    <th>Capacity</th>
                    <th>Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((service) => (
                    <tr key={service.id}>
                      <td>
                        <p className="font-medium">{service.name}</p>
                        {service.min_level && (
                          <p className="muted text-xs">Min level: {service.min_level}</p>
                        )}
                      </td>
                      <td>{categoryName.get(service.category_id) ?? '—'}</td>
                      <td className="tabular-nums">{service.duration_minutes} min</td>
                      <td className="tabular-nums">{service.default_capacity}</td>
                      <td>
                        <p className="muted mb-1 text-xs">
                          {formatMoney(service.price_cents, service.currency)}
                        </p>
                        <PriceEditor entityType="service" entityId={service.id} priceCents={service.price_cents} />
                      </td>
                      <td>
                        {service.is_active ? (
                          <Badge tone="success">Bookable</Badge>
                        ) : (
                          <Badge tone="neutral">Off</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>No services yet.</EmptyState>
          )}
        </Card>

        <Card title="Recent price changes" description="Appended automatically whenever a price moves.">
          {historyRes.data?.length ? (
            <ul className="space-y-1.5 text-sm">
              {historyRes.data.map((entry) => (
                <li key={entry.id} className="flex flex-wrap justify-between gap-2">
                  <span>
                    {entry.entity_type.replace('_', ' ')} ·{' '}
                    {entry.old_price_cents === null
                      ? 'set to'
                      : `${formatMoney(entry.old_price_cents, entry.currency)} →`}{' '}
                    {formatMoney(entry.new_price_cents, entry.currency)}
                  </span>
                  <span className="muted text-xs">{formatDateTime(entry.created_at, club.timezone)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No price changes recorded yet.</EmptyState>
          )}
        </Card>
      </div>
    </>
  )
}
