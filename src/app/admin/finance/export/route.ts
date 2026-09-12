import { NextResponse, type NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { getRequestClub } from '@/lib/tenant'
import { createUserClient } from '@/lib/supabase/server'
import { getClubSettings } from '@/lib/db/queries'
import { getClubOnboarding } from '@/lib/billing/onboarding'
import { planHasFullFinance } from '@/lib/billing/plans'
import { resolvePeriod, toCsv } from '@/lib/finance/report'
import { recordAudit } from '@/lib/audit'
import type { ReportPeriod } from '@/lib/db/types'

export const dynamic = 'force-dynamic'

/** The period's payments as CSV — the full plan only. Reads under the caller's own RLS. */
export async function GET(request: NextRequest) {
  const [user, club] = await Promise.all([getSessionUser(), getRequestClub()])
  if (!user || user.profile.role !== 'admin' || !club || user.profile.club_id !== club.id) {
    return new NextResponse('Not found', { status: 404 })
  }
  const onboarding = await getClubOnboarding(club.id)
  if (!planHasFullFinance(onboarding.plan)) {
    return new NextResponse('Export comes with Surfing Vibes.', { status: 403 })
  }

  const settings = await getClubSettings()
  const periodParam = request.nextUrl.searchParams.get('period') ?? 'monthly'
  const period = (['monthly', 'quarterly', 'yearly'] as string[]).includes(periodParam) ? (periodParam as ReportPeriod) : 'monthly'
  const range = resolvePeriod(period, request.nextUrl.searchParams.get('at') ?? undefined, settings.timezone)

  const { data } = await (await createUserClient())
    .from('payments')
    .select('id, kind, status, amount_cents, currency, platform_fee_cents, description, provider, provider_ref, succeeded_at, refunded_at, created_at')
    .gte('created_at', range.from)
    .lt('created_at', range.to)
    .order('created_at')
    .limit(10_000)

  const rows = (data ?? []).map((p) => ({
    id: p.id,
    created_at: p.created_at,
    succeeded_at: p.succeeded_at,
    refunded_at: p.refunded_at,
    kind: p.kind,
    status: p.status,
    description: p.description,
    amount: (p.amount_cents / 100).toFixed(2),
    platform_fee: (p.platform_fee_cents / 100).toFixed(2),
    currency: p.currency,
    provider: p.provider,
    reference: p.provider_ref,
  }))

  await recordAudit({
    actorId: user.id,
    actorRole: 'admin',
    action: 'finance.exported',
    entity: 'payments',
    entityId: range.key,
    after: { period: range.key, rows: rows.length },
  })

  const csv = toCsv(rows, ['id', 'created_at', 'succeeded_at', 'refunded_at', 'kind', 'status', 'description', 'amount', 'platform_fee', 'currency', 'provider', 'reference'])
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="payments-${range.key}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
