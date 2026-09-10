import type { Metadata } from 'next'
import Link from 'next/link'
import { requireUser, homeFor } from '@/lib/auth/session'
import { Card, PageHeader } from '@/components/ui'
import { PasswordForm } from './password-form'

export const metadata: Metadata = { title: 'Your account' }

/**
 * Personal details are read-only for everyone but an administrator — the club
 * owns the client record. The password is the one thing a member changes here.
 */
export default async function AccountPage() {
  const user = await requireUser()
  const { profile } = user

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <PageHeader
        title="Your account"
        description="Your details are kept by the club. Ask a member of staff to change them."
        action={
          <Link href={homeFor(profile.role)} className="text-sm underline">
            Back
          </Link>
        }
      />

      <div className="space-y-4">
        <Card title="Details">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {[
              ['Name', profile.full_name],
              ['Email', user.email ?? '—'],
              ['Mobile', profile.phone ?? '—'],
              ['Role', profile.role],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="muted text-xs uppercase tracking-wide">{label}</dt>
                <dd className="mt-0.5">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card title="Change password" description="You will need your current password.">
          <PasswordForm />
        </Card>
      </div>
    </div>
  )
}
