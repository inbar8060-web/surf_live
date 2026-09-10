'use client'

import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import clsx from 'clsx'
import type { ActionResult } from '@/lib/actions/result'
import { Alert } from './index'
import { buttonClass, type ButtonVariant } from './button-class'

/* ---------------------------------------------------------------- buttons */

/**
 * Submit control that disables itself while the action is in flight. This is
 * the only guard against a double submission that the user can see; the
 * database's uniqueness constraints are the one that actually holds.
 */
export function SubmitButton({
  children = 'Save',
  variant = 'primary',
  size = 'md',
  pendingLabel = 'Working…',
  confirm,
  name,
  value,
}: {
  children?: ReactNode
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  pendingLabel?: string
  confirm?: string
  name?: string
  value?: string
}) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-busy={pending}
      className={buttonClass(variant, size)}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault()
      }}
    >
      {pending ? pendingLabel : children}
    </button>
  )
}

/* ------------------------------------------------------------------ forms */

export type FormAction<T> = (
  prev: ActionResult<T> | null,
  formData: FormData,
) => Promise<ActionResult<T>>

/**
 * Wraps a Server Action with `useActionState`, renders the returned message or
 * error, and hands per-field errors to the children through a render prop.
 */
export function ActionForm<T>({
  action,
  children,
  className,
  resetOnSuccess = false,
  onSuccess,
}: {
  action: FormAction<T>
  children: (state: { fieldErrors: Record<string, string>; pending: boolean }) => ReactNode
  className?: string
  resetOnSuccess?: boolean
  onSuccess?: (data: T) => void
}) {
  const [state, formAction, pending] = useActionState<ActionResult<T> | null, FormData>(action, null)
  const formRef = useRef<HTMLFormElement>(null)
  const handled = useRef<ActionResult<T> | null>(null)

  useEffect(() => {
    if (!state || state === handled.current || !state.ok) return
    handled.current = state
    if (resetOnSuccess) formRef.current?.reset()
    onSuccess?.(state.data)
  }, [state, resetOnSuccess, onSuccess])

  const fieldErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {}

  return (
    <form ref={formRef} action={formAction} className={clsx('space-y-3', className)} noValidate>
      {state && !state.ok && <Alert tone="error">{state.error}</Alert>}
      {state?.ok && state.message && <Alert tone="success">{state.message}</Alert>}
      {children({ fieldErrors, pending })}
    </form>
  )
}

/* ------------------------------------------------------------------- misc */

/** Copies text (an invite link) and confirms it, with a clipboard fallback. */
export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      className={buttonClass('secondary', 'sm')}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
        } catch {
          window.prompt('Copy this link', value)
          return
        }
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
    >
      {copied ? 'Copied' : label}
    </button>
  )
}

/** Reveals a block of extra form fields without pulling in a dialog library. */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <details open={defaultOpen} className="surface px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium">{summary}</summary>
      <div className="mt-4">{children}</div>
    </details>
  )
}
