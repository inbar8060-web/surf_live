import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

/**
 * The deep-water header every member screen sits under. The wave texture is
 * pinned to its bottom edge, and the cards below pull up over it.
 */
export function MemberHero({
  children,
  waves = true,
  className,
}: {
  children: ReactNode
  waves?: boolean
  className?: string
}) {
  return (
    <header
      className={`relative shrink-0 px-6 pb-7 pt-5 text-white ${className ?? ''}`}
      style={{ background: '#072f49' }}
    >
      {waves && (
        <div
          aria-hidden
          className="wave-texture pointer-events-none absolute inset-x-0 bottom-0"
          style={{ height: 56 }}
        />
      )}
      <div className="relative">{children}</div>
    </header>
  )
}

/** Secondary screens push with a back chevron rather than a tab switch. */
export function HeroBack({
  href,
  title,
  action,
}: {
  href: string
  title: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      <Link
        href={href}
        aria-label="Back"
        className="flex items-center justify-center rounded-full"
        style={{ width: 38, height: 38, background: '#0b4a6d', color: '#b6e8ff' }}
      >
        <ChevronLeft size={22} />
      </Link>
      <h1 className="display" style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
        {title}
      </h1>
      {action && <div className="ml-auto">{action}</div>}
    </div>
  )
}

/** Status pill in the member palette. */
export function MemberStatus({ status }: { status: string }) {
  const map: Record<string, { bg: string; ink: string; label: string }> = {
    pending: { bg: '#fef3c7', ink: '#78350f', label: 'Awaiting approval' },
    approved: { bg: '#d1fae5', ink: '#065f46', label: 'Approved' },
    rejected: { bg: '#ffe4e6', ink: '#9f1239', label: 'Declined' },
    cancelled: { bg: '#f1f5f9', ink: '#334155', label: 'Cancelled' },
    completed: { bg: '#def2ff', ink: '#065a84', label: 'Completed' },
    no_show: { bg: '#ffe4e6', ink: '#9f1239', label: 'No show' },
    active: { bg: '#d1fae5', ink: '#065f46', label: 'Active' },
    expired: { bg: '#f1f5f9', ink: '#334155', label: 'Expired' },
    reserved: { bg: '#fef3c7', ink: '#78350f', label: 'Reserved' },
    out: { bg: '#def2ff', ink: '#065a84', label: 'Out with you' },
    returned: { bg: '#d1fae5', ink: '#065f46', label: 'Returned' },
    overdue: { bg: '#ffe4e6', ink: '#9f1239', label: 'Overdue' },
    succeeded: { bg: '#d1fae5', ink: '#065f46', label: 'Paid' },
    failed: { bg: '#ffe4e6', ink: '#9f1239', label: 'Failed' },
  }
  const entry = map[status] ?? { bg: '#f1f5f9', ink: '#334155', label: status }

  return (
    <span
      style={{
        background: entry.bg,
        color: entry.ink,
        borderRadius: 999,
        padding: '4px 10px',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {entry.label}
    </span>
  )
}
