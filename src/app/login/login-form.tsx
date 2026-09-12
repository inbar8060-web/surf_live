'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { signInAction } from '@/lib/actions/auth'
import { ActionForm, SubmitButton } from '@/components/ui/form'
import { memberButton } from '@/components/ui/button-class'

/** Field on the dark ground: 52px, radius 16, focus ring in the bright accent. */
function DarkField({
  label,
  children,
  error,
}: {
  label: string
  children: React.ReactNode
  error?: string
}) {
  return (
    <div>
      <span
        className="mb-1.5 block"
        style={{ fontSize: 12, fontWeight: 700, color: '#75d8ff', letterSpacing: '0.04em' }}
      >
        {label.toUpperCase()}
      </span>
      {children}
      {error && (
        <p role="alert" style={{ color: '#ff9ea1', fontSize: 13, marginTop: 6 }}>
          {error}
        </p>
      )}
    </div>
  )
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  height: 52,
  borderRadius: 16,
  background: '#0b4a6d',
  border: '2px solid transparent',
  color: '#fff',
  padding: '0 16px',
  fontSize: 15,
}

export function LoginForm({ next }: { next: string }) {
  const [reveal, setReveal] = useState(false)

  return (
    <ActionForm action={signInAction} className="space-y-4">
      {({ fieldErrors }) => (
        <>
          <input type="hidden" name="next" value={next} />

          <DarkField label="Email" error={fieldErrors.email}>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              autoFocus
              spellCheck={false}
              placeholder="you@example.com"
              style={fieldStyle}
              className="placeholder:text-[#4d7f9e] focus:border-sea-400 focus:outline-none"
            />
          </DarkField>

          <DarkField label="Password" error={fieldErrors.password}>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={reveal ? 'text' : 'password'}
                autoComplete="current-password"
                required
                style={{ ...fieldStyle, paddingRight: 48 }}
                className="focus:border-sea-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                aria-label={reveal ? 'Hide password' : 'Show password'}
                aria-pressed={reveal}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5"
                style={{ color: '#75d8ff' }}
              >
                {reveal ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </DarkField>

          <div className="pt-1">
            <SubmitButton className={`${memberButton('accent')} w-full`} pendingLabel="Signing in…">
              Sign in
            </SubmitButton>
          </div>

          <p className="text-center" style={{ fontSize: 13, color: '#75d8ff', fontWeight: 600 }}>
            Forgotten your password?
          </p>
        </>
      )}
    </ActionForm>
  )
}
