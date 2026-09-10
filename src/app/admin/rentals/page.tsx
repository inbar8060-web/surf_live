import { createUserClient } from '@/lib/supabase/server'
import { getClubSettings } from '@/lib/db/queries'
import { Badge, Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui'
import { CallButton, WhatsAppButton } from '@/components/contact-links'
import { formatMoney } from '@/lib/util/format'
import { NewRentalForm, RentalStatusForm, ReturnForm } from './forms'

export const metadata = { title: 'Rentals' }
export const dynamic = 'force-dynamic'

export default async function AdminRentalsPage() {
  const supabase = await createUserClient()
  const club = await getClubSettings()

  const [rentalsRes, clientsRes, itemsRes, typesRes] = await Promise.all([
    supabase.from('rentals').select('*').order('start_date', { ascending: false }).limit(200),
    supabase.from('profiles').select('id, full_name, phone').eq('role', 'client').eq('is_active', true).order('full_name'),
    supabase.from('inventory_items').select('*').eq('status', 'available').order('asset_tag'),
    supabase.from('inventory_types').select('id, name, size_label, daily_price_cents, currency'),
  ])

  const typeById = new Map((typesRes.data ?? []).map((t) => [t.id, t]))
  const clientById = new Map((clientsRes.data ?? []).map((c) => [c.id, c]))

  const availableItems = (itemsRes.data ?? []).map((item) => {
    const type = typeById.get(item.type_id)
    return {
      id: item.id,
      label: `${item.asset_tag} — ${type?.name ?? 'Unknown'}${
        type ? ` (${formatMoney(type.daily_price_cents, type.currency)}/day)` : ''
      }`,
    }
  })

  const clients = (clientsRes.data ?? []).map((c) => ({ id: c.id, name: c.full_name }))

  const open = (rentalsRes.data ?? []).filter((r) => ['reserved', 'out', 'overdue'].includes(r.status))
  const closed = (rentalsRes.data ?? []).filter((r) => !['reserved', 'out', 'overdue'].includes(r.status))
  const today = new Date().toISOString().slice(0, 10)

  return (
    <>
      <PageHeader
        title="Rentals"
        description="A board leaves stock the moment it is handed over, and returns when it is booked back in."
      />

      <div className="mb-4">
        {availableItems.length ? (
          <NewRentalForm clients={clients} items={availableItems} />
        ) : (
          <Card>
            <p className="text-sm">
              Every unit is currently out, retired or in maintenance. Add stock under{' '}
              <strong>Inventory</strong> to hand out more.
            </p>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <Card title="Out and reserved">
          {open.length ? (
            <div className="space-y-3">
              {open.map((rental) => {
                const client = clientById.get(rental.client_id)
                const overdue = rental.end_date < today && rental.status !== 'returned'
                return (
                  <div
                    key={rental.id}
                    className="rounded-lg border px-3 py-3"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{client?.full_name ?? 'Unknown member'}</p>
                          <StatusBadge status={rental.status} />
                          {overdue && <Badge tone="danger">Past the return date</Badge>}
                        </div>
                        <p className="muted text-sm">
                          {rental.start_date} → {rental.end_date} ·{' '}
                          {formatMoney(rental.price_cents, rental.currency)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <WhatsAppButton
                          phone={client?.phone}
                          message={`Hi ${client?.full_name.split(' ')[0] ?? ''}, about the board you have from ${club.club_name}…`}
                        />
                        <CallButton phone={client?.phone} />
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      <RentalStatusForm rentalId={rental.id} current={rental.status} />
                      <ReturnForm rentalId={rental.id} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState>Nothing is out at the moment.</EmptyState>
          )}
        </Card>

        <Card title="History">
          {closed.length ? (
            <div className="table-wrap">
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
                      <td className="muted text-xs">
                        {rental.start_date} → {rental.end_date}
                      </td>
                      <td className="tabular-nums">{formatMoney(rental.price_cents, rental.currency)}</td>
                      <td>
                        {rental.condition_in ?? '—'}
                        {rental.damage_note && <p className="muted text-xs">{rental.damage_note}</p>}
                      </td>
                      <td>
                        <StatusBadge status={rental.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>No closed rentals yet.</EmptyState>
          )}
        </Card>
      </div>
    </>
  )
}
