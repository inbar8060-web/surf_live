import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import clsx from 'clsx'

/* --------------------------------------------------------------- surfaces */

export function Card({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={clsx('surface p-4 sm:p-5', className)}>
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {description && <p className="muted mt-1 text-sm">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">{title}</h1>
        {description && <p className="muted mt-1 max-w-2xl text-sm">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="muted rounded-lg border border-dashed px-4 py-8 text-center text-sm"
       style={{ borderColor: 'var(--border)' }}>
      {children}
    </p>
  )
}

/* ----------------------------------------------------------------- badges */

const TONES = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  info: 'bg-sea-100 text-sea-800 dark:bg-sea-900 dark:text-sea-100',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100',
  warning: 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100',
  danger: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-100',
} as const

export type Tone = keyof typeof TONES

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={clsx('inline-block rounded-full px-2 py-0.5 text-xs font-medium', TONES[tone])}>
      {children}
    </span>
  )
}

/** Status wording and colour kept in one place so every screen agrees. */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: Tone; label: string }> = {
    pending: { tone: 'warning', label: 'Awaiting approval' },
    approved: { tone: 'success', label: 'Approved' },
    rejected: { tone: 'danger', label: 'Declined' },
    cancelled: { tone: 'neutral', label: 'Cancelled' },
    completed: { tone: 'info', label: 'Completed' },
    no_show: { tone: 'danger', label: 'No show' },
    open: { tone: 'success', label: 'Open' },
    blocked: { tone: 'warning', label: 'Blocked' },
    active: { tone: 'success', label: 'Active' },
    expired: { tone: 'neutral', label: 'Expired' },
    available: { tone: 'success', label: 'Available' },
    rented: { tone: 'info', label: 'Out on rental' },
    maintenance: { tone: 'warning', label: 'Maintenance' },
    retired: { tone: 'neutral', label: 'Retired' },
    reserved: { tone: 'warning', label: 'Reserved' },
    out: { tone: 'info', label: 'Out' },
    returned: { tone: 'success', label: 'Returned' },
    overdue: { tone: 'danger', label: 'Overdue' },
    lost: { tone: 'danger', label: 'Lost' },
    succeeded: { tone: 'success', label: 'Paid' },
    failed: { tone: 'danger', label: 'Failed' },
    refunded: { tone: 'neutral', label: 'Refunded' },
  }
  const entry = map[status] ?? { tone: 'neutral' as Tone, label: status }
  return <Badge tone={entry.tone}>{entry.label}</Badge>
}

/* ------------------------------------------------------------------ forms */

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  error?: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && !error && <p className="muted mt-1 text-xs">{hint}</p>}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx('field-input', props.className)} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx('field-input', props.className)} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx('field-input', props.className)} />
}

/* --------------------------------------------------------------- feedback */

export function Alert({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success'; children: ReactNode }) {
  const styles = {
    info: 'border-sea-300 bg-sea-50 text-sea-900 dark:bg-sea-950 dark:text-sea-100',
    error: 'border-rose-300 bg-rose-50 text-rose-900 dark:bg-rose-950 dark:text-rose-100',
    success: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
  }[tone]

  return (
    <div className={clsx('rounded-lg border px-3 py-2 text-sm', styles)} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}
