import { permanentRedirect } from 'next/navigation'

/** Lesson packages now live inside the Catalog category. */
export default function LegacyPackagesPage() {
  permanentRedirect('/admin/catalog?tab=packages')
}
