'use client'

import type { ReactNode } from 'react'
import { acceptLegalAction } from '@/lib/actions/legal'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { adminButton, memberButton } from '@/components/ui/button-class'

export function AcceptLegalForm({
  documents,
  staff,
}: {
  documents: { key: string; version: string; title: string; summary: string; consent: string; body: ReactNode }[]
  staff: boolean
}) {
  return (
    <ActionForm action={acceptLegalAction} className="space-y-4">
      {({ fieldErrors }) => (
        <>
          {documents.map((doc) => (
            <section key={doc.key} className={staff ? 'a-card' : 'm-card-sm'} style={{ padding: '16px 18px' }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{doc.title}</h2>
              <p style={{ margin: '2px 0 10px', fontSize: 12, opacity: 0.75 }}>
                {doc.summary} Version {doc.version}.{' '}
                <a href={`/legal/${doc.key}`} target="_blank" rel="noreferrer" className="underline">
                  Open in a new tab
                </a>
              </p>
              <div style={{ maxHeight: 300, overflowY: 'auto', paddingRight: 4 }} tabIndex={0} aria-label={`${doc.title} full text`}>
                {doc.body}
              </div>
              <label className="mt-3 flex items-start gap-2.5" style={{ fontSize: 13, fontWeight: 700 }}>
                <input type="checkbox" name="accepted" value={`${doc.key}@${doc.version}`} style={{ marginTop: 3 }} />
                <span>{doc.consent}</span>
              </label>
              {fieldErrors[doc.key] && <p className="field-error">{fieldErrors[doc.key]}</p>}
            </section>
          ))}
          <SubmitButton className={staff ? adminButton('primary') : memberButton('primary')} pendingLabel="Recording…">
            Accept and continue
          </SubmitButton>
        </>
      )}
    </ActionForm>
  )
}
