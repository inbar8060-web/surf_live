import { createUserClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui'
import { CallButton } from '@/components/contact-links'
import { formatMoney } from '@/lib/util/format'

export const metadata = { title: 'Rentals' }
export const dynamic = 'force-dynamic'

export default async function ClientRentalsPage() {
  await requireRole('client')
  const supabase = await createUserClient()
  const club = await getClubSettings()

  const { data: rentals } = await supabase
    .from('my_rentals')
    .select('*')
    .order('start_date', { ascending: false })

  const open = (rentals ?? []).filter((r) => ['reserved', 'out', 'overdue'].includes(r.status))
  const past = (rentals ?? []).filter((r) => !['reserved', 'out', 'overdue'].includes(r.status))

  return (
    <>
      <PageHeader
        title="Gear rentals"
        description="Rentals are arranged at the club. This is where you can see what you have and when it is due back."
        action={<CallButton phone={club.contact_phone} label="Call the club" size="md" />}
      />

      <div className="space-y-4">
        <Card title="Out with you now">
          {open.length ? (
            <ul className="space-y-3">
              {open.map((rental) => (
                <li
                  key={rental.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-lg border px-3 py-3"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div>
                    <p className="font-medium">
                      {rental.item_name}
                      {rental.size_label ? ` · ${rental.size_label}` : ''}
                    </p>
                    <p className="muted text-sm">
                      {rental.asset_tag} · {rental.start_date} → {rental.end_date} ·{' '}
                      {formatMoney(rental.price_cents, rental.currency)}
                    </p>
                  </div>
                  <StatusBadge status={rental.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Nothing out at the moment.</EmptyState>
          )}
        </Card>

        {past.length > 0 && (
          <Card title="Past rentals">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Dates</th>
                    <th>Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {past.map((rental) => (
                    <tr key={rental.id}>
                      <td>{rental.item_name}</td>
                      <td className="muted text-xs">
                        {rental.start_date} → {rental.end_date}
                      </td>
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
