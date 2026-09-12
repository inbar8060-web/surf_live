'use client'

import { useRouter } from 'next/navigation'
import { signDocumentAction } from '@/lib/actions/documents'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { memberButton } from '@/components/ui/button-class'
import { SignaturePad } from '@/components/member/signature-pad'
import type { Acknowledgement, SignableDocument } from '@/lib/documents'

export function SignForm({
  documentKey,
  version,
  fields,
  acknowledgements,
  defaultName,
  isLast,
}: {
  documentKey: string
  version: string
  fields: NonNullable<SignableDocument['fields']>
  acknowledgements: Acknowledgement[]
  defaultName: string
  isLast: boolean
}) {
  const router = useRouter()

  return (
    <ActionForm
      action={signDocumentAction}
      onSuccess={(data) => {
        // Signing the last document ends onboarding; otherwise the page
        // re-renders on the next unsigned one.
        router.replace(data.done ? '/onboarding/legal' : '/onboarding/documents')
        router.refresh()
      }}
    >
      {({ fieldErrors }) => (
        <>
          <input type="hidden" name="documentKey" value={documentKey} />
          <input type="hidden" name="version" value={version} />

          {fields.map((field) => (
            <label key={field.id} className="block">
              <span
                className="mb-1.5 block"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#5a6f7d',
                }}
              >
                {field.label}
              </span>
              <select
                name={field.id}
                required={field.required}
                defaultValue=""
                style={{
                  width: '100%',
                  height: 48,
                  borderRadius: 15,
                  border: '2px solid #dbe3ea',
                  padding: '0 12px',
                  fontSize: 15,
                  background: '#fff',
                }}
              >
                <option value="" disabled>
                  Please select
                </option>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {fieldErrors[field.id] && <p className="field-error">{fieldErrors[field.id]}</p>}
            </label>
          ))}

          <div className="flex flex-col gap-2.5">
            {acknowledgements.map((ack) => (
              <label key={ack.id} className="flex items-start gap-2.5" style={{ fontSize: 14, lineHeight: 1.45 }}>
                <input
                  type="checkbox"
                  /* Optional consent is never pre-ticked. */
                  name={ack.id === 'media_consent' ? 'mediaConsent' : `ack_${ack.id}`}
                  required={ack.required}
                  style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }}
                />
                <span>{ack.label}</span>
              </label>
            ))}
            {Object.entries(fieldErrors)
              .filter(([key]) => key.startsWith('ack_'))
              .map(([key, message]) => (
                <p key={key} className="field-error">
                  {message}
                </p>
              ))}
          </div>

          <SignaturePad name="signatureImage" defaultName={defaultName} />
          {fieldErrors.typedName && <p className="field-error">{fieldErrors.typedName}</p>}
          {fieldErrors.signatureImage && <p className="field-error">{fieldErrors.signatureImage}</p>}

          <SubmitButton className={`${memberButton('primary')} w-full`} pendingLabel="Signing…">
            {isLast ? 'Sign and send me a copy' : 'Sign and continue'}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  )
}
