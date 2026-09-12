'use client'

import { changePasswordAction } from '@/lib/actions/auth'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { instructorButton, memberButton } from '@/components/ui/button-class'

/**
 * The only self-service change a member is allowed. The current password is
 * re-verified server-side before a new one is accepted, so a stolen session
 * cannot quietly take over the account.
 */
export function PasswordForm({ tone = 'member' }: { tone?: 'member' | 'instructor' }) {
  const member = tone === 'member'

  const field: React.CSSProperties = {
    width: '100%',
    height: 48,
    borderRadius: member ? 15 : 14,
    border: member ? '2px solid #dbe3ea' : '1.5px solid #e0e0dd',
    padding: '0 14px',
    fontSize: 15,
    background: '#fff',
  }

  const label = (text: string) => (
    <span
      className="mb-1.5 block"
      style={{
        fontSize: 11,
        fontWeight: member ? 700 : 800,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: member ? '#5a6f7d' : 'var(--color-ins-ink-2)',
      }}
    >
      {text}
    </span>
  )

  return (
    <ActionForm action={changePasswordAction} resetOnSuccess>
      {({ fieldErrors }) => (
        <>
          <div>
            {label('Current password')}
            <input
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              style={field}
            />
            {fieldErrors.currentPassword && <p className="field-error">{fieldErrors.currentPassword}</p>}
          </div>

          <div>
            {label('New password')}
            <input
              name="newPassword"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              style={field}
            />
            <p
              className="mt-1"
              style={{ fontSize: 12, color: member ? '#5a6f7d' : 'var(--color-ins-ink-2)' }}
            >
              At least 12 characters. A short sentence works well.
            </p>
            {fieldErrors.newPassword && <p className="field-error">{fieldErrors.newPassword}</p>}
          </div>

          <div>
            {label('Confirm new password')}
            <input
              name="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              style={field}
            />
            {fieldErrors.confirmPassword && <p className="field-error">{fieldErrors.confirmPassword}</p>}
          </div>

          <SubmitButton
            className={`${member ? memberButton('primary', 'md') : instructorButton('primary', 'md')} w-full`}
            pendingLabel="Updating…"
          >
            Change password
          </SubmitButton>
        </>
      )}
    </ActionForm>
  )
}
