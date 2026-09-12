import { redirect } from 'next/navigation'
import { requireClubRole } from '@/lib/auth/club-guard'
import { createUserClient } from '@/lib/supabase/server'
import { getClubSettings } from '@/lib/db/queries'
import { homeFor } from '@/lib/auth/session'
import { outstandingLegal } from '@/lib/legal'
import { DocumentBody } from '@/components/document-body'
import { AcceptLegalForm } from './forms'

export const metadata = { title: 'Platform documents' }
export const dynamic = 'force-dynamic'

/**
 * The platform's documents, accepted once per version by every role on first
 * sign-in — after the club's own signing documents for a member. The full
 * text is on screen, one document after another, each with its own box.
 */
export default async function LegalOnboardingPage() {
  const { user } = await requireClubRole('admin', 'instructor', 'client')
  const club = await getClubSettings()

  const { data: accepted } = await (await createUserClient())
    .from('legal_acceptances')
    .select('document_key, version')
    .eq('user_id', user.id)
  const outstanding = outstandingLegal(user.profile.role, accepted ?? [])
  if (outstanding.length === 0) redirect(homeFor(user.profile.role))

  const staff = user.profile.role !== 'client'

  return (
    <div className={staff ? 'app-admin min-h-screen' : 'app-member min-h-screen'}>
      <div className="mx-auto max-w-[760px] px-5 py-10">
        <p className={staff ? 'a-label' : 'm-label'} style={{ color: staff ? 'var(--color-adm-ink-2)' : '#5a6f7d' }}>
          Surfer Live · {club.club_name}
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: '6px 0 0' }}>
          {outstanding.length === 1 ? 'One document to accept' : `${outstanding.length} documents to accept`}
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: staff ? 'var(--color-adm-ink-2)' : '#5a6f7d' }}>
          These are the platform&rsquo;s own terms — separate from the club&rsquo;s documents. Read each one and tick its box.
        </p>

        <div className="mt-6">
          <AcceptLegalForm
            documents={outstanding.map((doc) => ({
              key: doc.key,
              version: doc.version,
              title: doc.title,
              summary: doc.summary,
              consent: doc.consent,
              body: <DocumentBody blocks={doc.body({ clubName: club.club_name })} tone={staff ? 'plain' : 'member'} />,
            }))}
            staff={staff}
          />
        </div>
      </div>
    </div>
  )
}
