'use client'

import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'

/**
 * Everything that can actually take focus.
 *
 * Two exclusions matter and are easy to miss: a disabled control cannot be
 * focused, and neither can `input[type=hidden]` — and these forms are full of
 * hidden inputs carrying ids, so without that second clause the first "match"
 * is unfocusable and focus silently stays on the page behind the scrim.
 */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/**
 * Bottom sheet.
 *
 * Slides up over a dimmed parent, dismissed by the scrim, the Escape key or an
 * explicit control. Focus is moved in on open and returned to whatever opened
 * it on close, and the page behind is locked so a scroll gesture on the sheet
 * cannot run away with the page.
 *
 * Rendered through a portal so a sheet opened from deep inside a card is not
 * clipped by that card's overflow or stacking context.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  variant = 'member',
  labelledBy,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  variant?: 'member' | 'instructor'
  labelledBy?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreTo = useRef<HTMLElement | null>(null)
  const headingId = useId()

  /*
   * `onClose` is almost always an inline arrow, so it has a new identity on
   * every render. Depending on it directly would tear the effect down and set
   * it up again on each keystroke — restoring focus to the trigger every time,
   * which makes the sheet impossible to type in. The ref keeps the latest
   * callback while the effect depends only on `open`.
   */
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  const close = useCallback(() => closeRef.current(), [])

  useEffect(() => {
    if (!open) return

    restoreTo.current = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return

      // Keep Tab inside the sheet: it is modal, so the page behind it is inert.
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (focusable.length === 0) return

      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)

    /*
     * Move focus in synchronously — the panel is already in the DOM when this
     * effect runs, and deferring to an animation frame leaves a window in
     * which focus is still on the page behind the scrim.
     *
     * The selector matches the Tab trap's, for the same reason: the first node
     * in the panel is often a disabled stepper button, and focusing a disabled
     * control silently does nothing. The panel itself (tabIndex -1) is the
     * fallback, so focus is never left outside a modal.
     */
    const target = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? panelRef.current
    target?.focus({ preventScroll: true })

    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = previousOverflow
      restoreTo.current?.focus?.()
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  const scrim = variant === 'instructor' ? 'rgba(23,25,26,0.42)' : 'rgba(7,47,73,0.45)'
  const radius = variant === 'instructor' ? '30px 30px 44px 44px' : '32px 32px 44px 44px'

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className="sheet-scrim absolute inset-0 h-full w-full cursor-default"
        style={{ background: scrim }}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby={labelledBy ?? (title ? headingId : undefined)}
        className={clsx(
          'sheet-panel relative w-full max-w-[430px] px-5 pt-3',
          variant === 'instructor' ? 'bg-white' : 'bg-white',
        )}
        style={{
          borderRadius: radius,
          boxShadow: '0 -12px 40px rgba(7,47,73,0.3)',
          maxHeight: '88vh',
          overflowY: 'auto',
          paddingBottom: 34,
        }}
      >
        <div
          aria-hidden
          className="mx-auto mb-3"
          style={{ width: 44, height: 5, borderRadius: 3, background: '#dbe3ea' }}
        />
        {title && (
          <h2
            id={headingId}
            className={clsx(
              'mb-3',
              variant === 'instructor' ? 'font-[family-name:var(--font-staff)]' : 'display',
            )}
            style={{ fontSize: 21, fontWeight: variant === 'instructor' ? 800 : 700 }}
          >
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}
