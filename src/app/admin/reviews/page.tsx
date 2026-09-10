import Link from 'next/link'
import { createUserClient } from '@/lib/supabase/server'
import { getClubSettings } from '@/lib/db/queries'
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui'
import { formatDateTime } from '@/lib/util/format'
import { MarkReadButton, ModerateForm } from './forms'

export const metadata = { title: 'Reviews' }
export const dynamic = 'force-dynamic'

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} out of 5`} title={`${rating} / 5`}>
      {'★'.repeat(rating)}
      <span className="muted">{'★'.repeat(5 - rating)}</span>
    </span>
  )
}

export default async function AdminReviewsPage() {
  const supabase = await createUserClient()
  const club = await getClubSettings()

  const [instructorReviews, sessionReviews, profilesRes] = await Promise.all([
    supabase.from('instructor_reviews').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('session_reviews').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('profiles').select('id, full_name'),
  ])

  const nameOf = new Map((profilesRes.data ?? []).map((p) => [p.id, p.full_name]))
  const unread = (instructorReviews.data ?? []).filter((r) => !r.admin_read_at)

  return (
    <>
      <PageHeader
        title="Reviews"
        description="Private feedback about instructors, and the public wall members can read."
      />

      <div className="space-y-4">
        <Card
          title="Feedback about instructors"
          description="Confidential — instructors cannot read these, by database policy, not just by screen."
          action={unread.length > 0 ? <Badge tone="warning">{unread.length} unread</Badge> : null}
        >
          {instructorReviews.data?.length ? (
            <ul className="space-y-3">
              {instructorReviews.data.map((review) => (
                <li
                  key={review.id}
                  className="rounded-lg border px-3 py-3"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        About{' '}
                        <Link href={`/admin/people/${review.instructor_id}`} className="underline">
                          {nameOf.get(review.instructor_id) ?? 'an instructor'}
                        </Link>{' '}
                        <Stars rating={review.rating} />
                      </p>
                      <p className="muted text-xs">
                        From {nameOf.get(review.client_id) ?? 'a member'} ·{' '}
                        {formatDateTime(review.created_at, club.timezone)}
                      </p>
                      {review.body && <p className="mt-2 text-sm">{review.body}</p>}
                    </div>
                    {!review.admin_read_at && <MarkReadButton reviewId={review.id} />}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No feedback yet.</EmptyState>
          )}
        </Card>

        <Card title="Public session reviews" description="Hide anything unsuitable — the record is kept either way.">
          {sessionReviews.data?.length ? (
            <ul className="space-y-3">
              {sessionReviews.data.map((review) => (
                <li
                  key={review.id}
                  className="rounded-lg border px-3 py-3"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {review.title || 'Session review'} <Stars rating={review.rating} />
                      </p>
                      <p className="muted text-xs">
                        {review.author_display_name} · {formatDateTime(review.created_at, club.timezone)}
                      </p>
                      {review.body && <p className="mt-2 text-sm">{review.body}</p>}
                      {review.hidden_reason && (
                        <p className="muted mt-1 text-xs">Hidden: {review.hidden_reason}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {review.is_published ? (
                        <Badge tone="success">Visible</Badge>
                      ) : (
                        <Badge tone="neutral">Hidden</Badge>
                      )}
                      <ModerateForm reviewId={review.id} isPublished={review.is_published} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No public reviews yet.</EmptyState>
          )}
        </Card>
      </div>
    </>
  )
}
