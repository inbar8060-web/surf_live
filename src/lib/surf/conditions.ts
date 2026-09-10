import 'server-only'

import { serverEnv } from '@/lib/env'

/**
 * Sea and wind conditions for the club's spot.
 *
 * Open-Meteo's marine and forecast endpoints are free and keyless, which keeps
 * this out of the secrets surface entirely. Responses are cached for 15
 * minutes: the data updates hourly, and clients refreshing the page should not
 * each cost an upstream call.
 */

export interface ConditionsNow {
  waveHeightM: number | null
  waveDirectionDeg: number | null
  wavePeriodS: number | null
  swellHeightM: number | null
  swellPeriodS: number | null
  seaTemperatureC: number | null
  windSpeedKph: number | null
  windGustKph: number | null
  windDirectionDeg: number | null
  airTemperatureC: number | null
  observedAt: string
}

export interface ConditionsHour {
  time: string
  waveHeightM: number | null
  wavePeriodS: number | null
  windSpeedKph: number | null
  windDirectionDeg: number | null
}

export interface SpotConditions {
  spotName: string
  latitude: number
  longitude: number
  now: ConditionsNow
  hourly: ConditionsHour[]
  /** A short, honest read on whether it is worth going out. */
  summary: { label: string; tone: 'good' | 'fair' | 'poor'; detail: string }
  stale: boolean
}

const CACHE_SECONDS = 900

function nearestIndex(times: string[]): number {
  const now = Date.now()
  let best = 0
  let bestDelta = Number.POSITIVE_INFINITY
  times.forEach((t, i) => {
    const delta = Math.abs(new Date(t).getTime() - now)
    if (delta < bestDelta) {
      bestDelta = delta
      best = i
    }
  })
  return best
}

function at(series: (number | null)[] | undefined, index: number): number | null {
  const value = series?.[index]
  return typeof value === 'number' ? value : null
}

/**
 * Turn numbers into a sentence a beginner can act on. Deliberately
 * conservative: onshore wind and big swell both push the rating down.
 */
function summarise(now: ConditionsNow): SpotConditions['summary'] {
  const wave = now.waveHeightM
  const wind = now.windSpeedKph

  if (wave === null) {
    return { label: 'No reading', tone: 'fair', detail: 'The forecast service did not return wave data.' }
  }
  if (wave < 0.3) {
    return { label: 'Flat', tone: 'poor', detail: 'Barely any swell — a good day for theory or a paddle.' }
  }
  if (wave > 2.5 || (wind ?? 0) > 45) {
    return { label: 'Heavy', tone: 'poor', detail: 'Big and windy. Experienced surfers only, and check with the club first.' }
  }
  if (wave >= 0.6 && wave <= 1.6 && (wind ?? 0) < 25) {
    return { label: 'Good', tone: 'good', detail: 'Clean, rideable surf across most levels.' }
  }
  return { label: 'Fair', tone: 'fair', detail: 'Surfable, but expect some chop or an awkward size.' }
}

export async function getSpotConditions(
  latitude: number,
  longitude: number,
  spotName: string,
): Promise<SpotConditions> {
  const env = serverEnv()
  const common = `latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}&timezone=auto&forecast_days=2`

  const marineUrl =
    `${env.MARINE_API_BASE}?${common}` +
    '&hourly=wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_period,sea_surface_temperature'
  const weatherUrl =
    `${env.WEATHER_API_BASE}?${common}` +
    '&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,temperature_2m&wind_speed_unit=kmh'

  const fetchOptions = { next: { revalidate: CACHE_SECONDS }, signal: AbortSignal.timeout(8000) }

  const [marineRes, weatherRes] = await Promise.allSettled([
    fetch(marineUrl, fetchOptions),
    fetch(weatherUrl, fetchOptions),
  ])

  type Hourly = Record<string, (number | null)[] | string[] | undefined>
  const readBody = async (settled: PromiseSettledResult<Response>): Promise<Hourly> => {
    if (settled.status !== 'fulfilled' || !settled.value.ok) return {}
    try {
      const json = (await settled.value.json()) as { hourly?: Hourly }
      return json.hourly ?? {}
    } catch {
      return {}
    }
  }

  const marine = await readBody(marineRes)
  const weather = await readBody(weatherRes)

  const times = (marine.time as string[] | undefined) ?? (weather.time as string[] | undefined) ?? []
  const stale = times.length === 0
  const index = stale ? 0 : nearestIndex(times)

  const now: ConditionsNow = {
    waveHeightM: at(marine.wave_height as (number | null)[], index),
    waveDirectionDeg: at(marine.wave_direction as (number | null)[], index),
    wavePeriodS: at(marine.wave_period as (number | null)[], index),
    swellHeightM: at(marine.swell_wave_height as (number | null)[], index),
    swellPeriodS: at(marine.swell_wave_period as (number | null)[], index),
    seaTemperatureC: at(marine.sea_surface_temperature as (number | null)[], index),
    windSpeedKph: at(weather.wind_speed_10m as (number | null)[], index),
    windGustKph: at(weather.wind_gusts_10m as (number | null)[], index),
    windDirectionDeg: at(weather.wind_direction_10m as (number | null)[], index),
    airTemperatureC: at(weather.temperature_2m as (number | null)[], index),
    observedAt: times[index] ?? new Date().toISOString(),
  }

  const hourly: ConditionsHour[] = times.slice(index, index + 12).map((time, offset) => ({
    time,
    waveHeightM: at(marine.wave_height as (number | null)[], index + offset),
    wavePeriodS: at(marine.wave_period as (number | null)[], index + offset),
    windSpeedKph: at(weather.wind_speed_10m as (number | null)[], index + offset),
    windDirectionDeg: at(weather.wind_direction_10m as (number | null)[], index + offset),
  }))

  return { spotName, latitude, longitude, now, hourly, summary: summarise(now), stale }
}

/** Compass point for a bearing in degrees. */
export function compass(deg: number | null): string {
  if (deg === null) return '—'
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return points[Math.round(((deg % 360) / 22.5)) % 16] ?? '—'
}
