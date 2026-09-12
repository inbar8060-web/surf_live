'use client'

import { closeSupportConversationAction, replyAsPlatformAction } from '@/lib/actions/support'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { adminButton } from '@/components/ui/button-class'

export function PlatformReplyForm({ conversationId }: { conversationId: string }) {
  return (
    <ActionForm action={replyAsPlatformAction} resetOnSuccess>
      {({ fieldErrors }) => (
        <>
          <input type="hidden" name="conversationId" value={conversationId} />
          <textarea
            name="body"
            required
            rows={4}
            maxLength={8000}
            className="a-input"
            style={{ height: 'auto', padding: 12, resize: 'vertical' }}
            placeholder="Reply to the club's administrator…"
          />
          {fieldErrors.body && <p className="field-error">{fieldErrors.body}</p>}
          <SubmitButton className={adminButton('primary')} pendingLabel="Sending…">
            Send reply
          </SubmitButton>
        </>
      )}
    </ActionForm>
  )
}

export function PlatformCloseForm({ conversationId }: { conversationId: string }) {
  return (
    <ActionForm action={closeSupportConversationAction}>
      {() => (
        <>
          <input type="hidden" name="conversationId" value={conversationId} />
          <input name="note" maxLength={2000} className="a-input" placeholder="Closing note (optional)" />
          <SubmitButton className={adminButton('secondary', 'sm')} confirm="Close this conversation?">
            Close conversation
          </SubmitButton>
        </>
      )}
    </ActionForm>
  )
}
