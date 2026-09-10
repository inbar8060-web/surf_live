'use client'

import Link from 'next/link'
import { completeMockPaymentAction } from './actions'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { buttonClass } from '@/components/ui/button-class'

export function MockCheckoutForm({
  paymentId,
  amountCents,
  currency,
  next,
  cancel,
}: {
  paymentId: string
  amountCents: number
  currency: string
  next: string
  cancel: string
}) {
  const safeCancel = /^\/(?!\/)/.test(cancel) ? cancel : '/client/payments?status=cancelled'

  return (
    <ActionForm action={completeMockPaymentAction}>
      {() => (
        <>
          <input type="hidden" name="paymentId" value={paymentId} />
          <input type="hidden" name="amountCents" value={amountCents} />
          <input type="hidden" name="currency" value={currency} />
          <input type="hidden" name="next" value={next} />

          <div className="flex flex-wrap gap-2">
            <SubmitButton name="outcome" value="succeeded" pendingLabel="Confirming…">
              Simulate a successful payment
            </SubmitButton>
            <SubmitButton variant="secondary" name="outcome" value="failed" pendingLabel="…">
              Simulate a failure
            </SubmitButton>
            <Link href={safeCancel} className={buttonClass('ghost')}>
              Cancel
            </Link>
          </div>
        </>
      )}
    </ActionForm>
  )
}
