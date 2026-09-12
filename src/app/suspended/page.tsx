import { getRequestClub } from '@/lib/tenant'
import { signOutAction } from '@/lib/actions/auth'
import { buttonClass } from '@/components/ui/button-class'

export const metadata = { title: 'Paused' }

export default async function SuspendedPage() {
  const club = await getRequestClub()
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="text-3xl" aria-hidden>🌊</p>
      <h1 className="mt-2 text-2xl font-semibold">{club?.name ?? 'This club'} is paused</h1>
      <p className="muted mt-2 text-sm">
        Bookings and sessions are on hold for the moment. The club will be in touch when things are
        running again.
      </p>
      <form action={signOutAction} className="mt-6">
        <button type="submit" className={buttonClass('secondary')}>Sign out</button>
      </form>
    </div>
  )
}
