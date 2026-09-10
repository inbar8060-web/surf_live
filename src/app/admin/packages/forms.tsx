'use client'

import { savePackageTemplateAction } from '@/lib/actions/admin-packages'
import { ActionForm, SubmitButton, Disclosure } from '@/components/ui/form'
import { Field, Input, Select, Textarea } from '@/components/ui'

export function PackageTemplateForm({ categories }: { categories: { id: string; name: string }[] }) {
  return (
    <Disclosure summary="Add a package type">
      <ActionForm action={savePackageTemplateAction} resetOnSuccess>
        {({ fieldErrors }) => (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" htmlFor="pt-name" error={fieldErrors.name}>
                <Input id="pt-name" name="name" required maxLength={120} placeholder="Starter pack - 5 lessons" />
              </Field>
              <Field label="Category" htmlFor="pt-cat" error={fieldErrors.categoryId}>
                <Select id="pt-cat" name="categoryId" defaultValue="">
                  <option value="">Any</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Lessons included" htmlFor="pt-count" error={fieldErrors.lessonsCount}>
                <Input id="pt-count" name="lessonsCount" type="number" min={1} max={200} defaultValue={5} required />
              </Field>
              <Field
                label="Valid for (days)"
                htmlFor="pt-days"
                error={fieldErrors.validityDays}
                hint="Counted from the day it is attached."
              >
                <Input id="pt-days" name="validityDays" type="number" min={1} max={1095} defaultValue={180} required />
              </Field>
              <Field
                label="Price"
                htmlFor="pt-price"
                error={fieldErrors.priceCents}
                hint="Minor units — 80000 means 800.00"
              >
                <Input id="pt-price" name="priceCents" type="number" min={0} defaultValue={0} required />
              </Field>
            </div>

            <Field label="Description" htmlFor="pt-desc" error={fieldErrors.description}>
              <Textarea id="pt-desc" name="description" rows={2} maxLength={1000} />
            </Field>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isActive" defaultChecked /> On sale
            </label>

            <SubmitButton>Add package type</SubmitButton>
          </>
        )}
      </ActionForm>
    </Disclosure>
  )
}
