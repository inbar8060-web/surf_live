import clsx from 'clsx'

/**
 * Button styling, shared by Server and Client Components.
 *
 * This deliberately lives outside form.tsx: that module is marked
 * 'use client', and a plain function exported from a client module cannot be
 * called during server rendering — only rendered as a component.
 *
 * Each interface has its own set. They are not interchangeable: a member
 * button is tall and soft, an instructor button is full-width and quiet, an
 * admin button is short and dense. Passing the wrong family is the main way a
 * screen ends up looking like a different app.
 */

const BASE =
  'inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:cursor-not-allowed'

/* ------------------------------------------------------------------ member */

const MEMBER = {
  /** Dark ink on light ground — the main action on a white card. */
  primary: 'bg-sea-950 text-white hover:bg-[#0b3f61] disabled:opacity-55',
  /** Bright accent — the main action on a dark ground. */
  accent: 'bg-sea-400 text-sea-950 hover:bg-[#4fcfff] disabled:opacity-55',
  secondary: 'bg-white text-sea-950 border-2 border-[#dbe3ea] hover:bg-sea-50 disabled:opacity-55',
  quiet: 'bg-transparent text-sea-800 hover:bg-sea-50 disabled:opacity-55',
} as const

export type MemberVariant = keyof typeof MEMBER

export function memberButton(variant: MemberVariant = 'primary', size: 'lg' | 'md' | 'sm' = 'lg') {
  return clsx(
    BASE,
    size === 'lg' && 'h-[54px] rounded-[17px] text-[15px]',
    size === 'md' && 'h-[44px] rounded-[15px] text-[14px]',
    size === 'sm' && 'h-[38px] rounded-[13px] px-3 text-[13px]',
    MEMBER[variant],
  )
}

/* -------------------------------------------------------------- instructor */

const INSTRUCTOR = {
  primary: 'bg-[#17191a] text-white hover:bg-black disabled:opacity-55',
  secondary: 'bg-white text-[#17191a] border-[1.5px] border-[#e0e0dd] hover:bg-[#f4f4f2] disabled:opacity-55',
  approve: 'bg-[#0f6f8c] text-white hover:bg-[#0c5c75] disabled:opacity-55',
  decline: 'bg-[#a3272c] text-white hover:bg-[#8c2126] disabled:opacity-55',
  onDark: 'bg-white text-[#17191a] hover:bg-[#eeeeec] disabled:opacity-55',
} as const

export type InstructorVariant = keyof typeof INSTRUCTOR

export function instructorButton(
  variant: InstructorVariant = 'primary',
  size: 'lg' | 'md' = 'lg',
) {
  return clsx(
    BASE,
    'font-extrabold',
    size === 'lg' ? 'h-[48px] rounded-[15px] text-[14px]' : 'h-[42px] rounded-[13px] px-3 text-[13px]',
    INSTRUCTOR[variant],
  )
}

/* ------------------------------------------------------------------- admin */

const ADMIN = {
  primary: 'bg-[#1f6f5c] text-white hover:bg-[#1a5f4f] disabled:opacity-55',
  bright: 'bg-[#6fd3b4] text-[#0d1a16] hover:bg-[#5fc7a6] disabled:opacity-55',
  secondary: 'bg-white text-[#12211d] border-[1.5px] border-[#e6eae8] hover:bg-[#f5f6f4] disabled:opacity-55',
  danger: 'bg-[#9c2f39] text-white hover:bg-[#872731] disabled:opacity-55',
  quiet: 'bg-transparent text-[#5c6b66] hover:bg-[#eef1ef] disabled:opacity-55',
  onChrome: 'bg-[#1f3830] text-[#a9c7bd] hover:bg-[#26463c] disabled:opacity-55',
} as const

export type AdminVariant = keyof typeof ADMIN

export function adminButton(variant: AdminVariant = 'primary', size: 'md' | 'sm' | 'phone' = 'md') {
  return clsx(
    BASE,
    size === 'md' && 'h-[39px] rounded-[10px] px-3.5 text-[13px]',
    size === 'sm' && 'h-[35px] rounded-[9px] px-3 text-[13px]',
    size === 'phone' && 'h-[45px] rounded-[12px] px-4 text-[14px]',
    ADMIN[variant],
  )
}

/* --------------------------------------------------------------- fallback */

/**
 * Kept for the routes the redesign does not cover (`/invite/[token]`,
 * `/checkout/mock`). New screens should use one of the three sets above.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

export function buttonClass(variant: ButtonVariant = 'primary', size: 'sm' | 'md' = 'md') {
  const map = {
    primary: 'bg-sea-600 text-white hover:bg-sea-700 disabled:bg-sea-300',
    secondary: 'border border-[color:var(--border)] bg-transparent hover:bg-black/5 disabled:opacity-50',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300',
    ghost: 'bg-transparent hover:bg-black/5 disabled:opacity-50',
  }
  return clsx(
    BASE,
    'rounded-lg',
    size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
    map[variant],
  )
}
