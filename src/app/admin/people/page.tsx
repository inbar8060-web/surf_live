import Link from 'next/link'
import { MessageCircle, Phone } from 'lucide-react'
import { createUserClient } from '@/lib/supabase/server'
import { getClubSettings } from '@/lib/db/queries'
import { AdmChip, EmptyRow, PageTitle, Panel, SubTabs, type AdminChipTone } from '@/components/admin/pieces'
import type { AppRole } from '@/lib/db/types'
import { Initials } from '@/components/ui/bits'
import { adminButton } from '@/components/ui/button-class'
import { formatDateTime, formatRelative } from '@/lib/util/format'
import { telUrl, whatsappChatUrl } from '@/lib/util/contact'
import { searchTerm } from '@/lib/util/search'
import { CreateUserForm, InviteForm, RevokeInviteButton } from './forms'
import { MarkReadButton } from '@/app/admin/club/forms'

export const metadata = { title: 'People' }
export const dynamic = 'force-dynamic'

// the platform operator never appears in a club's directory, but the map is total
const ROLE_TONE: Record<AppRole, AdminChipTone> = { admin: 'rose', instructor: 'blue', client: 'neutral', super_admin: 'rose' }

export default async function AdminPeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; role?: string }>
}) {
  const { tab, q, role } = await searchParams
  const view = ['instructors', 'invites', 'feedback'].includes(tab ?? '') ? tab! : ''

  const supabase = await createUserClient()
  const club = await getClubSettings()

  let query = supabase.from('profiles').select('*').order('full_name').limit(300)
  const roleFilter = view === 'instructors' ? 'instructor' : role
  if (roleFilter === 'admin' || roleFilter === 'instructor' || roleFilter === 'client') {
    query = query.eq('role', roleFilter)
  }
  // The filter below is a PostgREST expression: commas, dots and parentheses
  // are syntax. `searchTerm` strips everything that could rewrite it, and the
  // wildcards are added here rather than typed.
  const term = searchTerm(q)
  if (term) {
    query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
  }

  const [peopleRes, invitesRes, feedbackRes, countsRes, clientsRes] = await Promise.all([
    query,
    supabase
      .from('registration_invites')
      .select('*')
      .is('used_at', null)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase.from('instructor_reviews').select('*').order('created_at', { ascending: false }).limit(60),
    supabase.from('profiles').select('id, role'),
    supabase.from('clients').select('profile_id, level, waiver_signed_at'),
  ])

  const people = peopleRes.data ?? []
  const counts = (countsRes.data ?? []).reduce<Record<string, number>>((acc, p) => {
    acc[p.role] = (acc[p.role] ?? 0) + 1
    return acc
  }, {})
  const clientById = new Map((clientsRes.data ?? []).map((c) => [c.profile_id, c]))
  const nameOf = new Map((countsRes.data ?? []).map((p) => [p.id, p.id]))
  const displayName = new Map(people.map((p) => [p.id, p.full_name]))
  const unread = (feedbackRes.data ?? []).filter((r) => !r.admin_read_at)

  return (
    <>
      <PageTitle
        title="People"
        sub="Members, instructors and administrators."
        actions={
          view === 'invites' ? null : (
            <>
              <CreateUserForm />
              <Link href="/admin/people?tab=invites" className={adminButton('primary')}>
                Invite link
              </Link>
            </>
          )
        }
      />

      <SubTabs
        base="/admin/people"
        current={view}
        tabs={[
          { key: '', label: 'Directory', count: people.length },
          { key: 'instructors', label: 'Instructors', count: counts.instructor ?? 0 },
          { key: 'invites', label: 'Open invites', count: invitesRes.data?.length ?? 0 },
          { key: 'feedback', label: 'Reviews & feedback', count: unread.length },
        ]}
      />

      {(view === '' || view === 'instructors') && (
        <Panel
          action={
            <form className="flex flex-wrap gap-2" action="/admin/people">
              {view && <input type="hidden" name="tab" value={view} />}
              <input
                name="q"
                defaultValue={q ?? ''}
                placeholder="Name, email or phone"
                aria-label="Search people"
                className="a-input"
                style={{ width: 280, height: 36 }}
              />
              {view === '' && (
                <select name="role" defaultValue={role ?? ''} aria-label="Role" className="a-input" style={{ width: 140, height: 36 }}>
                  <option value="">All roles</option>
                  <option value="client">Members</option>
                  <option value="instructor">Instructors</option>
                  <option value="admin">Admins</option>
                </select>
              )}
              <button type="submit" className={adminButton('secondary', 'sm')}>
                Search
              </button>
            </form>
          }
        >
          {people.length ? (
            <div className="table-wrap" style={{ border: 'none' }}>
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
                  {people.map((person) => {
                    const client = clientById.get(person.id)
                    const chat = whatsappChatUrl(person.phone)
                    const call = telUrl(person.phone)

                    return (
                      <tr key={person.id}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <Initials
                              name={person.full_name}
                              size={32}
                              background="var(--color-adm-neutral-chip)"
                              color="var(--color-adm-ink-2)"
                              fontSize={11}
                            />
                            <div>
                              <Link
                                href={`/admin/people/${person.id}`}
                                style={{ fontWeight: 800, color: 'var(--color-adm-ink)' }}
                              >
                                {person.full_name}
                              </Link>
                              {client && (
                                <p className="a-helper" style={{ margin: '2px 0 0' }}>
                                  {client.level}
                                  {client.waiver_signed_at ? ' · waiver signed' : ' · no waiver'}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <AdmChip tone={ROLE_TONE[person.role]}>{person.role}</AdmChip>
                        </td>
                        <td>
                          <p style={{ margin: 0, fontSize: 12 }}>{person.email ?? '—'}</p>
                          <p className="a-helper" style={{ margin: 0 }}>
                            {person.phone ?? '—'}
                          </p>
                        </td>
                        <td className="a-helper">{formatDateTime(person.created_at, club.timezone)}</td>
                        <td>
                          {person.is_active ? <AdmChip tone="green">Active</AdmChip> : <AdmChip>Disabled</AdmChip>}
                        </td>
                        <td>
                          <div className="flex gap-1.5">
                            {chat && (
                              <a
                                href={chat}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Message ${person.full_name}`}
                                className="flex items-center justify-center"
                                style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--color-adm-line)' }}
                              >
                                <MessageCircle size={15} />
                              </a>
                            )}
                            {call && (
                              <a
                                href={call}
                                aria-label={`Call ${person.full_name}`}
                                className="flex items-center justify-center"
                                style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--color-adm-line)' }}
                              >
                                <Phone size={15} />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyRow>Nobody matches that search.</EmptyRow>
          )}
        </Panel>
      )}

      {view === 'invites' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Panel title="Open registration links" helper="Each one works exactly once.">
            {invitesRes.data?.length ? (
              <ul className="flex flex-col">
                {invitesRes.data.map((invite, i) => (
                  <li
                    key={invite.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                    style={{ borderTop: i === 0 ? undefined : '1px solid var(--color-adm-rule)' }}
                  >
                    <span style={{ fontSize: 13 }}>
                      <AdmChip tone={ROLE_TONE[invite.role]}>{invite.role}</AdmChip>{' '}
                      {invite.full_name || invite.email || 'Anyone with the link'}
                      <span className="a-helper"> · expires {formatRelative(invite.expires_at)}</span>
                    </span>
                    <RevokeInviteButton inviteId={invite.id} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyRow>No open invitations.</EmptyRow>
            )}
          </Panel>

          <Panel
            title="New registration link"
            helpTitle="A link that works once"
            help="Only the hash of the token is stored, so the link cannot be recovered after you close this page. Generate another if it is lost."
          >
            <InviteForm />
          </Panel>
        </div>
      )}

      {view === 'feedback' && (
        <Panel
          title="Private feedback about instructors"
          helpTitle="Confidential to the club"
          help="Instructors cannot read these, by database policy — not just by what is on screen."
          helper="Confidential. Instructors cannot read these, by database policy — not just by what's on screen."
        >
          {feedbackRes.data?.length ? (
            <ul className="flex flex-col">
              {feedbackRes.data.map((review, i) => (
                <li
                  key={review.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-3.5"
                  style={{
                    borderTop: i === 0 ? undefined : '1px solid var(--color-adm-rule)',
                    background: review.admin_read_at ? undefined : 'var(--color-adm-amber-bg)',
                    borderRadius: review.admin_read_at ? undefined : 10,
                    paddingInline: review.admin_read_at ? undefined : 10,
                  }}
                >
                  <div className="min-w-0">
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>
                      About {displayName.get(review.instructor_id) ?? 'an instructor'} ·{' '}
                      {'★'.repeat(review.rating)}
                      <span style={{ color: 'var(--color-adm-ink-3)' }}>{'★'.repeat(5 - review.rating)}</span>
                    </p>
                    <p className="a-helper" style={{ margin: '2px 0 0' }}>
                      From {displayName.get(review.client_id) ?? 'a member'} ·{' '}
                      {formatDateTime(review.created_at, club.timezone)}
                    </p>
                    {review.body && <p style={{ margin: '8px 0 0', fontSize: 13 }}>{review.body}</p>}
                  </div>
                  {!review.admin_read_at && <MarkReadButton reviewId={review.id} />}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyRow>No feedback yet.</EmptyRow>
          )}
        </Panel>
      )}
    </>
  )
}
