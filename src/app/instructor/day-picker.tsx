'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Calendar } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { instructorButton } from '@/components/ui/button-class'

/**
 * Month grid for picking another day.
 *
 * Days that carry a session are dotted in the accent, today is inverted. Only
 * a plain YYYY-MM-DD ever reaches the route — the value is built here from
 * numbers, never from anything typed.
 */
export function DayPicker({
  selected,
  busyDays,
  timeZone,
  today,
}: {
  selected: string
  busyDays: string[]
  timeZone: string
  /** Today at the club, resolved on the server so both agree. */
  today: string
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const chosen = new Date(`${selected}T00:00:00`)
  const [month, setMonth] = useState(new Date(chosen.getFullYear(), chosen.getMonth(), 1))
  const busy = new Set(busyDays)
  const todayIso = today

  const firstWeekday = (month.getDay() + 6) % 7 // Monday-first
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()

  const iso = (day: number) =>
    `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const go = (value: string) => {
    setOpen(false)
    router.push(`/instructor?date=${value}`)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Pick another day"
        className="flex shrink-0 items-center justify-center"
        style={{ width: 42, height: 42, borderRadius: 21, background: '#e9e9e6' }}
      >
        <Calendar size={20} />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Pick another day" variant="instructor">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            className={instructorButton('secondary', 'md')}
            aria-label="Previous month"
          >
            ‹
          </button>
          <span style={{ fontSize: 15, fontWeight: 800 }}>
            {new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone }).format(month)}
          </span>
          <button
            type="button"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            className={instructorButton('secondary', 'md')}
            aria-label="Next month"
          >
            ›
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1.5">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span
              key={i}
              className="text-center"
              style={{ fontSize: 10, fontWeight: 800, color: 'var(--color-ins-ink-3)' }}
            >
              {d}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: firstWeekday }).map((_, i) => (
            <span key={`pad-${i}`} />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const value = iso(day)
            const isSelected = value === selected
            const isToday = value === todayIso

            return (
              <button
                key={value}
                type="button"
                onClick={() => go(value)}
                aria-current={isSelected ? 'date' : undefined}
                className="relative flex flex-col items-center justify-center"
                style={{
                  height: 44,
                  borderRadius: 12,
                  background: isSelected || isToday ? 'var(--color-ins-ink)' : '#fff',
                  color: isSelected || isToday ? '#fff' : 'var(--color-ins-ink)',
                  fontSize: 14,
                  fontWeight: 800,
                  border: isSelected ? '2px solid var(--color-ins-accent)' : '1.5px solid var(--color-ins-line)',
                }}
              >
                {day}
                {busy.has(value) && (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      bottom: 6,
                      width: 5,
                      height: 5,
                      borderRadius: 3,
                      background: isSelected || isToday ? 'var(--color-ins-accent-on-dark)' : 'var(--color-ins-accent)',
                    }}
                  />
                )}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => go(todayIso)}
          className={`${instructorButton('primary')} mt-4 w-full`}
        >
          Show today
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={`${instructorButton('secondary')} mt-2 w-full`}
        >
          Close
        </button>
      </Sheet>
    </>
  )
}
