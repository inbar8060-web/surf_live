'use client'

import { signInAction } from '@/lib/actions/auth'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { Field, Input } from '@/components/ui'

export function LoginForm({ next }: { next: string }) {
  return (
    <ActionForm action={signInAction}>
      {({ fieldErrors }) => (
        <>
          <input type="hidden" name="next" value={next} />

          <Field label="Email" htmlFor="email" error={fieldErrors.email}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              autoFocus
              spellCheck={false}
            />
          </Field>

          <Field label="Password" htmlFor="password" error={fieldErrors.password}>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </Field>

          <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
        </>
      )}
    </ActionForm>
  )
}
