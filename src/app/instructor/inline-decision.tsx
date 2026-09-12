'use client'

import { useState } from 'react'
import { decideReservationAction } from '@/lib/actions/reservations'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { instructorButton } from '@/components/ui/button-class'

/**
 * Approve is one tap. Decline always opens the reason field first and cannot
 * submit empty — the member sees that text, and "declined, no explanation"
 * turns into a phone call to the club.
 */
export function InlineDecision({ reservationId, name }: { reservationId: string; name?: string }) {
  const [declining, setDeclining] = useState(false)

  return (
    <ActionForm action={decideReservationAction}>
      {({ fieldErrors }) => (
        <>
          <input type="hidden" name="reservationId" value={reservationId} />

          {declining ? (
            <div className="flex flex-col gap-2">
              <p style={{ fontSize: 15, fontWeight: 800 }}>Why are you declining?</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ins-ink-2)', lineHeight: 1.45 }}>
                {name ? `${name.split(' ')[0]} sees` : 'The member sees'} this text, so a reason saves a
                phone call.
              </p>
              <input
                name="reason"
                required
                maxLength={500}
                autoFocus
                placeholder="Session is full for their level…"
                style={{
                  height: 46,
                  borderRadius: 14,
                  border: '1.5px solid var(--color-ins-line)',
                  padding: '0 14px',
                  fontSize: 14,
                  background: '#fff',
                }}
              />
              {fieldErrors.reason && <p className="field-error">{fieldErrors.reason}</p>}

              <SubmitButton
                name="decision"
                value="rejected"
                className={`${instructorButton('decline')} w-full`}
                pendingLabel="…"
              >
                Confirm decline
              </SubmitButton>
              <button
                type="button"
                onClick={() => setDeclining(false)}
                className={`${instructorButton('secondary')} w-full`}
              >
                Back
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <SubmitButton
                name="decision"
                value="approved"
                className={`${instructorButton('approve')} flex-1`}
                pendingLabel="…"
              >
                Approve
              </SubmitButton>
              <button
                type="button"
                onClick={() => setDeclining(true)}
                className={`${instructorButton('secondary')} flex-1`}
              >
                Decline
              </button>
            </div>
          )}
        </>
      )}
    </ActionForm>
  )
}
