/**
 * One-tap contact links.
 *
 * Every phone number in the database is stored in E.164, so these helpers only
 * have to strip the "+" for wa.me. They return null rather than a broken href
 * when a number is missing, so the UI can hide the control instead of
 * rendering a dead link.
 */

const E164 = /^\+[1-9]\d{6,14}$/

export function isE164(phone: string | null | undefined): phone is string {
  return typeof phone === 'string' && E164.test(phone)
}

/** Open a direct WhatsApp chat, optionally with a prefilled message. */
export function whatsappChatUrl(phone: string | null | undefined, message?: string): string | null {
  if (!isE164(phone)) return null
  const base = `https://wa.me/${phone.slice(1)}`
  return message ? `${base}?text=${encodeURIComponent(message.slice(0, 900))}` : base
}

/** Click-to-call. */
export function telUrl(phone: string | null | undefined): string | null {
  return isE164(phone) ? `tel:${phone}` : null
}

/**
 * WhatsApp group invite links are pasted in by staff. Only accept the exact
 * shape WhatsApp issues, so the field cannot be used to plant an arbitrary
 * outbound link in front of clients.
 */
const GROUP_LINK = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{10,40}$/

export function isWhatsappGroupUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && GROUP_LINK.test(url)
}

/** Normalise a typed number to E.164 given a default country calling code. */
export function normalisePhone(input: string, defaultCallingCode = '972'): string | null {
  const digitsOnly = input.replace(/[^\d+]/g, '')
  if (digitsOnly.startsWith('+')) return E164.test(digitsOnly) ? digitsOnly : null

  const national = digitsOnly.replace(/^0+/, '')
  const candidate = `+${defaultCallingCode}${national}`
  return E164.test(candidate) ? candidate : null
}
