import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashInviteToken } from '@/lib/util/invites'
import { getClubSettings } from '@/lib/db/queries'
import { Alert } from '@/components/ui'
import { InviteForm } from './invite-form'

export const metadata: Metadata = { title: 'Create your account' }
export const dynamic = 'force-dynamic'

/**
 * The invite is looked up by the hash of the token, using the service role,
 * because an anonymous visitor has no read access to registration_invites.
 * Only the prefill fields are handed to the page — never the stored hash.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const decoded = decodeURIComponent(token)

  if (decoded.length < 20 || decoded.length > 200) notFound()

  const { data: invite } = await createAdminClient()
    .from('registration_invites')
    .select('role, email, phone, full_name, expires_at, used_at, revoked_at')
    .eq('token_hash', hashInviteToken(decoded))
    .maybeSingle()

  const club = await getClubSettings()

  const problem = !invite
    ? 'This registration link is not valid.'
    : invite.used_at
      ? 'This registration link has already been used.'
      : invite.revoked_at
        ? 'This registration link was cancelled by the club.'
        : new Date(invite.expires_at) <= new Date()
          ? 'This registration link has expired.'
          : null

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <p className="text-3xl" aria-hidden>🌊</p>
        <h1 className="mt-2 text-2xl font-semibold">Welcome to {club.club_name}</h1>
        <p className="muted mt-1 text-sm">Set a password to finish creating your account</p>
      </div>

      <div className="surface p-5">
        {problem ? (
          <Alert tone="error">
            {problem} Please ask the club for a fresh link.
          </Alert>
        ) : (
          <InviteForm
            token={decoded}
            prefill={{
              fullName: invite?.full_name ?? '',
              email: invite?.email ?? '',
              phone: invite?.phone ?? '',
            }}
            lockEmail={Boolean(invite?.email)}
          />
        )}
      </div>
    </div>
  )
}
