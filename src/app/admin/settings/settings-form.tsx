'use client'

import { saveClubSettingsAction } from '@/lib/actions/admin-catalog'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { Field, Input } from '@/components/ui'
import type { ClubSettings } from '@/lib/db/types'

export function SettingsForm({ settings }: { settings: ClubSettings }) {
  return (
    <ActionForm action={saveClubSettingsAction}>
      {({ fieldErrors }) => (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Club name" htmlFor="s-name" error={fieldErrors.clubName}>
              <Input id="s-name" name="clubName" defaultValue={settings.club_name} required maxLength={120} />
            </Field>

            <Field
              label="Time zone"
              htmlFor="s-tz"
              error={fieldErrors.timezone}
              hint="IANA name, e.g. Asia/Jerusalem. Every date on every screen uses this."
            >
              <Input id="s-tz" name="timezone" defaultValue={settings.timezone} required />
            </Field>

            <Field
              label="Currency"
              htmlFor="s-cur"
              error={fieldErrors.currency}
              hint="Three-letter code, e.g. ILS or EUR."
            >
              <Input id="s-cur" name="currency" defaultValue={settings.currency} required maxLength={3} />
            </Field>

            <Field label="Club phone" htmlFor="s-phone" error={fieldErrors.contactPhone}>
              <Input id="s-phone" name="contactPhone" type="tel" defaultValue={settings.contact_phone ?? ''} />
            </Field>

            <Field label="Spot name" htmlFor="s-spot" error={fieldErrors.spotName}>
              <Input id="s-spot" name="spotName" defaultValue={settings.spot_name} required maxLength={120} />
            </Field>

            <Field
              label="Change window (hours)"
              htmlFor="s-window"
              error={fieldErrors.cancellationWindowHours}
              hint="How close to the session a member may still change or cancel."
            >
              <Input
                id="s-window"
                name="cancellationWindowHours"
                type="number"
                min={0}
                max={168}
                defaultValue={settings.cancellation_window_hours}
                required
              />
            </Field>

            <Field
              label="Latitude"
              htmlFor="s-lat"
              error={fieldErrors.spotLatitude}
              hint="Used for the wave and wind forecast."
            >
              <Input id="s-lat" name="spotLatitude" type="number" step="0.00001" min={-90} max={90} defaultValue={settings.spot_latitude} required />
            </Field>

            <Field label="Longitude" htmlFor="s-lon" error={fieldErrors.spotLongitude}>
              <Input id="s-lon" name="spotLongitude" type="number" step="0.00001" min={-180} max={180} defaultValue={settings.spot_longitude} required />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="tipsEnabled" defaultChecked={settings.tips_enabled} />
            Members can tip their instructor from the app
          </label>

          <SubmitButton>Save settings</SubmitButton>
        </>
      )}
    </ActionForm>
  )
}
