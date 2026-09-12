import { Phone } from 'lucide-react'
import { createUserClient } from '@/lib/supabase/server'
import { getClubSettings } from '@/lib/db/queries'
import { AdmChip, AdmStatus, EmptyRow, PageTitle, Panel, SubTabs } from '@/components/admin/pieces'
import { Help } from '@/components/ui/help'
import { PriceEditor } from '@/app/admin/catalog/forms'
import { formatMoney, todayInZone } from '@/lib/util/format'
import { telUrl } from '@/lib/util/contact'
import { InventoryTypeForm, ItemStatusForm, NewRentalForm, QuantityForm, ReturnForm } from './forms'

export const metadata = { title: 'Gear' }
export const dynamic = 'force-dynamic'

function Stat({ label, value, help }: { label: string; value: number; help: string }) {
  return (
    <div className="a-card" style={{ padding: '13px 16px' }}>
      <p className="a-label flex items-center gap-1.5" style={{ margin: 0, color: 'var(--color-adm-ink-3)' }}>
        {label}
        <Help title={label}>{help}</Help>
      </p>
      <p style={{ margin: '5px 0 0', fontSize: 26, fontWeight: 800 }}>{value}</p>
    </div>
  )
}

export default async function AdminGearPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const view = ['types', 'units', 'history'].includes(tab ?? '') ? tab! : ''

  const supabase = await createUserClient()
  const club = await getClubSettings()

  const [typesRes, itemsRes, rentalsRes, clientsRes, categoriesRes] = await Promise.all([
    supabase.from('inventory_overview').select('*').order('name'),
    supabase.from('inventory_items').select('*').order('asset_tag').limit(500),
    supabase.from('rentals').select('*').order('start_date', { ascending: false }).limit(200),
    supabase
      .from('profiles')
      .select('id, full_name, phone')
      .eq('role', 'client')
      .eq('is_active', true)
      .order('full_name'),
    supabase.from('categories').select('id, name').eq('kind', 'rental').order('name'),
  ])

  const types = typesRes.data ?? []
  const items = itemsRes.data ?? []
  const rentals = rentalsRes.data ?? []
  const clientById = new Map((clientsRes.data ?? []).map((c) => [c.id, c]))
  const typeById = new Map(types.map((t) => [t.id, t]))
  const today = todayInZone(club.timezone)

  const totals = types.reduce(
    (acc, t) => ({
      held: acc.held + (t.total_units - t.retired_units),
      available: acc.available + t.available_units,
      out: acc.out + t.rented_units,
      maintenance: acc.maintenance + t.maintenance_units,
    }),
    { held: 0, available: 0, out: 0, maintenance: 0 },
  )

  const open = rentals.filter((r) => ['reserved', 'out', 'overdue'].includes(r.status))
  const closed = rentals.filter((r) => !['reserved', 'out', 'overdue'].includes(r.status))

  const availableItems = items
    .filter((i) => i.status === 'available')
    .map((item) => {
      const type = typeById.get(item.type_id)
      return {
        id: item.id,
        label: `${item.asset_tag} — ${type?.name ?? 'Unknown'}${
          type ? ` (${formatMoney(type.daily_price_cents, type.currency)}/day)` : ''
        }`,
        dailyCents: type?.daily_price_cents ?? 0,
        currency: type?.currency ?? club.currency,
      }
    })

  return (
    <>
      <PageTitle
        title="Gear"
        sub="Stock levels and what is out with members."
        actions={view === 'types' ? <InventoryTypeForm categories={categoriesRes.data ?? []} /> : null}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Units held"
          value={totals.held}
          help="Every unit the club owns that has not been retired, whatever state it is in."
        />
        <Stat label="Available" value={totals.available} help="In stock right now and ready to hand out." />
        <Stat label="Out on rental" value={totals.out} help="With a member. These cannot be handed to anyone else until they are booked in." />
        <Stat label="In maintenance" value={totals.maintenance} help="Held back for repair. A board returned in poor condition lands here automatically." />
      </div>

      <SubTabs
        base="/admin/gear"
        current={view}
        tabs={[
          { key: '', label: 'Out and reserved', count: open.length },
          { key: 'types', label: 'Gear types' },
          { key: 'units', label: 'Every unit' },
          { key: 'history', label: 'Rental history' },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div>
          {view === '' && (
            <Panel>
              {open.length ? (
                <ul className="flex flex-col">
                  {open.map((rental, i) => {
                    const client = clientById.get(rental.client_id)
                    const item = items.find((it) => it.id === rental.item_id)
                    const type = item ? typeById.get(item.type_id) : undefined
                    const overdue = rental.end_date < today
                    const call = telUrl(client?.phone)

                    return (
                      <li
                        key={rental.id}
                        className="flex flex-wrap items-start gap-3 py-3.5"
                        style={{
                          borderTop: i === 0 ? undefined : '1px solid var(--color-adm-rule)',
                          background: overdue ? 'var(--color-adm-rose-bg)' : undefined,
                          borderRadius: overdue ? 10 : undefined,
                          paddingInline: overdue ? 10 : undefined,
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-1.5" style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
                            {client?.full_name ?? 'Unknown member'}
                            {overdue ? <AdmChip tone="rose">Overdue</AdmChip> : <AdmStatus status={rental.status} />}
                          </p>
                          <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--color-adm-ink-2)' }}>
                            {item?.asset_tag ?? '—'} · {type?.name ?? '—'} · {rental.start_date} → {rental.end_date} ·{' '}
                            {formatMoney(rental.price_cents, rental.currency)}
                          </p>
                        </div>

                        <div className="flex w-full flex-wrap items-center gap-1.5 lg:w-auto lg:shrink-0">
                          {call && (
                            <a
                              href={call}
                              aria-label={`Call ${client?.full_name ?? 'the member'}`}
                              className="flex items-center justify-center"
                              style={{ width: 35, height: 35, borderRadius: 9, border: '1.5px solid var(--color-adm-line)', background: '#fff' }}
                            >
                              <Phone size={16} />
                            </a>
                          )}
                          <ReturnForm rentalId={rental.id} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <EmptyRow>Nothing is out at the moment.</EmptyRow>
              )}
            </Panel>
          )}

          {view === 'types' && (
            <Panel helper="Lowering the unit count retires spare boards; it never removes one that is out with a member.">
              {types.length ? (
                <div className="table-wrap" style={{ border: 'none' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Units</th>
                        <th>Breakdown</th>
                        <th>Daily price</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {types.map((type) => (
                        <tr key={type.id}>
                          <td>
                            <p style={{ margin: 0, fontWeight: 800 }}>{type.name}</p>
                            <p className="a-helper" style={{ margin: '2px 0 0' }}>
                              {[type.brand, type.size_label, type.kind].filter(Boolean).join(' · ')}
                            </p>
                          </td>
                          <td>
                            <QuantityForm typeId={type.id} current={type.total_units - type.retired_units} />
                          </td>
                          <td className="tabular-nums" style={{ fontSize: 12 }}>
                            <p style={{ margin: 0 }}>{type.available_units} available</p>
                            <p className="a-helper" style={{ margin: 0 }}>
                              {type.rented_units} out · {type.maintenance_units} maintenance
                            </p>
                          </td>
                          <td>
                            <p className="a-helper" style={{ margin: '0 0 5px' }}>
                              {formatMoney(type.daily_price_cents, type.currency)}
                            </p>
                            <PriceEditor
                              entityType="inventory_type"
                              entityId={type.id}
                              priceCents={type.daily_price_cents}
                            />
                          </td>
                          <td>
                            {type.is_active ? <AdmChip tone="green">Rentable</AdmChip> : <AdmChip>Off</AdmChip>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyRow>No gear types yet.</EmptyRow>
              )}
            </Panel>
          )}

          {view === 'units' && (
            <Panel>
              {items.length ? (
                <div className="table-wrap" style={{ border: 'none' }}>
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
                      {items.map((item) => (
                        <tr key={item.id}>
                          <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{item.asset_tag}</td>
                          <td>{typeById.get(item.type_id)?.name ?? '—'}</td>
                          <td>{item.condition}</td>
                          <td>
                            <AdmStatus status={item.status} />
                          </td>
                          <td>
                            {item.status === 'rented' ? (
                              <span className="a-helper">Out with a member</span>
                            ) : (
                              <ItemStatusForm itemId={item.id} current={item.status} />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyRow>No units recorded yet.</EmptyRow>
              )}
            </Panel>
          )}

          {view === 'history' && (
            <Panel>
              {closed.length ? (
                <div className="table-wrap" style={{ border: 'none' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Dates</th>
                        <th>Price</th>
                        <th>Condition back</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {closed.map((rental) => (
                        <tr key={rental.id}>
                          <td>{clientById.get(rental.client_id)?.full_name ?? '—'}</td>
                          <td className="a-helper">
                            {rental.start_date} → {rental.end_date}
                          </td>
                          <td className="tabular-nums">{formatMoney(rental.price_cents, rental.currency)}</td>
                          <td>
                            {rental.condition_in ?? '—'}
                            {rental.damage_note && (
                              <p className="a-helper" style={{ margin: '2px 0 0' }}>
                                {rental.damage_note}
                              </p>
                            )}
                          </td>
                          <td>
                            <AdmStatus status={rental.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyRow>No closed rentals yet.</EmptyRow>
              )}
            </Panel>
          )}
        </div>

        <div>
          <Panel
            title="Hand out gear"
            helpTitle="Handing over takes it out of stock"
            help="A board leaves stock the moment it is handed over and comes back when it is booked in. The same board can never be double-booked."
          >
            {availableItems.length ? (
              <NewRentalForm
                clients={(clientsRes.data ?? []).map((c) => ({ id: c.id, name: c.full_name }))}
                items={availableItems}
              />
            ) : (
              <p className="a-helper" style={{ margin: 0 }}>
                Every unit is currently out, retired or in maintenance. Add stock under Gear types to
                hand out more.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}
