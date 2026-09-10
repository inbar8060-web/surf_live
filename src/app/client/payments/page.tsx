import Link from 'next/link'
import { createUserClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { Alert, Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui'
import { formatDateTime, formatMoney } from '@/lib/util/format'

export const metadata = { title: 'Payments' }
export const dynamic = 'force-dynamic'

export default async function ClientPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  await requireRole('client')

  const supabase = await createUserClient()
  const club = await getClubSettings()

  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <>
      <PageHeader
        title="Payments"
        description="Everything you have paid through the app."
        action={
          <Link href="/client/bookings" className="text-sm underline">
            My sessions
          </Link>
        }
      />

      {status === 'done' && (
        <div className="mb-4">
          <Alert tone="success">
            Thanks. Payments are confirmed by the payment provider, so the status below updates a
            moment after you return.
          </Alert>
        </div>
      )}
      {status === 'cancelled' && (
        <div className="mb-4">
          <Alert tone="info">Payment cancelled — nothing was charged.</Alert>
        </div>
      )}

      <Card>
        {payments?.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>What</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="muted text-xs whitespace-nowrap">
                      {formatDateTime(payment.created_at, club.timezone)}
                    </td>
                    <td>{payment.description ?? payment.kind}</td>
                    <td className="tabular-nums">
                      {formatMoney(payment.amount_cents, payment.currency)}
                    </td>
                    <td>
                      <StatusBadge status={payment.status} />
                      {payment.failure_reason && (
                        <p className="muted text-xs">{payment.failure_reason}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>No payments yet.</EmptyState>
        )}
      </Card>
    </>
  )
}
