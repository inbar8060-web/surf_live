'use client'

import { useId, useState, type ReactNode } from 'react'
import { CircleHelp } from 'lucide-react'

/**
 * Admin help affordance.
 *
 * Every control that changes club data carries one. The panel opens on hover
 * *and* on keyboard focus — a tooltip that only answers to a mouse is not an
 * explanation, it is decoration — and is anchored below the icon so it never
 * covers the row it is explaining.
 *
 * The wording pattern is one bold sentence naming the effect, then one
 * sentence of consequence. Where the consequence really matters it is also
 * written as inline helper text, because a tooltip can always be missed.
 */
export function Help({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={`What does this do? ${title}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center rounded-full"
        style={{ color: open ? 'var(--color-adm-accent)' : 'var(--color-adm-ink-3)' }}
      >
        <CircleHelp size={15} strokeWidth={2} />
      </button>

      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-full z-40 -translate-x-1/2"
          style={{ marginTop: 8, width: 262 }}
        >
          <span
            className="block"
            style={{
              background: 'var(--color-adm-chrome)',
              borderRadius: 10,
              padding: '10px 12px',
              boxShadow: '0 10px 22px rgba(20,32,28,0.24)',
            }}
          >
            <span
              className="block"
              style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 3 }}
            >
              {title}
            </span>
            <span
              className="block"
              style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-adm-chrome-ink-2)', lineHeight: 1.45 }}
            >
              {children}
            </span>
          </span>
        </span>
      )}
    </span>
  )
}
