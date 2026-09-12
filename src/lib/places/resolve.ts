import 'server-only'

import { serverEnv } from '@/lib/env'
import { extractMapsLinkFacts, isGoogleMapsHost, isShortMapsLink, parseMapsUrl } from './maps-link'

/**
 * Turn a Google Maps link into the facts about a club.
 *
 * Three stages, each optional past the first:
 *   1. Parse the link. Short links (maps.app.goo.gl) are followed, but only to
 *      other Google hosts — a redirect anywhere else is refused, so this can
 *      never be used to make the server fetch an arbitrary address.
 *   2. With GOOGLE_MAPS_API_KEY: ask the Places API for the listing — the
 *      address, hours, phone, website and the exact pin. By place id when the
 *      link carries one; otherwise by name, biased to the link's coordinates.
 *   3. With the same key: the Time Zone API for the club's clock.
 *
 * Without a key the result is what the link alone says: the name and the pin.
 */

export interface ClubPlace {
  name: string | null
  address: string | null
  phone: string | null
  website: string | null
  /** One line per day as the listing prints them. */
  openingHours: string[]
  latitude: number | null
  longitude: number | null
  timezone: string | null
  placeId: string | null
  /** The canonical listing link, when the API gave one; otherwise what was pasted. */
  mapsUrl: string
  /** Where the facts came from — so the form can say "from Google" or "from the link". */
  source: 'places' | 'link'
  businessStatus: string | null
  rating: number | null
  ratingCount: number | null
}

export class MapsLinkError extends Error {}

const FETCH_TIMEOUT_MS = 8_000
const MAX_HOPS = 5

const PLACE_FIELDS = [
  'id', 'displayName', 'formattedAddress', 'internationalPhoneNumber', 'websiteUri',
  'regularOpeningHours', 'location', 'googleMapsUri', 'businessStatus', 'rating', 'userRatingCount',
] as const

interface PlaceResponse {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  internationalPhoneNumber?: string
  websiteUri?: string
  regularOpeningHours?: { weekdayDescriptions?: string[] }
  location?: { latitude?: number; longitude?: number }
  googleMapsUri?: string
  businessStatus?: string
  rating?: number
  userRatingCount?: number
}

/** Follow a short link, hop by hop, refusing to leave Google's hosts. */
async function expandShortLink(url: URL): Promise<URL> {
  let current = url
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    if (!isShortMapsLink(current) && !/^consent\.google\.com$/i.test(current.hostname)) return current

    const response = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; SurferLive/1.0)' },
    })
    // the body is never read; only the Location header matters
    const location = response.headers.get('location')
    if (!location) throw new MapsLinkError('That short link did not lead anywhere.')

    const next = new URL(location, current)
    if (next.protocol !== 'https:' || !isGoogleMapsHost(next.hostname)) {
      throw new MapsLinkError('That link leads away from Google Maps.')
    }
    const parsed = parseMapsUrl(next.href)
    if (!parsed) throw new MapsLinkError('That link leads away from Google Maps.')
    current = parsed
  }
  throw new MapsLinkError('That short link redirects too many times.')
}

async function placeById(placeId: string, key: string): Promise<PlaceResponse | null> {
  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': PLACE_FIELDS.join(',') },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (response.status === 404) return null
  if (!response.ok) throw new MapsLinkError(`Google Places refused the request (${response.status}).`)
  return (await response.json()) as PlaceResponse
}

async function placeByText(
  query: string,
  near: { latitude: number; longitude: number } | null,
  key: string,
): Promise<PlaceResponse | null> {
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': PLACE_FIELDS.map((f) => `places.${f}`).join(','),
    },
    body: JSON.stringify({
      textQuery: query,
      pageSize: 1,
      ...(near ? { locationBias: { circle: { center: near, radius: 500 } } } : {}),
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!response.ok) throw new MapsLinkError(`Google Places refused the request (${response.status}).`)
  const data = (await response.json()) as { places?: PlaceResponse[] }
  return data.places?.[0] ?? null
}

async function timeZoneAt(latitude: number, longitude: number, key: string): Promise<string | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/timezone/json')
  url.searchParams.set('location', `${latitude},${longitude}`)
  url.searchParams.set('timestamp', String(Math.floor(Date.now() / 1000)))
  url.searchParams.set('key', key)
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!response.ok) return null
  const data = (await response.json()) as { status?: string; timeZoneId?: string }
  return data.status === 'OK' && data.timeZoneId ? data.timeZoneId : null
}

export function placesEnabled(): boolean {
  return Boolean(serverEnv().GOOGLE_MAPS_API_KEY)
}

export async function resolveClubPlace(input: string): Promise<ClubPlace> {
  const pasted = parseMapsUrl(input)
  if (!pasted) throw new MapsLinkError('Paste a Google Maps link (google.com/maps/… or maps.app.goo.gl/…).')

  const full = await expandShortLink(pasted)
  const facts = extractMapsLinkFacts(full)

  const base: ClubPlace = {
    name: facts.name,
    address: null,
    phone: null,
    website: null,
    openingHours: [],
    latitude: facts.latitude,
    longitude: facts.longitude,
    timezone: null,
    placeId: facts.placeId,
    mapsUrl: full.href,
    source: 'link',
    businessStatus: null,
    rating: null,
    ratingCount: null,
  }

  const key = serverEnv().GOOGLE_MAPS_API_KEY
  if (!key) return base

  let place: PlaceResponse | null = null
  if (facts.placeId) place = await placeById(facts.placeId, key)
  if (!place && facts.name) {
    place = await placeByText(
      facts.name,
      facts.latitude !== null && facts.longitude !== null ? { latitude: facts.latitude, longitude: facts.longitude } : null,
      key,
    )
  }
  if (!place) return base

  const latitude = place.location?.latitude ?? base.latitude
  const longitude = place.location?.longitude ?? base.longitude
  const timezone = latitude !== null && longitude !== null ? await timeZoneAt(latitude, longitude, key).catch(() => null) : null

  return {
    name: place.displayName?.text?.trim() || base.name,
    address: place.formattedAddress?.trim() || null,
    phone: place.internationalPhoneNumber?.replace(/[\s()-]/g, '') || null,
    website: place.websiteUri?.trim() || null,
    openingHours: (place.regularOpeningHours?.weekdayDescriptions ?? []).slice(0, 7),
    latitude,
    longitude,
    timezone,
    placeId: place.id ?? base.placeId,
    mapsUrl: place.googleMapsUri ?? base.mapsUrl,
    source: 'places',
    businessStatus: place.businessStatus ?? null,
    rating: place.rating ?? null,
    ratingCount: place.userRatingCount ?? null,
  }
}
