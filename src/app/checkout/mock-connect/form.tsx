'use client'

import { completeMockConnectAction } from './actions'
import { ActionForm, SubmitButton } from '@/components/ui/form'

export function MockConnectForm({ accountId, next }: { accountId: string; next: string }) {
  return (
    <ActionForm action={completeMockConnectAction}>
      {() => (
        <>
          <input type="hidden" name="accountId" value={accountId} />
          <input type="hidden" name="next" value={next} />
          <div className="flex flex-wrap gap-2">
            <SubmitButton name="outcome" value="approved" pendingLabel="Confirming…">
              Simulate full approval
            </SubmitButton>
            <SubmitButton variant="secondary" name="outcome" value="pending" pendingLabel="…">
              Simulate “details submitted, under review”
            </SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  )
}
