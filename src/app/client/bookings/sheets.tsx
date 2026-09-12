'use client'

import { useState } from 'react'
import { Minus, Plus, Star } from 'lucide-react'
import { amendReservationAction, cancelReservationAction } from '@/lib/actions/reservations'
import { submitInstructorReviewAction, submitSessionReviewAction } from '@/lib/actions/reviews'
import { createTipCheckoutAction } from '@/lib/actions/tips'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { memberButton } from '@/components/ui/button-class'
import { Sheet } from '@/components/ui/sheet'
import { MicroLabel } from '@/components/ui/bits'

/* ------------------------------------------------------------------ pieces */

function Stepper({
  value,
  onChange,
  max,
  size = 44,
}: {
  value: number
  onChange: (n: number) => void
  max: number
  size?: number
}) {
  const box: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: 14,
    border: '2px solid #dbe3ea',
    background: '#fff',
  }
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label="One fewer place"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        className="flex items-center justify-center disabled:opacity-40"
        style={box}
      >
        <Minus size={18} />
      </button>
      <span className="display" style={{ fontSize: 20, fontWeight: 700, minWidth: 26, textAlign: 'center' }}>
        {value}
      </span>
      <button
        type="button"
        aria-label="One more place"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="flex items-center justify-center disabled:opacity-40"
        style={box}
      >
        <Plus size={18} />
      </button>
    </div>
  )
}

const WORDS = ['', 'Poor', 'Not great', 'Fine', 'Good', 'Excellent']

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const on = n <= value
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-label={`${n} out of 5`}
              aria-pressed={on}
              className="flex items-center justify-center"
              style={{ width: 52, height: 52, borderRadius: 16, background: '#eff9ff' }}
            >
              <Star
                size={22}
                strokeWidth={2}
                style={{ color: on ? '#0087c6' : '#b6e8ff' }}
                fill={on ? '#0087c6' : 'none'}
              />
            </button>
          )
        })}
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#5a6f7d' }}>{WORDS[value]}</span>
    </div>
  )
}

const noteStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 15,
  border: '2px solid #dbe3ea',
  padding: '10px 12px',
  fontSize: 14,
  background: '#fff',
  resize: 'vertical',
}

/* ------------------------------------------------------------ change sheet */

/**
 * The re-approval rule is enforced by a database trigger. The amber notice
 * exists so it is not a surprise, not to implement it.
 */
export function AmendSheet({
  reservationId,
  participants,
  clientNote,
  isApproved,
  sessionLine,
  seatsFree,
}: {
  reservationId: string
  participants: number
  clientNote: string
  isApproved: boolean
  sessionLine: string
  seatsFree: number
}) {
  const [open, setOpen] = useState(false)
  const [places, setPlaces] = useState(participants)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={memberButton('secondary', 'sm')}>
        Change
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Change your booking">
        <p className="mb-3" style={{ fontSize: 13, color: '#5a6f7d' }}>
          {sessionLine}
        </p>

        {isApproved && (
          <p
            className="mb-4"
            style={{
              background: '#fef3c7',
              color: '#78350f',
              borderRadius: 15,
              padding: '11px 14px',
              fontSize: 13,
              lineHeight: 1.45,
            }}
          >
            This booking is approved. Changing it puts it back in the queue for the club to approve
            again.
          </p>
        )}

        <ActionForm action={amendReservationAction}>
          {({ fieldErrors }) => (
            <>
              <input type="hidden" name="reservationId" value={reservationId} />
              <input type="hidden" name="participants" value={places} />

              <MicroLabel color="#5a6f7d" className="mb-2">
                Places
              </MicroLabel>
              <div className="mb-4 flex items-center gap-3">
                <Stepper value={places} onChange={setPlaces} max={Math.max(1, participants + seatsFree)} size={48} />
                <span className="ml-auto" style={{ fontSize: 12, fontWeight: 600, color: '#5a6f7d' }}>
                  {seatsFree} free
                </span>
              </div>
              {fieldErrors.participants && <p className="field-error">{fieldErrors.participants}</p>}

              <MicroLabel color="#5a6f7d" className="mb-2">
                Note
              </MicroLabel>
              <textarea
                name="clientNote"
                rows={2}
                maxLength={1000}
                defaultValue={clientNote}
                className="mb-4"
                style={noteStyle}
              />

              <SubmitButton className={`${memberButton('primary')} w-full`} pendingLabel="Saving…">
                Save change
              </SubmitButton>
            </>
          )}
        </ActionForm>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-2 w-full"
          style={{ fontSize: 14, fontWeight: 700, color: '#5a6f7d', padding: '8px 0' }}
        >
          Cancel
        </button>
      </Sheet>
    </>
  )
}

