import { compass, type SpotConditions } from '@/lib/surf/conditions'
import { Badge, Card, type Tone } from '@/components/ui'

const TONE: Record<SpotConditions['summary']['tone'], Tone> = {
  good: 'success',
  fair: 'warning',
  poor: 'danger',
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--surface-muted)' }}>
      <p className="muted text-xs uppercase tracking-wide">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
      {sub && <p className="muted text-xs">{sub}</p>}
    </div>
  )
}

const num = (v: number | null, unit: string, digits = 1) =>
  v === null ? '—' : `${v.toFixed(digits)}${unit}`

/** Sea state for the club's spot, shown to clients and staff alike. */
export function ConditionsPanel({
  conditions,
  timeZone,
}: {
  conditions: SpotConditions
  timeZone: string
}) {
  const { now, summary, hourly } = conditions

  return (
    <Card
      title={`Conditions at ${conditions.spotName}`}
      description={
        conditions.stale
          ? 'Live data is unavailable right now — check with the club before heading out.'
          : `Reading for ${new Intl.DateTimeFormat('en-GB', { timeStyle: 'short', timeZone }).format(new Date(now.observedAt))}`
      }
      action={<Badge tone={TONE[summary.tone]}>{summary.label}</Badge>}
    >
      <p className="mb-4 text-sm">{summary.detail}</p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric
          label="Wave height"
          value={num(now.waveHeightM, ' m')}
          sub={now.wavePeriodS ? `${now.wavePeriodS.toFixed(0)}s period` : undefined}
        />
        <Metric
          label="Swell"
          value={num(now.swellHeightM, ' m')}
          sub={now.waveDirectionDeg !== null ? `from ${compass(now.waveDirectionDeg)}` : undefined}
        />
        <Metric
          label="Wind"
          value={now.windSpeedKph === null ? '—' : `${now.windSpeedKph.toFixed(0)} km/h`}
          sub={now.windDirectionDeg !== null ? `from ${compass(now.windDirectionDeg)}` : undefined}
        />
        <Metric
          label="Water"
          value={num(now.seaTemperatureC, '°C', 0)}
          sub={now.airTemperatureC !== null ? `air ${now.airTemperatureC.toFixed(0)}°C` : undefined}
        />
      </div>

      {hourly.length > 1 && (
        <div className="mt-4">
          <p className="muted mb-2 text-xs uppercase tracking-wide">Next hours</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {hourly.map((hour) => (
              <div
                key={hour.time}
                className="min-w-[4.5rem] shrink-0 rounded-lg px-2 py-2 text-center"
                style={{ background: 'var(--surface-muted)' }}
              >
                <p className="muted text-xs">
                  {new Intl.DateTimeFormat('en-GB', { hour: '2-digit', timeZone }).format(
                    new Date(hour.time),
                  )}
                </p>
                <p className="text-sm font-semibold tabular-nums">{num(hour.waveHeightM, 'm')}</p>
                <p className="muted text-xs tabular-nums">
                  {hour.windSpeedKph === null ? '—' : `${hour.windSpeedKph.toFixed(0)}km/h`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
