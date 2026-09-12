'use client'

import { useState } from 'react'
import { createInviteAction, createUserAction, revokeInviteAction } from '@/lib/actions/admin-people'
import { ActionForm, CopyButton, SubmitButton } from '@/components/ui/form'
import { adminButton } from '@/components/ui/button-class'
import { Alert } from '@/components/ui'

const label = (text: string) => (
  <span className="a-label mb-1.5 block" style={{ color: 'var(--color-adm-ink-2)' }}>
    {text}
  </span>
)

/**
 * Issue a registration link.
 *
 * A fresh 256-bit token is minted on every call and shown here exactly once —
 * only its SHA-256 is stored, so it cannot be recovered afterwards and a
 * database leak yields no usable links.
 */
export function InviteForm() {
  const [issued, setIssued] = useState<{ url: string; expiresAt: string } | null>(null)

  return (
    <>
      <ActionForm action={createInviteAction} resetOnSuccess onSuccess={(data) => setIssued(data)}>
        {({ fieldErrors }) => (
          <>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div>
                {label('Role')}
                <select name="role" defaultValue="client" className="a-input">
                  <option value="client">Member</option>
                  <option value="instructor">Instructor</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div>
                {label('Valid for (hours)')}
                <input name="expiresInHours" type="number" min={1} max={720} defaultValue={72} className="a-input" />
              </div>
              <div>
                {label('Email')}
                <input name="email" type="email" spellCheck={false} className="a-input" />
                <p className="a-helper" style={{ marginTop: 4 }}>
                  Optional. If set, only this address can redeem the link.
                </p>
                {fieldErrors.email && <p className="field-error">{fieldErrors.email}</p>}
              </div>
              <div>
                {label('Name')}
                <input name="fullName" maxLength={120} className="a-input" />
              </div>
            </div>

            <SubmitButton className={adminButton('primary')} pendingLabel="Generating…">
              Generate link
            </SubmitButton>
          </>
        )}
      </ActionForm>

      {issued && (
        <div className="mt-3 flex flex-col gap-2">
          <Alert tone="success">
            Copy this link now — for security it is never shown again. Expires{' '}
            {new Date(issued.expiresAt).toLocaleString()}.
          </Alert>
          <div className="flex flex-wrap items-center gap-2">
            <code
              className="flex-1 overflow-x-auto"
              style={{ background: 'var(--color-adm-ground)', borderRadius: 9, padding: '9px 11px', fontSize: 12 }}
            >
              {issued.url}
            </code>
            <CopyButton value={issued.url} label="Copy link" />
          </div>
        </div>
      )}
    </>
  )
}

/** Register someone at the desk. */
export function CreateUserForm() {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button type="button" className={adminButton('secondary')} onClick={() => setOpen(true)}>
        Register someone
      </button>
    )
  }

  return (
    <div className="a-card w-full" style={{ padding: '16px 18px' }}>
      <div className="mb-3 flex items-center justify-between">
        <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Register someone</h3>
        <button type="button" className={adminButton('quiet', 'sm')} onClick={() => setOpen(false)}>
          Close
        </button>
      </div>

      <ActionForm action={createUserAction} resetOnSuccess>
        {({ fieldErrors }) => (
          <>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div>
                {label('Role')}
                <select name="role" defaultValue="client" className="a-input">
                  <option value="client">Member</option>
                  <option value="instructor">Instructor</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div>
                {label('Full name')}
                <input name="fullName" required maxLength={120} className="a-input" />
                {fieldErrors.fullName && <p className="field-error">{fieldErrors.fullName}</p>}
              </div>
              <div>
                {label('Email')}
                <input name="email" type="email" required spellCheck={false} className="a-input" />
                {fieldErrors.email && <p className="field-error">{fieldErrors.email}</p>}
              </div>
              <div>
                {label('Mobile')}
                <input name="phone" type="tel" className="a-input" placeholder="+972501234567" />
                {fieldErrors.phone && <p className="field-error">{fieldErrors.phone}</p>}
              </div>
              <div>
                {label('Temporary password')}
                <input name="password" type="password" required minLength={12} className="a-input" />
                <p className="a-helper" style={{ marginTop: 4 }}>
                  At least 12 characters. Ask them to change it after signing in.
                </p>
                {fieldErrors.password && <p className="field-error">{fieldErrors.password}</p>}
              </div>
              <div>
                {label('Starting level')}
                <select name="level" defaultValue="beginner" className="a-input">
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="pro">Pro</option>
                </select>
              </div>
            </div>

            <SubmitButton className={adminButton('primary')} pendingLabel="Creating…">
              Create account
            </SubmitButton>
          </>
        )}
      </ActionForm>
    </div>
  )
}

export function RevokeInviteButton({ inviteId }: { inviteId: string }) {
  return (
    <ActionForm action={revokeInviteAction}>
      {() => (
        <>
          <input type="hidden" name="inviteId" value={inviteId} />
          <SubmitButton
            className={adminButton('quiet', 'sm')}
            confirm="Revoke this registration link?"
            pendingLabel="…"
          >
            Revoke
          </SubmitButton>
        </>
      )}
    </ActionForm>
  )
}
