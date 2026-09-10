import Link from 'next/link'
import { createUserClient } from '@/lib/supabase/server'
import { getClubSettings } from '@/lib/db/queries'
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui'
import { CallButton, WhatsAppButton } from '@/components/contact-links'
import { formatDateTime, formatRelative } from '@/lib/util/format'
import { CreateUserForm, InviteForm, RevokeInviteButton } from './forms'

export const metadata = { title: 'People' }
export const dynamic = 'force-dynamic'

const ROLE_TONE = { admin: 'danger', instructor: 'info', client: 'neutral' } as const

export default async function AdminPeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>
}) {
  const { q, role } = await searchParams
  const supabase = await createUserClient()
  const club = await getClubSettings()

  let query = supabase.from('profiles').select('*').order('full_name').limit(300)
  if (role === 'admin' || role === 'instructor' || role === 'client') {
    query = query.eq('role', role)
  }
  if (q && q.trim()) {
    // ilike with the wildcards supplied here, not by the user, so a typed "%"
    // cannot widen the search beyond one field.
    const term = q.trim().replace(/[%_]/g, '')
    query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
  }

  const [peopleRes, invitesRes] = await Promise.all([
    query,
    supabase
      .from('registration_invites')
      .select('*')
      .is('used_at', null)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(25),
  ])

  const people = peopleRes.data ?? []

  return (
    <>
      <PageHeader
        title="People"
        description="Members, instructors and administrators. Everything about an account is editable here."
      />

      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <InviteForm />
        <CreateUserForm />
      </div>

      {invitesRes.data && invitesRes.data.length > 0 && (
        <div className="mb-4">
          <Card title="Open registration links" description="Each one works exactly once.">
            <ul className="space-y-2 text-sm">
              {invitesRes.data.map((invite) => (
                <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <Badge tone={ROLE_TONE[invite.role]}>{invite.role}</Badge>{' '}
                    {invite.full_name || invite.email || 'Anyone with the link'}
                    <span className="muted"> · expires {formatRelative(invite.expires_at)}</span>
                  </span>
                  <RevokeInviteButton inviteId={invite.id} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      <Card
        title="Directory"
        action={
          <form className="flex gap-2" action="/admin/people">
            <input
              name="q"
              defaultValue={q ?? ''}
              placeholder="Search name, email or phone"
              className="field-input w-56"
              aria-label="Search people"
            />
            <select name="role" defaultValue={role ?? ''} className="field-input w-32" aria-label="Filter by role">
              <option value="">All roles</option>
              <option value="client">Members</option>
              <option value="instructor">Instructors</option>
              <option value="admin">Admins</option>
            </select>
            <button type="submit" className="field-input w-auto px-3">
              Search
            </button>
          </form>
        }
      >
        {people.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Contact</th>
                  <th>Joined</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {people.map((person) => (
                  <tr key={person.id}>
                    <td>
                      <Link href={`/admin/people/${person.id}`} className="font-medium underline">
                        {person.full_name}
                      </Link>
                    </td>
                    <td>
                      <Badge tone={ROLE_TONE[person.role]}>{person.role}</Badge>
                    </td>
                    <td>
                      <p className="text-xs">{person.email ?? '—'}</p>
                      <p className="muted text-xs">{person.phone ?? '—'}</p>
                    </td>
                    <td className="muted text-xs">{formatDateTime(person.created_at, club.timezone)}</td>
                    <td>
                      {person.is_active ? (
                        <Badge tone="success">Active</Badge>
                      ) : (
                        <Badge tone="neutral">Disabled</Badge>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-1.5">
                        <WhatsAppButton phone={person.phone} label="" />
                        <CallButton phone={person.phone} label="" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>Nobody matches that search.</EmptyState>
        )}
      </Card>
    </>
  )
}
