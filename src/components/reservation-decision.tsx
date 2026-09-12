'use client'

import { useState } from 'react'
import { decideReservationAction } from '@/lib/actions/reservations'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { adminButton } from '@/components/ui/button-class'

/**
 * Approve / decline for one request, in the admin palette.
 *
 * Approve is a single click. Decline always expands the reason field first and
 * cannot submit empty — the member is shown that text, so "declined, no
 * explanation" turns into a phone call to the club. The two-step shape is
 * deliberate and is kept identical on the instructor side.
 */
export function ReservationDecision({
  reservationId,
  clientName,
  allowComplete = false,
}: {
  reservationId: string
  clientName?: string
  allowComplete?: boolean
}) {
  const [declining, setDeclining] = useState(false)

  return (
    <ActionForm action={decideReservationAction} className="shrink-0">
      {({ fieldErrors }) => (
        <>
          <input type="hidden" name="reservationId" value={reservationId} />

          {declining ? (
            <div style={{ width: 420, maxWidth: '100%' }}>
              <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 800 }}>
                Reason for declining{clientName ? ` — ${clientName.split(' ')[0]} will see this` : ''}
              </p>
              <input
                name="reason"
                required
                maxLength={500}
                autoFocus
                placeholder="The session is full for this level…"
                className="a-input"
              />
              {fieldErrors.reason && <p className="field-error">{fieldErrors.reason}</p>}

              <div className="mt-2 flex gap-2">
                <SubmitButton
                  name="decision"
                  value="rejected"
                  className={adminButton('danger', 'sm')}
                  pendingLabel="…"
                >
                  Confirm decline
                </SubmitButton>
                <button
                  type="button"
                  className={adminButton('quiet', 'sm')}
                  onClick={() => setDeclining(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              <SubmitButton
                name="decision"
                value="approved"
                className={adminButton('primary', 'sm')}
                pendingLabel="…"
              >
                Approve
              </SubmitButton>
              <button type="button" className={adminButton('secondary', 'sm')} onClick={() => setDeclining(true)}>
                Decline
              </button>
              {allowComplete && (
                <>
                  <SubmitButton
                    name="decision"
                    value="completed"
                    className={adminButton('quiet', 'sm')}
                    pendingLabel="…"
                  >
                    Mark attended
                  </SubmitButton>
                  <SubmitButton
                    name="decision"
                    value="no_show"
                    className={adminButton('quiet', 'sm')}
                    pendingLabel="…"
                  >
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
