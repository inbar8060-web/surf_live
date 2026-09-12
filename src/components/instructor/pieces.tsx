import type { ReactNode } from 'react'

/**
 * Instructor building blocks. The palette is fixed here rather than passed in,
 * so a screen cannot accidentally introduce a second accent — the whole point
 * of this interface is that there is only one.
 */

export function ScreenTitle({
  title,
  sub,
  action,
}: {
  title: string
  sub?: string
  action?: ReactNode
}) {
  return (
    <header className="flex items-start justify-between gap-3 px-5 pb-4 pt-8">
      <div className="min-w-0">
        <h1 style={{ fontSize: 27, fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>
          {title}
        </h1>
        {sub && (
          <p style={{ margin: '3px 0 0', fontSize: 14, fontWeight: 600, color: 'var(--color-ins-ink-2)' }}>
            {sub}
          </p>
        )}
      </div>
      {action}
    </header>
  )
}

/** Amber and rose flags used on member rows: medical, missing waiver. */
export function Flag({
  tone,
  children,
  onDark = false,
}: {
  tone: 'warn' | 'danger'
  children: ReactNode
  onDark?: boolean
}) {
  const palette = onDark
    ? {
        warn: { bg: 'var(--color-ins-warn-bg-dark)', ink: 'var(--color-ins-warn-ink-dark)' },
        danger: { bg: 'var(--color-ins-danger-bg-dark)', ink: 'var(--color-ins-danger-ink-dark)' },
      }
    : {
        warn: { bg: 'var(--color-ins-warn-bg)', ink: 'var(--color-ins-warn-ink)' },
        danger: { bg: 'var(--color-ins-danger-bg)', ink: 'var(--color-ins-danger-ink)' },
      }

  const { bg, ink } = palette[tone]

  return (
    <span
      style={{
        background: bg,
        color: ink,
        borderRadius: 8,
        padding: '3px 8px',
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

/** Amber panel carrying a medical note or a session note. */
export function NotePanel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--color-ins-warn-bg)',
        color: 'var(--color-ins-warn-ink)',
        borderRadius: 14,
        padding: '10px 12px',
      }}
    >
      <span
        style={{ display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', marginBottom: 2 }}
      >
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.45 }}>{children}</span>
    </div>
  )
}

/** Neutral status chip. */
export function InsChip({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'warn' }) {
  const map = {
    neutral: { bg: '#eeeeec', ink: 'var(--color-ins-ink-2)' },
    accent: { bg: '#e3f0f4', ink: 'var(--color-ins-accent)' },
    warn: { bg: 'var(--color-ins-warn-bg)', ink: 'var(--color-ins-warn-ink)' },
  }
  const { bg, ink } = map[tone]

  return (
    <span
      style={{
        background: bg,
        color: ink,
        borderRadius: 999,
        padding: '4px 10px',
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}
