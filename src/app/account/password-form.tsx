'use client'

import { changePasswordAction } from '@/lib/actions/auth'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { Field, Input } from '@/components/ui'

export function PasswordForm() {
  return (
    <ActionForm action={changePasswordAction} resetOnSuccess>
      {({ fieldErrors }) => (
        <>
          <Field label="Current password" htmlFor="currentPassword" error={fieldErrors.currentPassword}>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
            />
          </Field>

          <Field
            label="New password"
            htmlFor="newPassword"
            error={fieldErrors.newPassword}
            hint="At least 12 characters."
          >
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
            />
          </Field>

          <Field label="Confirm new password" htmlFor="confirmPassword" error={fieldErrors.confirmPassword}>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
            />
          </Field>

          <SubmitButton pendingLabel="Updating…">Change password</SubmitButton>
        </>
      )}
    </ActionForm>
  )
}
