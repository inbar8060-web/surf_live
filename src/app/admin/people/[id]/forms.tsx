'use client'

import {
  updateClientAction,
  updateInstructorAction,
  updateProfileAction,
} from '@/lib/actions/admin-people'
import {
  cancelPackageAction,
  extendPackageAction,
  grantPackageAction,
} from '@/lib/actions/admin-packages'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { Field, Input, Select, Textarea } from '@/components/ui'
import type { AppRole, Profile } from '@/lib/db/types'
import type { ReadableClient, ReadableInstructor } from '@/lib/db/columns'

export function ProfileForm({ profile, isSelf }: { profile: Profile; isSelf: boolean }) {
  return (
    <ActionForm action={updateProfileAction}>
      {({ fieldErrors }) => (
        <>
          <input type="hidden" name="profileId" value={profile.id} />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" htmlFor="p-name" error={fieldErrors.fullName}>
              <Input id="p-name" name="fullName" defaultValue={profile.full_name} required maxLength={120} />
            </Field>
            <Field label="Email" htmlFor="p-email" error={fieldErrors.email}>
              <Input id="p-email" name="email" type="email" defaultValue={profile.email ?? ''} spellCheck={false} />
            </Field>
            <Field
              label="Mobile"
              htmlFor="p-phone"
              error={fieldErrors.phone}
              hint="International format — this powers the call and WhatsApp buttons."
            >
              <Input id="p-phone" name="phone" type="tel" defaultValue={profile.phone ?? ''} />
            </Field>
            <Field
              label="Role"
              htmlFor="p-role"
              error={fieldErrors.role}
              hint={isSelf ? 'Changing your own role can lock you out of this area.' : undefined}
            >
              <Select id="p-role" name="role" defaultValue={profile.role as AppRole}>
                <option value="client">Member</option>
                <option value="instructor">Instructor</option>
                <option value="admin">Administrator</option>
              </Select>
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={profile.is_active} disabled={isSelf} />
            Account is active
            {isSelf && <span className="muted text-xs">(you cannot disable your own)</span>}
          </label>

          <SubmitButton>Save details</SubmitButton>
        </>
      )}
    </ActionForm>
  )
}

export function ClientRecordForm({
  client,
  adminNotes,
}: {
  client: ReadableClient
  adminNotes: string
}) {
  return (
    <ActionForm action={updateClientAction}>
      {({ fieldErrors }) => (
        <>
          <input type="hidden" name="profileId" value={client.profile_id} />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Level" htmlFor="c-level" error={fieldErrors.level}>
              <Select id="c-level" name="level" defaultValue={client.level}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="pro">Pro</option>
              </Select>
            </Field>
            <Field label="Date of birth" htmlFor="c-dob" error={fieldErrors.birthDate}>
              <Input id="c-dob" name="birthDate" type="date" defaultValue={client.birth_date ?? ''} />
            </Field>
            <Field label="Emergency contact" htmlFor="c-ec" error={fieldErrors.emergencyContactName}>
              <Input id="c-ec" name="emergencyContactName" defaultValue={client.emergency_contact_name ?? ''} maxLength={120} />
            </Field>
            <Field label="Emergency phone" htmlFor="c-ep" error={fieldErrors.emergencyContactPhone}>
              <Input id="c-ep" name="emergencyContactPhone" type="tel" defaultValue={client.emergency_contact_phone ?? ''} />
            </Field>
          </div>

          <Field
            label="Medical notes"
            htmlFor="c-med"
            error={fieldErrors.medicalNotes}
            hint="Visible to the instructors who teach this member."
          >
            <Textarea id="c-med" name="medicalNotes" rows={2} defaultValue={client.medical_notes ?? ''} maxLength={2000} />
          </Field>

          <Field
            label="Internal notes"
            htmlFor="c-admin"
            error={fieldErrors.adminNotes}
            hint="Administrators only. Never shown to the member or to instructors."
          >
            <Textarea id="c-admin" name="adminNotes" rows={3} defaultValue={adminNotes} maxLength={4000} />
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="waiverSigned" defaultChecked={Boolean(client.waiver_signed_at)} />
            Waiver signed
          </label>

          <SubmitButton>Save member record</SubmitButton>
        </>
      )}
    </ActionForm>
  )
}

