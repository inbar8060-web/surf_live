import type { Metadata } from 'next'
import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { createUserClient } from '@/lib/supabase/server'
import { requireUser, homeFor } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClubSettings } from '@/lib/db/queries'
import { MemberHero, MemberStatus } from '@/components/member/hero'
import { Empty, Initials, MicroLabel } from '@/components/ui/bits'
import { memberButton, instructorButton } from '@/components/ui/button-class'
import { signOutAction } from '@/lib/actions/auth'
import { formatDateTime, formatMoney } from '@/lib/util/format'
import { CLIENT_COLUMNS } from '@/lib/db/columns'
import { PasswordForm } from './password-form'

export const metadata: Metadata = { title: 'Your account' }
export const dynamic = 'force-dynamic'

/**
 * Account and payment history in one screen — the standalone
 * `/client/payments` page is folded in here, as the handoff specifies.
 *
 * Personal details are read-only for everyone but an administrator: the club
 * owns the member record, and there is no self-update policy on `profiles`.
 * The password is the one thing a member changes here.
 */
export default async function AccountPage() {
  const user = await requireUser()
  const { profile } = user
  const club = await getClubSettings()
  const supabase = await createUserClient()

  const isMember = profile.role === 'client'

  const [clientRes, paymentsRes] = await Promise.all([
    isMember
      ? supabase.from('clients').select(CLIENT_COLUMNS).eq('profile_id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    isMember
      ? supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(20)
      : Promise.resolve({ data: null }),
  ])

  const client = clientRes.data
  const payments = paymentsRes.data ?? []

  const rows: [string, string][] = [
    ['Email', user.email ?? '—'],
    ['Mobile', profile.phone ?? '—'],
  ]
  if (client) {
    rows.push(['Level', client.level])
    rows.push([
      'Emergency contact',
      client.emergency_contact_name
        ? `${client.emergency_contact_name}${client.emergency_contact_phone ? ` · ${client.emergency_contact_phone}` : ''}`
        : '—',
    ])
    rows.push([
      'Waiver',
      client.waiver_signed_at ? `Signed ${formatDateTime(client.waiver_signed_at, club.timezone)}` : 'Not signed',
    ])
  }

  return (
    <div className={isMember ? 'app-member min-h-screen' : 'app-instructor min-h-screen'}>
      <div className="mx-auto min-h-screen w-full max-w-[430px] pb-16">
        {isMember ? (
          <MemberHero waves={false}>
            <div className="flex items-center gap-3.5">
              <Initials
                name={profile.full_name}
                size={58}
                radius={20}
                background="#0b4a6d"
                color="#b6e8ff"
                fontSize={21}
              />
              <div className="min-w-0">
                <h1 className="display" style={{ fontSize: 21, fontWeight: 700, margin: 0 }}>
                  {profile.full_name}
                </h1>
                <p style={{ margin: '3px 0 0', fontSize: 13, color: '#b6e8ff' }}>
                  Member since{' '}
                  {new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: club.timezone }).format(
                    new Date(profile.created_at),
                  )}
                  {client ? ` · ${client.level}` : ''}
                </p>
              </div>
            </div>
          </MemberHero>
        ) : (
          <header className="px-5 pt-8 pb-4">
            <div className="flex items-center gap-3.5">
              <Initials name={profile.full_name} size={56} radius={20} background="#17191a" color="#fff" fontSize={20} />
              <div>
                <h1 style={{ fontSize: 23, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                  {profile.full_name}
                </h1>
                <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 600, color: 'var(--color-ins-ink-2)' }}>
                  {profile.role === 'instructor' ? 'Instructor' : 'Administrator'} · {club.club_name}
                </p>
              </div>
            </div>
          </header>
        )}

        <div className="flex flex-col gap-3 px-5 pt-4">
          {isMember && (
            <section className="m-card-sm" style={{ padding: '16px 18px' }}>
              <MicroLabel color="#5a6f7d" className="mb-3">
                Your details
              </MicroLabel>
              <dl className="flex flex-col gap-2.5">
                {rows.map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-3">
                    <dt style={{ fontSize: 13, color: '#5a6f7d' }}>{label}</dt>
                    <dd style={{ fontSize: 14, fontWeight: 700, textAlign: 'right' }}>{value}</dd>
                  </div>
                ))}
              </dl>
              <p style={{ margin: '14px 0 0', fontSize: 12, color: '#5a6f7d', lineHeight: 1.45 }}>
                Your details are kept by the club. Ask a member of staff to change them.
              </p>
            </section>
          )}

          <section
            className={isMember ? 'm-card-sm' : 'i-card'}
            style={{ padding: '16px 18px' }}
          >
            <MicroLabel color={isMember ? '#5a6f7d' : 'var(--color-ins-ink-2)'} className="mb-3">
              Change password
            </MicroLabel>
            <PasswordForm tone={isMember ? 'member' : 'instructor'} />
          </section>

          {isMember && (
            <section className="m-card-sm" style={{ padding: '16px 18px' }}>
              <MicroLabel color="#5a6f7d" className="mb-3">
                Payments
              </MicroLabel>
              {payments.length ? (
                <div className="flex flex-col gap-2.5">
                  {payments.map((payment) => (
                    <div key={payment.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                          {payment.description ?? payment.kind}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#5a6f7d' }}>
                          {formatDateTime(payment.created_at, club.timezone)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="display" style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                          {formatMoney(payment.amount_cents, payment.currency)}
                        </p>
                        <MemberStatus status={payment.status} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty>No payments yet.</Empty>
              )}
            </section>
          )}

          <form action={signOutAction} className="pt-1">
            <button
              type="submit"
              className={`${isMember ? memberButton('secondary') : instructorButton('secondary')} w-full`}
            >
              <LogOut size={17} /> Sign out
            </button>
          </form>

          <Link
            href={homeFor(profile.role)}
            className="pb-4 text-center"
            style={{ fontSize: 13, fontWeight: 700, color: isMember ? '#0087c6' : 'var(--color-ins-accent)' }}
          >
            Back
          </Link>
        </div>
      </div>
    </div>
  )
}
