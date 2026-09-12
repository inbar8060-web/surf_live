import { redirect } from 'next/navigation'
import { requireClubRole } from '@/lib/auth/club-guard'
import { createUserClient } from '@/lib/supabase/server'
import { getClubSettings } from '@/lib/db/queries'
import { getClubOnboarding } from '@/lib/billing/onboarding'
import { outstandingLegal } from '@/lib/legal'
import { AdminShell } from '@/components/admin/shell'

/**
 * Admin shell. Desktop gets the dark category bar; under 768px the same
 * palette collapses to a floating pill and a More sheet.
 *
 * The guard is unchanged: `requireRole('admin')` runs before any child
 * renders, every Server Action re-checks the caller, and RLS is still the
 * thing that actually decides what comes back.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, club: tenant } = await requireClubRole('admin')

  // The desk opens only for a club that has chosen and paid for a plan and
  // connected its payout account, and for an administrator who has accepted
  // the platform's documents. The onboarding routes sit outside this layout.
  const supabase = await createUserClient()
  const [onboarding, { data: accepted }, club] = await Promise.all([
    getClubOnboarding(tenant.id),
    supabase.from('legal_acceptances').select('document_key, version').eq('user_id', user.id),
    getClubSettings(),
  ])
  if (outstandingLegal('admin', accepted ?? []).length > 0) redirect('/onboarding/legal')
  if (onboarding.step === 'plan') redirect('/onboarding/plan')
  if (onboarding.step === 'payouts') redirect('/onboarding/payouts')

  return (
    <AdminShell clubName={club.club_name} userName={user.profile.full_name}>
      {children}
    </AdminShell>
  )
}
