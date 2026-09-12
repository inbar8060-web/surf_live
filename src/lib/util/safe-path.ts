/**
 * Accept a redirect target only if it is an internal path.
 *
 * The naive check — "starts with a single slash" — is not enough. Browsers
 * following the WHATWG URL spec treat a backslash as a slash in http(s) URLs,
 * so `/\evil.com` is resolved as `//evil.com`, a protocol-relative link to
 * another host. A control character or a scheme smuggled in after the slash
 * is refused for the same reason: anything that could make the browser leave
 * this origin does not qualify as "internal".
 *
 * Pure and dependency-free so it can run on either side of the boundary and
 * be unit-tested with plain node.
 */
export function safeInternalPath(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return fallback

  // exactly one leading slash, then neither a slash nor a backslash
  if (!/^\/(?![/\\])/.test(value)) return fallback

  // no control characters (line injection) and no backslash anywhere
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F\\]/.test(value)) return fallback

  // and a real URL parser must agree it stays on this origin
  try {
    const parsed = new URL(value, 'http://internal.invalid')
    if (parsed.origin !== 'http://internal.invalid' || parsed.protocol !== 'http:') return fallback
  } catch {
    return fallback
  }

  return value
}
