import { PageTitle, Panel } from '@/components/admin/pieces'
import { ProvisionForm } from './forms'

export const metadata = { title: 'Add a club' }

export default function NewClubPage() {
  return (
    <>
      <PageTitle
        title="Add a club"
        sub="Three things: a name, where it is, and who runs it. The platform does the rest."
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,640px)_1fr]">
        <Panel title="The club">
          <ProvisionForm platformDomain={process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? ''} />
        </Panel>
        <Panel title="What happens next">
          <ol className="flex flex-col gap-2" style={{ fontSize: 13, paddingLeft: 18 }}>
            <li>The club gets its own address, <code>name.{process.env.NEXT_PUBLIC_PLATFORM_DOMAIN}</code>, and its own settings row.</li>
            <li>Every row it will ever write is stamped with its id; the database refuses a row that names another club, and every read is filtered by it.</li>
            <li>The administrator receives a single-use link, valid for seven days, that creates their account inside this club and no other.</li>
            <li>They add instructors, sessions and gear themselves. You see counts of what they do, never the rows.</li>
          </ol>
        </Panel>
      </div>
    </>
  )
}
