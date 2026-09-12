import { createUserClient } from '@/lib/supabase/server'
import { getClubSettings } from '@/lib/db/queries'
import { AdmChip, EmptyRow, PageTitle, Panel, SubTabs } from '@/components/admin/pieces'
import { formatDateTime } from '@/lib/util/format'
import { ModerateForm, SettingsForm } from './forms'
import { PlanPanel } from './plan-panel'

export const metadata = { title: 'Club' }
export const dynamic = 'force-dynamic'

export default async function AdminClubPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const view = ['reviews', 'audit', 'plan'].includes(tab ?? '') ? tab! : ''

  const club = await getClubSettings()
  const supabase = await createUserClient()

  const [reviewsRes, auditRes, profilesRes] = await Promise.all([
    supabase.from('session_reviews').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(80),
    supabase.from('profiles').select('id, full_name'),
  ])

  const nameOf = new Map((profilesRes.data ?? []).map((p) => [p.id, p.full_name]))

  return (
    <>
      <PageTitle title="Club" sub="Settings, the public review wall and the audit log." />

      <SubTabs
        base="/admin/club"
        current={view}
        tabs={[
          { key: '', label: 'Settings' },
          { key: 'reviews', label: 'Public reviews', count: reviewsRes.data?.length ?? 0 },
          { key: 'audit', label: 'Audit log' },
          { key: 'plan', label: 'Plan & payouts' },
        ]}
      />

      {view === 'plan' && <PlanPanel clubId={club.club_id} timeZone={club.timezone} />}

      {view === '' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Panel title="Club settings">
            <SettingsForm settings={club} />
          </Panel>

          <Panel
            title="Recent activity"
            helpTitle="The audit log only ever gains rows"
            help="Every privileged action is appended here. Rows cannot be edited or deleted, by database trigger."
          >
            {auditRes.data?.length ? (
              <ul className="flex flex-col gap-2">
                {auditRes.data.slice(0, 12).map((entry) => (
                  <li key={entry.id} style={{ fontSize: 12, color: 'var(--color-adm-ink-2)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-adm-ink)' }}>
                      {entry.action.replace(/[._]/g, ' ')}
                    </span>{' '}
                    · {entry.actor_role ?? 'system'} · {formatDateTime(entry.created_at, club.timezone)}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyRow>Nothing recorded yet.</EmptyRow>
            )}
          </Panel>
        </div>
      )}

      {view === 'reviews' && (
        <Panel helper="Hide anything unsuitable — the record is kept either way, and the member is not told.">
          {reviewsRes.data?.length ? (
            <ul className="flex flex-col">
              {reviewsRes.data.map((review, i) => (
                <li
                  key={review.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-3.5"
                  style={{ borderTop: i === 0 ? undefined : '1px solid var(--color-adm-rule)' }}
                >
                  <div className="min-w-0">
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>
                      {review.title || 'Session review'} · {'★'.repeat(review.rating)}
                      <span style={{ color: 'var(--color-adm-ink-3)' }}>{'★'.repeat(5 - review.rating)}</span>
                    </p>
                    <p className="a-helper" style={{ margin: '2px 0 0' }}>
                      {review.author_display_name} · {formatDateTime(review.created_at, club.timezone)}
                    </p>
                    {review.body && <p style={{ margin: '8px 0 0', fontSize: 13 }}>{review.body}</p>}
                    {review.hidden_reason && (
                      <p className="a-helper" style={{ margin: '4px 0 0' }}>
                        Hidden: {review.hidden_reason}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {review.is_published ? <AdmChip tone="green">Visible</AdmChip> : <AdmChip>Hidden</AdmChip>}
                    <ModerateForm reviewId={review.id} isPublished={review.is_published} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyRow>No public reviews yet.</EmptyRow>
          )}
        </Panel>
      )}

      {view === 'audit' && (
        <Panel helper="This log only ever gains rows — entries cannot be edited or deleted.">
          {auditRes.data?.length ? (
            <div className="table-wrap" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Action</th>
                    <th>Subject</th>
                    <th>Actor</th>
                  </tr>
                </thead>
                <tbody>
                  {auditRes.data.map((entry) => (
                    <tr key={entry.id}>
                      <td className="a-helper" style={{ whiteSpace: 'nowrap' }}>
                        {formatDateTime(entry.created_at, club.timezone)}
                      </td>
                      <td style={{ fontWeight: 700 }}>{entry.action.replace(/[._]/g, ' ')}</td>
                      <td>
                        {entry.entity}
                        {entry.entity_id && (
                          <span className="a-helper"> · {entry.entity_id.slice(0, 8)}</span>
                        )}
                      </td>
                      <td className="a-helper">
                        {(entry.actor_id && nameOf.get(entry.actor_id)) ?? entry.actor_role ?? 'system'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyRow>Nothing recorded yet.</EmptyRow>
          )}
        </Panel>
      )}
    </>
  )
}
