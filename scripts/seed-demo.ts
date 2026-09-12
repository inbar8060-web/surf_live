/**
 * Fill a development environment with a believable week: sessions across the
 * next few days, instructors assigned, and a mix of booking states so every
 * screen has something to show.
 *
 * Run after `npm run seed:users`:
 *   node --env-file=.env.local scripts/seed-demo.ts
 *
 * Local/staging only — it refuses to touch anything that looks like a real
 * project, the same guard the user seed uses.
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.')
  process.exit(1)
}
if (process.env.ALLOW_PRODUCTION_SEED !== 'yes' && !/localhost|127\.0\.0\.1|staging/.test(url)) {
  console.error(`Refusing to seed ${url}. Re-run with ALLOW_PRODUCTION_SEED=yes if you are certain.`)
  process.exit(1)
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } })

const { data: club } = await db.from('clubs').select('id').eq('slug', 'surfer-live').single()
const clubId = club!.id
const { data: services } = await db.from('services').select('id, name, duration_minutes, default_capacity').eq('club_id', clubId)
const { data: staff } = await db.from('profiles').select('id, full_name').eq('role', 'instructor').eq('club_id', clubId).order('full_name')
const { data: members } = await db.from('profiles').select('id, full_name').eq('role', 'client').eq('club_id', clubId).order('full_name')

if (!services?.length || !staff?.length || !members?.length) {
  console.error('Run `npm run seed:users` first — this needs instructors, members and services.')
  process.exit(1)
}

const serviceBy = (name: string) => services.find((s) => s.name === name) ?? services[0]!
const [maya, daniel] = [staff[0]!, staff[1] ?? staff[0]!]
const [noa, tom] = [members[0]!, members[1] ?? members[0]!]

/** A local-time hour on `dayOffset` days from today, as an ISO instant. */
function at(dayOffset: number, hour: number, minute = 0): Date {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, minute, 0, 0)
  return d
}

const plan = [
  { day: 0, hour: 7, minute: 30, service: 'Beginner group lesson', instructor: maya, capacity: 8, group: true },
  { day: 0, hour: 9, minute: 0, service: 'Improver group lesson', instructor: daniel, capacity: 6 },
  { day: 0, hour: 16, minute: 0, service: 'Private lesson', instructor: maya, capacity: 1 },
  { day: 1, hour: 7, minute: 30, service: 'Beginner group lesson', instructor: daniel, capacity: 8, group: true },
  { day: 1, hour: 10, minute: 0, service: 'Kids surf session', instructor: maya, capacity: 10 },
  { day: 2, hour: 8, minute: 0, service: 'Improver group lesson', instructor: maya, capacity: 6 },
  { day: 3, hour: 7, minute: 30, service: 'Beginner group lesson', instructor: daniel, capacity: 8 },
  { day: 4, hour: 16, minute: 30, service: 'Private lesson', instructor: daniel, capacity: 1 },
]

const created: { id: string; starts: Date }[] = []

for (const entry of plan) {
  const service = serviceBy(entry.service)
  const starts = at(entry.day, entry.hour, entry.minute)
  const ends = new Date(starts.getTime() + service.duration_minutes * 60_000)

  // Idempotent: re-running must not double the calendar.
  const { data: already } = await db
    .from('time_slots')
    .select('id')
    .eq('service_id', service.id)
    .eq('starts_at', starts.toISOString())
    .maybeSingle()

  if (already) {
    created.push({ id: already.id, starts })
    console.log(`  exists   ${starts.toISOString().slice(0, 16)}  ${entry.service}`)
    continue
  }

  const { data: slot, error } = await db
    .from('time_slots')
    .insert({
      club_id: clubId,
      service_id: service.id,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      capacity: entry.capacity,
      location: 'Hilton Beach',
      whatsapp_group_url: entry.group ? 'https://chat.whatsapp.com/DemoGroupLink01' : null,
      notes: entry.day === 0 && entry.hour === 7 ? 'Bring the soft-tops down early — low tide.' : null,
    })
    .select('id')
    .single()

  if (error) {
    console.log(`  skipped ${entry.service} ${starts.toISOString()}: ${error.message}`)
    continue
  }

  await db.from('time_slot_instructors').insert({
    club_id: clubId,
    slot_id: slot.id,
    instructor_id: entry.instructor.id,
    is_lead: true,
  })

  created.push({ id: slot.id, starts })
  console.log(`  session  ${starts.toISOString().slice(0, 16)}  ${entry.service}  (${entry.instructor.full_name})`)
}

// A spread of booking states: approved, awaiting approval, and one changed
// booking so the "needs re-approval" treatment has something to render.
const bookings: { slot: number; client: { id: string }; status?: 'approved'; note?: string }[] = [
  { slot: 0, client: noa, status: 'approved', note: 'Bringing my own board this time.' },
  { slot: 0, client: tom },
  { slot: 1, client: noa },
  { slot: 3, client: tom, status: 'approved' },
  { slot: 4, client: noa, status: 'approved' },
]

for (const booking of bookings) {
  const slot = created[booking.slot]
  if (!slot) continue

  const { data: held } = await db
    .from('reservations')
    .select('id')
    .eq('slot_id', slot.id)
    .eq('client_id', booking.client.id)
    .maybeSingle()
  if (held) continue

  const { error } = await db.from('reservations').insert({
    club_id: clubId,
    slot_id: slot.id,
    client_id: booking.client.id,
    participants: 1,
    status: booking.status ?? 'pending',
    client_note: booking.note ?? null,
  })
  if (error) console.log(`  booking skipped: ${error.message}`)
}

// One member with a package, and a board out on loan.
const { data: template } = await db.from('package_templates').select('id').eq('name', 'Starter pack - 5 lessons').eq('club_id', clubId).maybeSingle()
if (template) {
  const { data: existing } = await db.from('client_packages').select('id').eq('client_id', noa.id).maybeSingle()
  if (!existing) {
    const { data: pkgId, error } = await db.rpc('grant_client_package', {
      p_client_id: noa.id,
      p_template_id: template.id,
      p_note: 'Paid at the desk',
    })
    if (error) console.log(`  package skipped: ${error.message}`)
    else console.log(`  package  attached to ${noa.full_name} (${pkgId})`)
  }
}

const { data: openRental } = await db.from('rentals').select('id').in('status', ['out', 'reserved']).limit(1).maybeSingle()
const { data: board } = await db.from('inventory_items').select('id').eq('status', 'available').eq('club_id', clubId).limit(1).maybeSingle()
if (board && !openRental) {
  const today = new Date().toISOString().slice(0, 10)
  const back = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10)
  const { error } = await db.from('rentals').insert({
    club_id: clubId,
    client_id: tom.id,
    item_id: board.id,
    start_date: today,
    end_date: back,
    status: 'out',
  })
  if (error) console.log(`  rental skipped: ${error.message}`)
  else console.log(`  rental   one board out with ${tom.full_name} until ${back}`)
}

console.log(`\nDone. ${created.length} session(s) on the calendar.`)
