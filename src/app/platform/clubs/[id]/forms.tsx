'use client'

import { AdmLabel as Label } from '@/components/admin/pieces'
import { useState } from 'react'
import { refreshClubFromMapsAction, reissueAdminInviteAction, setClubStatusAction, updateClubAction } from '@/lib/actions/platform'
import { setPlatformFeeAction } from '@/lib/actions/billing'
import { ActionForm, CopyButton, SubmitButton } from '@/components/ui/form'
import { adminButton } from '@/components/ui/button-class'
import type { Club } from '@/lib/db/types'

export function EditClubForm({ club }: { club: Club }) {
  return (
    <ActionForm action={updateClubAction}>
      {({ fieldErrors }) => (
        <>
          <input type="hidden" name="clubId" value={club.id} />
          <div>
            <Label>Name</Label>
            <input name="name" defaultValue={club.name} required maxLength={120} className="a-input" />
            {fieldErrors.name && <p className="field-error">{fieldErrors.name}</p>}
          </div>
          <div>
            <Label>Google Maps link</Label>
            <input name="mapsUrl" type="url" required defaultValue={club.maps_url ?? ''} className="a-input" />
            {fieldErrors.mapsUrl && <p className="field-error">{fieldErrors.mapsUrl}</p>}
          </div>
          <div>
            <Label>Administrator email</Label>
            <input name="adminEmail" type="email" defaultValue={club.admin_email} required className="a-input" />
            <p className="a-helper" style={{ marginTop: 4 }}>
              Where administrator links are sent. Changing it does not change any account.
            </p>
            {fieldErrors.adminEmail && <p className="field-error">{fieldErrors.adminEmail}</p>}
          </div>
          <SubmitButton className={adminButton('primary', 'sm')}>Save</SubmitButton>
        </>
      )}
    </ActionForm>
  )
}

export function ReissueInviteForm({ clubId, adminEmail }: { clubId: string; adminEmail: string }) {
  const [link, setLink] = useState<string | null>(null)
  return (
    <ActionForm action={reissueAdminInviteAction} onSuccess={(data) => setLink(data.inviteUrl)}>
      {() => (
        <>
          <input type="hidden" name="clubId" value={clubId} />
          <p className="a-helper" style={{ margin: 0 }}>
            Goes to <strong>{adminEmail}</strong>.
          </p>
          {link && (
            <div className="a-card" style={{ padding: 12, background: 'var(--color-adm-amber-bg)', border: '1px solid var(--color-adm-amber-line)' }}>
              <code style={{ display: 'block', wordBreak: 'break-all', fontSize: 12, marginBottom: 8 }}>{link}</code>
              <CopyButton value={link} label="Copy link" />
            </div>
          )}
          <SubmitButton className={adminButton('secondary', 'sm')} pendingLabel="Issuing…">
            Issue a new link
          </SubmitButton>
        </>
      )}
    </ActionForm>
  )
}

export function StatusForm({ clubId, status }: { clubId: string; status: Club['status'] }) {
  if (status === 'archived') {
    return (
      <ActionForm action={setClubStatusAction}>
        {() => (
          <>
            <input type="hidden" name="clubId" value={clubId} />
            <input type="hidden" name="status" value="active" />
            <p className="a-helper" style={{ margin: 0 }}>
              Archived. The address answers nothing and no one can sign in; the data is kept as it was.
            </p>
            <SubmitButton className={adminButton('secondary', 'sm')} confirm="Bring this club back online?">
              Restore
            </SubmitButton>
          </>
        )}
      </ActionForm>
    )
  }

  return (
    <ActionForm action={setClubStatusAction}>
      {({ fieldErrors }) => (
        <>
          <input type="hidden" name="clubId" value={clubId} />
          <div>
            <Label>Reason</Label>
            <input name="reason" maxLength={500} className="a-input" placeholder="Kept on the record and shown to you here" />
            {fieldErrors.reason && <p className="field-error">{fieldErrors.reason}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {status === 'suspended' ? (
              <SubmitButton name="status" value="active" className={adminButton('primary', 'sm')}>
                Resume the club
              </SubmitButton>
            ) : (
              <SubmitButton
                name="status"
                value="suspended"
                className={adminButton('secondary', 'sm')}
                confirm="Pause this club? Members will see a holding page until it is resumed."
              >
                Pause
              </SubmitButton>
            )}
            <SubmitButton
              name="status"
              value="archived"
              className={adminButton('danger', 'sm')}
              confirm="Archive this club? Its address stops answering and no one can sign in. Nothing is deleted."
            >
              Archive
            </SubmitButton>
          </div>
          <p className="a-helper" style={{ margin: 0 }}>
            Pausing is reversible in one click. Archiving keeps every row but takes the club offline.
          </p>
        </>
      )}
    </ActionForm>
  )
}

export function RefreshListingForm({ clubId }: { clubId: string }) {
  return (
    <ActionForm action={refreshClubFromMapsAction} className="space-y-2">
      {() => (
        <>
          <input type="hidden" name="clubId" value={clubId} />
          <SubmitButton className={adminButton('secondary', 'sm')} pendingLabel="Reading…">
            Refresh from Google Maps
          </SubmitButton>
        </>
      )}
    </ActionForm>
  )
}

/** The platform's share of each member payment for this club, in percent. */
export function PlatformFeeForm({ clubId, feePercent, disabled }: { clubId: string; feePercent: number; disabled: boolean }) {
  return (
    <ActionForm action={setPlatformFeeAction} className="space-y-1">
      {({ fieldErrors }) => (
        <>
          <input type="hidden" name="clubId" value={clubId} />
          <div className="flex items-center gap-2">
            <input
              name="feePercent"
              type="number"
              step="0.1"
              min={0}
              max={30}
              defaultValue={feePercent}
              disabled={disabled}
              className="a-input"
              style={{ width: 90, height: 34 }}
              aria-label="Platform fee percent"
            />
            <span className="a-helper">% per payment</span>
            <SubmitButton className={adminButton('secondary', 'sm')} pendingLabel="…">
              Set
            </SubmitButton>
          </div>
          {fieldErrors.feePercent && <p className="field-error">{fieldErrors.feePercent}</p>}
          {disabled && (
            <p className="a-helper" style={{ margin: 0 }}>
              Set once the club has started connecting payouts.
            </p>
          )}
        </>
      )}
    </ActionForm>
  )
}
