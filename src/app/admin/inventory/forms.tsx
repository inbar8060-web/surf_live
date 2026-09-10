'use client'

import {
  saveInventoryTypeAction,
  setItemStatusAction,
  setQuantityAction,
} from '@/lib/actions/admin-inventory'
import { ActionForm, SubmitButton, Disclosure } from '@/components/ui/form'
import { Field, Input, Select } from '@/components/ui'

export function InventoryTypeForm({ categories }: { categories: { id: string; name: string }[] }) {
  return (
    <Disclosure summary="Add a gear type">
      <ActionForm action={saveInventoryTypeAction} resetOnSuccess>
        {({ fieldErrors }) => (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" htmlFor="it-name" error={fieldErrors.name}>
                <Input id="it-name" name="name" required maxLength={120} placeholder="Soft-top 8'0&quot;" />
              </Field>
              <Field label="Kind" htmlFor="it-kind" error={fieldErrors.kind}>
                <Select id="it-kind" name="kind" defaultValue="board">
                  <option value="board">Board</option>
                  <option value="wetsuit">Wetsuit</option>
                  <option value="leash">Leash</option>
                  <option value="fins">Fins</option>
                  <option value="sup">SUP</option>
                  <option value="kayak">Kayak</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
              <Field label="Brand" htmlFor="it-brand" error={fieldErrors.brand}>
                <Input id="it-brand" name="brand" maxLength={80} />
              </Field>
              <Field label="Size" htmlFor="it-size" error={fieldErrors.sizeLabel}>
                <Input id="it-size" name="sizeLabel" maxLength={40} />
              </Field>
              <Field
                label="Daily price"
                htmlFor="it-price"
                error={fieldErrors.dailyPriceCents}
                hint="Minor units — 12000 means 120.00 per day"
              >
                <Input id="it-price" name="dailyPriceCents" type="number" min={0} defaultValue={0} required />
              </Field>
              <Field label="Category" htmlFor="it-cat" error={fieldErrors.categoryId}>
                <Select id="it-cat" name="categoryId" defaultValue="">
                  <option value="">None</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isActive" defaultChecked /> Available for rental
            </label>

            <SubmitButton>Add gear type</SubmitButton>
          </>
        )}
      </ActionForm>
    </Disclosure>
  )
}

/**
 * Set how many units of a type the club holds. Units currently out with a
 * client are never removed — the database function only retires idle ones.
 */
export function QuantityForm({ typeId, current }: { typeId: string; current: number }) {
  return (
    <ActionForm action={setQuantityAction}>
      {() => (
        <div className="flex items-center gap-1.5">
          <input type="hidden" name="typeId" value={typeId} />
          <Input
            name="quantity"
            type="number"
            min={0}
            max={1000}
            defaultValue={current}
            aria-label="Quantity held"
            className="w-20"
          />
          <SubmitButton variant="secondary" size="sm" pendingLabel="…">
            Set
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
          <Select name="status" defaultValue={current} aria-label="Unit status" className="w-36">
            <option value="available">Available</option>
            <option value="maintenance">Maintenance</option>
            <option value="retired">Retired</option>
          </Select>
          <SubmitButton variant="ghost" size="sm" pendingLabel="…">
            Update
          </SubmitButton>
        </div>
      )}
    </ActionForm>
  )
}
