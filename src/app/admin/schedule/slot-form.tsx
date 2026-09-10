'use client'

import { saveTimeSlotAction } from '@/lib/actions/admin-schedule'
import { ActionForm, SubmitButton, Disclosure } from '@/components/ui/form'
import { Field, Input, Select, Textarea } from '@/components/ui'

export interface ServiceOption {
  id: string
  name: string
  durationMinutes: number
  defaultCapacity: number
  categoryName: string
}

export interface InstructorOption {
  id: string
  name: string
}

/**
 * Times are typed in the club's local wall-clock and converted server-side
 * using the club timezone, so the same session reads correctly for staff
 * working from another country.
 */
export function SlotForm({
  services,
  instructors,
  timeZoneLabel,
}: {
  services: ServiceOption[]
  instructors: InstructorOption[]
  timeZoneLabel: string
}) {
  return (
    <Disclosure summary="Add a session to the calendar">
      <ActionForm action={saveTimeSlotAction} resetOnSuccess>
        {({ fieldErrors }) => (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Service" htmlFor="serviceId" error={fieldErrors.serviceId}>
                <Select id="serviceId" name="serviceId" required defaultValue="">
                  <option value="" disabled>
                    Choose a service
                  </option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.categoryName} — {service.name} ({service.durationMinutes} min)
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Capacity"
                htmlFor="capacity"
                error={fieldErrors.capacity}
                hint="How many places are on offer."
              >
                <Input id="capacity" name="capacity" type="number" min={1} max={100} defaultValue={6} required />
              </Field>

              <Field
                label="Starts"
                htmlFor="startsAt"
                error={fieldErrors.startsAt}
                hint={`Local time at the club (${timeZoneLabel}).`}
              >
                <Input id="startsAt" name="startsAt" type="datetime-local" required />
              </Field>

              <Field label="Ends" htmlFor="endsAt" error={fieldErrors.endsAt}>
                <Input id="endsAt" name="endsAt" type="datetime-local" required />
              </Field>

              <Field label="Location" htmlFor="location" error={fieldErrors.location}>
                <Input id="location" name="location" maxLength={200} placeholder="Main beach, north end" />
              </Field>

              <Field
                label="Price override"
                htmlFor="priceCentsOverride"
                error={fieldErrors.priceCentsOverride}
                hint="In minor units (e.g. 18000 = 180.00). Leave empty to use the service price."
              >
                <Input id="priceCentsOverride" name="priceCentsOverride" type="number" min={0} />
              </Field>
            </div>

            <Field
              label="Instructors"
              htmlFor="instructorIds"
              error={fieldErrors.instructorIds}
              hint="The first one selected leads the session. Hold ⌘/Ctrl to pick more than one."
            >
              <Select id="instructorIds" name="instructorIds" multiple size={Math.min(5, Math.max(3, instructors.length))}>
                {instructors.map((instructor) => (
                  <option key={instructor.id} value={instructor.id}>
                    {instructor.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="WhatsApp group link"
              htmlFor="whatsappGroupUrl"
              error={fieldErrors.whatsappGroupUrl}
              hint="Paste the chat.whatsapp.com invite so instructors can open the group in one tap."
            >
              <Input id="whatsappGroupUrl" name="whatsappGroupUrl" type="url" placeholder="https://chat.whatsapp.com/…" />
            </Field>

            <Field label="Notes for staff" htmlFor="notes" error={fieldErrors.notes}>
              <Textarea id="notes" name="notes" rows={2} maxLength={1000} />
            </Field>

            <SubmitButton pendingLabel="Saving…">Add session</SubmitButton>
          </>
        )}
      </ActionForm>
    </Disclosure>
  )
}
