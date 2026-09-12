import { permanentRedirect } from 'next/navigation'

/** The requests screen is now the Bookings category. */
export default async function LegacyRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const { view } = await searchParams
  permanentRedirect(view ? `/admin/bookings?tab=${view}` : '/admin/bookings')
}
