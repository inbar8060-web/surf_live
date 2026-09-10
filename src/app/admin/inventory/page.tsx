import { createUserClient } from '@/lib/supabase/server'
import { Badge, Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui'
import { formatMoney } from '@/lib/util/format'
import { PriceEditor } from '@/app/admin/catalog/forms'
import { InventoryTypeForm, ItemStatusForm, QuantityForm } from './forms'

export const metadata = { title: 'Inventory' }
export const dynamic = 'force-dynamic'

export default async function AdminInventoryPage() {
  const supabase = await createUserClient()

  const [typesRes, itemsRes, categoriesRes] = await Promise.all([
    supabase.from('inventory_overview').select('*').order('name'),
    supabase.from('inventory_items').select('*').order('asset_tag').limit(500),
    supabase.from('categories').select('id, name').eq('kind', 'rental').order('name'),
  ])

  const types = typesRes.data ?? []
  const items = itemsRes.data ?? []

  const totals = types.reduce(
    (acc, t) => ({
      total: acc.total + t.total_units,
      available: acc.available + t.available_units,
      out: acc.out + t.rented_units,
      maintenance: acc.maintenance + t.maintenance_units,
    }),
    { total: 0, available: 0, out: 0, maintenance: 0 },
  )

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Gear types, how many units the club holds, and where each one is."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Units held', totals.total],
          ['Available', totals.available],
          ['Out on rental', totals.out],
          ['In maintenance', totals.maintenance],
        ].map(([label, value]) => (
          <div key={String(label)} className="surface px-4 py-3">
            <p className="muted text-xs uppercase tracking-wide">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <InventoryTypeForm categories={categoriesRes.data ?? []} />
      </div>

      <div className="space-y-4">
        <Card title="Gear types" description="Quantity and daily price are both editable in place.">
          {types.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Quantity</th>
                    <th>Availability</th>
                    <th>Daily price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {types.map((type) => (
                    <tr key={type.id}>
                      <td>
                        <p className="font-medium">{type.name}</p>
                        <p className="muted text-xs">
                          {[type.brand, type.size_label, type.kind].filter(Boolean).join(' · ')}
                        </p>
                      </td>
                      <td>
                        <QuantityForm typeId={type.id} current={type.total_units - type.retired_units} />
                      </td>
                      <td className="text-xs tabular-nums">
                        <p>{type.available_units} available</p>
                        <p className="muted">
                          {type.rented_units} out · {type.maintenance_units} maintenance
                        </p>
                      </td>
                      <td>
                        <p className="muted mb-1 text-xs">
                          {formatMoney(type.daily_price_cents, type.currency)}
                        </p>
                        <PriceEditor
                          entityType="inventory_type"
                          entityId={type.id}
                          priceCents={type.daily_price_cents}
                        />
                      </td>
                      <td>
                        {type.is_active ? <Badge tone="success">Rentable</Badge> : <Badge tone="neutral">Off</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>No gear types yet — add the first one above.</EmptyState>
          )}
        </Card>

        <Card title="Units" description="Every physical item, and where it is right now.">
          {items.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Asset tag</th>
                    <th>Type</th>
                    <th>Condition</th>
                    <th>Status</th>
                    <th>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const type = types.find((t) => t.id === item.type_id)
                    return (
                      <tr key={item.id}>
                        <td className="font-mono text-xs">{item.asset_tag}</td>
                        <td>{type?.name ?? '—'}</td>
                        <td>{item.condition}</td>
                        <td>
                          <StatusBadge status={item.status} />
                        </td>
                        <td>
                          {item.status === 'rented' ? (
                            <span className="muted text-xs">Out with a member</span>
                          ) : (
                            <ItemStatusForm itemId={item.id} current={item.status} />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>No units recorded yet.</EmptyState>
          )}
        </Card>
      </div>
    </>
  )
}
