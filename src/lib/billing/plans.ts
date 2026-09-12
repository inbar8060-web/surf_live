import type { Plan, ReportPeriod } from '@/lib/db/types'

/**
 * What a plan lets a club do. Pure helpers over the `plans` row so that a
 * screen and the database agree on the same numbers — the numbers live in
 * the row, never here.
 */

export function planAllowsReport(plan: Plan | null, period: ReportPeriod): boolean {
  return plan?.reports.includes(period) ?? false
}

export function planHasFinance(plan: Plan | null): boolean {
  return plan?.financial_dashboard !== undefined && plan.financial_dashboard !== 'none'
}

export function planHasFullFinance(plan: Plan | null): boolean {
  return plan?.financial_dashboard === 'full'
}

/** "10 instructors", "Unlimited instructors". */
export function limitLine(limit: number | null, noun: string, suffix = ''): string {
  return limit === null ? `Unlimited ${noun}` : `${limit} ${noun}${suffix}`
}

/** Plan features as a list a pricing card can print. */
export function planFeatures(plan: Plan): string[] {
  const lines = [
    limitLine(plan.max_instructors, 'registered instructors'),
    limitLine(plan.max_new_clients_per_month, 'new members', ' a month'),
    plan.wallet_payments ? 'Digital wallet payments (Apple Pay, Google Pay, cards)' : 'Card payments',
    limitLine(plan.max_payments_per_month, 'payments', ' a month'),
  ]
  const reports = plan.reports.map((r) => ({ monthly: 'monthly', quarterly: 'quarterly', yearly: 'yearly' })[r])
  lines.push(`${reports.join(', ').replace(/, ([^,]*)$/, ' and $1')} reports — club statistics`.replace(/^./, (c) => c.toUpperCase()))
  if (plan.financial_dashboard === 'internal') lines.push('Financial management dashboard')
  if (plan.financial_dashboard === 'full') lines.push('Full financial dashboard, reports and export')
  return lines
}

/** How close a club is to a limit, for the plan screen and the desk warning. */
export function usage(used: number, limit: number | null): { used: number; limit: number | null; pct: number | null; atLimit: boolean } {
  if (limit === null) return { used, limit, pct: null, atLimit: false }
  return { used, limit, pct: Math.min(100, Math.round((used / limit) * 100)), atLimit: used >= limit }
}
