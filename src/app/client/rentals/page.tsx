import { Anchor, Phone } from 'lucide-react'
import { createUserClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { MemberHero, MemberStatus } from '@/components/member/hero'
import { Empty, MicroLabel } from '@/components/ui/bits'
import { memberButton } from '@/components/ui/button-class'
import { formatMoney } from '@/lib/util/format'
import { telUrl } from '@/lib/util/contact'

export const metadata = { title: 'Gear rentals' }
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
  const clubPhone = telUrl(club.contact_phone)

  return (
    <>
      <MemberHero waves={false}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="display" style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
              Gear rentals
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#b6e8ff', lineHeight: 1.45 }}>
              Arranged at the club. Here is what you have and when it is due back.
            </p>
          </div>
          {clubPhone && (
            <a
              href={clubPhone}
              className="flex shrink-0 items-center gap-1.5 rounded-full"
              style={{ background: '#0b4a6d', color: '#b6e8ff', padding: '8px 14px', fontSize: 13, fontWeight: 700 }}
            >
              <Phone size={15} /> Call
            </a>
          )}
        </div>
      </MemberHero>

      <div className="px-5 pt-4">
        <MicroLabel color="#5a6f7d" className="mb-2.5">
          Out with you now
        </MicroLabel>

        {open.length ? (
          <div className="flex flex-col gap-3">
            {open.map((rental) => (
              <article key={rental.id} className="m-card-sm" style={{ padding: '14px 16px' }}>
                <div className="flex items-start gap-3">
                  <span
                    className="gear-stripe flex shrink-0 items-center justify-center"
                    style={{ width: 64, height: 64, borderRadius: 18, color: '#0087c6' }}
                  >
                    <Anchor size={24} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                        {rental.item_name}
                        {rental.size_label ? ` · ${rental.size_label}` : ''}
                      </p>
                      <MemberStatus status={rental.status} />
                    </div>
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: '#5a6f7d' }}>
                      {rental.asset_tag}
                      {rental.item_kind ? ` · ${rental.item_kind}` : ''}
                    </p>
                  </div>
                </div>

                <div
                  className="mt-3 flex justify-between"
                  style={{ background: '#f1f5f9', borderRadius: 14, padding: '10px 12px' }}
                >
                  <div>
                    <MicroLabel color="#5a6f7d">Due back</MicroLabel>
                    <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700 }}>{rental.end_date}</p>
                  </div>
                  <div className="text-right">
                    <MicroLabel color="#5a6f7d">Total</MicroLabel>
                    <p className="display" style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700 }}>
                      {formatMoney(rental.price_cents, rental.currency)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty>Nothing out at the moment.</Empty>
        )}

        {past.length > 0 && (
          <>
            <MicroLabel color="#5a6f7d" className="mb-2.5 mt-6">
              Past rentals
            </MicroLabel>
            <div className="m-card-sm overflow-hidden">
              {past.map((rental, i) => (
                <div
                  key={rental.id}
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderTop: i === 0 ? undefined : '1px solid #eff2f5' }}
                >
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{rental.item_name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#5a6f7d' }}>
                      {rental.start_date} → {rental.end_date}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="display" style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                      {formatMoney(rental.price_cents, rental.currency)}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: '#0f766e', fontWeight: 700 }}>Returned</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {clubPhone && (
          <div
            className="mt-4"
            style={{ background: '#f5eede', borderRadius: 22, padding: '16px 18px', color: '#8a6b39' }}
          >
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Need a board?</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.45 }}>
              Rentals are handed out at the desk. Give us a ring and we will put one aside.
            </p>
            <a href={clubPhone} className={`${memberButton('secondary', 'md')} mt-3 w-full`}>
              Call the club
            </a>
          </div>
        )}
      </div>
    </>
  )
}
