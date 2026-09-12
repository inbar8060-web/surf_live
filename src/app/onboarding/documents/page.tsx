import { redirect } from 'next/navigation'
import { Check, FileText, Mail } from 'lucide-react'
import { requireClubRole } from '@/lib/auth/club-guard'
import { createUserClient } from '@/lib/supabase/server'
import { getClubSettings } from '@/lib/db/queries'
import { MemberHero } from '@/components/member/hero'
import { MicroLabel } from '@/components/ui/bits'
import { REQUIRED_DOCUMENTS, outstandingDocuments, type Block } from '@/lib/documents'
import { SignForm } from './sign-form'

export const metadata = { title: 'Documents to sign' }
export const dynamic = 'force-dynamic'

function Body({ block }: { block: Block }) {
  switch (block.kind) {
    case 'heading':
      return (
        <MicroLabel color="#5a6f7d" className="mt-4 mb-1.5">
          {block.text}
        </MicroLabel>
      )
    case 'emphatic':
      return (
        <p
          className="my-2"
          style={{
            background: '#eff9ff',
            borderRadius: 14,
            padding: '11px 13px',
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.5,
            textTransform: 'uppercase',
          }}
        >
          {block.text}
        </p>
      )
    case 'list':
      return (
        <div className="my-2">
          {block.title && (
            <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700 }}>{block.title}</p>
          )}
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {block.items.map((item) => (
              <li key={item} style={{ fontSize: 13, lineHeight: 1.55, color: '#33505f' }}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )
    case 'paragraph':
    default:
      return (
        <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.6, color: '#33505f' }}>
          {block.text}
        </p>
      )
  }
}

/**
 * First-registration signing.
 *
 * One document at a time, in order. The member reads the full text on screen —
 * not a summary with a link — because they are about to sign it.
 */
export default async function SignDocumentsPage() {
  const { user } = await requireClubRole('client')
  const club = await getClubSettings()
  const supabase = await createUserClient()

  const { data: signed } = await supabase
    .from('document_signatures')
    .select('document_key, version')
    .eq('client_id', user.id)

  const outstanding = outstandingDocuments(signed ?? [])
  if (outstanding.length === 0) redirect('/onboarding/legal')

  const current = outstanding[0]!
  const index = REQUIRED_DOCUMENTS.findIndex((d) => d.key === current.key)
  const isLast = outstanding.length === 1

  const context = {
    clubName: club.club_name,
    spotName: club.spot_name,
    signerName: user.profile.full_name,
    signerEmail: user.email ?? '',
    signerPhone: user.profile.phone,
  }

  return (
    <div className="app-member min-h-screen">
      <div className="mx-auto min-h-screen w-full max-w-[430px] pb-10">
        <MemberHero waves={false}>
          <MicroLabel color="#75d8ff">
            Step {index + 1} of {REQUIRED_DOCUMENTS.length}
          </MicroLabel>
          <h1 className="display mt-2" style={{ fontSize: 22, fontWeight: 700, margin: '8px 0 0' }}>
            {current.title}
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#b6e8ff', lineHeight: 1.45 }}>
            {current.summary}
          </p>

          <div className="mt-4 flex gap-1.5">
            {REQUIRED_DOCUMENTS.map((doc, i) => {
              const done = !outstanding.some((o) => o.key === doc.key)
              const active = doc.key === current.key
              return (
                <span
                  key={doc.key}
                  aria-label={`${doc.title}${done ? ', signed' : active ? ', in progress' : ', not started'}`}
                  className="flex items-center gap-1.5"
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 3,
                    background: done ? '#2cc4ff' : active ? '#75d8ff' : '#0b4a6d',
                  }}
                />
              )
            })}
          </div>
        </MemberHero>

        <div className="px-5 pt-4">
          <section className="m-card-sm mb-4" style={{ padding: '16px 18px' }}>
            <div className="mb-3 flex items-center gap-2" style={{ color: '#0087c6' }}>
              <FileText size={17} />
              <MicroLabel color="#5a6f7d">The agreement</MicroLabel>
            </div>

            {/* The full wording, on screen. Scrollable so the page does not
                become a wall, but nothing is hidden behind a link. */}
            <div
              style={{ maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}
              tabIndex={0}
              aria-label={`${current.title} full text`}
            >
              {current.body(context).map((block, i) => (
                <Body key={i} block={block} />
              ))}
            </div>
          </section>

          <section className="m-card-sm" style={{ padding: '16px 18px' }}>
            <SignForm
              documentKey={current.key}
              version={current.version}
              fields={current.fields ?? []}
              acknowledgements={current.acknowledgements}
              defaultName={user.profile.full_name}
              isLast={isLast}
            />
          </section>

          <p
            className="mt-4 flex items-start gap-2"
            style={{ fontSize: 12, color: '#5a6f7d', lineHeight: 1.5 }}
          >
            <Mail size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Once both are signed we email a copy to you and to {club.club_name}. The club does not
              keep the signed documents in its system — your copy and theirs are the only ones.
            </span>
          </p>

          {(signed?.length ?? 0) > 0 && (
            <p
              className="mt-3 flex items-center gap-2"
              style={{ fontSize: 12, color: '#0f766e', fontWeight: 700 }}
            >
              <Check size={15} /> {signed!.length} of {REQUIRED_DOCUMENTS.length} signed
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
