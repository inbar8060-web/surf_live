import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, Download, MessageCircle, Phone, Users } from 'lucide-react'
import { createUserClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { Flag, NotePanel } from '@/components/instructor/pieces'
import { instructorButton } from '@/components/ui/button-class'
import { Empty, Initials } from '@/components/ui/bits'
import { formatTime } from '@/lib/util/format'
import { isWhatsappGroupUrl, telUrl, whatsappChatUrl } from '@/lib/util/contact'
import { InlineDecision } from '../../inline-decision'

export const dynamic = 'force-dynamic'

/**
 * One session's roster.
 *
 * `instructor_roster` only returns rows for sessions the caller is assigned to
 * (or any, for an admin), so an instructor opening another instructor's slot
 * id simply gets nothing back. No client-side ownership check is needed, and
 * none is written here.
 */
export default async function SessionRosterPage({
  params,
}: {
  params: Promise<{ slotId: string }>
}) {
  const { slotId } = await params
  await requireRole('instructor')

  const supabase = await createUserClient()
  const club = await getClubSettings()

  const { data: rows } = await supabase.from('instructor_roster').select('*').eq('slot_id', slotId)
  if (!rows || rows.length === 0) notFound()

  const slot = rows[0]!
  const members = rows.filter((r) => r.reservation_id && r.client_id)
  const taken = members.reduce((n, m) => n + (m.participants ?? 0), 0)

  const { data: overview } = await supabase
    .from('staff_slot_overview')
    .select('capacity')
    .eq('slot_id', slotId)
    .maybeSingle()

  const day = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: club.timezone,
  }).format(new Date(slot.starts_at))

  return (
    <>
      <header className="flex items-center justify-between gap-3 px-5 pb-4 pt-8">
        <Link
          href="/instructor"
          aria-label="Back"
          className="flex items-center justify-center"
          style={{ width: 40, height: 40, borderRadius: 20, background: '#e9e9e6' }}
        >
          <ChevronLeft size={21} />
        </Link>

        <div className="flex gap-2">
          {isWhatsappGroupUrl(slot.whatsapp_group_url) && (
            <a
              href={slot.whatsapp_group_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open the session group chat"
              className="flex items-center justify-center"
              style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--color-ins-ink)', color: '#fff' }}
            >
              <Users size={19} />
            </a>
          )}
          <a
            href={`/instructor/export?date=${slot.starts_at.slice(0, 10)}`}
            aria-label="Export the day as CSV"
            className="flex items-center justify-center"
            style={{ width: 40, height: 40, borderRadius: 20, background: '#e9e9e6' }}
          >
            <Download size={19} />
          </a>
        </div>
      </header>

      <div className="px-5">
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>
          {slot.service_name}
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 600, color: 'var(--color-ins-ink-2)' }}>
          {day} · {formatTime(slot.starts_at, club.timezone)}–{formatTime(slot.ends_at, club.timezone)}
          {slot.location ? ` · ${slot.location}` : ''} · {taken} of {overview?.capacity ?? '—'}
        </p>

        {slot.slot_notes && (
          <div className="mt-4">
            <NotePanel label="Session note">{slot.slot_notes}</NotePanel>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3">
          {members.length === 0 && <Empty tone="instructor">Nobody booked in yet.</Empty>}

          {members.map((member) => {
            const chat = whatsappChatUrl(
              member.client_phone,
              `Hi ${member.client_name?.split(' ')[0] ?? ''}, about the ${slot.service_name}…`,
            )
            const call = telUrl(member.client_phone)
            const pending = member.reservation_status === 'pending'

            return (
              <article key={member.reservation_id} className="i-card" style={{ padding: '15px 18px' }}>
                <div className="flex items-start gap-3">
                  <Initials
                    name={member.client_name ?? '?'}
                    size={44}
                    background="var(--color-ins-ink)"
                    color="#fff"
                    fontSize={15}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{member.client_name}</p>
                      {!member.waiver_signed_at && <Flag tone="danger">No waiver</Flag>}
                    </div>
                    <p
                      style={{
                        margin: '2px 0 0',
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--color-ins-ink-2)',
                      }}
                    >
                      {member.client_level} · {member.participants} place
                      {(member.participants ?? 1) === 1 ? '' : 's'} · {member.reservation_status}
                    </p>
                  </div>
                </div>

                {member.medical_notes && (
                  <div className="mt-3">
                    <NotePanel label="Medical">{member.medical_notes}</NotePanel>
                  </div>
                )}

                {member.emergency_contact_phone && (
                  <p
                    style={{
                      margin: '10px 0 0',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--color-ins-ink-2)',
                    }}
                  >
                    Emergency: {member.emergency_contact_name ?? '—'} · {member.emergency_contact_phone}
                  </p>
                )}

                {member.client_note && (
                  <p style={{ margin: '6px 0 0', fontSize: 13, fontWeight: 600 }}>
                    “{member.client_note}”
                  </p>
                )}

                <div className="mt-3.5">
                  {pending && member.reservation_id ? (
                    <InlineDecision reservationId={member.reservation_id} name={member.client_name ?? undefined} />
                  ) : (
                    (chat || call) && (
                      <div className="flex gap-2">
                        {chat && (
                          <a
                            href={chat}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${instructorButton('primary')} flex-1`}
                          >
                            <MessageCircle size={17} /> WhatsApp
                          </a>
                        )}
                        {call && (
                          <a href={call} className={`${instructorButton('secondary')} flex-1`}>
                            <Phone size={17} /> Call
                          </a>
                        )}
                      </div>
                    )
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </>
  )
}
