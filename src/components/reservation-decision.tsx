'use client'

import { useState } from 'react'
import { decideReservationAction } from '@/lib/actions/reservations'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { buttonClass } from '@/components/ui/button-class'
import { Input } from '@/components/ui'

/**
 * Approve / decline controls for a single request.
 *
 * Declining asks for a reason before it will submit — the client sees that
 * text, and "declined, no explanation" generates a phone call to the club.
 */
export function ReservationDecision({
  reservationId,
  allowComplete = false,
}: {
  reservationId: string
  allowComplete?: boolean
}) {
  const [declining, setDeclining] = useState(false)

  return (
    <ActionForm action={decideReservationAction} className="space-y-2">
      {({ fieldErrors }) => (
        <>
          <input type="hidden" name="reservationId" value={reservationId} />

          {declining ? (
            <div className="space-y-2">
              <Input
                name="reason"
                placeholder="Why is this being declined?"
                aria-label="Reason for declining"
                required
                maxLength={500}
                autoFocus
              />
              {fieldErrors.reason && <p className="field-error">{fieldErrors.reason}</p>}
              <div className="flex gap-2">
                <SubmitButton variant="danger" size="sm" name="decision" value="rejected">
                  Confirm decline
                </SubmitButton>
                <button
                  type="button"
                  className={buttonClass('ghost', 'sm')}
                  onClick={() => setDeclining(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <SubmitButton size="sm" name="decision" value="approved">
                Approve
              </SubmitButton>
              <button
                type="button"
                className={buttonClass('secondary', 'sm')}
                onClick={() => setDeclining(true)}
              >
                Decline
              </button>
              {allowComplete && (
                <>
                  <SubmitButton variant="ghost" size="sm" name="decision" value="completed">
                    Mark attended
                  </SubmitButton>
                  <SubmitButton variant="ghost" size="sm" name="decision" value="no_show">
                    No show
                  </SubmitButton>
                </>
              )}
            </div>
          )}
        </>
      )}
    </ActionForm>
  )
}
