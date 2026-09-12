import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Clock, Globe, MapPin, Phone } from 'lucide-react'
import { getSessionUser, homeFor } from '@/lib/auth/session'
import { getRequestArea, getRequestClub, ownClubUrl, platformUrl } from '@/lib/tenant'
import { getPublicClub } from '@/lib/db/queries'
import { getSpotConditions } from '@/lib/surf/conditions'
import { ConditionsPanel } from '@/components/conditions-panel'
import { buttonClass } from '@/components/ui/button-class'
import { Card } from '@/components/ui'

export const revalidate = 900

/**
 * The front door depends on the address:
 *
 *   <club>.<domain>   the club's own landing page, with its spot's conditions
 *   admin.<domain>    the operator's sign-in
 *   <domain>          the platform itself, which names no club
 *
 * A club's page is built from `club_public_profile()` — the one function an
 * anonymous visitor may call, returning only what a sign on the beach would say.
 */
export default async function LandingPage() {
  const [user, area] = await Promise.all([getSessionUser(), getRequestArea()])
  if (user) {
    // Home is an area, and areas live on their own addresses: the operator on
    // admin.<domain>, a club user on their club's. On any other address a
    // relative redirect would meet the proxy's 404, so build the full one.
    if (user.profile.role === 'super_admin') redirect(area === 'platform' ? '/platform' : platformUrl('/platform'))
    if (area === 'club') redirect(homeFor(user.profile.role))
    redirect((await ownClubUrl(user.profile.club_id, homeFor(user.profile.role))) ?? '/closed')
  }

  if (area === 'platform') redirect('/login')
  if (area === 'unknown') notFound()

  if (area === 'apex') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <p className="muted text-sm">🌊 Surfer Live</p>
        <h1 className="mt-1 text-3xl font-semibold">Booking and gear for surf clubs</h1>
        <p className="muted mt-3 text-base">
          Each club has its own address. If you are a member, open the link your club gave you —
          it looks like <code>your-club.{process.env.NEXT_PUBLIC_PLATFORM_DOMAIN}</code>.
        </p>
        <Link href={platformUrl('/login')} className={`${buttonClass('secondary')} mt-6`}>
          Platform operator sign-in
        </Link>
      </div>
    )
  }

  const club = await getRequestClub()
  if (!club) notFound()

  const profile = await getPublicClub(club.slug)
  const conditions = await getSpotConditions(
    Number(profile?.spot_latitude ?? 32.08088),
    Number(profile?.spot_longitude ?? 34.76765),
    profile?.spot_name ?? club.name,
  )

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="muted text-sm">🌊 {club.name}</p>
          <h1 className="mt-1 text-3xl font-semibold">Book your next session</h1>
          {club.mapsUrl && (
            <a
              href={club.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="muted mt-1 inline-flex items-center gap-1 text-sm underline"
            >
              <MapPin size={14} /> {profile?.address ?? profile?.spot_name ?? 'Find us on the map'}
            </a>
          )}
        </div>
        <Link href="/login" className={buttonClass('primary')}>
          Sign in
        </Link>
      </header>

      {club.status === 'suspended' ? (
        <Card title="Bookings are paused">
          <p className="text-sm">This club is not taking bookings at the moment. Please contact the club directly.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          <ConditionsPanel conditions={conditions} timeZone={profile?.timezone ?? 'UTC'} />
          {(profile?.opening_hours.length || profile?.contact_phone || profile?.website) && (
            <Card title="The club">
              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                {profile?.opening_hours.length ? (
                  <div>
                    <p className="mb-1 inline-flex items-center gap-1 font-semibold">
                      <Clock size={14} /> Opening hours
                    </p>
                    <ul className="muted space-y-0.5">
                      {profile.opening_hours.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  {profile?.contact_phone && (
                    <p>
                      <a className="inline-flex items-center gap-1 underline" href={`tel:${profile.contact_phone}`}>
                        <Phone size={14} /> {profile.contact_phone}
                      </a>
                    </p>
                  )}
                  {profile?.website && (
                    <p>
                      <a className="inline-flex items-center gap-1 underline" href={profile.website} target="_blank" rel="noopener noreferrer">
                        <Globe size={14} /> {profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </a>
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}
          <Card title="Members only">
            <p className="text-sm">
              Accounts are created by the club. If you have been given a registration link, open it
              to set your password. Otherwise{' '}
              {profile?.contact_phone ? (
                <a className="underline" href={`tel:${profile.contact_phone}`}>give us a call</a>
              ) : (
                'get in touch with the club'
              )}{' '}
              and we will set you up.
            </p>
          </Card>
        </div>
      )}
    </div>
  )
}
