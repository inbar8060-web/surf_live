/**
 * Prepare a free-text search term for a PostgREST filter string.
 *
 * `query.or('full_name.ilike.%term%,email.ilike.%term%')` is a small
 * expression language: commas separate clauses, dots separate field, operator
 * and value, parentheses group. A term containing any of those rewrites the
 * filter — `x),id.eq.` would tack a new condition onto the query. RLS still
 * bounds what comes back, so the reach is limited, but a query language must
 * never be assembled from raw input.
 *
 * Only letters, digits, spaces and the few characters that appear in names,
 * email addresses and phone numbers survive. `%` and `_` are LIKE wildcards
 * and `\` is its escape character, so they are dropped too.
 */
export function searchTerm(raw: unknown, maxLength = 60): string {
  if (typeof raw !== 'string') return ''
  return raw
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s@+'.-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}
