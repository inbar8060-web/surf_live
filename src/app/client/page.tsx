import Link from 'next/link'
import { Anchor, Compass, MessageCircle, Sun, Thermometer, Ticket, Users, Waves, Wind } from 'lucide-react'
import { createUserClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { compass, getSpotConditions, type SpotConditions } from '@/lib/surf/conditions'
import { MemberHero, MemberStatus } from '@/components/member/hero'
import { memberButton } from '@/components/ui/button-class'
import { Empty, Initials, MicroLabel } from '@/components/ui/bits'
import { formatRelative, formatTime } from '@/lib/util/format'
import { telUrl, whatsappChatUrl, isWhatsappGroupUrl } from '@/lib/util/contact'

export const metadata = { title: 'Home' }
export const dynamic = 'force-dynamic'

/** Greeting follows the club's clock, not the server's. */
function greeting(timeZone: string): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone }).format(new Date()),
  )
  if (hour < 12) return 'Morning'
  if (hour < 18) return 'Afternoon'
  return 'Evening'
}

const TONE_PILL = {
  good: { bg: '#2cc4ff', ink: '#072f49' },
  fair: { bg: '#fef3c7', ink: '#78350f' },
  poor: { bg: '#ffe4e6', ink: '#9f1239' },
} as const

function Metric({
  icon: Icon,
  value,
  unit,
  iconColor = '#0087c6',
}: {
  icon: typeof Wind
  value: string
  unit: string
  iconColor?: string
}) {
  return (
    <div
      className="flex-1 text-center"
      style={{ background: '#fff', borderRadius: 20, padding: '12px 8px', boxShadow: '0 6px 16px rgba(7,47,73,0.08)' }}
    >
      <Icon size={20} strokeWidth={1.9} style={{ color: iconColor, margin: '0 auto 2px' }} />
      <p className="display" style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
        {value}
      </p>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#5a6f7d' }}>{unit}</p>
    </div>
  )
}

