/**
 * Create the starting accounts for a fresh environment.
 *
 * Run against a LOCAL or STAGING project only:
 *   node --env-file=.env.local scripts/seed-users.ts
 *
 * Passwords are hashed by GoTrue, which is why these accounts are created
 * through the auth admin API rather than by inserting rows. The role is set in
 * app_metadata — the one place a user cannot write to — and the database
 * trigger creates the matching profile.
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.')
  process.exit(1)
}

if (process.env.ALLOW_PRODUCTION_SEED !== 'yes' && !/localhost|127\.0\.0\.1|staging/.test(url)) {
  console.error(
    `Refusing to seed ${url}.\n` +
      'This looks like a real project. Re-run with ALLOW_PRODUCTION_SEED=yes if you are certain.',
  )
  process.exit(1)
}

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface SeedUser {
  email: string
  password: string
  role: 'admin' | 'instructor' | 'client'
  fullName: string
  phone: string
}

const users: SeedUser[] = [
  { email: 'admin@surferlive.test',   password: 'change-me-please-01', role: 'admin',      fullName: 'Club Manager',  phone: '+972500000001' },
  { email: 'maya@surferlive.test',    password: 'change-me-please-02', role: 'instructor', fullName: 'Maya Cohen',    phone: '+972500000002' },
  { email: 'daniel@surferlive.test',  password: 'change-me-please-03', role: 'instructor', fullName: 'Daniel Peretz', phone: '+972500000003' },
  { email: 'noa@surferlive.test',     password: 'change-me-please-04', role: 'client',     fullName: 'Noa Levi',      phone: '+972500000004' },
  { email: 'tom@surferlive.test',     password: 'change-me-please-05', role: 'client',     fullName: 'Tom Bar',       phone: '+972500000005' },
]

for (const user of users) {
  const { data, error } = await db.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    app_metadata: { role: user.role, full_name: user.fullName, phone: user.phone },
  })

  if (error) {
    console.log(`  skipped ${user.email}: ${error.message}`)
    continue
  }

  // The trigger fills in name and phone; this keeps the instructor reachable.
  if (user.role === 'instructor' && data.user) {
    await db.from('instructors').update({ whatsapp_phone: user.phone }).eq('profile_id', data.user.id)
  }

  console.log(`  created ${user.role.padEnd(10)} ${user.email}`)
}

console.log('\nDone. Change every one of these passwords before this environment is used for real.')
