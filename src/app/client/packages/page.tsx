import Link from 'next/link'
import { Ticket } from 'lucide-react'
import { createUserClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { MemberHero } from '@/components/member/hero'
import { Chip, Empty, MicroLabel } from '@/components/ui/bits'
import { memberButton } from '@/components/ui/button-class'
import { formatDateTime, formatMoney } from '@/lib/util/format'
import { telUrl } from '@/lib/util/contact'

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

  const active = (packages ?? []).filter((p) => p.status === 'active')
  const rest = (packages ?? []).filter((p) => p.status !== 'active')
  const clubPhone = telUrl(club.contact_phone)

  return (
    <>
      <MemberHero waves={false}>
        <h1 className="display" style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          Lesson packages
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#b6e8ff', lineHeight: 1.45 }}>
          Choose one when you request a place — a lesson comes off once the club approves.
        </p>
      </MemberHero>

      <div className="flex flex-col gap-3 px-5 pt-4">
        {active.map((pkg) => {
          const used = pkg.lessons_total - pkg.lessons_remaining
          return (
            <section
              key={pkg.id}
              style={{ background: '#0b4a6d', borderRadius: 26, padding: '18px 20px', color: '#fff' }}
            >
              <MicroLabel color="#75d8ff">Active</MicroLabel>

              <div className="mt-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="display" style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
                    {pkg.name}
                  </h2>
                  <p className="display" style={{ margin: '10px 0 0', fontSize: 38, fontWeight: 700, lineHeight: 1 }}>
                    {pkg.lessons_remaining}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: '#b6e8ff' }}>
                    of {pkg.lessons_total} lessons left
                  </p>
                </div>
                <span
                  className="flex shrink-0 items-center justify-center"
                  style={{ width: 56, height: 56, borderRadius: 18, background: '#065a84', color: '#75d8ff' }}
                >
                  <Ticket size={26} />
                </span>
              </div>

              {/* one segment per lesson: spent segments stay visible */}
              <div className="mt-4 flex gap-1.5" aria-hidden>
                {Array.from({ length: pkg.lessons_total }).map((_, i) => (
                  <span
                    key={i}
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 3,
                      background: i < used ? '#065a84' : '#2cc4ff',
                    }}
                  />
                ))}
              </div>

              <p style={{ margin: '14px 0 0', fontSize: 12, color: '#b6e8ff' }}>
                Expires {formatDateTime(pkg.expires_at, club.timezone)} ·{' '}
                {formatMoney(pkg.price_cents, pkg.currency)} paid
              </p>

              <Link href="/client/book" className={`${memberButton('accent', 'md')} mt-4 w-full`}>
                Use it to book a session
              </Link>
            </section>
          )
        })}

        {rest.map((pkg) => (
          <article key={pkg.id} className="m-card-sm" style={{ padding: '14px 18px' }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{pkg.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#5a6f7d' }}>
                  {pkg.lessons_remaining} of {pkg.lessons_total} left · expired{' '}
                  {formatDateTime(pkg.expires_at, club.timezone)}
                </p>
              </div>
              <Chip bg="#f1f5f9" ink="#334155" size="sm">
                {pkg.status}
              </Chip>
            </div>
          </article>
        ))}

        {(packages?.length ?? 0) === 0 && (
          <Empty>
            You have no packages. Ask at the club if you would like one — it works out cheaper than
            paying per session.
          </Empty>
        )}

        <div style={{ background: '#f5eede', borderRadius: 22, padding: '16px 18px', color: '#8a6b39' }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Want another package?</p>
          <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.45 }}>
            Packages are set up by the club — ask at the desk and they will add it to your account.
          </p>
          {clubPhone && (
            <a href={clubPhone} className={`${memberButton('secondary', 'md')} mt-3 w-full`}>
              Call the club
            </a>
          )}
        </div>
      </div>
    </>
  )
}
