'use client'

import { useState } from 'react'
import { amendReservationAction, cancelReservationAction } from '@/lib/actions/reservations'
import { submitInstructorReviewAction, submitSessionReviewAction } from '@/lib/actions/reviews'
import { createTipCheckoutAction } from '@/lib/actions/tips'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { buttonClass } from '@/components/ui/button-class'
import { Field, Input, Select, Textarea } from '@/components/ui'

/**
 * Change an existing booking.
 *
 * Changing an approved booking sends it back for approval — that is enforced
 * in the database, and said plainly here so it is not a surprise.
 */
export function AmendForm({
  reservationId,
  participants,
  clientNote,
  isApproved,
}: {
  reservationId: string
  participants: number
  clientNote: string
  isApproved: boolean
}) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button type="button" className={buttonClass('secondary', 'sm')} onClick={() => setOpen(true)}>
        Change
      </button>
    )
  }

  return (
    <ActionForm action={amendReservationAction} className="w-full sm:w-72">
      {({ fieldErrors }) => (
        <>
          <input type="hidden" name="reservationId" value={reservationId} />

          {isApproved && (
            <p className="muted text-xs">
              This booking is approved. Changing it puts it back in the queue for approval.
            </p>
          )}

          <Field label="Places" htmlFor={`am-p-${reservationId}`} error={fieldErrors.participants}>
            <Input
              id={`am-p-${reservationId}`}
              name="participants"
              type="number"
              min={1}
              max={20}
              defaultValue={participants}
              required
            />
          </Field>

          <Field label="Note" htmlFor={`am-n-${reservationId}`} error={fieldErrors.clientNote}>
            <Textarea id={`am-n-${reservationId}`} name="clientNote" rows={2} defaultValue={clientNote} maxLength={1000} />
          </Field>

          <div className="flex gap-2">
            <SubmitButton size="sm">Save change</SubmitButton>
            <button type="button" className={buttonClass('ghost', 'sm')} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </>
      )}
    </ActionForm>
  )
}

export function CancelBookingButton({ reservationId }: { reservationId: string }) {
  return (
    <ActionForm action={cancelReservationAction}>
      {() => (
        <>
          <input type="hidden" name="reservationId" value={reservationId} />
          <SubmitButton variant="ghost" size="sm" confirm="Cancel this booking?">
            Cancel booking
          </SubmitButton>
        </>
      )}
    </ActionForm>
  )
}

function RatingSelect({ id, name = 'rating' }: { id: string; name?: string }) {
  return (
    <Select id={id} name={name} defaultValue="5" required>
      <option value="5">★★★★★ Excellent</option>
      <option value="4">★★★★ Good</option>
      <option value="3">★★★ Fine</option>
      <option value="2">★★ Not great</option>
      <option value="1">★ Poor</option>
    </Select>
  )
}

/** Public review of the session — everyone can read this one. */
export function SessionReviewForm({ slotId }: { slotId: string }) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button type="button" className={buttonClass('secondary', 'sm')} onClick={() => setOpen(true)}>
        Review the session
      </button>
    )
  }

  return (
    <ActionForm action={submitSessionReviewAction} className="w-full sm:w-80">
      {({ fieldErrors }) => (
        <>
          <input type="hidden" name="slotId" value={slotId} />
          <p className="muted text-xs">
            This one is public — other members can read it on the reviews wall.
          </p>

          <Field label="Rating" htmlFor={`sr-r-${slotId}`} error={fieldErrors.rating}>
            <RatingSelect id={`sr-r-${slotId}`} />
          </Field>

          <Field label="Title" htmlFor={`sr-t-${slotId}`} error={fieldErrors.title}>
            <Input id={`sr-t-${slotId}`} name="title" maxLength={120} placeholder="Great first lesson" />
          </Field>

          <Field label="Your review" htmlFor={`sr-b-${slotId}`} error={fieldErrors.body}>
            <Textarea id={`sr-b-${slotId}`} name="body" rows={3} maxLength={4000} />
          </Field>

          <div className="flex gap-2">
            <SubmitButton size="sm">Post review</SubmitButton>
            <button type="button" className={buttonClass('ghost', 'sm')} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </>
      )}
    </ActionForm>
  )
}

/** Private feedback about the instructor — read by the club only. */
export function InstructorReviewForm({
  instructorId,
  instructorName,
  reservationId,
}: {
  instructorId: string
  instructorName: string
  reservationId: string
}) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button type="button" className={buttonClass('ghost', 'sm')} onClick={() => setOpen(true)}>
        Feedback to the club
      </button>
    )
  }

  return (
    <ActionForm action={submitInstructorReviewAction} className="w-full sm:w-80">
      {({ fieldErrors }) => (
        <>
          <input type="hidden" name="instructorId" value={instructorId} />
          <input type="hidden" name="reservationId" value={reservationId} />
          <p className="muted text-xs">
            Private feedback about {instructorName}. Only the club management reads this — it is
            never shown to your instructor.
          </p>

          <Field label="Rating" htmlFor={`ir-r-${reservationId}`} error={fieldErrors.rating}>
            <RatingSelect id={`ir-r-${reservationId}`} />
          </Field>

          <Field label="What would you like the club to know?" htmlFor={`ir-b-${reservationId}`} error={fieldErrors.body}>
            <Textarea id={`ir-b-${reservationId}`} name="body" rows={3} maxLength={4000} />
          </Field>

          <div className="flex gap-2">
            <SubmitButton size="sm">Send privately</SubmitButton>
            <button type="button" className={buttonClass('ghost', 'sm')} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </>
      )}
    </ActionForm>
  )
}

/** Tip the instructor. Amounts are in minor units and re-checked server-side. */
export function TipForm({
  instructorId,
  instructorName,
  reservationId,
  currency,
}: {
  instructorId: string
  instructorName: string
  reservationId: string
  currency: string
}) {
  const [open, setOpen] = useState(false)
  const presets = [2000, 5000, 10000]

  if (!open) {
    return (
      <button type="button" className={buttonClass('secondary', 'sm')} onClick={() => setOpen(true)}>
        💙 Tip {instructorName.split(' ')[0]}
      </button>
    )
  }

  return (
    <ActionForm action={createTipCheckoutAction} className="w-full sm:w-72">
      {({ fieldErrors }) => (
        <>
          <input type="hidden" name="instructorId" value={instructorId} />
          <input type="hidden" name="reservationId" value={reservationId} />

          <Field
            label={`Amount (${currency}, minor units)`}
            htmlFor={`tip-${reservationId}`}
            error={fieldErrors.amountCents}
            hint={`e.g. ${presets.map((p) => p / 100).join(', ')}${'  '}→ enter ${presets.join(', ')}`}
          >
            <Input
              id={`tip-${reservationId}`}
              name="amountCents"
              type="number"
              min={500}
              max={100000}
              step={100}
              defaultValue={5000}
              required
            />
          </Field>

          <Field label="Message" htmlFor={`tipm-${reservationId}`} error={fieldErrors.message}>
            <Input id={`tipm-${reservationId}`} name="message" maxLength={300} placeholder="Thanks for the session!" />
          </Field>

          <div className="flex gap-2">
            <SubmitButton size="sm" pendingLabel="Opening checkout…">
              Continue to payment
            </SubmitButton>
            <button type="button" className={buttonClass('ghost', 'sm')} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </>
      )}
    </ActionForm>
  )
}
