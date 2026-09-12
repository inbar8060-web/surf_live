import { redirect } from 'next/navigation'
import { requireClubRole } from '@/lib/auth/club-guard'
import { createUserClient } from '@/lib/supabase/server'
import { outstandingLegal } from '@/lib/legal'
import { InstructorTabBar } from '@/components/ui/tab-bar'

/**
 * Instructor shell.
 *
 * Deliberately the quietest of the three: warm grey ground, no card borders,
 * no shadows, one accent colour. It is read on a beach in bright sun, so
 * contrast and type weight do the work that colour does elsewhere.
 *
 * The bottom bar has no chrome of its own — it sits straight on the page
 * ground, which keeps the screen from gaining a second horizon line.
 */
export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireClubRole('instructor')

  // First sign-in: the instructor agreement, terms and privacy policy.
  const { data: accepted } = await (await createUserClient())
    .from('legal_acceptances')
    .select('document_key, version')
    .eq('user_id', user.id)
  if (outstandingLegal('instructor', accepted ?? []).length > 0) redirect('/onboarding/legal')

  return (
    <div className="app-instructor min-h-screen">
      <div className="mx-auto min-h-screen w-full max-w-[430px] pb-[92px]">{children}</div>
      <InstructorTabBar />
    </div>
  )
}
