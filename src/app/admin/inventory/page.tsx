import { permanentRedirect } from 'next/navigation'

/** Inventory is now the "Gear types" tab of the Gear category. */
export default function LegacyInventoryPage() {
  permanentRedirect('/admin/gear?tab=types')
}
