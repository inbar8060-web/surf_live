import { signOutAction } from '@/lib/actions/auth'
import { buttonClass } from '@/components/ui/button-class'

export const metadata = { title: 'Club closed' }

/** Where a signed-in person lands when the club their account belongs to is no longer on the platform. */
export default function ClubClosedPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="text-3xl" aria-hidden>🌊</p>
      <h1 className="mt-2 text-2xl font-semibold">This club is no longer on Surfer Live</h1>
      <p className="muted mt-2 text-sm">
        Your account belongs to a club that has left the platform, so there is nothing here to open. If you think
        this is a mistake, contact the club directly.
      </p>
      <form action={signOutAction} className="mt-6">
        <button type="submit" className={buttonClass('secondary')}>Sign out</button>
      </form>
    </div>
  )
}
