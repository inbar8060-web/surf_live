import type { Block } from '@/lib/documents/types'
import { MicroLabel } from '@/components/ui/bits'

/**
 * Renders a document's blocks. Used by the signing screens and the public
 * legal pages, so the same text reads the same everywhere.
 */
export function DocumentBody({ blocks, tone = 'member' }: { blocks: Block[]; tone?: 'member' | 'plain' }) {
  const ink = tone === 'member' ? '#33505f' : 'var(--text, #1f2933)'
  const label = tone === 'member' ? '#5a6f7d' : '#5c6b66'
  return (
    <>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'heading':
            return (
              <MicroLabel key={i} color={label} className="mt-5 mb-1.5">
                {block.text}
              </MicroLabel>
            )
          case 'emphatic':
            return (
              <p
                key={i}
                className="my-2"
                style={{
                  background: tone === 'member' ? '#eff9ff' : 'rgba(0,0,0,0.04)',
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
              <div key={i} className="my-2">
                {block.title && <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700 }}>{block.title}</p>}
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {block.items.map((item) => (
                    <li key={item} style={{ fontSize: 13, lineHeight: 1.55, color: ink, marginBottom: 4 }}>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )
          case 'paragraph':
          default:
            return (
              <p key={i} style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.6, color: ink }}>
                {block.text}
              </p>
            )
        }
      })}
    </>
  )
}
