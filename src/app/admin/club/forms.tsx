'use client'

import { saveClubSettingsAction } from '@/lib/actions/admin-catalog'
import { markReviewReadAction, moderateReviewAction } from '@/lib/actions/reviews'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { adminButton } from '@/components/ui/button-class'
import { Help } from '@/components/ui/help'
import type { ClubSettings } from '@/lib/db/types'

function Label({
  children,
  help,
  helpTitle,
}: {
  children: React.ReactNode
  help?: React.ReactNode
  helpTitle?: string
}) {
  return (
    <span className="a-label mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--color-adm-ink-2)' }}>
      {children}
      {help && <Help title={helpTitle ?? String(children)}>{help}</Help>}
    </span>
  )
}

export function SettingsForm({ settings }: { settings: ClubSettings }) {
  return (
    <ActionForm action={saveClubSettingsAction}>
      {({ fieldErrors }) => (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Club name</Label>
              <input name="clubName" defaultValue={settings.club_name} required maxLength={120} className="a-input" />
              {fieldErrors.clubName && <p className="field-error">{fieldErrors.clubName}</p>}
            </div>

            <div>
              <Label>Club phone</Label>
              <input name="contactPhone" type="tel" defaultValue={settings.contact_phone ?? ''} className="a-input" />
              {fieldErrors.contactPhone && <p className="field-error">{fieldErrors.contactPhone}</p>}
            </div>

            <div>
              <Label
                helpTitle="Sets the club's clock"
                help="Every date and time on every screen is shown in this zone, and session times are stored against it."
              >
                Time zone
              </Label>
              <input name="timezone" defaultValue={settings.timezone} required className="a-input" />
              <p className="a-helper" style={{ marginTop: 4 }}>
                IANA name, e.g. Asia/Jerusalem.
              </p>
              {fieldErrors.timezone && <p className="field-error">{fieldErrors.timezone}</p>}
            </div>

            <div>
              <Label
                helpTitle="Changes how prices are shown"
                help="It does not convert anything. Amounts already recorded keep the number they were stored with."
              >
                Currency
              </Label>
              <input name="currency" defaultValue={settings.currency} required maxLength={3} className="a-input" />
              <p className="a-helper" style={{ marginTop: 4 }}>
                Three-letter code, e.g. ILS or EUR.
              </p>
              {fieldErrors.currency && <p className="field-error">{fieldErrors.currency}</p>}
            </div>

            <div>
              <Label
                helpTitle="Where signed documents are sent"
                help="Every waiver and rental agreement a member signs is emailed here as well as to them. Leave it empty and the copy goes to every active administrator instead."
              >
                Club inbox
              </Label>
              <input
                name="contactEmail"
                type="email"
                defaultValue={settings.contact_email ?? ''}
                spellCheck={false}
                className="a-input"
              />
              {fieldErrors.contactEmail && <p className="field-error">{fieldErrors.contactEmail}</p>}
            </div>

            <div>
              <Label>Spot name</Label>
              <input name="spotName" defaultValue={settings.spot_name} required maxLength={120} className="a-input" />
            </div>

            <div>
              <Label
                helpTitle="How late a member may change a booking"
                help="Inside this window the change and cancel buttons are replaced with a line telling them to call the club. The database enforces it too."
              >
                Change window (hours)
              </Label>
              <input
                name="cancellationWindowHours"
                type="number"
                min={0}
                max={168}
                defaultValue={settings.cancellation_window_hours}
                required
                className="a-input"
              />
            </div>

            <div>
              <Label>Latitude</Label>
              <input
                name="spotLatitude"
                type="number"
                step="0.00001"
                min={-90}
                max={90}
                defaultValue={settings.spot_latitude}
                required
                className="a-input"
              />
            </div>

            <div>
              <Label
                helpTitle="Where the forecast comes from"
                help="These coordinates are sent to the marine forecast service to produce the wave and wind figures every role sees."
              >
                Longitude
              </Label>
              <input
                name="spotLongitude"
                type="number"
                step="0.00001"
                min={-180}
                max={180}
                defaultValue={settings.spot_longitude}
                required
                className="a-input"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label
                helpTitle="Shown on the club's public page"
                help="Filled from the club's Google Maps listing when the club was added. Correct it here if the listing is wrong; the change is yours and is not overwritten."
              >
                Street address
              </Label>
              <input name="address" defaultValue={settings.address ?? ''} maxLength={300} className="a-input" />
              {fieldErrors.address && <p className="field-error">{fieldErrors.address}</p>}
            </div>
            <div>
              <Label>Website</Label>
              <input name="website" type="url" defaultValue={settings.website ?? ''} maxLength={300} className="a-input" placeholder="https://" />
              {fieldErrors.website && <p className="field-error">{fieldErrors.website}</p>}
            </div>
            <div>
              <Label helpTitle="One line per day" help="Written exactly as visitors should read it, e.g. “Monday: 8:00 – 18:00”. Leave empty to show nothing.">
                Opening hours
              </Label>
              <textarea
                name="openingHours"
                defaultValue={settings.opening_hours.join('\n')}
                rows={7}
                maxLength={1000}
                className="a-input"
                style={{ height: 'auto', padding: 10, resize: 'vertical', fontSize: 12 }}
              />
              {fieldErrors.openingHours && <p className="field-error">{fieldErrors.openingHours}</p>}
            </div>
          </div>

          <label
            className="flex items-start gap-2.5"
            style={{ background: 'var(--color-adm-ground)', borderRadius: 11, padding: '12px 14px' }}
          >
            <input type="checkbox" name="tipsEnabled" defaultChecked={settings.tips_enabled} style={{ marginTop: 3 }} />
            <span>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 800 }}>
                Members can tip their instructor
              </span>
              <span className="a-helper">
                Turning this off hides the tip button everywhere; tips already paid are unaffected.
              </span>
            </span>
          </label>

          <SubmitButton className={adminButton('primary')} pendingLabel="Saving…">
            Save settings
          </SubmitButton>
        </>
      )}
    </ActionForm>
  )
}

export function MarkReadButton({ reviewId }: { reviewId: string }) {
  return (
    <ActionForm action={markReviewReadAction}>
      {() => (
        <>
          <input type="hidden" name="reviewId" value={reviewId} />
          <SubmitButton className={adminButton('secondary', 'sm')} pendingLabel="…">
            Mark as read
          </SubmitButton>
        </>
      )}
    </ActionForm>
  )
}

export function ModerateForm({ reviewId, isPublished }: { reviewId: string; isPublished: boolean }) {
  return (
    <ActionForm action={moderateReviewAction}>
      {() => (
        <div className="flex flex-wrap items-center gap-1.5">
          <input type="hidden" name="reviewId" value={reviewId} />
          <input type="hidden" name="isPublished" value={isPublished ? 'false' : 'true'} />
          {isPublished && (
            <input
              name="hiddenReason"
              placeholder="Reason"
              maxLength={500}
              aria-label="Reason for hiding"
              className="a-input"
              style={{ width: 150, height: 35 }}
            />
          )}
          <SubmitButton
            className={isPublished ? adminButton('secondary', 'sm') : adminButton('primary', 'sm')}
            pendingLabel="…"
          >
            {isPublished ? 'Hide' : 'Leave it up'}
          </SubmitButton>
        </div>
      )}
    </ActionForm>
  )
}
