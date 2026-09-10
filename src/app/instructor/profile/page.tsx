import Link from 'next/link'
import { createUserClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { getClubSettings } from '@/lib/db/queries'
import { INSTRUCTOR_COLUMNS } from '@/lib/db/columns'
import { Card, EmptyState, PageHeader } from '@/components/ui'
import { InstructorRecordForm } from '@/app/admin/people/[id]/forms'
import { formatDateTime, formatMoney } from '@/lib/util/format'

export const metadata = { title: 'My profile' }
export const dynamic = 'force-dynamic'

export default async function InstructorProfilePage() {
  const user = await requireRole('instructor')
  const supabase = await createUserClient()
  const club = await getClubSettings()

  const [instructorRes, tipsRes] = await Promise.all([
    supabase.from('instructors').select(INSTRUCTOR_COLUMNS).eq('profile_id', user.id).maybeSingle(),
    supabase.from('tips').select('*').eq('instructor_id', user.id).order('created_at', { ascending: false }).limit(25),
  ])

  const tips = tipsRes.data ?? []
  const total = tips.reduce((sum, tip) => sum + tip.amount_cents, 0)

  return (
    <>
      <PageHeader
        title="My profile"
        description="Members see your bio and message you on the number below."
        action={
          <Link href="/account" className="text-sm underline">
            Change password
          </Link>
        }
      />

      <div className="space-y-4">
        <Card title="Your details">
          {instructorRes.data ? (
            <InstructorRecordForm instructor={instructorRes.data} />
          ) : (
            <EmptyState>Your instructor record is missing — ask an administrator to set it up.</EmptyState>
          )}
        </Card>

        <Card
          title="Tips received"
          description={tips.length ? `${formatMoney(total, club.currency)} across ${tips.length} tip(s).` : undefined}
        >
          {tips.length ? (
            <ul className="space-y-2 text-sm">
              {tips.map((tip) => (
                <li key={tip.id} className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium tabular-nums">
                      {formatMoney(tip.amount_cents, tip.currency)}
                    </p>
                    {tip.message && <p className="muted">“{tip.message}”</p>}
                  </div>
                  <span className="muted text-xs">{formatDateTime(tip.created_at, club.timezone)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No tips yet.</EmptyState>
          )}
        </Card>
      </div>
    </>
  )
}
