'use client'

import { useEffect, useRef, useState } from 'react'
import { memberButton } from '@/components/ui/button-class'

/**
 * Signature pad.
 *
 * The drawing never leaves the browser except as one PNG inside the form
 * submission that produces the agreement. It is not uploaded separately, not
 * stored, and not kept after the PDF is built.
 *
 * Typing a name is a first-class alternative rather than a fallback: pointer
 * drawing is awkward with a mouse and impossible without one, and a typed name
 * is an accepted electronic signature.
 */
export function SignaturePad({ name, defaultName }: { name: string; defaultName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasInk, setHasInk] = useState(false)
  const [value, setValue] = useState('')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Draw at device resolution so the signature is not a blurry upscale.
    const ratio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.round(rect.width * ratio)
    canvas.height = Math.round(rect.height * ratio)

    const context = canvas.getContext('2d')
    if (!context) return
    context.scale(ratio, ratio)
    context.lineWidth = 2.2
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = '#072f49'
  }, [])

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drawing.current = true
    const { x, y } = point(event)
    context.beginPath()
    context.moveTo(x, y)
  }

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    const { x, y } = point(event)
    context.lineTo(x, y)
    context.stroke()
    if (!hasInk) setHasInk(true)
  }

  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    const canvas = canvasRef.current
    if (canvas) setValue(canvas.toDataURL('image/png'))
  }

  const clear = () => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    setHasInk(false)
    setValue('')
  }

  return (
    <div>
      <input type="hidden" name={name} value={value} />

      <div
        className="relative"
        style={{ background: '#fff', border: '2px solid #dbe3ea', borderRadius: 16, overflow: 'hidden' }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
          aria-label="Draw your signature"
          style={{ display: 'block', width: '100%', height: 150, touchAction: 'none', cursor: 'crosshair' }}
        />
        {!hasInk && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            style={{ color: '#9db3c0', fontSize: 14 }}
          >
            Sign here with your finger or mouse
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <p style={{ fontSize: 12, color: '#5a6f7d', margin: 0 }}>
          Or simply type your full name below — both count as a signature.
        </p>
        {hasInk && (
          <button type="button" onClick={clear} className={memberButton('quiet', 'sm')}>
            Clear
          </button>
        )}
      </div>

      <label className="mt-3 block">
        <span
          className="mb-1.5 block"
          style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5a6f7d' }}
        >
          Full name
        </span>
        <input
          name="typedName"
          defaultValue={defaultName}
          required
          minLength={2}
          maxLength={120}
          autoComplete="name"
          style={{
            width: '100%',
            height: 48,
            borderRadius: 15,
            border: '2px solid #dbe3ea',
            padding: '0 14px',
            fontSize: 15,
            background: '#fff',
          }}
        />
      </label>
    </div>
  )
}
