import Link from 'next/link'
import { createUserClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui'
import { formatDateTime, formatMoney } from '@/lib/util/format'

export const metadata = { title: 'Packages' }
export const dynamic = 'force-dynamic'

export default async function ClientPackagesPage() {
  await requireRole('client')
  const supabase = await createUserClient()
  const club = await getClubSettings()

  const { data: packages } = await supabase
    .from('my_packages')
    .select('*')
    .order('purchased_at', { ascending: false })

  return (
    <>
      <PageHeader
        title="Lesson packages"
        description="Packages are set up by the club. Choose one when you request a place and a lesson comes off the balance once the booking is approved."
      />

      {packages?.length ? (
        <div className="space-y-3">
          {packages.map((pkg) => (
            <Card key={pkg.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{pkg.name}</p>
                  <p className="muted mt-1 text-sm">
                    {pkg.lessons_remaining} of {pkg.lessons_total} lessons left
                  </p>
                  <p className="muted text-sm">
                    Expires {formatDateTime(pkg.expires_at, club.timezone)} ·{' '}
                    {formatMoney(pkg.price_cents, pkg.currency)}
                  </p>
                </div>
                <StatusBadge status={pkg.status} />
              </div>

              {pkg.is_usable && (
                <div className="mt-3">
                  <Link href="/client/book" className="text-sm underline">
                    Use it to book a session
                  </Link>
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState>
          You have no packages. Ask at the club if you would like one — it works out cheaper than
          paying per session.
        </EmptyState>
      )}
    </>
  )
}
