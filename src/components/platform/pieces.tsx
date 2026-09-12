import type { ReactNode } from 'react'
import { AdmChip, type AdminChipTone } from '@/components/admin/pieces'
import { CLUB_STATUS_LABEL, SUPPORT_STATUS_LABEL } from '@/lib/platform'

/** A single number with its label, for the overview grids. */
export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: 'amber' | 'rose' }) {
  return (
    <div
      className="a-card"
      style={{
        padding: '14px 16px',
        background: tone === 'amber' ? 'var(--color-adm-amber-bg)' : tone === 'rose' ? 'var(--color-adm-rose-bg)' : undefined,
      }}
    >
      <span className="a-label" style={{ color: 'var(--color-adm-ink-2)' }}>
        {label}
      </span>
      <span style={{ display: 'block', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 2 }}>{value}</span>
      {hint && (
        <span className="a-helper" style={{ display: 'block', marginTop: 2 }}>
          {hint}
        </span>
      )}
    </div>
  )
}

const CLUB_TONE: Record<string, AdminChipTone> = {
  provisioning: 'amber',
  active: 'green',
  suspended: 'amber',
  archived: 'neutral',
}

export function ClubStatusChip({ status }: { status: string }) {
  return <AdmChip tone={CLUB_TONE[status] ?? 'neutral'}>{CLUB_STATUS_LABEL[status] ?? status}</AdmChip>
}

const SUPPORT_TONE: Record<string, AdminChipTone> = {
  open: 'blue',
  awaiting_platform: 'amber',
  awaiting_club: 'green',
  closed: 'neutral',
}

export function SupportStatusChip({ status, viewer = 'super_admin' }: { status: string; viewer?: 'super_admin' | 'admin' }) {
  return <AdmChip tone={SUPPORT_TONE[status] ?? 'neutral'}>{SUPPORT_STATUS_LABEL[viewer][status] ?? status}</AdmChip>
}

const SEVERITY_TONE: Record<string, AdminChipTone> = { low: 'neutral', medium: 'blue', high: 'amber', critical: 'rose' }

export function SeverityChip({ severity }: { severity: string | null }) {
  if (!severity) return null
  return <AdmChip tone={SEVERITY_TONE[severity] ?? 'neutral'}>{severity}</AdmChip>
}

/** Plain table used across the operator screens. */
export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                className="a-label"
                style={{
                  textAlign: 'left',
                  padding: '6px 8px',
                  color: 'var(--color-adm-ink-2)',
                  borderBottom: '1px solid var(--color-adm-line)',
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Td({ children, strong, right }: { children: ReactNode; strong?: boolean; right?: boolean }) {
  return (
    <td
      style={{
        padding: '10px 8px',
        borderBottom: '1px solid var(--color-adm-rule)',
        fontWeight: strong ? 800 : 500,
        textAlign: right ? 'right' : 'left',
        verticalAlign: 'top',
      }}
    >
      {children}
    </td>
  )
}
