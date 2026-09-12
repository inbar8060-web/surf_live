/**
 * What a Google Maps link says on its own, before any API is asked.
 *
 * Pure: no network, no environment. The server-side resolver in resolve.ts
 * follows short links to one of these full forms first.
 *
 *   https://www.google.com/maps/place/Hilton+Beach/@32.088,34.768,17z/data=…!3d32.0881!4d34.7679…
 *   https://www.google.com/maps/search/?api=1&query=…&query_place_id=ChIJ…
 *   https://www.google.com/maps?cid=1234567890
 *   https://maps.google.com/?q=place_id:ChIJ…
 */

export interface MapsLinkFacts {
  /** The place name from the /place/<name>/ segment, when present. */
  name: string | null
  latitude: number | null
  longitude: number | null
  /** A Places API place id (ChIJ…), when the link carries one. */
  placeId: string | null
}

/** Hosts a Maps link may start at, and the only hosts a redirect may lead to. */
const MAPS_HOST = /^(maps\.app\.goo\.gl|goo\.gl|(www\.|maps\.)?google\.[a-z]{2,3}(\.[a-z]{2})?|consent\.google\.com)$/i
const SHORT_HOST = /^(maps\.app\.goo\.gl|goo\.gl)$/i

export function isGoogleMapsHost(host: string): boolean {
  return MAPS_HOST.test(host)
}

export function isShortMapsLink(url: URL): boolean {
  return SHORT_HOST.test(url.hostname)
}

/** Accepts only https links to a Google Maps host; returns the parsed URL or null. */
export function parseMapsUrl(input: string): URL | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || !isGoogleMapsHost(url.hostname)) return null
  // consent.google.com wraps the real address in ?continue=
  if (/^consent\.google\.com$/i.test(url.hostname)) {
    const next = url.searchParams.get('continue')
    return next ? parseMapsUrl(next) : null
  }
  // on the plain google.<tld> host only the /maps path is a Maps link
  // (the same rule the database applies to clubs.maps_url)
  if (/^(www\.)?google\./i.test(url.hostname) && !url.pathname.startsWith('/maps')) return null
  return url
}

const PLACE_ID = /^ChIJ[A-Za-z0-9_-]{10,}$/

function num(value: string | undefined): number | null {
  if (value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function extractMapsLinkFacts(url: URL): MapsLinkFacts {
  const facts: MapsLinkFacts = { name: null, latitude: null, longitude: null, placeId: null }

  const place = url.pathname.match(/\/maps\/place\/([^/]+)/)?.[1]
  if (place) {
    try {
      facts.name = decodeURIComponent(place.replace(/\+/g, ' ')).trim() || null
    } catch {
      facts.name = null
    }
  }

  // The pin's own coordinates (!3d…!4d…) beat the viewport centre (@lat,lng).
  const pin = url.pathname.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) ?? url.href.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
  const centre = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  const query = url.searchParams.get('q') ?? url.searchParams.get('query') ?? url.searchParams.get('ll')
  const fromQuery = query?.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/)
  const coords = pin ?? centre ?? fromQuery
  if (coords) {
    const lat = num(coords[1])
    const lng = num(coords[2])
    if (lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      facts.latitude = lat
      facts.longitude = lng
    }
  }

  const candidates = [
    url.searchParams.get('query_place_id'),
    url.searchParams.get('place_id'),
    url.searchParams.get('q')?.replace(/^place_id:/, ''),
    url.href.match(/!1s(ChIJ[A-Za-z0-9_-]+)/)?.[1],
    url.href.match(/!19s(ChIJ[A-Za-z0-9_-]+)/)?.[1],
  ]
  facts.placeId = candidates.find((c): c is string => !!c && PLACE_ID.test(c)) ?? null

  return facts
}
