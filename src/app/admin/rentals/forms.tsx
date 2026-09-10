'use client'

import {
  createRentalAction,
  returnRentalAction,
  setRentalStatusAction,
} from '@/lib/actions/admin-inventory'
import { ActionForm, SubmitButton, Disclosure } from '@/components/ui/form'
import { Field, Input, Select } from '@/components/ui'

export function NewRentalForm({
  clients,
  items,
}: {
  clients: { id: string; name: string }[]
  items: { id: string; label: string }[]
}) {
  const today = new Date().toISOString().slice(0, 10)

  return (
    <Disclosure summary="Hand out a board" defaultOpen>
      <ActionForm action={createRentalAction} resetOnSuccess>
        {({ fieldErrors }) => (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Member" htmlFor="r-client" error={fieldErrors.clientId}>
                <Select id="r-client" name="clientId" required defaultValue="">
                  <option value="" disabled>
                    Choose a member
                  </option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Unit"
                htmlFor="r-item"
                error={fieldErrors.itemId}
                hint="Only units currently in stock are listed."
              >
                <Select id="r-item" name="itemId" required defaultValue="">
                  <option value="" disabled>
                    Choose a unit
                  </option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="From" htmlFor="r-start" error={fieldErrors.startDate}>
                <Input id="r-start" name="startDate" type="date" defaultValue={today} required />
              </Field>

              <Field label="Until" htmlFor="r-end" error={fieldErrors.endDate}>
                <Input id="r-end" name="endDate" type="date" defaultValue={today} required />
              </Field>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="handOverNow" defaultChecked />
              Handing it over now (takes the board out of stock immediately)
            </label>

            <SubmitButton>Create rental</SubmitButton>
          </>
        )}
      </ActionForm>
    </Disclosure>
  )
}

export function ReturnForm({ rentalId }: { rentalId: string }) {
  return (
    <ActionForm action={returnRentalAction}>
      {() => (
        <div className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="rentalId" value={rentalId} />
          <div>
            <label className="field-label" htmlFor={`cond-${rentalId}`}>
              Condition back
            </label>
            <Select id={`cond-${rentalId}`} name="conditionIn" defaultValue="good" className="w-32">
              <option value="new">New</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
            </Select>
          </div>
          <Input name="damageNote" placeholder="Damage note (optional)" maxLength={1000} className="w-52" />
          <SubmitButton size="sm">Book back in</SubmitButton>
        </div>
      )}
    </ActionForm>
  )
}

export function RentalStatusForm({ rentalId, current }: { rentalId: string; current: string }) {
  return (
    <ActionForm action={setRentalStatusAction}>
      {() => (
        <div className="flex items-center gap-1.5">
          <input type="hidden" name="rentalId" value={rentalId} />
          <Select name="status" defaultValue={current} aria-label="Rental status" className="w-32">
            <option value="reserved">Reserved</option>
            <option value="out">Out</option>
            <option value="overdue">Overdue</option>
            <option value="lost">Lost</option>
          </Select>
          <SubmitButton variant="ghost" size="sm" pendingLabel="…">
            Set
          </SubmitButton>
        </div>
      )}
    </ActionForm>
  )
}
