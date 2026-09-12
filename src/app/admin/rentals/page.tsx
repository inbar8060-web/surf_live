import { permanentRedirect } from 'next/navigation'

/** Rentals are now the default tab of the Gear category. */
export default function LegacyRentalsPage() {
  permanentRedirect('/admin/gear')
}
