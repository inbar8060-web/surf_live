'use client'

import { useState } from 'react'
import { requestReservationAction } from '@/lib/actions/reservations'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { buttonClass } from '@/components/ui/button-class'
import { Field, Input, Select, Textarea } from '@/components/ui'

export interface PackageOption {
  id: string
  label: string
}

/**
 * Ask for a place on a session.
 *
 * Note there is no price field: the server works the price out from the
 * session and the service, so nothing sent from this form can change what the
 * booking costs.
 */
export function BookForm({
  slotId,
  seatsLeft,
  packages,
}: {
  slotId: string
  seatsLeft: number
  packages: PackageOption[]
}) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button type="button" className={buttonClass('primary', 'sm')} onClick={() => setOpen(true)}>
        Request a place
      </button>
    )
  }

  return (
    <ActionForm action={requestReservationAction} className="w-full sm:w-80">
      {({ fieldErrors }) => (
        <>
          <input type="hidden" name="slotId" value={slotId} />

          <Field label="How many places?" htmlFor={`p-${slotId}`} error={fieldErrors.participants}>
            <Input
              id={`p-${slotId}`}
              name="participants"
              type="number"
              min={1}
              max={Math.max(1, seatsLeft)}
              defaultValue={1}
              required
            />
          </Field>

          {packages.length > 0 && (
            <Field
              label="Pay with"
              htmlFor={`pkg-${slotId}`}
              error={fieldErrors.clientPackageId}
              hint="Using a package spends one lesson when the booking is approved."
            >
              <Select id={`pkg-${slotId}`} name="clientPackageId" defaultValue="">
                <option value="">Pay for this session</option>
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="Anything we should know?" htmlFor={`n-${slotId}`} error={fieldErrors.clientNote}>
            <Textarea id={`n-${slotId}`} name="clientNote" rows={2} maxLength={1000} />
          </Field>

          <div className="flex gap-2">
            <SubmitButton size="sm" pendingLabel="Sending…">
              Send request
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
