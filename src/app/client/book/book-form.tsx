'use client'

import { useState } from 'react'
import { Minus, Plus, Ticket, CreditCard } from 'lucide-react'
import { requestReservationAction } from '@/lib/actions/reservations'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { memberButton } from '@/components/ui/button-class'
import { MicroLabel } from '@/components/ui/bits'

export interface PackageOption {
  id: string
  name: string
  remaining: number
}

/**
 * Request a place.
 *
 * Collapsed it is a single button; expanded it reveals the places stepper, how
 * to pay and a note. There is deliberately no price field anywhere in this
 * form — the amount is computed by a database trigger from the session and the
 * service, so nothing posted here can change what a booking costs.
 */
export function BookForm({
  slotId,
  seatsLeft,
  packages,
  priceLabel,
}: {
  slotId: string
  seatsLeft: number
  packages: PackageOption[]
  priceLabel: string
}) {
  const [open, setOpen] = useState(false)
  const [places, setPlaces] = useState(1)
  const [payWith, setPayWith] = useState<string>('')

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={memberButton('accent', 'md')}
        style={{ paddingInline: 20 }}
      >
        Request
      </button>
    )
  }

  const max = Math.max(1, seatsLeft)

  return (
    <ActionForm action={requestReservationAction} className="w-full">
      {({ fieldErrors }) => (
        <>
          <input type="hidden" name="slotId" value={slotId} />
          <input type="hidden" name="participants" value={places} />
          <input type="hidden" name="clientPackageId" value={payWith} />

          <div style={{ borderTop: '1px dashed #dbe3ea', margin: '14px 0 14px' }} />

          <MicroLabel color="#5a6f7d" className="mb-2">
            How many places?
          </MicroLabel>
          <div className="mb-4 flex items-center gap-3">
            <button
              type="button"
              aria-label="One fewer place"
              onClick={() => setPlaces((n) => Math.max(1, n - 1))}
              disabled={places <= 1}
              className="flex items-center justify-center disabled:opacity-40"
              style={{ width: 44, height: 44, borderRadius: 14, border: '2px solid #dbe3ea', background: '#fff' }}
            >
              <Minus size={18} />
            </button>
            <span className="display" style={{ fontSize: 20, fontWeight: 700, minWidth: 24, textAlign: 'center' }}>
              {places}
            </span>
            <button
              type="button"
              aria-label="One more place"
              onClick={() => setPlaces((n) => Math.min(max, n + 1))}
              disabled={places >= max}
              className="flex items-center justify-center disabled:opacity-40"
              style={{ width: 44, height: 44, borderRadius: 14, border: '2px solid #dbe3ea', background: '#fff' }}
            >
              <Plus size={18} />
            </button>
            <span className="ml-auto" style={{ fontSize: 12, fontWeight: 600, color: '#5a6f7d' }}>
              max {max}
            </span>
          </div>
          {fieldErrors.participants && <p className="field-error">{fieldErrors.participants}</p>}

          {packages.length > 0 && (
            <>
              <MicroLabel color="#5a6f7d" className="mb-2">
                Pay with
              </MicroLabel>
              <div className="mb-4 flex gap-2">
                {packages.map((pkg) => {
                  const selected = payWith === pkg.id
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setPayWith(selected ? '' : pkg.id)}
                      aria-pressed={selected}
                      className="flex-1 text-left"
                      style={{
                        borderRadius: 15,
                        padding: '10px 12px',
                        border: selected ? '2px solid #072f49' : '2px solid #dbe3ea',
                        background: selected ? '#eff9ff' : '#fff',
                      }}
                    >
                      <Ticket size={17} style={{ color: '#0087c6' }} />
                      <p style={{ margin: '5px 0 0', fontSize: 13, fontWeight: 700 }}>{pkg.name}</p>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#5a6f7d' }}>
                        {pkg.remaining} left
                      </p>
                    </button>
                  )
                })}

                <button
                  type="button"
                  onClick={() => setPayWith('')}
                  aria-pressed={payWith === ''}
                  className="flex-1 text-left"
                  style={{
                    borderRadius: 15,
                    padding: '10px 12px',
                    border: payWith === '' ? '2px solid #072f49' : '2px solid #dbe3ea',
                    background: payWith === '' ? '#eff9ff' : '#fff',
                  }}
                >
                  <CreditCard size={17} style={{ color: '#0087c6' }} />
                  <p style={{ margin: '5px 0 0', fontSize: 13, fontWeight: 700 }}>Card</p>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#5a6f7d' }}>{priceLabel}</p>
                </button>
              </div>
            </>
          )}

          <MicroLabel color="#5a6f7d" className="mb-2">
            Anything we should know?
          </MicroLabel>
          <textarea
            name="clientNote"
            rows={2}
            maxLength={1000}
            placeholder="First time, nervous, borrowing a board…"
            className="mb-4 w-full"
            style={{
              borderRadius: 15,
              border: '2px solid #dbe3ea',
              padding: '10px 12px',
              fontSize: 14,
              background: '#fff',
              resize: 'vertical',
            }}
          />

          <SubmitButton className={`${memberButton('primary')} w-full`} pendingLabel="Sending…">
            Send request
          </SubmitButton>

          <p className="mt-2.5 text-center" style={{ fontSize: 12, color: '#5a6f7d' }}>
            The club confirms — you&apos;ll get a notification.
          </p>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-1 w-full text-center"
            style={{ fontSize: 13, fontWeight: 700, color: '#5a6f7d', padding: '6px 0' }}
          >
            Cancel
          </button>
        </>
      )}
    </ActionForm>
  )
}
