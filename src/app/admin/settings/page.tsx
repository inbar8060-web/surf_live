import { permanentRedirect } from 'next/navigation'

/** Settings are now the default tab of the Club category. */
export default function LegacySettingsPage() {
  permanentRedirect('/admin/club')
}