export function CancelBookingButton({ reservationId }: { reservationId: string }) {
  return (
    <ActionForm action={cancelReservationAction}>
      {() => (
        <>
          <input type="hidden" name="reservationId" value={reservationId} />
          <SubmitButton
            className={memberButton('quiet', 'sm')}
            confirm="Cancel this booking?"
            pendingLabel="…"
          >
            Cancel
          </SubmitButton>
        </>
      )}
    </ActionForm>
  )
}

/* ------------------------------------------------------------ review sheet */

/**
 * Two reviews live behind one control because members think of it as one act.
 * They are different records with different audiences: the public tab writes
 * `session_reviews` (readable by every member), the club tab writes
 * `instructor_reviews`, which RLS makes readable by admins alone.
 */
export function ReviewSheet({
  slotId,
  instructorId,
  instructorName,
  reservationId,
  currency,
  tipsEnabled,
  label = 'Review session',
}: {
  slotId: string
  instructorId: string | null
  instructorName: string | null
  reservationId: string
  currency: string
  tipsEnabled: boolean
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'public' | 'club'>('public')
  const [rating, setRating] = useState(5)
  const [clubRating, setClubRating] = useState(5)

  const presets = [2000, 5000, 10000]
  const money = (cents: number) =>
    new Intl.NumberFormat('en-IL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
      cents / 100,
    )

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={memberButton('secondary', 'sm')}>
        {label}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="How was the session?">
        <div
          className="mb-4 flex gap-1 rounded-full p-1"
          role="tablist"
          aria-label="Who reads this"
          style={{ background: '#f1f5f9' }}
        >
          {(['public', 'club'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className="flex-1 rounded-full"
              style={{
                padding: '9px 12px',
                fontSize: 13,
                fontWeight: 700,
                background: tab === key ? '#fff' : 'transparent',
                color: tab === key ? '#10242f' : '#5a6f7d',
                boxShadow: tab === key ? '0 2px 6px rgba(7,47,73,0.10)' : undefined,
              }}
            >
              {key === 'public' ? 'Public review' : 'To the club'}
            </button>
          ))}
        </div>

        {tab === 'public' ? (
          <>
            <ActionForm action={submitSessionReviewAction}>
              {({ fieldErrors }) => (
                <>
                  <input type="hidden" name="slotId" value={slotId} />
                  <input type="hidden" name="rating" value={rating} />

                  <p className="mb-2" style={{ fontSize: 13, color: '#5a6f7d' }}>
                    Other members can read this on the reviews wall.
                  </p>
                  <div className="mb-4">
                    <StarPicker value={rating} onChange={setRating} />
                  </div>

                  <input
                    name="title"
                    maxLength={120}
                    placeholder="Title"
                    className="mb-3"
                    style={{ ...noteStyle, height: 48 }}
                  />
                  <textarea
                    name="body"
                    rows={3}
                    maxLength={4000}
                    placeholder="What was it like?"
                    className="mb-4"
                    style={noteStyle}
                  />
                  {fieldErrors.body && <p className="field-error">{fieldErrors.body}</p>}

                  <SubmitButton className={`${memberButton('primary')} w-full`} pendingLabel="Posting…">
                    Post review
                  </SubmitButton>
                </>
              )}
            </ActionForm>

            {tipsEnabled && instructorId && instructorName && (
              <div
                className="mt-4"
                style={{ background: '#f5eede', borderRadius: 18, padding: '14px 16px', color: '#8a6b39' }}
              >
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                  Say thanks to {instructorName.split(' ')[0]}
                </p>
                <p style={{ margin: '3px 0 10px', fontSize: 12 }}>
                  Goes straight to them. Opens a secure checkout.
                </p>
                <ActionForm action={createTipCheckoutAction}>
                  {() => (
                    <>
                      <input type="hidden" name="instructorId" value={instructorId} />
                      <input type="hidden" name="reservationId" value={reservationId} />
                      <div className="flex gap-2">
                        {presets.map((cents) => (
                          <SubmitButton
                            key={cents}
                            name="amountCents"
                            value={String(cents)}
                            className={`${memberButton('secondary', 'md')} flex-1`}
                            pendingLabel="…"
                          >
                            {money(cents)}
                          </SubmitButton>
                        ))}
                      </div>
                    </>
                  )}
                </ActionForm>
              </div>
            )}
          </>
        ) : (
          <ActionForm action={submitInstructorReviewAction}>
            {({ fieldErrors }) => (
              <>
                <input type="hidden" name="instructorId" value={instructorId ?? ''} />
                <input type="hidden" name="reservationId" value={reservationId} />
                <input type="hidden" name="rating" value={clubRating} />

                <p className="mb-2" style={{ fontSize: 13, color: '#5a6f7d' }}>
                  How was {instructorName ?? 'your instructor'}?
                </p>
                <div className="mb-4">
                  <StarPicker value={clubRating} onChange={setClubRating} />
                </div>

                <textarea
                  name="body"
                  rows={4}
                  maxLength={4000}
                  placeholder="What would you like the club to know?"
                  className="mb-3"
                  style={noteStyle}
                />
                {fieldErrors.body && <p className="field-error">{fieldErrors.body}</p>}

                <p className="mb-4" style={{ fontSize: 12, color: '#5a6f7d', lineHeight: 1.45 }}>
                  Only the club management reads this — it is never shown to your instructor.
                </p>

                <SubmitButton className={`${memberButton('primary')} w-full`} pendingLabel="Sending…">
                  Send privately
                </SubmitButton>
              </>
            )}
          </ActionForm>
        )}
      </Sheet>
    </>
  )
}

