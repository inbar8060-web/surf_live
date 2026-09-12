'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { lookupPlaceAction, provisionClubAction } from '@/lib/actions/platform'
import type { ClubPlace } from '@/lib/places/resolve'
import { ActionForm, CopyButton, SubmitButton } from '@/components/ui/form'
import { Alert } from '@/components/ui'
import { adminButton } from '@/components/ui/button-class'
import { slugify } from '@/lib/tenant-host'

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <span className="a-label mb-1.5 block" style={{ color: 'var(--color-adm-ink-2)' }}>
      {children}
      {hint && (
        <span style={{ marginLeft: 6, fontWeight: 600, letterSpacing: 0, textTransform: 'none', opacity: 0.8 }}>{hint}</span>
      )}
    </span>
  )
}

/**
 * Add a club. The Google Maps link comes first: "Look up" reads the listing
 * and fills everything below, which the operator checks and can correct
 * before creating the club. Nothing is created by the look-up itself.
 */
export function ProvisionForm({ platformDomain }: { platformDomain: string }) {
  const [mapsUrl, setMapsUrl] = useState('')
  const [place, setPlace] = useState<ClubPlace | null>(null)
  const [lookup, setLookup] = useState<{ ok: boolean; message: string } | null>(null)
  const [looking, startLookup] = useTransition()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [done, setDone] = useState<{ slug: string; url: string; inviteUrl: string | null } | null>(null)

  function runLookup() {
    startLookup(async () => {
      const result = await lookupPlaceAction(mapsUrl)
      if (!result.ok) {
        setLookup({ ok: false, message: result.error })
        return
      }
      const found = result.data
      setPlace(found)
      setLookup({ ok: true, message: result.message ?? 'Done.' })
      if (found.name) {
        setName(found.name)
        if (!slugTouched) setSlug(slugify(found.name))
      }
      if (found.mapsUrl) setMapsUrl(found.mapsUrl)
    })
  }

  if (done) {
    return (
      <div className="flex flex-col gap-3" style={{ fontSize: 13 }}>
        <p>
          The club is live at{' '}
          <a href={done.url} target="_blank" rel="noreferrer" style={{ fontWeight: 800, color: 'var(--color-adm-accent)' }}>
            {done.url}
          </a>
          .
        </p>
        {done.inviteUrl && (
          <div className="a-card" style={{ padding: 12, background: 'var(--color-adm-amber-bg)', border: '1px solid var(--color-adm-amber-line)' }}>
            <p style={{ fontWeight: 800, margin: '0 0 6px' }}>Administrator link — shown once</p>
            <p className="a-helper" style={{ margin: '0 0 8px' }}>
              Mail is not configured yet, so send this to the administrator yourself. It works once and expires in seven days.
            </p>
            <code style={{ display: 'block', wordBreak: 'break-all', fontSize: 12, marginBottom: 8 }}>{done.inviteUrl}</code>
            <CopyButton value={done.inviteUrl} label="Copy link" />
          </div>
        )}
        <div className="flex gap-2">
          <Link href="/platform/clubs" className={adminButton('primary')}>
            Back to clubs
          </Link>
          <button
            type="button"
            className={adminButton('secondary')}
            onClick={() => {
              setDone(null)
              setPlace(null)
              setLookup(null)
              setMapsUrl('')
              setName('')
              setSlug('')
              setSlugTouched(false)
            }}
          >
            Add another
          </button>
        </div>
      </div>
    )
  }

  const from = place?.source === 'places' ? 'from Google Maps' : place ? 'from the link' : undefined

  return (
    <ActionForm action={provisionClubAction} onSuccess={(data) => setDone(data)}>
      {({ fieldErrors }) => (
        <>
          <div>
            <Label>Google Maps link</Label>
            <div className="flex flex-wrap gap-2">
              <input
                name="mapsUrl"
                type="url"
                required
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (mapsUrl) runLookup()
                  }
                }}
                className="a-input"
                style={{ flex: '1 1 260px' }}
                placeholder="https://maps.app.goo.gl/… or https://www.google.com/maps/place/…"
              />
              <button
                type="button"
                className={adminButton('bright')}
                disabled={!mapsUrl || looking}
                aria-busy={looking}
                onClick={runLookup}
              >
                {looking ? 'Reading…' : 'Look up'}
              </button>
            </div>
            <p className="a-helper" style={{ marginTop: 4 }}>
              Share → Copy link on the club&rsquo;s Google Maps listing. The name, address, hours and contact details are read from it.
            </p>
            {fieldErrors.mapsUrl && <p className="field-error">{fieldErrors.mapsUrl}</p>}
            {lookup && (
              <div style={{ marginTop: 8 }}>
                <Alert tone={lookup.ok ? 'success' : 'error'}>{lookup.message}</Alert>
              </div>
            )}
          </div>

          <div>
            <Label hint={from}>Club name</Label>
            <input
              name="name"
              required
              maxLength={120}
              className="a-input"
              value={name}
              placeholder="Reef Riders Surf Club"
              onChange={(e) => {
                setName(e.target.value)
                if (!slugTouched) setSlug(slugify(e.target.value))
              }}
            />
            {fieldErrors.name && <p className="field-error">{fieldErrors.name}</p>}
          </div>

          <div>
            <Label>Address on the platform</Label>
            <div className="flex items-center gap-2">
              <input
                name="slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  setSlug(e.target.value.toLowerCase())
                }}
                required
                minLength={3}
                maxLength={40}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                className="a-input"
                style={{ maxWidth: 260 }}
                aria-label="Subdomain"
              />
              <span className="a-helper" style={{ whiteSpace: 'nowrap' }}>
                .{platformDomain}
              </span>
            </div>
            <p className="a-helper" style={{ marginTop: 4 }}>
              Lower-case letters, digits and hyphens. This is the club&rsquo;s permanent address — it cannot be changed later.
            </p>
            {fieldErrors.slug && <p className="field-error">{fieldErrors.slug}</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label hint={place?.address ? from : undefined}>Street address</Label>
              <input name="address" maxLength={300} className="a-input" defaultValue={place?.address ?? ''} key={`address-${place?.placeId ?? 'none'}`} />
              {fieldErrors.address && <p className="field-error">{fieldErrors.address}</p>}
            </div>
            <div>
              <Label hint={place?.phone ? from : undefined}>Club phone</Label>
              <input name="phone" type="tel" className="a-input" defaultValue={place?.phone ?? ''} key={`phone-${place?.placeId ?? 'none'}`} placeholder="+972…" />
              {fieldErrors.phone && <p className="field-error">{fieldErrors.phone}</p>}
            </div>
            <div>
              <Label hint={place?.website ? from : undefined}>Website</Label>
              <input name="website" type="url" className="a-input" defaultValue={place?.website ?? ''} key={`website-${place?.placeId ?? 'none'}`} placeholder="https://" />
              {fieldErrors.website && <p className="field-error">{fieldErrors.website}</p>}
            </div>
            <div className="sm:col-span-2">
              <Label hint={place?.openingHours.length ? from : undefined}>Opening hours</Label>
              <textarea
                name="openingHours"
                rows={7}
                maxLength={1000}
                className="a-input"
                style={{ height: 'auto', padding: 10, resize: 'vertical', fontSize: 12 }}
                defaultValue={place?.openingHours.join('\n') ?? ''}
                key={`hours-${place?.placeId ?? 'none'}`}
                placeholder={'Monday: 8:00 – 18:00\nTuesday: 8:00 – 18:00\n…'}
              />
              {fieldErrors.openingHours && <p className="field-error">{fieldErrors.openingHours}</p>}
            </div>
            <div>
              <Label hint={place?.latitude !== null && place?.latitude !== undefined ? from : undefined}>Latitude</Label>
              <input name="latitude" type="number" step="0.00001" min={-90} max={90} className="a-input" defaultValue={place?.latitude ?? ''} key={`lat-${place?.placeId ?? 'none'}`} />
              <p className="a-helper" style={{ marginTop: 4 }}>
                The pin the surf forecast is read from.
              </p>
            </div>
            <div>
              <Label>Longitude</Label>
              <input name="longitude" type="number" step="0.00001" min={-180} max={180} className="a-input" defaultValue={place?.longitude ?? ''} key={`lng-${place?.placeId ?? 'none'}`} />
            </div>
            <div>
              <Label>Administrator email</Label>
              <input name="adminEmail" type="email" required maxLength={254} className="a-input" />
              <p className="a-helper" style={{ marginTop: 4 }}>
                Receives the registration link. Only this address can redeem it.
              </p>
              {fieldErrors.adminEmail && <p className="field-error">{fieldErrors.adminEmail}</p>}
            </div>
            <div>
              <Label hint={place?.timezone ? from : undefined}>Time zone</Label>
              <input name="timezone" className="a-input" defaultValue={place?.timezone ?? 'Asia/Jerusalem'} key={`tz-${place?.placeId ?? 'none'}`} />
              <p className="a-helper" style={{ marginTop: 4 }}>
                IANA name. The club can change it later.
              </p>
              {fieldErrors.timezone && <p className="field-error">{fieldErrors.timezone}</p>}
            </div>
          </div>

          <input type="hidden" name="placeId" value={place?.placeId ?? ''} />

          {place?.businessStatus && place.businessStatus !== 'OPERATIONAL' && (
            <Alert tone="error">Google lists this place as {place.businessStatus.toLowerCase().replace(/_/g, ' ')}.</Alert>
          )}

          <SubmitButton className={adminButton('primary')} pendingLabel="Creating…">
            Create the club
          </SubmitButton>
        </>
      )}
    </ActionForm>
  )
}
