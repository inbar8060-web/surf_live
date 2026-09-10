import clsx from 'clsx'

/**
 * Button styling, shared by Server and Client Components.
 *
 * This deliberately lives outside form.tsx: that module is marked
 * 'use client', and a plain function exported from a client module cannot be
 * called during server rendering — only rendered as a component. Keeping the
 * class helper here lets a server-rendered <a> and a client <button> look
 * identical without duplicating the styles.
 */

const VARIANTS = {
  primary: 'bg-sea-600 text-white hover:bg-sea-700 disabled:bg-sea-300',
  secondary: 'border bg-transparent hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300',
  ghost: 'bg-transparent hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50',
} as const

export type ButtonVariant = keyof typeof VARIANTS

export function buttonClass(variant: ButtonVariant = 'primary', size: 'sm' | 'md' = 'md') {
  return clsx(
    'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors',
    'disabled:cursor-not-allowed',
    size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
    VARIANTS[variant],
    variant === 'secondary' && 'border-[color:var(--border)]',
  )
}
