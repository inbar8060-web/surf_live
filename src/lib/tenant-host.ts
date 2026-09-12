/**
 * Host → tenant parsing. Pure, so the proxy (edge runtime, no request
 * context) and the app share one implementation, and so it is unit-testable.
 */

export const RESERVED_SLUGS = new Set([
  'www', 'admin', 'platform', 'api', 'app', 'mail', 'support', 'static', 'assets',
])
export const PLATFORM_SLUG = 'admin'

/** The host without a port, lower-cased — what the proxy and the app agree on. */
export function bareHost(host: string | null | undefined): string {
  return (host ?? '').split(':')[0]!.trim().toLowerCase()
}

export type HostTarget =
  | { kind: 'apex' }
  | { kind: 'platform' }
  | { kind: 'club'; slug: string }
  | { kind: 'unknown' }

/**
 * Split an incoming host into what it names.
 *
 *   <platform domain>            → apex (the platform's front door)
 *   admin.<platform domain>      → platform (the operator's area)
 *   <slug>.<platform domain>     → club
 *   anything else                → unknown (stray IP, misconfigured proxy)
 *
 * A LAN address during development is treated as the apex so the app can be
 * opened from a phone. Exactly one label is allowed below the platform
 * domain: "a.b.<domain>" names nothing.
 */
export function parseHost(host: string | null | undefined, platformDomain: string): HostTarget {
  const h = bareHost(host)
  const base = bareHost(platformDomain)
  if (!h || !base) return { kind: 'unknown' }
  if (h === base) return { kind: 'apex' }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return { kind: 'apex' }
  if (!h.endsWith(`.${base}`)) return { kind: 'unknown' }

  const label = h.slice(0, -(base.length + 1))
  if (!label || label.includes('.')) return { kind: 'unknown' }
  if (label === PLATFORM_SLUG) return { kind: 'platform' }
  if (label === 'www') return { kind: 'apex' }
  if (RESERVED_SLUGS.has(label)) return { kind: 'unknown' }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(label) || label.length < 3 || label.length > 40) {
    return { kind: 'unknown' }
  }
  return { kind: 'club', slug: label }
}

/** "Reef Riders Surf Club" → "reef-riders-surf-club". Never yields a reserved slug. */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
  return RESERVED_SLUGS.has(slug) ? `${slug}-club` : slug
}
