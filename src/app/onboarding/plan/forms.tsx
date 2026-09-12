'use client'

import { startPlanCheckoutAction } from '@/lib/actions/billing'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { adminButton } from '@/components/ui/button-class'

export function ChoosePlanButton({ planKey, planName, highlight }: { planKey: string; planName: string; highlight: boolean }) {
  return (
    <ActionForm action={startPlanCheckoutAction} className="space-y-2">
      {() => (
        <>
          <input type="hidden" name="planKey" value={planKey} />
          <SubmitButton className={`${adminButton(highlight ? 'primary' : 'secondary')} w-full`} pendingLabel="Opening checkout…">
            Choose {planName}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  )
}
