'use client'

import { acceptInviteAction } from '@/lib/actions/auth'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { Field, Input } from '@/components/ui'

export function InviteForm({
  token,
  prefill,
  lockEmail,
  role,
}: {
  token: string
  prefill: { fullName: string; email: string; phone: string }
  lockEmail: boolean
  role: string
}) {
  const documents = role === 'admin' ? ['terms', 'privacy', 'club_agreement'] : ['terms', 'privacy']
  const titles: Record<string, string> = {
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    club_agreement: 'Club Service Agreement',
  }
  return (
    <ActionForm action={acceptInviteAction}>
      {({ fieldErrors }) => (
        <>
          <input type="hidden" name="token" value={token} />

          <Field label="Full name" htmlFor="fullName" error={fieldErrors.fullName}>
            <Input id="fullName" name="fullName" defaultValue={prefill.fullName} required autoComplete="name" />
          </Field>

          <Field
            label="Email"
            htmlFor="email"
            error={fieldErrors.email}
            hint={lockEmail ? 'This invitation is tied to this address.' : undefined}
          >
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={prefill.email}
              readOnly={lockEmail}
              required
              autoComplete="username"
              spellCheck={false}
            />
          </Field>

          <Field
            label="Mobile"
            htmlFor="phone"
            error={fieldErrors.phone}
            hint="International format, e.g. +972501234567. Used for WhatsApp and calls."
          >
            <Input id="phone" name="phone" type="tel" defaultValue={prefill.phone} autoComplete="tel" />
          </Field>

          <Field
            label="Password"
            htmlFor="password"
            error={fieldErrors.password}
            hint="At least 12 characters. A short sentence works well."
          >
            <Input id="password" name="password" type="password" required autoComplete="new-password" minLength={12} />
          </Field>

          <Field label="Confirm password" htmlFor="confirmPassword" error={fieldErrors.confirmPassword}>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
            />
          </Field>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="acceptedTerms" className="mt-1" required />
            <span>
              {role === 'admin' ? (
                <>I am authorised to act for the club and I accept the </>
              ) : (
                <>I confirm I am fit to take part in water activities and I accept the </>
              )}
              {documents.map((key, i) => (
                <span key={key}>
                  {i > 0 && (i === documents.length - 1 ? ' and the ' : ', the ')}
                  <a href={`/legal/${key}`} target="_blank" rel="noreferrer" className="underline">
                    {titles[key]}
                  </a>
                </span>
              ))}
              .
            </span>
          </label>
          {fieldErrors.acceptedTerms && <p className="field-error">{fieldErrors.acceptedTerms}</p>}

          <SubmitButton pendingLabel="Creating your account…">Create account</SubmitButton>
        </>
      )}
    </ActionForm>
  )
}
