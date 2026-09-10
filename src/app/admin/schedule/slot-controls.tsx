'use client'

import { useState } from 'react'
import { blockSlotAction, cancelSlotAction } from '@/lib/actions/admin-schedule'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { buttonClass } from '@/components/ui/button-class'
import { Input } from '@/components/ui'

/** Block, reopen or cancel a session. */
export function SlotControls({ slotId, isBlocked }: { slotId: string; isBlocked: boolean }) {
  const [showCancel, setShowCancel] = useState(false)

  if (showCancel) {
    return (
      <ActionForm action={cancelSlotAction}>
        {() => (
          <div className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="slotId" value={slotId} />
            <Input
              name="reason"
              placeholder="Reason members will see"
              maxLength={500}
              required
              autoFocus
              className="w-56"
            />
            <SubmitButton
              variant="danger"
              size="sm"
              confirm="Cancel this session? Every booking on it is released."
            >
              Cancel session
            </SubmitButton>
            <button type="button" className={buttonClass('ghost', 'sm')} onClick={() => setShowCancel(false)}>
              Back
            </button>
          </div>
        )}
      </ActionForm>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      <ActionForm action={blockSlotAction}>
        {() => (
          <>
            <input type="hidden" name="slotId" value={slotId} />
            <input type="hidden" name="blocked" value={isBlocked ? 'false' : 'true'} />
            {!isBlocked && <input type="hidden" name="reason" value="Blocked by the club" />}
            <SubmitButton variant="secondary" size="sm">
              {isBlocked ? 'Reopen' : 'Block'}
            </SubmitButton>
          </>
        )}
      </ActionForm>

      <button type="button" className={buttonClass('ghost', 'sm')} onClick={() => setShowCancel(true)}>
        Cancel…
      </button>
    </div>
  )
}
