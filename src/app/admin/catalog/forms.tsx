'use client'

import { useState } from 'react'
import {
  changePriceAction,
  deleteCategoryAction,
  saveCategoryAction,
  saveServiceAction,
} from '@/lib/actions/admin-catalog'
import { savePackageTemplateAction } from '@/lib/actions/admin-packages'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { adminButton } from '@/components/ui/button-class'

export interface CategoryOption {
  id: string
  name: string
}

const label = (text: string) => (
  <span className="a-label mb-1.5 block" style={{ color: 'var(--color-adm-ink-2)' }}>
    {text}
  </span>
)

/** Wraps a create form in a disclosure so the table stays the focus. */
function CreatePanel({ cta, children }: { cta: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button type="button" className={adminButton('secondary')} onClick={() => setOpen(true)}>
        {cta}
      </button>
    )
  }

  return (
    <div className="a-card w-full" style={{ padding: '16px 18px' }}>
      <div className="mb-3 flex items-center justify-between">
        <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>{cta}</h3>
        <button type="button" className={adminButton('quiet', 'sm')} onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      {children}
    </div>
  )
}

export function CategoryForm() {
  return (
    <CreatePanel cta="New category">
      <ActionForm action={saveCategoryAction} resetOnSuccess>
        {({ fieldErrors }) => (
          <>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div>
                {label('Name')}
                <input name="name" required maxLength={80} className="a-input" />
                {fieldErrors.name && <p className="field-error">{fieldErrors.name}</p>}
              </div>
              <div>
                {label('Slug')}
                <input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" className="a-input" placeholder="group-lessons" />
                {fieldErrors.slug && <p className="field-error">{fieldErrors.slug}</p>}
              </div>
              <div>
                {label('Kind')}
                <select name="kind" defaultValue="lesson" className="a-input">
                  <option value="lesson">Lessons</option>
                  <option value="rental">Rentals</option>
                  <option value="service">Other services</option>
                </select>
              </div>
              <div>
                {label('Order')}
                <input name="sortOrder" type="number" min={0} defaultValue={0} className="a-input" />
              </div>
            </div>

            <label className="flex items-center gap-2" style={{ fontSize: 13 }}>
              <input type="checkbox" name="isActive" defaultChecked /> Visible to members
            </label>

            <SubmitButton className={adminButton('primary')} pendingLabel="Saving…">
              Add category
            </SubmitButton>
          </>
        )}
      </ActionForm>
    </CreatePanel>
  )
}

export function ServiceForm({ categories }: { categories: CategoryOption[] }) {
  return (
    <CreatePanel cta="New service">
      <ActionForm action={saveServiceAction} resetOnSuccess>
        {({ fieldErrors }) => (
          <>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div>
                {label('Category')}
                <select name="categoryId" required defaultValue="" className="a-input">
                  <option value="" disabled>
                    Choose a category
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.categoryId && <p className="field-error">{fieldErrors.categoryId}</p>}
              </div>
              <div>
                {label('Name')}
                <input name="name" required maxLength={120} className="a-input" />
              </div>
              <div>
                {label('Duration (minutes)')}
                <input name="durationMinutes" type="number" min={15} max={600} defaultValue={90} required className="a-input" />
              </div>
              <div>
                {label('Default capacity')}
                <input name="defaultCapacity" type="number" min={1} max={100} defaultValue={6} required className="a-input" />
              </div>
              <div>
                {label('Price')}
                <input name="priceCents" type="number" min={0} defaultValue={0} required className="a-input" />
                <p className="a-helper" style={{ marginTop: 4 }}>
                  Minor units — 18000 means 180.00.
                </p>
              </div>
              <div>
                {label('Minimum level')}
                <select name="minLevel" defaultValue="" className="a-input">
                  <option value="">Any level</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="pro">Pro</option>
                </select>
              </div>
            </div>

            <div>
              {label('Description')}
              <textarea name="description" rows={2} maxLength={2000} className="a-input" style={{ height: 'auto', paddingBlock: 9 }} />
            </div>

            <label className="flex items-center gap-2" style={{ fontSize: 13 }}>
              <input type="checkbox" name="isActive" defaultChecked /> Bookable
            </label>

            <SubmitButton className={adminButton('primary')} pendingLabel="Saving…">
              Add service
            </SubmitButton>
          </>
        )}
      </ActionForm>
    </CreatePanel>
  )
}

export function PackageTemplateForm({ categories }: { categories: CategoryOption[] }) {
  return (
    <CreatePanel cta="New package type">
      <ActionForm action={savePackageTemplateAction} resetOnSuccess>
        {({ fieldErrors }) => (
          <>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div>
                {label('Name')}
                <input name="name" required maxLength={120} className="a-input" placeholder="Starter pack - 5 lessons" />
                {fieldErrors.name && <p className="field-error">{fieldErrors.name}</p>}
              </div>
              <div>
                {label('Category')}
                <select name="categoryId" defaultValue="" className="a-input">
                  <option value="">Any</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                {label('Lessons included')}
                <input name="lessonsCount" type="number" min={1} max={200} defaultValue={5} required className="a-input" />
              </div>
              <div>
                {label('Valid for (days)')}
                <input name="validityDays" type="number" min={1} max={1095} defaultValue={180} required className="a-input" />
                <p className="a-helper" style={{ marginTop: 4 }}>
                  Counted from the day it is attached.
                </p>
              </div>
              <div>
                {label('Price')}
                <input name="priceCents" type="number" min={0} defaultValue={0} required className="a-input" />
              </div>
            </div>

            <label className="flex items-center gap-2" style={{ fontSize: 13 }}>
              <input type="checkbox" name="isActive" defaultChecked /> On sale
            </label>

            <SubmitButton className={adminButton('primary')} pendingLabel="Saving…">
              Add package type
            </SubmitButton>
          </>
        )}
      </ActionForm>
    </CreatePanel>
  )
}

/**
 * Inline price editor. Every submission is appended to price_history by a
 * database trigger, so the previous figure is always recoverable.
 */
export function PriceEditor({
  entityType,
  entityId,
  priceCents,
  label: fieldLabel = 'Price',
}: {
  entityType: 'service' | 'inventory_type' | 'package_template' | 'time_slot'
  entityId: string
  priceCents: number
  label?: string
}) {
  return (
    <ActionForm action={changePriceAction}>
      {() => (
        <div className="flex items-center gap-1.5">
          <input type="hidden" name="entityType" value={entityType} />
          <input type="hidden" name="entityId" value={entityId} />
          <input
            name="priceCents"
            type="number"
            min={0}
            defaultValue={priceCents}
            aria-label={fieldLabel}
            className="a-input"
            style={{ width: 86, height: 36 }}
          />
          <SubmitButton className={adminButton('secondary', 'sm')} pendingLabel="…">
            Save
          </SubmitButton>
        </div>
      )}
    </ActionForm>
  )
}

export function DeleteCategoryButton({ id }: { id: string }) {
  return (
    <ActionForm action={deleteCategoryAction}>
      {() => (
        <>
          <input type="hidden" name="id" value={id} />
          <SubmitButton
            className={adminButton('quiet', 'sm')}
            confirm="Remove this category? If it has services it is deactivated instead."
            pendingLabel="…"
          >
            Remove
          </SubmitButton>
        </>
      )}
    </ActionForm>
  )
}