/* --------------------------------------------------------------- tip sheet */

export function TipSheet({
  instructorId,
  instructorName,
  reservationId,
  currency,
}: {
  instructorId: string
  instructorName: string
  reservationId: string
  currency: string
}) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(5000)
  const presets = [2000, 5000, 10000]

  const money = (cents: number) =>
    new Intl.NumberFormat('en-IL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
      cents / 100,
    )

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={memberButton('secondary', 'sm')}>
        Tip {instructorName.split(' ')[0]}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={`Tip ${instructorName.split(' ')[0]}`}>
        <ActionForm action={createTipCheckoutAction}>
          {({ fieldErrors }) => (
            <>
              <input type="hidden" name="instructorId" value={instructorId} />
              <input type="hidden" name="reservationId" value={reservationId} />
              <input type="hidden" name="amountCents" value={amount} />

              <div className="mb-4 flex gap-2">
                {presets.map((cents) => (
                  <button
                    key={cents}
                    type="button"
                    onClick={() => setAmount(cents)}
                    aria-pressed={amount === cents}
                    className="flex-1"
                    style={{
                      height: 56,
                      borderRadius: 16,
                      border: amount === cents ? '2px solid #072f49' : '2px solid #dbe3ea',
                      background: amount === cents ? '#eff9ff' : '#fff',
                      fontSize: 16,
                      fontWeight: 700,
                    }}
                  >
                    {money(cents)}
                  </button>
                ))}
              </div>
              {fieldErrors.amountCents && <p className="field-error">{fieldErrors.amountCents}</p>}

              <input
                name="message"
                maxLength={300}
                placeholder="Message (optional)"
                className="mb-4"
                style={{ ...noteStyle, height: 48 }}
              />

              <SubmitButton className={`${memberButton('primary')} w-full`} pendingLabel="Opening checkout…">
                Continue to payment
              </SubmitButton>
            </>
          )}
        </ActionForm>
      </Sheet>
    </>
  )
}
