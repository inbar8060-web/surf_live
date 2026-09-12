'use client'

import { useRouter } from 'next/navigation'
import {
  closeSupportConversationAction,
  escalateSupportConversationAction,
  openSupportConversationAction,
  sendSupportMessageAction,
} from '@/lib/actions/support'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { adminButton } from '@/components/ui/button-class'

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="a-label mb-1.5 block" style={{ color: 'var(--color-adm-ink-2)' }}>
      {children}
    </span>
  )
}

export function OpenForm() {
  const router = useRouter()
  return (
    <ActionForm action={openSupportConversationAction} onSuccess={(data) => router.push(`/admin/support?c=${data.id}`)}>
      {({ fieldErrors }) => (
        <>
          <div>
            <Label>What is it about?</Label>
            <input name="subject" required minLength={3} maxLength={200} className="a-input" placeholder="e.g. Members cannot see Saturday's sessions" />
            {fieldErrors.subject && <p className="field-error">{fieldErrors.subject}</p>}
          </div>
          <div>
            <Label>Tell us what happened</Label>
            <textarea
              name="body"
              required
              rows={6}
              maxLength={8000}
              className="a-input"
              style={{ height: 'auto', padding: 12, resize: 'vertical' }}
              placeholder="What you were doing, what you expected, what happened instead. Please leave members' names and contact details out."
            />
            {fieldErrors.body && <p className="field-error">{fieldErrors.body}</p>}
          </div>
          <SubmitButton className={adminButton('primary')} pendingLabel="Sending…">
            Start
          </SubmitButton>
        </>
      )}
    </ActionForm>
  )
}

export function MessageForm({ conversationId }: { conversationId: string }) {
  return (
    <ActionForm action={sendSupportMessageAction} resetOnSuccess>
      {({ fieldErrors }) => (
        <>
          <input type="hidden" name="conversationId" value={conversationId} />
          <textarea
            name="body"
            required
            rows={3}
            maxLength={8000}
            className="a-input"
            style={{ height: 'auto', padding: 12, resize: 'vertical' }}
            placeholder="Write a message…"
          />
          {fieldErrors.body && <p className="field-error">{fieldErrors.body}</p>}
          <SubmitButton className={adminButton('primary')} pendingLabel="Sending…">
            Send
          </SubmitButton>
        </>
      )}
    </ActionForm>
  )
}

export function EscalateForm({ conversationId }: { conversationId: string }) {
  return (
    <ActionForm action={escalateSupportConversationAction} className="space-y-0">
      {() => (
        <>
          <input type="hidden" name="conversationId" value={conversationId} />
          <SubmitButton className={adminButton('bright', 'sm')} pendingLabel="Sending…">
            Send to the platform
          </SubmitButton>
        </>
      )}
    </ActionForm>
  )
}

export function CloseForm({ conversationId }: { conversationId: string }) {
  return (
    <ActionForm action={closeSupportConversationAction}>
      {() => (
        <>
          <input type="hidden" name="conversationId" value={conversationId} />
          <SubmitButton className={adminButton('secondary', 'sm')} confirm="Close this conversation?">
            Close conversation
          </SubmitButton>
        </>
      )}
    </ActionForm>
  )
}