/** Bars are scaled against the tallest hour so the shape is always readable. */
function NextHours({ conditions, timeZone }: { conditions: SpotConditions; timeZone: string }) {
  const hours = conditions.hourly.slice(0, 6)
  if (hours.length === 0) return null

  const peak = Math.max(...hours.map((h) => h.waveHeightM ?? 0), 0.4)

  return (
    <div className="m-card" style={{ padding: '16px 18px' }}>
      <div className="mb-2.5 flex items-center justify-between">
        <MicroLabel color="#5a6f7d">Next hours</MicroLabel>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#0087c6' }}>
          {conditions.stale ? 'No data' : 'Full forecast'}
        </span>
      </div>
      <div className="flex items-end gap-2" style={{ height: 66 }}>
        {hours.map((hour) => {
          const h = hour.waveHeightM ?? 0
          const height = Math.max(10, Math.round((h / peak) * 48))
          const fill = h >= 1.2 ? '#2cc4ff' : h >= 0.7 ? '#75d8ff' : '#b6e8ff'
          return (
            <div key={hour.time} className="flex flex-1 flex-col items-center gap-1.5">
              <div style={{ width: '100%', height, borderRadius: '8px 8px 4px 4px', background: fill }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#5a6f7d' }}>
                {new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone }).format(
                  new Date(hour.time),
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default async function ClientHomePage() {
  const user = await requireRole('client')
  const supabase = await createUserClient()
  const club = await getClubSettings()

  const [bookingsRes, packagesRes, rentalsRes, conditions] = await Promise.all([
    supabase
      .from('my_bookings')
      .select('*')
      .gte('starts_at', new Date().toISOString())
      .in('status', ['pending', 'approved'])
      .order('starts_at')
      .limit(3),
    supabase.from('my_packages').select('*').eq('is_usable', true).order('expires_at'),
    supabase.from('my_rentals').select('*').in('status', ['reserved', 'out', 'overdue']),
    getSpotConditions(Number(club.spot_latitude), Number(club.spot_longitude), club.spot_name),
  ])

  const next = bookingsRes.data?.[0]
  const { now, summary } = conditions
  const pill = TONE_PILL[summary.tone]
  const firstName = user.profile.full_name.split(' ')[0] ?? 'there'
  const packageLessons = (packagesRes.data ?? []).reduce((sum, p) => sum + p.lessons_remaining, 0)
  const gearOut = rentalsRes.data?.length ?? 0

  const instructorChat = next
    ? whatsappChatUrl(
        next.instructor_whatsapp,
        `Hi ${next.instructor_name?.split(' ')[0] ?? ''}, about my ${next.service_name}…`,
      )
    : null

  return (
    <>
      <MemberHero>
        <div className="flex items-start justify-between">
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#75d8ff' }}>
              {club.spot_name} · now
            </p>
            <h1
              className="display"
              style={{ margin: '4px 0 0', fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}
            >
              {greeting(club.timezone)}, {firstName}
            </h1>
          </div>
          <Initials name={user.profile.full_name} size={44} background="#0b4a6d" color="#b6e8ff" fontSize={15} />
        </div>

        <div className="mt-5 flex items-center gap-3.5">
          <div
            className="flex shrink-0 flex-col items-center justify-center gap-0.5"
            style={{ width: 76, height: 76, borderRadius: 24, background: '#065a84' }}
          >
            <Waves size={26} style={{ color: '#2cc4ff' }} />
            <span className="display" style={{ fontSize: 20, fontWeight: 700 }}>
              {now.waveHeightM === null ? '—' : now.waveHeightM.toFixed(1)}
              <span style={{ fontSize: 12, fontWeight: 600 }}>m</span>
            </span>
          </div>
          <div className="min-w-0">
            <span
              className="display inline-flex items-center rounded-full"
              style={{ background: pill.bg, color: pill.ink, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}
            >
              {summary.label.toUpperCase()}
              {summary.tone === 'good' ? ' — GO SURF' : ''}
            </span>
            <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.45, color: '#b6e8ff' }}>
              {summary.detail}
            </p>
          </div>
        </div>
      </MemberHero>

      <div className="flex flex-col gap-3.5 px-5" style={{ marginTop: -14 }}>
        <div className="flex gap-2">
          <Metric
            icon={Wind}
            value={now.windSpeedKph === null ? '—' : String(Math.round(now.windSpeedKph))}
            unit={`km/h ${compass(now.windDirectionDeg)}`}
          />
          <Metric
            icon={Thermometer}
            value={now.seaTemperatureC === null ? '—' : `${Math.round(now.seaTemperatureC)}°`}
            unit="water"
          />
          <Metric
            icon={Compass}
            value={compass(now.waveDirectionDeg)}
            unit={now.swellHeightM === null ? 'swell' : `${now.swellHeightM.toFixed(1)}m swell`}
          />
          <Metric
            icon={Sun}
            value={now.airTemperatureC === null ? '—' : `${Math.round(now.airTemperatureC)}°`}
            unit="air"
            iconColor="#d0a668"
          />
        </div>

        <NextHours conditions={conditions} timeZone={club.timezone} />

        {/* ---- your next session ---- */}
        <div className="m-card m-card-current" style={{ padding: '16px 18px' }}>
          <MicroLabel color="#5a6f7d" className="mb-2.5">
            Your next session
          </MicroLabel>

          {next ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <MemberStatus status={next.status} />
                  <h2 className="display mt-2" style={{ fontSize: 19, fontWeight: 700, margin: '8px 0 0' }}>
                    {next.service_name}
                  </h2>
                  <p style={{ margin: '3px 0 0', fontSize: 13, fontWeight: 700, color: '#0087c6' }}>
                    {formatRelative(next.starts_at)} · {formatTime(next.starts_at, club.timezone)}
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: 13, color: '#5a6f7d' }}>
                    {next.location ?? 'Location to be confirmed'}
                    {next.instructor_name ? ` · ${next.instructor_name}` : ''}
                  </p>
                </div>

                <div
                  className="flex shrink-0 flex-col items-center justify-center"
                  style={{ width: 52, height: 52, borderRadius: 16, background: '#eff9ff' }}
                >
                  <span className="display" style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>
                    {new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: club.timezone }).format(
                      new Date(next.starts_at),
                    )}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#5a6f7d', textTransform: 'uppercase' }}>
                    {new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: club.timezone }).format(
                      new Date(next.starts_at),
                    )}
                  </span>
                </div>
              </div>

              {/* Each control disappears with its number or link, as today */}
              {(instructorChat || isWhatsappGroupUrl(next.whatsapp_group_url)) && (
                <div className="mt-3.5 flex gap-2">
                  {instructorChat && (
                    <a
                      href={instructorChat}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${memberButton('primary', 'md')} flex-1`}
                    >
                      <MessageCircle size={17} /> Instructor
                    </a>
                  )}
                  {isWhatsappGroupUrl(next.whatsapp_group_url) && (
                    <a
                      href={next.whatsapp_group_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${memberButton('secondary', 'md')} flex-1`}
                    >
                      <Users size={17} /> Group
                    </a>
                  )}
                </div>
              )}

              {next.status === 'pending' && (
                <p style={{ margin: '12px 0 0', fontSize: 13, color: '#5a6f7d' }}>
                  Waiting for the club to confirm. You will see it here once it is approved.
                </p>
              )}
            </>
          ) : (
            <>
              <Empty>Nothing booked. Pick a session and send a request.</Empty>
              <Link href="/client/book" className={`${memberButton('primary', 'md')} w-full`}>
                Book a session
              </Link>
            </>
          )}
        </div>

        {/* ---- two half tiles ---- */}
        <div className="flex gap-2.5">
          <Link
            href="/client/packages"
            className="flex-1"
            style={{ background: '#0b4a6d', borderRadius: 22, padding: '14px 16px', color: '#fff' }}
          >
            <Ticket size={20} style={{ color: '#75d8ff' }} />
            <p className="display" style={{ margin: '8px 0 0', fontSize: 26, fontWeight: 700 }}>
              {packageLessons}
            </p>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#b6e8ff' }}>
              lesson{packageLessons === 1 ? '' : 's'} left
            </p>
          </Link>

          <Link
            href="/client/rentals"
            className="flex-1"
            style={{ background: '#f5eede', borderRadius: 22, padding: '14px 16px', color: '#8a6b39' }}
          >
            <Anchor size={20} />
            <p className="display" style={{ margin: '8px 0 0', fontSize: 26, fontWeight: 700 }}>
              {gearOut}
            </p>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              gear item{gearOut === 1 ? '' : 's'} out
            </p>
          </Link>
        </div>

        {club.contact_phone && telUrl(club.contact_phone) && (
          <a
            href={telUrl(club.contact_phone)!}
            className="text-center"
            style={{ fontSize: 13, fontWeight: 700, color: '#0087c6', padding: '4px 0' }}
          >
            Call the club
          </a>
        )}
      </div>
    </>
  )
}
