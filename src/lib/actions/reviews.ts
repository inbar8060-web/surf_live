'use server'

import { revalidatePath } from 'next/cache'
import { createUserClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertRole } from '@/lib/auth/session'
import { recordAudit } from '@/lib/audit'
import { rateLimit } from '@/lib/util/rate-limit'
import {
  instructorReviewSchema,
  moderateReviewSchema,
  sessionReviewSchema,
} from '@/lib/validation/schemas'
import { assertSameOrigin, describeDbError, fail, fromZod, ok, type ActionResult } from './result'
import { bool, optionalStr, str } from './form'

const DENIED = 'You are not allowed to do that.'

/**
 * Private feedback about an instructor. Only administrators can ever read
 * these — the RLS policy on instructor_reviews grants SELECT to admins alone,
 * so the instructor being reviewed cannot see it even with a valid token.
 */
export async function submitInstructorReviewAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const user = await assertRole('client')
  if (!user) return fail(DENIED)

  const parsed = instructorReviewSchema.safeParse({
    instructorId: str(formData, 'instructorId'),
    reservationId: optionalStr(formData, 'reservationId'),
    rating: str(formData, 'rating'),
    body: optionalStr(formData, 'body'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  const limit = await rateLimit(`review:instructor:${user.id}`, 20, 24 * 3_600_000)
  if (!limit.ok) return fail('You have left a lot of feedback today. Please try again tomorrow.')

  const supabase = await createUserClient()
  const { error } = await supabase.from('instructor_reviews').insert({
    client_id: user.id,
    instructor_id: parsed.data.instructorId,
    reservation_id: parsed.data.reservationId || null,
    rating: parsed.data.rating,
    body: parsed.data.body || null,
  })

  if (error) return fail(describeDbError(error, 'Could not send that feedback.'))

  await recordAudit({
    actorId: user.id,
    actorRole: 'client',
    action: 'review.instructor_submitted',
    entity: 'instructor_review',
    entityId: parsed.data.instructorId,
    // The rating and text are deliberately not copied into the audit trail:
    // this feedback is confidential to the admin team.
  })

  revalidatePath('/client/bookings')
  revalidatePath('/admin/reviews')
  return ok(null, 'Thank you — your feedback goes to the club management only.')
}

/**
 * A review of the session itself, for the public wall. The database checks
 * that the client actually attended and stamps the display name, so neither
 * can be forged from here.
 */
export async function submitSessionReviewAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const user = await assertRole('client')
  if (!user) return fail(DENIED)

  const parsed = sessionReviewSchema.safeParse({
    slotId: str(formData, 'slotId'),
    rating: str(formData, 'rating'),
    title: optionalStr(formData, 'title'),
    body: optionalStr(formData, 'body'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  const limit = await rateLimit(`review:session:${user.id}`, 20, 24 * 3_600_000)
  if (!limit.ok) return fail('You have posted a lot of reviews today. Please try again tomorrow.')

  const supabase = await createUserClient()
  const { error } = await supabase.from('session_reviews').insert({
    slot_id: parsed.data.slotId,
    client_id: user.id,
    // Overwritten by the trigger; required by the column's NOT NULL.
    author_display_name: user.profile.full_name.split(' ')[0] ?? 'Surfer',
    rating: parsed.data.rating,
    title: parsed.data.title || null,
    body: parsed.data.body || null,
  })

  if (error) return fail(describeDbError(error, 'Could not post that review.'))

  await recordAudit({
    actorId: user.id,
    actorRole: 'client',
    action: 'review.session_posted',
    entity: 'session_review',
    entityId: parsed.data.slotId,
    after: { rating: parsed.data.rating },
  })

  revalidatePath('/client/reviews')
  revalidatePath('/admin/reviews')
  return ok(null, 'Posted. Thanks for sharing it with the other surfers.')
}

/** Take an abusive public review down without destroying the record. */
export async function moderateReviewAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const parsed = moderateReviewSchema.safeParse({
    reviewId: str(formData, 'reviewId'),
    isPublished: bool(formData, 'isPublished'),
    hiddenReason: optionalStr(formData, 'hiddenReason'),
  })
  if (!parsed.success) return fromZod(parsed.error)

  const { error } = await createAdminClient()
    .from('session_reviews')
    .update({
      is_published: parsed.data.isPublished,
      hidden_reason: parsed.data.isPublished ? null : parsed.data.hiddenReason || 'Hidden by the club',
    })
    .eq('id', parsed.data.reviewId)

  if (error) return fail(describeDbError(error, 'Could not update that review.'))

  await recordAudit({
    actorId: admin.id,
    actorRole: 'admin',
    action: parsed.data.isPublished ? 'review.published' : 'review.hidden',
    entity: 'session_review',
    entityId: parsed.data.reviewId,
    after: { reason: parsed.data.hiddenReason ?? null },
  })

  revalidatePath('/admin/reviews')
  revalidatePath('/client/reviews')
  return ok(null, parsed.data.isPublished ? 'Review is visible again.' : 'Review hidden.')
}

/** Mark private instructor feedback as read, so the admin queue clears. */
export async function markReviewReadAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  if (!(await assertSameOrigin())) return fail('Request blocked.')
  const admin = await assertRole('admin')
  if (!admin) return fail(DENIED)

  const reviewId = str(formData, 'reviewId')
  const { error } = await createAdminClient()
    .from('instructor_reviews')
    .update({ admin_read_at: new Date().toISOString() })
    .eq('id', reviewId)

  if (error) return fail(describeDbError(error, 'Could not update that item.'))

  revalidatePath('/admin/reviews')
  return ok(null, 'Marked as read.')
}
