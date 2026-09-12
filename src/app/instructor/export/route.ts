import { NextResponse, type NextRequest } from 'next/server'
import { createUserClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { recordAudit } from '@/lib/audit'
import { dayRangeInZone, formatTime, todayInZone } from '@/lib/util/format'

export const dynamic = 'force-dynamic'

/**
 * Today's schedule as CSV, including the client contact details an instructor
 * needs on the beach.
 *
 * The rows come from the instructor_roster view, which filters to the caller's
 * own sessions — so this endpoint cannot be used to pull another instructor's
 * client list by changing the query string. The export is audited, because it
 * takes personal data out of the system.
 */

/**
 * Escape a value for CSV.
 *
 * The leading apostrophe on =, +, - and @ is deliberate: without it a
 * spreadsheet treats the cell as a formula, which turns an exported phone
 * number or a client's note into code that runs when the file is opened.
 */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let text = String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user || (user.profile.role !== 'instructor' && user.profile.role !== 'admin')) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const supabase = await createUserClient()
  const club = await getClubSettings()

  // The day is the club's, not the server's: on Vercel the server clock is UTC,
  // so a 07:30 session would land in the previous day's export for half the night.
  const dateParam = request.nextUrl.searchParams.get('date')
  const isoDay = /^\d{4}-\d{2}-\d{2}$/.test(dateParam ?? '')
    ? dateParam!
    : todayInZone(club.timezone)
  const { from, to } = dayRangeInZone(isoDay, club.timezone)

  const { data, error } = await supabase
    .from('instructor_roster')
    .select('*')
    .gte('starts_at', from)
    .lt('starts_at', to)
    .order('starts_at')

  if (error) {
    return NextResponse.json({ error: 'Could not build the export' }, { status: 500 })
  }

  const headers = [
    'Start', 'End', 'Session', 'Location', 'Status',
    'Member', 'Phone', 'Email', 'Level', 'Places',
    'Waiver signed', 'Medical notes', 'Emergency contact', 'Emergency phone', 'Member note',
  ]

  const lines = [headers.map(csvCell).join(',')]

  for (const row of data ?? []) {
    if (!row.reservation_id) continue
    lines.push(
      [
        formatTime(row.starts_at, club.timezone),
        formatTime(row.ends_at, club.timezone),
        row.service_name,
        row.location,
        row.reservation_status,
        row.client_name,
        row.client_phone,
        row.client_email,
        row.client_level,
        row.participants,
        row.waiver_signed_at ? 'yes' : 'NO',
        row.medical_notes,
        row.emergency_contact_name,
        row.emergency_contact_phone,
        row.client_note,
      ]
        .map(csvCell)
        .join(','),
    )
  }

  await recordAudit({
    actorId: user.id,
    actorRole: user.profile.role,
    action: 'schedule.exported',
    entity: 'instructor_roster',
    entityId: isoDay,
    after: { rows: lines.length - 1 },
  })

  // The BOM makes Excel open UTF-8 correctly instead of mangling accents.
  const body = `﻿${lines.join('\r\n')}\r\n`

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="schedule-${isoDay}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
