import type { SupportMessage, SupportConversation } from '@/lib/db/types'
import { formatDateTime } from '@/lib/util/format'

/**
 * A support thread, rendered the same way on both sides. `viewer` decides
 * which bubbles sit on the right.
 */
export function Thread({
  messages,
  viewer,
  timeZone,
}: {
  messages: Pick<SupportMessage, 'id' | 'sender_role' | 'body' | 'created_at'>[]
  viewer: 'admin' | 'super_admin'
  timeZone: string
}) {
  if (messages.length === 0) {
    return (
      <p className="a-helper" style={{ padding: '22px 4px', textAlign: 'center' }}>
        No messages yet.
      </p>
    )
  }

  return (
    <ol className="flex flex-col gap-2.5">
      {messages.map((m) => {
        const mine = m.sender_role === viewer
        const who = m.sender_role === 'bot' ? 'Assistant' : m.sender_role === 'super_admin' ? 'Platform' : 'Club administrator'
        return (
          <li key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div
              style={{
                maxWidth: '78%',
                borderRadius: 16,
                padding: '10px 14px',
                background: mine ? 'var(--color-adm-chrome)' : m.sender_role === 'bot' ? 'var(--color-adm-blue-chip)' : 'var(--color-adm-ground)',
                color: mine ? '#fff' : 'var(--color-adm-ink)',
                fontSize: 13,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              <span
                style={{
                  display: 'block',
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  opacity: 0.7,
                  marginBottom: 3,
                }}
              >
                {who} · {formatDateTime(m.created_at, timeZone)}
              </span>
              {m.body}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** The assistant's structured report, if it wrote one. */
export function Report({ report }: { report: SupportConversation['report'] }) {
  if (!report) return null
  const r = report as Record<string, unknown>
  const text = (key: string) => (typeof r[key] === 'string' && r[key] ? (r[key] as string) : null)
  const list = (key: string) => (Array.isArray(r[key]) ? (r[key] as unknown[]).filter((x) => typeof x === 'string') as string[] : [])

  const rows: [string, string | null][] = [
    ['Where', text('where')],
    ['Expected', text('expected')],
    ['Actual', text('actual')],
    ['Impact', text('impact')],
    ['Started', text('started')],
  ]

  return (
    <div style={{ fontSize: 13 }}>
      {text('title') && <p style={{ fontWeight: 800, margin: '0 0 6px', fontSize: 14 }}>{text('title')}</p>}
      {text('summary') && <p style={{ margin: '0 0 10px' }}>{text('summary')}</p>}
      <dl className="grid gap-x-3 gap-y-1.5" style={{ gridTemplateColumns: '90px 1fr' }}>
        {rows.map(([label, value]) =>
          value ? (
            <div key={label} style={{ display: 'contents' }}>
              <dt className="a-label" style={{ color: 'var(--color-adm-ink-2)' }}>{label}</dt>
              <dd style={{ margin: 0 }}>{value}</dd>
            </div>
          ) : null,
        )}
      </dl>
      {list('steps').length > 0 && (
        <>
          <p className="a-label" style={{ color: 'var(--color-adm-ink-2)', margin: '10px 0 4px' }}>Steps</p>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            {list('steps').map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </>
      )}
      {list('tried').length > 0 && (
        <>
          <p className="a-label" style={{ color: 'var(--color-adm-ink-2)', margin: '10px 0 4px' }}>Already tried</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {list('tried').map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
