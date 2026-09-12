import { createUserClient } from '@/lib/supabase/server'
import { getClubSettings } from '@/lib/db/queries'
import { AdmChip, EmptyRow, PageTitle, Panel, SubTabs } from '@/components/admin/pieces'
import { formatDateTime, formatMoney } from '@/lib/util/format'
import {
  CategoryForm,
  DeleteCategoryButton,
  PackageTemplateForm,
  PriceEditor,
  ServiceForm,
} from './forms'

export const metadata = { title: 'Catalog' }
export const dynamic = 'force-dynamic'

export default async function AdminCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const view = ['categories', 'packages', 'prices'].includes(tab ?? '') ? tab! : ''

  const supabase = await createUserClient()
  const club = await getClubSettings()

  const [categoriesRes, servicesRes, templatesRes, historyRes] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order').order('name'),
    supabase.from('services').select('*').order('name'),
    supabase.from('package_templates').select('*').order('name'),
    supabase.from('price_history').select('*').order('created_at', { ascending: false }).limit(25),
  ])

  const categories = categoriesRes.data ?? []
  const services = servicesRes.data ?? []
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))
  const options = categories.map((c) => ({ id: c.id, name: c.name }))

  return (
    <>
      <PageTitle
        title="Catalog"
        sub="What the club sells, and what it costs."
        actions={
          view === 'categories' ? (
            <CategoryForm />
          ) : view === 'packages' ? (
            <PackageTemplateForm categories={options} />
          ) : view === '' ? (
            <ServiceForm categories={options} />
          ) : null
        }
      />

      <SubTabs
        base="/admin/catalog"
        current={view}
        tabs={[
          { key: '', label: 'Services & prices' },
          { key: 'categories', label: 'Categories' },
          { key: 'packages', label: 'Lesson packages' },
          { key: 'prices', label: 'Price history' },
        ]}
      />

      {view === '' && (
        <Panel helper="Changing a price here never changes what an existing booking costs — the price is fixed when the booking is made.">
          {services.length ? (
            <div className="table-wrap" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Category</th>
                    <th>Duration</th>
                    <th>Capacity</th>
                    <th>Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((service) => (
                    <tr key={service.id}>
                      <td>
                        <p style={{ margin: 0, fontWeight: 800 }}>{service.name}</p>
                        {service.description && (
                          <p className="a-helper" style={{ margin: '2px 0 0' }}>
                            {service.description}
                          </p>
                        )}
                        {service.min_level && (
                          <p className="a-helper" style={{ margin: '2px 0 0' }}>
                            Minimum level: {service.min_level}
                          </p>
                        )}
                      </td>
                      <td>{categoryName.get(service.category_id) ?? '—'}</td>
                      <td className="tabular-nums">{service.duration_minutes} min</td>
                      <td className="tabular-nums">{service.default_capacity}</td>
                      <td>
                        <p className="a-helper" style={{ margin: '0 0 5px' }}>
                          {formatMoney(service.price_cents, service.currency)}
                        </p>
                        <PriceEditor entityType="service" entityId={service.id} priceCents={service.price_cents} />
                      </td>
                      <td>
                        {service.is_active ? (
                          <AdmChip tone="green">Bookable</AdmChip>
                        ) : (
                          <AdmChip>Off</AdmChip>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyRow>No services yet.</EmptyRow>
          )}
        </Panel>
      )}

      {view === 'categories' && (
        <Panel>
          {categories.length ? (
            <div className="table-wrap" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Kind</th>
                    <th>Services</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id}>
                      <td>
                        <p style={{ margin: 0, fontWeight: 800 }}>{category.name}</p>
                        <p className="a-helper" style={{ margin: '2px 0 0' }}>
                          /{category.slug}
                        </p>
                      </td>
                      <td>{category.kind}</td>
                      <td className="tabular-nums">
                        {services.filter((s) => s.category_id === category.id).length}
                      </td>
                      <td>
                        {category.is_active ? <AdmChip tone="green">Visible</AdmChip> : <AdmChip>Hidden</AdmChip>}
                      </td>
                      <td>
                        <DeleteCategoryButton id={category.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyRow>No categories yet — add the first one above.</EmptyRow>
          )}
        </Panel>
      )}

      {view === 'packages' && (
        <Panel helper="Packages are attached to a member from their record under People.">
          {templatesRes.data?.length ? (
            <div className="table-wrap" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Lessons</th>
                    <th>Valid for</th>
                    <th>Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {templatesRes.data.map((template) => (
                    <tr key={template.id}>
                      <td>
                        <p style={{ margin: 0, fontWeight: 800 }}>{template.name}</p>
                        {template.description && (
                          <p className="a-helper" style={{ margin: '2px 0 0' }}>
                            {template.description}
                          </p>
                        )}
                      </td>
                      <td className="tabular-nums">{template.lessons_count}</td>
                      <td className="tabular-nums">{template.validity_days} days</td>
                      <td>
                        <p className="a-helper" style={{ margin: '0 0 5px' }}>
                          {formatMoney(template.price_cents, template.currency)}
                        </p>
                        <PriceEditor
                          entityType="package_template"
                          entityId={template.id}
                          priceCents={template.price_cents}
                        />
                      </td>
                      <td>
                        {template.is_active ? <AdmChip tone="green">On sale</AdmChip> : <AdmChip>Off</AdmChip>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyRow>No package types yet.</EmptyRow>
          )}
        </Panel>
      )}

      {view === 'prices' && (
        <Panel helper="Appended automatically whenever a price moves. This log cannot be edited or deleted.">
          {historyRes.data?.length ? (
            <ul className="flex flex-col">
              {historyRes.data.map((entry, i) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                  style={{ borderTop: i === 0 ? undefined : '1px solid var(--color-adm-rule)', fontSize: 13 }}
                >
                  <span>
                    <span style={{ fontWeight: 800 }}>{entry.entity_type.replace('_', ' ')}</span>{' '}
                    {entry.old_price_cents === null
                      ? 'set to'
                      : `${formatMoney(entry.old_price_cents, entry.currency)} →`}{' '}
                    {formatMoney(entry.new_price_cents, entry.currency)}
                  </span>
                  <span className="a-helper">{formatDateTime(entry.created_at, club.timezone)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyRow>No price changes recorded yet.</EmptyRow>
          )}
        </Panel>
      )}
    </>
  )
}
