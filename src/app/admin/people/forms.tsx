'use client'

import { useState } from 'react'
import {
  createInviteAction,
  createUserAction,
  revokeInviteAction,
} from '@/lib/actions/admin-people'
import { ActionForm, CopyButton, SubmitButton, Disclosure } from '@/components/ui/form'
import { Alert, Field, Input, Select, Textarea } from '@/components/ui'

/**
 * Issue a registration link.
 *
 * The generated link is shown once, right here, and is not recoverable
 * afterwards — the database only keeps its hash. Generating another invite
 * always mints a brand new token.
 */
export function InviteForm() {
  const [issued, setIssued] = useState<{ url: string; expiresAt: string } | null>(null)

  return (
    <Disclosure summary="Send a registration link" defaultOpen>
      <ActionForm
        action={createInviteAction}
        resetOnSuccess
        onSuccess={(data) => setIssued(data)}
      >
        {({ fieldErrors }) => (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Role" htmlFor="inv-role" error={fieldErrors.role}>
                <Select id="inv-role" name="role" defaultValue="client">
                  <option value="client">Member</option>
                  <option value="instructor">Instructor</option>
                  <option value="admin">Administrator</option>
                </Select>
              </Field>

              <Field
                label="Valid for (hours)"
                htmlFor="inv-hours"
                error={fieldErrors.expiresInHours}
              >
                <Input id="inv-hours" name="expiresInHours" type="number" min={1} max={720} defaultValue={72} />
              </Field>

              <Field
                label="Email"
                htmlFor="inv-email"
                error={fieldErrors.email}
                hint="Optional. If set, only this address can redeem the link."
              >
                <Input id="inv-email" name="email" type="email" spellCheck={false} />
              </Field>

              <Field label="Name" htmlFor="inv-name" error={fieldErrors.fullName}>
                <Input id="inv-name" name="fullName" maxLength={120} />
              </Field>
            </div>

            <Field label="Note" htmlFor="inv-note" error={fieldErrors.note}>
              <Textarea id="inv-note" name="note" rows={2} maxLength={500} />
            </Field>

            <SubmitButton pendingLabel="Generating…">Generate link</SubmitButton>
          </>
        )}
      </ActionForm>

      {issued && (
        <div className="mt-3 space-y-2">
          <Alert tone="success">
            Copy this link now — for security it is never shown again. Expires{' '}
            {new Date(issued.expiresAt).toLocaleString()}.
          </Alert>
          <div className="flex flex-wrap items-center gap-2">
            <code
              className="flex-1 overflow-x-auto rounded-lg px-3 py-2 text-xs"
              style={{ background: 'var(--surface-muted)' }}
            >
              {issued.url}
            </code>
            <CopyButton value={issued.url} label="Copy link" />
          </div>
        </div>
      )}
    </Disclosure>
  )
}

/** Register a member on the spot, at the desk. */
export function CreateUserForm() {
  return (
    <Disclosure summary="Register someone directly">
      <ActionForm action={createUserAction} resetOnSuccess>
        {({ fieldErrors }) => (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Role" htmlFor="usr-role" error={fieldErrors.role}>
                <Select id="usr-role" name="role" defaultValue="client">
                  <option value="client">Member</option>
                  <option value="instructor">Instructor</option>
                  <option value="admin">Administrator</option>
                </Select>
              </Field>
              <Field label="Full name" htmlFor="usr-name" error={fieldErrors.fullName}>
                <Input id="usr-name" name="fullName" required maxLength={120} />
              </Field>
              <Field label="Email" htmlFor="usr-email" error={fieldErrors.email}>
                <Input id="usr-email" name="email" type="email" required spellCheck={false} />
              </Field>
              <Field
                label="Mobile"
                htmlFor="usr-phone"
                error={fieldErrors.phone}
                hint="International format, e.g. +972501234567"
              >
                <Input id="usr-phone" name="phone" type="tel" />
              </Field>
              <Field
                label="Temporary password"
                htmlFor="usr-pass"
                error={fieldErrors.password}
                hint="At least 12 characters. Ask them to change it after signing in."
              >
                <Input id="usr-pass" name="password" type="password" required minLength={12} />
              </Field>
              <Field label="Starting level" htmlFor="usr-level" error={fieldErrors.level}>
                <Select id="usr-level" name="level" defaultValue="beginner">
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="pro">Pro</option>
                </Select>
              </Field>
            </div>

            <SubmitButton pendingLabel="Creating…">Create account</SubmitButton>
          </>
        )}
      </ActionForm>
    </Disclosure>
  )
}

export function RevokeInviteButton({ inviteId }: { inviteId: string }) {
  return (
    <ActionForm action={revokeInviteAction}>
      {() => (
        <>
          <input type="hidden" name="inviteId" value={inviteId} />
          <SubmitButton variant="ghost" size="sm" confirm="Revoke this registration link?">
            Revoke
          </SubmitButton>
        </>
      )}
    </ActionForm>
  )
}
