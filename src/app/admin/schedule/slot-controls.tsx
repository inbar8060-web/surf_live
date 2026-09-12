'use client'

import { useState } from 'react'
import { Ellipsis } from 'lucide-react'
import { blockSlotAction, cancelSlotAction } from '@/lib/actions/admin-schedule'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { adminButton } from '@/components/ui/button-class'

/**
 * Block, reopen or cancel a session. The three actions sit behind one control
 * because they are rare and destructive; cancelling asks for a reason first,
 * which the member sees.
 */
export function SlotControls({ slotId, isBlocked }: { slotId: string; isBlocked: boolean }) {
  const [open, setOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  if (cancelling) {
    return (
      <ActionForm action={cancelSlotAction}>
        {() => (
          <div className="flex flex-wrap items-center gap-2" style={{ width: 400, maxWidth: '100%' }}>
            <input type="hidden" name="slotId" value={slotId} />
            <input
              name="reason"
              placeholder="Reason members will see"
              maxLength={500}
              required
              autoFocus
              className="a-input"
              style={{ width: 220 }}
            />
            <SubmitButton
              className={adminButton('danger', 'sm')}
              confirm="Cancel this session? Every booking on it is released."
              pendingLabel="…"
            >
              Cancel session
            </SubmitButton>
            <button type="button" className={adminButton('quiet', 'sm')} onClick={() => setCancelling(false)}>
              Back
            </button>
          </div>
        )}
      </ActionForm>
    )
  }

  return (
    <div className="relative flex items-center gap-1.5">
      {open && (
        <>
          <ActionForm action={blockSlotAction}>
            {() => (
              <>
                <input type="hidden" name="slotId" value={slotId} />
                <input type="hidden" name="blocked" value={isBlocked ? 'false' : 'true'} />
                {!isBlocked && <input type="hidden" name="reason" value="Blocked by the club" />}
                <SubmitButton className={adminButton('secondary', 'sm')} pendingLabel="…">
                  {isBlocked ? 'Reopen' : 'Block'}
                </SubmitButton>
              </>
            )}
          </ActionForm>
          <button type="button" className={adminButton('quiet', 'sm')} onClick={() => setCancelling(true)}>
            Cancel…
          </button>
        </>
      )}

      <button
        type="button"
        aria-label="Block, reopen or cancel this session"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center"
        style={{ width: 35, height: 35, borderRadius: 9, border: '1.5px solid var(--color-adm-line)', background: '#fff' }}
      >
        <Ellipsis size={16} />
      </button>
    </div>
  )
}
