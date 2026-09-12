import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { LEGAL_DOCUMENTS, legalDocumentByKey } from '@/lib/legal'
import { getRequestClub } from '@/lib/tenant'
import { DocumentBody } from '@/components/document-body'

export const revalidate = 3600

/** The platform's legal documents, readable by anyone, on every address. */
export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params
  const doc = legalDocumentByKey(key)
  return { title: doc?.title ?? 'Legal', robots: { index: true, follow: true } }
}

export default async function LegalPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const doc = legalDocumentByKey(key)
  if (!doc) notFound()
  const club = await getRequestClub()

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <nav className="muted mb-6 flex flex-wrap gap-3 text-sm">
        {LEGAL_DOCUMENTS.map((d) => (
          <Link key={d.key} href={`/legal/${d.key}`} className={d.key === doc.key ? 'font-semibold underline' : 'underline'}>
            {d.title}
          </Link>
        ))}
      </nav>
      <h1 className="text-2xl font-semibold">{doc.title}</h1>
      <p className="muted mt-1 text-sm">
        {doc.summary} Version {doc.version}.
      </p>
      <article className="surface mt-6 p-5 sm:p-7">
        <DocumentBody blocks={doc.body({ clubName: club?.name ?? null })} tone="plain" />
      </article>
    </div>
  )
}
