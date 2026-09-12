import { redirect } from 'next/navigation'
import { requireClubRole } from '@/lib/auth/club-guard'
import { createUserClient } from '@/lib/supabase/server'
import { outstandingDocuments } from '@/lib/documents'
import { outstandingLegal } from '@/lib/legal'
import { MemberTabBar } from '@/components/ui/tab-bar'

/**
 * Member shell.
 *
 * A phone app rather than a responsive web page: the column is capped at
 * 430px and centred, navigation lives in a pinned bottom bar with the booking
 * action raised into the middle, and every screen leaves room for it.
 *
 * It also carries the registration gate. A member who has not signed the
 * waiver and the rental agreement cannot reach any member screen — the check
 * sits in the layout so it covers every route underneath, present and future,
 * rather than being repeated per page and forgotten on the next one.
 *
 * `/onboarding/*` and `/account` deliberately sit outside this layout, so
 * signing and signing-out stay reachable and there is no redirect loop.
 */
export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireClubRole('client')

  const supabase = await createUserClient()
  const [{ data: signed }, { data: accepted }] = await Promise.all([
    supabase.from('document_signatures').select('document_key, version').eq('client_id', user.id),
    supabase.from('legal_acceptances').select('document_key, version').eq('user_id', user.id),
  ])

  if (outstandingDocuments(signed ?? []).length > 0) {
    redirect('/onboarding/documents')
  }
  // the platform's own documents come after the club's two
  if (outstandingLegal('client', accepted ?? []).length > 0) {
    redirect('/onboarding/legal')
  }

  return (
    <div className="app-member min-h-screen">
      {/* 96px keeps the last card clear of the raised centre action */}
      <div className="mx-auto min-h-screen w-full max-w-[430px] pb-[96px]">{children}</div>
      <MemberTabBar />
    </div>
  )
}