export function InstructorRecordForm({ instructor }: { instructor: ReadableInstructor }) {
  return (
    <ActionForm action={updateInstructorAction}>
      {({ fieldErrors }) => (
        <>
          <input type="hidden" name="profileId" value={instructor.profile_id} />

          <Field label="Bio" htmlFor="i-bio" error={fieldErrors.bio}>
            <Textarea id="i-bio" name="bio" rows={3} defaultValue={instructor.bio ?? ''} maxLength={2000} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Specialties"
              htmlFor="i-spec"
              error={fieldErrors.specialties}
              hint="Comma separated"
            >
              <Input id="i-spec" name="specialties" defaultValue={instructor.specialties.join(', ')} maxLength={400} />
            </Field>
            <Field label="Languages" htmlFor="i-lang" error={fieldErrors.languages} hint="Comma separated">
              <Input id="i-lang" name="languages" defaultValue={instructor.languages.join(', ')} maxLength={200} />
            </Field>
            <Field
              label="WhatsApp number"
              htmlFor="i-wa"
              error={fieldErrors.whatsappPhone}
              hint="The number members are given for one-tap messages."
            >
              <Input id="i-wa" name="whatsappPhone" type="tel" defaultValue={instructor.whatsapp_phone ?? ''} />
            </Field>
            <Field label="Calendar colour" htmlFor="i-col" error={fieldErrors.calendarColour}>
              <Input id="i-col" name="calendarColour" type="color" defaultValue={instructor.calendar_color} />
            </Field>
          </div>

          <SubmitButton>Save instructor profile</SubmitButton>
        </>
      )}
    </ActionForm>
  )
}

export function GrantPackageForm({
  clientId,
  templates,
}: {
  clientId: string
  templates: { id: string; name: string; lessons: number; price: string }[]
}) {
  return (
    <ActionForm action={grantPackageAction} resetOnSuccess>
      {({ fieldErrors }) => (
        <>
          <input type="hidden" name="clientId" value={clientId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Package" htmlFor="pk-tpl" error={fieldErrors.templateId}>
              <Select id="pk-tpl" name="templateId" required defaultValue="">
                <option value="" disabled>
                  Choose a package
                </option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.lessons} lessons, {t.price}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Note" htmlFor="pk-note" error={fieldErrors.note}>
              <Input id="pk-note" name="note" maxLength={500} placeholder="Paid in cash at the desk" />
            </Field>
          </div>
          <SubmitButton>Attach package</SubmitButton>
        </>
      )}
    </ActionForm>
  )
}

export function PackageControls({ packageId }: { packageId: string }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <ActionForm action={extendPackageAction}>
        {() => (
          <div className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="packageId" value={packageId} />
            <div>
              <label className="field-label" htmlFor={`ex-l-${packageId}`}>
                + lessons
              </label>
              <Input id={`ex-l-${packageId}`} name="extraLessons" type="number" min={0} max={200} defaultValue={0} className="w-20" />
            </div>
            <div>
              <label className="field-label" htmlFor={`ex-d-${packageId}`}>
                + days
              </label>
              <Input id={`ex-d-${packageId}`} name="extraDays" type="number" min={0} max={1095} defaultValue={0} className="w-20" />
            </div>
            <SubmitButton variant="secondary" size="sm">
              Extend
            </SubmitButton>
          </div>
        )}
      </ActionForm>

      <ActionForm action={cancelPackageAction}>
        {() => (
          <div className="flex items-end gap-2">
            <input type="hidden" name="packageId" value={packageId} />
            <div>
              <label className="field-label" htmlFor={`cx-${packageId}`}>
                Reason
              </label>
              <Input id={`cx-${packageId}`} name="reason" maxLength={500} required className="w-44" placeholder="Refunded" />
            </div>
            <SubmitButton
              variant="danger"
              size="sm"
              confirm="Cancel this package and write off the remaining lessons?"
            >
              Dismiss
            </SubmitButton>
          </div>
        )}
      </ActionForm>
    </div>
  )
}
