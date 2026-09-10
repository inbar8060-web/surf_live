'use client'

import {
  changePriceAction,
  deleteCategoryAction,
  saveCategoryAction,
  saveServiceAction,
} from '@/lib/actions/admin-catalog'
import { ActionForm, SubmitButton, Disclosure } from '@/components/ui/form'
import { Field, Input, Select, Textarea } from '@/components/ui'

export interface CategoryOption {
  id: string
  name: string
}

export function CategoryForm() {
  return (
    <Disclosure summary="Add a category">
      <ActionForm action={saveCategoryAction} resetOnSuccess>
        {({ fieldErrors }) => (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" htmlFor="cat-name" error={fieldErrors.name}>
                <Input id="cat-name" name="name" required maxLength={80} />
              </Field>
              <Field
                label="Slug"
                htmlFor="cat-slug"
                error={fieldErrors.slug}
                hint="Used in links, e.g. group-lessons"
              >
                <Input id="cat-slug" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" />
              </Field>
              <Field label="Kind" htmlFor="cat-kind" error={fieldErrors.kind}>
                <Select id="cat-kind" name="kind" defaultValue="lesson">
                  <option value="lesson">Lessons</option>
                  <option value="rental">Rentals</option>
                  <option value="service">Other services</option>
                </Select>
              </Field>
              <Field label="Order" htmlFor="cat-order" error={fieldErrors.sortOrder}>
                <Input id="cat-order" name="sortOrder" type="number" min={0} defaultValue={0} />
              </Field>
            </div>

            <Field label="Description" htmlFor="cat-desc" error={fieldErrors.description}>
              <Textarea id="cat-desc" name="description" rows={2} maxLength={1000} />
            </Field>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isActive" defaultChecked /> Visible to members
            </label>

            <SubmitButton>Add category</SubmitButton>
          </>
        )}
      </ActionForm>
    </Disclosure>
  )
}

export function ServiceForm({ categories }: { categories: CategoryOption[] }) {
  return (
    <Disclosure summary="Add a service">
      <ActionForm action={saveServiceAction} resetOnSuccess>
        {({ fieldErrors }) => (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Category" htmlFor="svc-cat" error={fieldErrors.categoryId}>
                <Select id="svc-cat" name="categoryId" required defaultValue="">
                  <option value="" disabled>
                    Choose a category
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Name" htmlFor="svc-name" error={fieldErrors.name}>
                <Input id="svc-name" name="name" required maxLength={120} />
              </Field>
              <Field label="Duration (minutes)" htmlFor="svc-dur" error={fieldErrors.durationMinutes}>
                <Input id="svc-dur" name="durationMinutes" type="number" min={15} max={600} defaultValue={90} required />
              </Field>
              <Field label="Default capacity" htmlFor="svc-cap" error={fieldErrors.defaultCapacity}>
                <Input id="svc-cap" name="defaultCapacity" type="number" min={1} max={100} defaultValue={6} required />
              </Field>
              <Field
                label="Price"
                htmlFor="svc-price"
                error={fieldErrors.priceCents}
                hint="Minor units — 18000 means 180.00"
              >
                <Input id="svc-price" name="priceCents" type="number" min={0} defaultValue={0} required />
              </Field>
              <Field
                label="Minimum level"
                htmlFor="svc-level"
                error={fieldErrors.minLevel}
                hint="Leave open for everyone."
              >
                <Select id="svc-level" name="minLevel" defaultValue="">
                  <option value="">Any level</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="pro">Pro</option>
                </Select>
              </Field>
            </div>

            <Field label="Description" htmlFor="svc-desc" error={fieldErrors.description}>
              <Textarea id="svc-desc" name="description" rows={2} maxLength={2000} />
            </Field>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isActive" defaultChecked /> Bookable
            </label>

            <SubmitButton>Add service</SubmitButton>
          </>
        )}
      </ActionForm>
    </Disclosure>
  )
}

/**
 * Inline price editor. Every submission is recorded in price_history by a
 * database trigger, so the previous figure is always recoverable.
 */
export function PriceEditor({
  entityType,
  entityId,
  priceCents,
  label = 'Price',
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
          <Input
            name="priceCents"
            type="number"
            min={0}
            defaultValue={priceCents}
            aria-label={label}
            className="w-28"
          />
          <SubmitButton variant="secondary" size="sm" pendingLabel="…">
            Set
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
            variant="ghost"
            size="sm"
            confirm="Remove this category? If it has services it is deactivated instead."
          >
            Remove
          </SubmitButton>
        </>
      )}
    </ActionForm>
  )
}
