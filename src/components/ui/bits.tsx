import type { ReactNode } from 'react'
import clsx from 'clsx'

/**
 * Small shared pieces used across the three interfaces. Each takes its palette
 * from the area it is rendered in rather than carrying variants for all three,
 * so a screen cannot accidentally mix two languages.
 */

/** Initials tile. Never renders more than two letters. */
export function Initials({
  name,
  size = 40,
  radius,
  background = '#0b4a6d',
  color = '#fff',
  fontSize,
}: {
  name: string
  size?: number
  radius?: number
  background?: string
  color?: string
  fontSize?: number
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: radius ?? size / 2,
        background,
        color,
        fontSize: fontSize ?? Math.round(size * 0.36),
        fontWeight: 800,
        letterSpacing: '0.02em',
      }}
    >
      {initials || '·'}
    </span>
  )
}

/** Uppercase micro-label used above values and section headings. */
export function MicroLabel({
  children,
  color,
  className,
}: {
  children: ReactNode
  color?: string
  className?: string
}) {
  return (
    <span
      className={clsx('block', className)}
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color,
      }}
    >
      {children}
    </span>
  )
}

/** Flat chip. Colours are passed in so each area keeps its own palette. */
export function Chip({
  children,
  bg,
  ink,
  border,
  size = 'md',
}: {
  children: ReactNode
  bg: string
  ink: string
  border?: string
  size?: 'sm' | 'md'
}) {
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap"
      style={{
        background: bg,
        color: ink,
        border: border ? `1px solid ${border}` : undefined,
        borderRadius: 999,
        padding: size === 'sm' ? '2px 8px' : '3px 10px',
        fontSize: size === 'sm' ? 10 : 11,
        fontWeight: 800,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  )
}

/** Empty state. Wording is deliberately carried over from the current build. */
export function Empty({ children, tone = 'member' }: { children: ReactNode; tone?: 'member' | 'instructor' | 'admin' }) {
  const color =
    tone === 'instructor'
      ? 'var(--color-ins-ink-2)'
      : tone === 'admin'
        ? 'var(--color-adm-ink-2)'
        : '#5a6f7d'

  return (
    <p className="px-4 py-8 text-center" style={{ color, fontSize: 14 }}>
      {children}
    </p>
  )
}
