import { telUrl, whatsappChatUrl, isWhatsappGroupUrl } from '@/lib/util/contact'
import { buttonClass } from '@/components/ui/button-class'

/**
 * One-tap contact controls. Each renders nothing when the underlying number or
 * link is missing, so a client never sees a button that goes nowhere.
 *
 * `rel="noopener noreferrer"` on every outbound link: without noopener the
 * opened page gets a handle on this one through window.opener.
 */

export function WhatsAppButton({
  phone,
  message,
  label = 'WhatsApp',
  size = 'sm',
}: {
  phone: string | null | undefined
  message?: string
  label?: string
  size?: 'sm' | 'md'
}) {
  const href = whatsappChatUrl(phone, message)
  if (!href) return null

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', size)}>
      <span aria-hidden>💬</span> {label}
    </a>
  )
}

export function CallButton({
  phone,
  label = 'Call',
  size = 'sm',
}: {
  phone: string | null | undefined
  label?: string
  size?: 'sm' | 'md'
}) {
  const href = telUrl(phone)
  if (!href) return null

  return (
    <a href={href} className={buttonClass('secondary', size)}>
      <span aria-hidden>📞</span> {label}
    </a>
  )
}

/** Opens the session's WhatsApp group in one click. */
export function GroupChatButton({
  url,
  label = 'Group chat',
  size = 'sm',
}: {
  url: string | null | undefined
  label?: string
  size?: 'sm' | 'md'
}) {
  if (!isWhatsappGroupUrl(url)) return null

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={buttonClass('primary', size)}>
      <span aria-hidden>👥</span> {label}
    </a>
  )
}
