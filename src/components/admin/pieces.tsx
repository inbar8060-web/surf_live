import Link from 'next/link'
import type { ReactNode } from 'react'
import { Help } from '@/components/ui/help'

/** Admin building blocks: page furniture, sub-tabs, tables and chips. */

/** The label above a form field in the admin and platform areas. */
export function AdmLabel({
  children,
  help,
  helpTitle,
  hint,
}: {
  children: ReactNode
  help?: ReactNode
  helpTitle?: string
  hint?: string
}) {
  return (
    <span className="a-label mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--color-adm-ink-2)' }}>
      {children}
      {hint && (
        <span style={{ fontWeight: 600, letterSpacing: 0, textTransform: 'none', opacity: 0.8 }}>{hint}</span>
      )}
      {help && <Help title={helpTitle ?? String(children)}>{help}</Help>}
    </span>
  )
}

export function PageTitle({
  title,
  sub,
  actions,
}: {
  title: string
  sub?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>{title}</h1>
        {sub && <p className="a-helper" style={{ margin: '4px 0 0' }}>{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

/**
 * Sub-tabs inside a category. The selection is a URL search param so the exact
 * screen can be linked, bookmarked and revalidated back into.
 */
export function SubTabs({
  base,
  current,
  tabs,
  param = 'tab',
}: {
  base: string
  current: string
  tabs: { key: string; label: string; count?: number }[]
  param?: string
}) {
  return (
    <nav aria-label="Sub-sections" className="mb-4 flex flex-wrap gap-1.5">
      {tabs.map((tab) => {
        const active = tab.key === current
        const href = tab.key ? `${base}?${param}=${tab.key}` : base
        return (
          <Link
            key={tab.key}
            href={href}
            aria-current={active ? 'page' : undefined}
            style={{
              borderRadius: 10,
              padding: '8px 13px',
              fontSize: 13,
              fontWeight: active ? 800 : 600,
              background: active ? 'var(--color-adm-chrome)' : '#fff',
              color: active ? '#fff' : 'var(--color-adm-ink-2)',
              border: active ? undefined : '1.5px solid var(--color-adm-line)',
            }}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span style={{ marginLeft: 6, opacity: 0.75 }}>{tab.count}</span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

export function Panel({
  title,
  help,
  helpTitle,
  action,
  helper,
  children,
  className,
  tone = 'plain',
}: {
  title?: ReactNode
  help?: ReactNode
  helpTitle?: string
  action?: ReactNode
  helper?: ReactNode
  children: ReactNode
  className?: string
  tone?: 'plain' | 'amber' | 'rose'
}) {
  const toneStyle =
    tone === 'amber'
      ? { background: 'var(--color-adm-amber-bg)', border: '1px solid var(--color-adm-amber-line)' }
      : tone === 'rose'
        ? { background: 'var(--color-adm-rose-bg)', border: '1px solid var(--color-adm-rose-line)' }
        : {}

  return (
    <section className={`a-card ${className ?? ''}`} style={{ padding: '16px 18px', ...toneStyle }}>
      {(title || action) && (
        <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <h2 className="flex items-center gap-1.5" style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>
            {title}
            {help && <Help title={helpTitle ?? String(title)}>{help}</Help>}
          </h2>
          {action}
        </header>
      )}
      {helper && (
        <p className="a-helper" style={{ margin: '0 0 12px' }}>
          {helper}
        </p>
      )}
      {children}
    </section>
  )
}

const CHIPS = {
  green: { bg: 'var(--color-adm-green-chip)', ink: 'var(--color-adm-green-ink)' },
  blue: { bg: 'var(--color-adm-blue-chip)', ink: 'var(--color-adm-blue-ink)' },
  amber: { bg: 'var(--color-adm-amber-row)', ink: 'var(--color-adm-amber-ink)' },
  rose: { bg: 'var(--color-adm-rose-chip)', ink: 'var(--color-adm-rose-ink)' },
  neutral: { bg: 'var(--color-adm-neutral-chip)', ink: 'var(--color-adm-neutral-ink)' },
} as const

export type AdminChipTone = keyof typeof CHIPS

export function AdmChip({ tone = 'neutral', children }: { tone?: AdminChipTone; children: ReactNode }) {
  const { bg, ink } = CHIPS[tone]
  return (
    <span
      style={{
        background: bg,
        color: ink,
        borderRadius: 7,
        padding: '3px 8px',
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

/** Status wording and colour, kept in one place so every admin screen agrees. */
export function AdmStatus({ status }: { status: string }) {
  const map: Record<string, { tone: AdminChipTone; label: string }> = {
    pending: { tone: 'amber', label: 'Awaiting approval' },
    approved: { tone: 'green', label: 'Approved' },
    rejected: { tone: 'rose', label: 'Declined' },
    cancelled: { tone: 'neutral', label: 'Cancelled' },
    completed: { tone: 'blue', label: 'Attended' },
    no_show: { tone: 'rose', label: 'No show' },
    open: { tone: 'green', label: 'Open' },
    blocked: { tone: 'amber', label: 'Blocked' },
    active: { tone: 'green', label: 'Active' },
    expired: { tone: 'neutral', label: 'Expired' },
    available: { tone: 'green', label: 'Available' },
    rented: { tone: 'blue', label: 'Out' },
    maintenance: { tone: 'amber', label: 'Maintenance' },
    retired: { tone: 'neutral', label: 'Retired' },
    reserved: { tone: 'amber', label: 'Reserved' },
    out: { tone: 'blue', label: 'Out' },
    returned: { tone: 'green', label: 'Returned' },
    overdue: { tone: 'rose', label: 'Overdue' },
    lost: { tone: 'rose', label: 'Lost' },
    succeeded: { tone: 'green', label: 'Paid' },
    failed: { tone: 'rose', label: 'Failed' },
    refunded: { tone: 'neutral', label: 'Refunded' },
  }
  const entry = map[status] ?? { tone: 'neutral' as AdminChipTone, label: status }
  return <AdmChip tone={entry.tone}>{entry.label}</AdmChip>
}

export function EmptyRow({ children }: { children: ReactNode }) {
  return (
    <p className="a-helper" style={{ padding: '22px 4px', textAlign: 'center' }}>
      {children}
    </p>
  )
}

/** Capacity bar used on the schedule and desk screens. */
export function CapacityBar({ taken, capacity }: { taken: number; capacity: number }) {
  const pct = capacity > 0 ? Math.min(100, Math.round((taken / capacity) * 100)) : 0
  const full = taken >= capacity
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        style={{ width: 120, height: 6, borderRadius: 3, background: 'var(--color-adm-rule)', display: 'inline-block' }}
      >
        <span
          style={{
            display: 'block',
            width: `${pct}%`,
            height: '100%',
            borderRadius: 3,
            background: full ? 'var(--color-adm-amber-ink)' : 'var(--color-adm-accent)',
          }}
        />
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-adm-ink-2)' }}>
        {taken}/{capacity}
      </span>
    </span>
  )
}
