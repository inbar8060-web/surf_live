'use client'

import { AdmLabel as Label } from '@/components/admin/pieces'
import { saveTimeSlotAction } from '@/lib/actions/admin-schedule'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { adminButton } from '@/components/ui/button-class'

export interface ServiceOption {
  id: string
  name: string
  durationMinutes: number
  defaultCapacity: number
  categoryName: string
  price: string
}

export interface InstructorOption {
  id: string
  name: string
}

/**
 * Create a session.
 *
 * Times are typed as the club's wall clock and converted server-side using
 * `club_settings.timezone`, so the same session reads correctly for staff
 * working from another country — and on Vercel, where the server is UTC.
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
    <ActionForm action={saveTimeSlotAction} resetOnSuccess>
      {({ fieldErrors }) => (
        <>
          <div>
            <Label>Service</Label>
            <select name="serviceId" required defaultValue="" className="a-input">
              <option value="" disabled>
                Choose a service
              </option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.categoryName} — {service.name} · {service.durationMinutes} min · {service.price}
                </option>
              ))}
            </select>
            {fieldErrors.serviceId && <p className="field-error">{fieldErrors.serviceId}</p>}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <Label>Starts</Label>
              <input name="startsAt" type="datetime-local" required className="a-input" />
              {fieldErrors.startsAt && <p className="field-error">{fieldErrors.startsAt}</p>}
            </div>
            <div>
              <Label>Ends</Label>
              <input name="endsAt" type="datetime-local" required className="a-input" />
              {fieldErrors.endsAt && <p className="field-error">{fieldErrors.endsAt}</p>}
            </div>
          </div>
          <p className="a-helper" style={{ marginTop: -6 }}>
            Local time at the club ({timeZoneLabel}).
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <Label>Capacity</Label>
              <input name="capacity" type="number" min={1} max={100} defaultValue={6} required className="a-input" />
              {fieldErrors.capacity && <p className="field-error">{fieldErrors.capacity}</p>}
            </div>
            <div>
              <Label
                helpTitle="Overrides the service price"
                help="Only for this one session. In minor units — 18000 means 180.00. Leave it empty to use the service's own price."
              >
                Price override
              </Label>
              <input name="priceCentsOverride" type="number" min={0} className="a-input" placeholder="—" />
            </div>
          </div>

          <div>
            <Label>Location</Label>
            <input name="location" maxLength={200} placeholder="Main beach, north end" className="a-input" />
          </div>

          <div>
            <Label>Instructors</Label>
            <select
              name="instructorIds"
              multiple
              size={Math.min(5, Math.max(3, instructors.length))}
              className="a-input"
              style={{ height: 'auto', paddingBlock: 8 }}
            >
              {instructors.map((instructor) => (
                <option key={instructor.id} value={instructor.id}>
                  {instructor.name}
                </option>
              ))}
            </select>
            <p className="a-helper" style={{ marginTop: 5 }}>
              Only an assigned instructor can approve requests for this session. The first one selected
              leads it.
            </p>
          </div>

          <div>
            <Label>WhatsApp group link</Label>
            <input
              name="whatsappGroupUrl"
              type="url"
              placeholder="https://chat.whatsapp.com/…"
              className="a-input"
            />
            <p className="a-helper" style={{ marginTop: 5 }}>
              Lets instructors open the session group in one tap.
            </p>
            {fieldErrors.whatsappGroupUrl && <p className="field-error">{fieldErrors.whatsappGroupUrl}</p>}
          </div>

          <div>
            <Label>Staff note</Label>
            <textarea name="notes" rows={2} maxLength={1000} className="a-input" style={{ height: 'auto', paddingBlock: 9 }} />
            <p className="a-helper" style={{ marginTop: 5 }}>
              Not shown to members.
            </p>
          </div>

          <SubmitButton className={`${adminButton('primary')} w-full`} pendingLabel="Creating…">
            Create session
          </SubmitButton>
        </>
      )}
    </ActionForm>
  )
}
