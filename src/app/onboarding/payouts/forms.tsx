'use client'

import { useActionState } from 'react'
import { openPayoutDashboardAction, refreshPayoutStatusAction, startPayoutOnboardingAction } from '@/lib/actions/billing'
import { adminButton } from '@/components/ui/button-class'
import { Alert } from '@/components/ui'
import type { ActionResult } from '@/lib/actions/result'

function useNoArgAction(action: () => Promise<ActionResult<null>>) {
  return useActionState<ActionResult<null> | null, FormData>(async () => action(), null)
}

export function ConnectPayoutsButton({ resume }: { resume: boolean }) {
  const [state, formAction, pending] = useNoArgAction(startPayoutOnboardingAction)
  return (
    <form action={formAction} className="space-y-2">
      {state && !state.ok && <Alert tone="error">{state.error}</Alert>}
      <button type="submit" disabled={pending} className={adminButton('primary')}>
        {pending ? 'Opening…' : resume ? 'Continue onboarding' : 'Connect payouts'}
      </button>
    </form>
  )
}

export function RefreshPayoutsButton() {
  const [state, formAction, pending] = useNoArgAction(refreshPayoutStatusAction)
  return (
    <form action={formAction} className="space-y-2">
      {state && !state.ok && <Alert tone="error">{state.error}</Alert>}
      <button type="submit" disabled={pending} className={adminButton('secondary')}>
        {pending ? 'Checking…' : 'Refresh status'}
      </button>
    </form>
  )
}

export function OpenPayoutDashboardButton() {
  const [state, formAction, pending] = useNoArgAction(openPayoutDashboardAction)
  return (
    <form action={formAction} className="space-y-2">
      {state && !state.ok && <Alert tone="error">{state.error}</Alert>}
      <button type="submit" disabled={pending} className={adminButton('secondary', 'sm')}>
        {pending ? 'Opening…' : 'Open payout dashboard'}
      </button>
    </form>
  )
}
