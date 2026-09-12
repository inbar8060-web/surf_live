'use client'

import { cancelPlanAction, changePlanAction } from '@/lib/actions/billing'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { adminButton } from '@/components/ui/button-class'

export function ChangePlanButton({ planKey, planName }: { planKey: string; planName: string }) {
  return (
    <ActionForm action={changePlanAction} className="space-y-2">
      {() => (
        <>
          <input type="hidden" name="planKey" value={planKey} />
          <SubmitButton className={`${adminButton('secondary', 'sm')} w-full`} pendingLabel="Changing…" confirm={`Move the club to ${planName}?`}>
            Switch to {planName}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  )
}

export function CancelPlanForm() {
  return (
    <ActionForm action={cancelPlanAction}>
      {({ fieldErrors }) => (
        <>
          <p className="a-helper" style={{ margin: 0 }}>
            The desk stays open until the end of the paid period; after that the club&rsquo;s address shows a holding page. Nothing is deleted.
          </p>
          <input name="confirm" className="a-input" placeholder="Type CANCEL to confirm" />
          {fieldErrors.confirm && <p className="field-error">{fieldErrors.confirm}</p>}
          <SubmitButton className={adminButton('danger', 'sm')} pendingLabel="Cancelling…">
            Cancel the plan
          </SubmitButton>
        </>
      )}
    </ActionForm>
  )
}
