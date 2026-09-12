import { permanentRedirect } from 'next/navigation'

/**
 * Reviews were one screen holding two very different things. They now sit with
 * the audience each belongs to: private instructor feedback under People, and
 * the public wall under Club.
 */
export default function LegacyReviewsPage() {
  permanentRedirect('/admin/people?tab=feedback')
}
