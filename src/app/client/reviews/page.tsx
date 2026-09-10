import { createUserClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { Card, EmptyState, PageHeader } from '@/components/ui'
import { formatDateTime } from '@/lib/util/format'

export const metadata = { title: 'Reviews' }
export const dynamic = 'force-dynamic'

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} out of 5`}>
      {'★'.repeat(rating)}
      <span className="muted">{'★'.repeat(5 - rating)}</span>
    </span>
  )
}

/**
 * The public wall. Reviews are written from the "My sessions" screen, by
 * members who actually attended — the database enforces that, so nothing here
 * needs to check it.
 */
export default async function ClientReviewsPage() {
  await requireRole('client')
  const supabase = await createUserClient()
  const club = await getClubSettings()

  const { data: reviews } = await supabase
    .from('public_session_reviews')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  const average =
    reviews && reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null

  return (
    <>
      <PageHeader
        title="What members are saying"
        description={
          average
            ? `${average} out of 5 across ${reviews!.length} review(s). Leave your own from My sessions.`
            : 'Leave the first one from My sessions, after a lesson.'
        }
      />

      {reviews?.length ? (
        <div className="space-y-3">
          {reviews.map((review) => (
            <Card key={review.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {review.title || review.service_name} <Stars rating={review.rating} />
                  </p>
                  <p className="muted mt-0.5 text-xs">
                    {review.author_display_name} · {review.service_name} ·{' '}
                    {formatDateTime(review.session_starts_at, club.timezone)}
                  </p>
                  {review.body && <p className="mt-2 text-sm">{review.body}</p>}
                </div>
                <span className="muted shrink-0 text-xs">
                  {formatDateTime(review.created_at, club.timezone)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState>No reviews yet.</EmptyState>
      )}
    </>
  )
}
