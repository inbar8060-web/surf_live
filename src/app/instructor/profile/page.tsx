import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { createUserClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { INSTRUCTOR_COLUMNS } from '@/lib/db/columns'
import { Empty, Initials, MicroLabel } from '@/components/ui/bits'
import { instructorButton } from '@/components/ui/button-class'
import { signOutAction } from '@/lib/actions/auth'
import { formatMoney } from '@/lib/util/format'
import { ProfileForm } from './profile-form'

export const metadata = { title: 'My profile' }
export const dynamic = 'force-dynamic'

/**
 * `instructors.payout_account_ref` is never displayed — the column is not even
 * granted to a browser session, so it cannot be read here by accident.
 */
export default async function InstructorProfilePage() {
  const user = await requireRole('instructor')
  const supabase = await createUserClient()
  const club = await getClubSettings()

  const [instructorRes, tipsRes] = await Promise.all([
    supabase.from('instructors').select(INSTRUCTOR_COLUMNS).eq('profile_id', user.id).maybeSingle(),
    supabase
      .from('tips')
      .select('*')
      .eq('instructor_id', user.id)
      .order('created_at', { ascending: false })
      .limit(25),
  ])

  const instructor = instructorRes.data
  const tips = tipsRes.data ?? []
  const total = tips.reduce((sum, tip) => sum + tip.amount_cents, 0)

  return (
    <>
      <header className="px-5 pb-4 pt-8">
        <div className="flex items-center gap-3.5">
          <Initials
            name={user.profile.full_name}
            size={56}
            radius={20}
            background="var(--color-ins-ink)"
            color="#fff"
            fontSize={20}
          />
          <div className="min-w-0">
            <h1 style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              {user.profile.full_name}
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 600, color: 'var(--color-ins-ink-2)' }}>
              Instructor
              {instructor?.certifications?.length ? ` · ${instructor.certifications.join(', ')}` : ''}
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-3 px-5">
        <section className="i-card" style={{ padding: '16px 18px' }}>
          <MicroLabel color="var(--color-ins-ink-3)" className="mb-3">
            Members see this
          </MicroLabel>
          {instructor ? (
            <ProfileForm instructor={instructor} />
          ) : (
            <Empty tone="instructor">
              Your instructor record is missing — ask an administrator to set it up.
            </Empty>
          )}
        </section>

        <section style={{ background: 'var(--color-ins-ink)', borderRadius: 24, padding: '16px 18px', color: '#fff' }}>
          <MicroLabel color="var(--color-ins-ink-3)" className="mb-2">
            Tips received
          </MicroLabel>
          <p style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em' }}>
            {formatMoney(total, club.currency)}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 600, color: 'var(--color-ins-ink-3)' }}>
            across {tips.length} tip{tips.length === 1 ? '' : 's'}
          </p>

          {tips.length > 0 && (
            <ul className="mt-3.5 flex flex-col gap-2">
              {tips.map((tip) => (
                <li
                  key={tip.id}
                  className="flex items-start justify-between gap-3"
                  style={{ background: 'var(--color-ins-surface)', borderRadius: 14, padding: '10px 12px' }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ins-ink-3)' }}>
                    {tip.message ? `“${tip.message}”` : 'Thanks!'}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap' }}>
                    {formatMoney(tip.amount_cents, tip.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Link href="/account" className={`${instructorButton('secondary')} w-full`}>
          Change password
        </Link>

        <form action={signOutAction}>
          <button type="submit" className={`${instructorButton('secondary')} w-full`}>
            <LogOut size={17} /> Sign out
          </button>
        </form>
      </div>
    </>
  )
}
