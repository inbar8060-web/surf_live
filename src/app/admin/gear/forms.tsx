'use client'

import { useState } from 'react'
import {
  createRentalAction,
  returnRentalAction,
  saveInventoryTypeAction,
  setItemStatusAction,
  setQuantityAction,
} from '@/lib/actions/admin-inventory'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { adminButton } from '@/components/ui/button-class'

const label = (text: string) => (
  <span className="a-label mb-1.5 block" style={{ color: 'var(--color-adm-ink-2)' }}>
    {text}
  </span>
)

export function InventoryTypeForm({ categories }: { categories: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button type="button" className={adminButton('secondary')} onClick={() => setOpen(true)}>
        New gear type
      </button>
    )
  }

  return (
    <div className="a-card w-full" style={{ padding: '16px 18px' }}>
      <div className="mb-3 flex items-center justify-between">
        <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>New gear type</h3>
        <button type="button" className={adminButton('quiet', 'sm')} onClick={() => setOpen(false)}>
          Close
        </button>
      </div>

      <ActionForm action={saveInventoryTypeAction} resetOnSuccess>
        {({ fieldErrors }) => (
          <>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div>
                {label('Name')}
                <input name="name" required maxLength={120} className="a-input" placeholder="Soft-top 8ft" />
                {fieldErrors.name && <p className="field-error">{fieldErrors.name}</p>}
              </div>
              <div>
                {label('Kind')}
                <select name="kind" defaultValue="board" className="a-input">
                  <option value="board">Board</option>
                  <option value="wetsuit">Wetsuit</option>
                  <option value="leash">Leash</option>
                  <option value="fins">Fins</option>
                  <option value="sup">SUP</option>
                  <option value="kayak">Kayak</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                {label('Brand')}
                <input name="brand" maxLength={80} className="a-input" />
              </div>
              <div>
                {label('Size')}
                <input name="sizeLabel" maxLength={40} className="a-input" />
              </div>
              <div>
                {label('Daily price')}
                <input name="dailyPriceCents" type="number" min={0} defaultValue={0} required className="a-input" />
                <p className="a-helper" style={{ marginTop: 4 }}>
                  Minor units — 12000 means 120.00 per day.
                </p>
              </div>
              <div>
                {label('Category')}
                <select name="categoryId" defaultValue="" className="a-input">
                  <option value="">None</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2" style={{ fontSize: 13 }}>
              <input type="checkbox" name="isActive" defaultChecked /> Available for rental
            </label>

            <SubmitButton className={adminButton('primary')} pendingLabel="Saving…">
              Add gear type
            </SubmitButton>
          </>
        )}
      </ActionForm>
    </div>
  )
}

/**
 * Stock level for a type. The database function only ever retires idle units,
 * so a board that is out with a member can never be removed from under them.
 */
export function QuantityForm({ typeId, current }: { typeId: string; current: number }) {
  return (
    <ActionForm action={setQuantityAction}>
      {() => (
        <div className="flex items-center gap-1.5">
          <input type="hidden" name="typeId" value={typeId} />
          <input
            name="quantity"
            type="number"
            min={0}
            max={1000}
            defaultValue={current}
            aria-label="Units held"
            className="a-input"
            style={{ width: 74, height: 36 }}
          />
          <SubmitButton className={adminButton('secondary', 'sm')} pendingLabel="…">
            Save
          </SubmitButton>
        </div>
      )}
    </ActionForm>
  )
}

export function ItemStatusForm({ itemId, current }: { itemId: string; current: string }) {
  return (
    <ActionForm action={setItemStatusAction}>
      {() => (
        <div className="flex items-center gap-1.5">
          <input type="hidden" name="itemId" value={itemId} />
          <select
            name="status"
            defaultValue={current}
            aria-label="Unit status"
            className="a-input"
            style={{ width: 140, height: 36 }}
          >
            <option value="available">Available</option>
            <option value="maintenance">Maintenance</option>
            <option value="retired">Retired</option>
          </select>
          <SubmitButton className={adminButton('quiet', 'sm')} pendingLabel="…">
            Update
          </SubmitButton>
        </div>
      )}
    </ActionForm>
  )
}

export function ReturnForm({ rentalId }: { rentalId: string }) {
  return (
    <ActionForm action={returnRentalAction}>
      {() => (
        <div className="flex flex-wrap items-center gap-1.5">
          <input type="hidden" name="rentalId" value={rentalId} />
          <select
            name="conditionIn"
            defaultValue="good"
            aria-label="Condition back"
            className="a-input"
            style={{ width: 132, height: 36 }}
          >
            <option value="new">New</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="poor">Poor</option>
          </select>
          <input
            name="damageNote"
            placeholder="Damage note"
            maxLength={1000}
            aria-label="Damage note"
            className="a-input"
            style={{ width: 170, height: 36 }}
          />
          <SubmitButton className={adminButton('primary', 'sm')} pendingLabel="…">
            Book it in
          </SubmitButton>
        </div>
      )}
    </ActionForm>
  )
}

export function NewRentalForm({
  clients,
  items,
}: {
  clients: { id: string; name: string }[]
  items: { id: string; label: string; dailyCents: number; currency: string }[]
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [itemId, setItemId] = useState('')
  const [start, setStart] = useState(today)
  const [end, setEnd] = useState(today)

  const item = items.find((i) => i.id === itemId)
  const days =
    Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000)) + 1
  const total = item ? item.dailyCents * days : 0
  const money = (cents: number, currency: string) =>
    new Intl.NumberFormat('en-IL', { style: 'currency', currency }).format(cents / 100)

  return (
    <ActionForm action={createRentalAction} resetOnSuccess>
      {({ fieldErrors }) => (
        <>
          <div>
            {label('Member')}
            <select name="clientId" required defaultValue="" className="a-input">
              <option value="" disabled>
                Choose a member
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {fieldErrors.clientId && <p className="field-error">{fieldErrors.clientId}</p>}
          </div>

          <div>
            {label('Unit')}
            <select
              name="itemId"
              required
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="a-input"
            >
              <option value="" disabled>
                Choose a unit
              </option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </select>
            <p className="a-helper" style={{ marginTop: 4 }}>
              Only units currently in stock are listed.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              {label('From')}
              <input
                name="startDate"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
                className="a-input"
              />
            </div>
            <div>
              {label('Until')}
              <input
                name="endDate"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                required
                className="a-input"
              />
              {fieldErrors.endDate && <p className="field-error">{fieldErrors.endDate}</p>}
            </div>
          </div>

          {item && (
            <div
              className="flex items-center justify-between"
              style={{ background: 'var(--color-adm-ground)', borderRadius: 11, padding: '10px 12px' }}
            >
              <span className="a-helper">
                {days} day{days === 1 ? '' : 's'} x {money(item.dailyCents, item.currency)}
              </span>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{money(total, item.currency)}</span>
            </div>
          )}
          <p className="a-helper">
            The amount charged is worked out by the database from the gear type, not from this form.
          </p>

          <div className="flex gap-2">
            <SubmitButton
              name="handOverNow"
              value="on"
              className={`${adminButton('primary')} flex-1`}
              pendingLabel="…"
            >
              Hand over now
            </SubmitButton>
            <SubmitButton className={`${adminButton('secondary')} flex-1`} pendingLabel="…">
              Reserve for later
            </SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  )
}
