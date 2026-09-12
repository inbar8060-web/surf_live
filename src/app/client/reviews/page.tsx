import { Star } from 'lucide-react'
import { createUserClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { MemberHero } from '@/components/member/hero'
import { Empty } from '@/components/ui/bits'
import { formatDateTime } from '@/lib/util/format'

export const metadata = { title: 'Reviews' }
export const dynamic = 'force-dynamic'

function Stars({ rating, size = 14, color = '#0087c6' }: { rating: number; size?: number; color?: string }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          strokeWidth={2}
          style={{ color: n <= rating ? color : '#c9d8e2' }}
          fill={n <= rating ? color : 'none'}
        />
      ))}
    </span>
  )
}

/**
 * The public wall. Reviews are written from My sessions by members who
 * actually attended — the database enforces that, so nothing here checks it.
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

  const count = reviews?.length ?? 0
  const average = count > 0 ? reviews!.reduce((sum, r) => sum + r.rating, 0) / count : null

  return (
    <>
      <MemberHero waves={false}>
        <h1 className="display" style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          What members say
        </h1>

        <div
          className="mt-4 flex items-center gap-4"
          style={{ background: '#0b4a6d', borderRadius: 22, padding: '16px 18px' }}
        >
          <div>
            <p className="display" style={{ margin: 0, fontSize: 34, fontWeight: 700, lineHeight: 1 }}>
              {average === null ? '—' : average.toFixed(1)}
            </p>
          </div>
          <div className="min-w-0">
            <Stars rating={Math.round(average ?? 0)} size={16} color="#2cc4ff" />
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#b6e8ff' }}>
              {count === 0 ? 'No reviews yet' : `out of 5 across ${count} review${count === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>
      </MemberHero>

      <div className="flex flex-col gap-3 px-5 pt-4">
        {count > 0 ? (
          reviews!.map((review) => (
            <article key={review.id} className="m-card-sm" style={{ padding: '16px 18px' }}>
              <Stars rating={review.rating} />
              <h2 style={{ margin: '8px 0 0', fontSize: 16, fontWeight: 700 }}>
                {review.title || review.service_name}
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: '#5a6f7d' }}>
                {review.author_display_name} · {review.service_name} ·{' '}
                {formatDateTime(review.session_starts_at, club.timezone)}
              </p>
              {review.body && (
                <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.5 }}>{review.body}</p>
              )}
            </article>
          ))
        ) : (
          <Empty>No reviews yet.</Empty>
        )}

        <p
          className="text-center"
          style={{ background: '#def2ff', color: '#065a84', borderRadius: 16, padding: '12px 14px', fontSize: 13 }}
        >
          Leave your own from My sessions.
        </p>
      </div>
    </>
  )
}
