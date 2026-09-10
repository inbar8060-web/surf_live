'use client'

import { markReviewReadAction, moderateReviewAction } from '@/lib/actions/reviews'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { Input } from '@/components/ui'

export function MarkReadButton({ reviewId }: { reviewId: string }) {
  return (
    <ActionForm action={markReviewReadAction}>
      {() => (
        <>
          <input type="hidden" name="reviewId" value={reviewId} />
          <SubmitButton variant="ghost" size="sm">
            Mark read
          </SubmitButton>
        </>
      )}
    </ActionForm>
  )
}

export function ModerateForm({ reviewId, isPublished }: { reviewId: string; isPublished: boolean }) {
  return (
    <ActionForm action={moderateReviewAction}>
      {() => (
        <div className="flex items-center gap-1.5">
          <input type="hidden" name="reviewId" value={reviewId} />
          <input type="hidden" name="isPublished" value={isPublished ? 'false' : 'true'} />
          {isPublished && (
            <Input name="hiddenReason" placeholder="Reason" maxLength={500} className="w-36" aria-label="Reason for hiding" />
          )}
          <SubmitButton variant={isPublished ? 'secondary' : 'primary'} size="sm">
            {isPublished ? 'Hide' : 'Publish'}
          </SubmitButton>
        </div>
      )}
    </ActionForm>
  )
}
