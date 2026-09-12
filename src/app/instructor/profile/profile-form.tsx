'use client'

import { updateInstructorAction } from '@/lib/actions/admin-people'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { instructorButton } from '@/components/ui/button-class'
import type { ReadableInstructor } from '@/lib/db/columns'

const label = (text: string) => (
  <span
    className="mb-1.5 block"
    style={{
      fontSize: 11,
      fontWeight: 800,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--color-ins-ink-2)',
    }}
  >
    {text}
  </span>
)

const field: React.CSSProperties = {
  width: '100%',
  borderRadius: 14,
  border: '1.5px solid var(--color-ins-line)',
  padding: '11px 14px',
  fontSize: 14,
  fontWeight: 600,
  background: '#fff',
}

/**
 * An instructor may edit their own record. The action allows both an admin and
 * an instructor, then narrows by identity — an instructor posting another
 * instructor's id is refused server-side.
 */
export function ProfileForm({ instructor }: { instructor: ReadableInstructor }) {
  return (
    <ActionForm action={updateInstructorAction}>
      {({ fieldErrors }) => (
        <>
          <input type="hidden" name="profileId" value={instructor.profile_id} />

          <div>
            {label('WhatsApp number')}
            <input
              name="whatsappPhone"
              type="tel"
              defaultValue={instructor.whatsapp_phone ?? ''}
              placeholder="+972501234567"
              style={field}
            />
            <p style={{ margin: '5px 0 0', fontSize: 12, fontWeight: 600, color: 'var(--color-ins-ink-2)' }}>
              The number members are given for one-tap messages.
            </p>
            {fieldErrors.whatsappPhone && <p className="field-error">{fieldErrors.whatsappPhone}</p>}
          </div>

          <div>
            {label('Bio')}
            <textarea name="bio" rows={3} defaultValue={instructor.bio ?? ''} maxLength={2000} style={field} />
          </div>

          <div>
            {label('Specialities')}
            <input
              name="specialties"
              defaultValue={instructor.specialties.join(', ')}
              placeholder="Beginners, longboard"
              style={field}
            />
          </div>

          <div>
            {label('Languages')}
            <input
              name="languages"
              defaultValue={instructor.languages.join(', ')}
              placeholder="Hebrew, English"
              style={field}
            />
          </div>

          <input type="hidden" name="calendarColour" value={instructor.calendar_color} />

          <SubmitButton className={`${instructorButton('primary')} w-full`} pendingLabel="Saving…">
            Save changes
          </SubmitButton>
        </>
      )}
    </ActionForm>
  )
}
