import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionUser, homeFor } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { getSpotConditions } from '@/lib/surf/conditions'
import { ConditionsPanel } from '@/components/conditions-panel'
import { buttonClass } from '@/components/ui/button-class'
import { Card } from '@/components/ui'

export const revalidate = 900

export default async function LandingPage() {
  const user = await getSessionUser()
  if (user) redirect(homeFor(user.profile.role))

  const club = await getClubSettings()
  const conditions = await getSpotConditions(
    Number(club.spot_latitude),
    Number(club.spot_longitude),
    club.spot_name,
  )

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="muted text-sm">🌊 {club.club_name}</p>
          <h1 className="mt-1 text-3xl font-semibold">Book your next session</h1>
        </div>
        <Link href="/login" className={buttonClass('primary')}>
          Sign in
        </Link>
      </header>

      <div className="space-y-4">
        <ConditionsPanel conditions={conditions} timeZone={club.timezone} />

        <Card title="Members only">
          <p className="text-sm">
            Accounts are created by the club. If you have been given a registration link, open it to
            set your password. Otherwise{' '}
            {club.contact_phone ? (
              <a className="underline" href={`tel:${club.contact_phone}`}>
                give us a call
              </a>
            ) : (
              'get in touch with the club'
            )}{' '}
            and we will set you up.
          </p>
        </Card>
      </div>
    </div>
  )
}
