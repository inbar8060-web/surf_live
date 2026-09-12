import type { Metadata, Viewport } from 'next'
import { fontVariables } from '@/lib/fonts'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Surfer Live', template: '%s · Surfer Live' },
  description: 'Bookings, lessons and gear for surf clubs and retreat centres.',
  robots: { index: false, follow: false }, // a members area has no business in search results
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // so the tab bars can pad past the home indicator
  themeColor: '#072f49',
}

/**
 * All three font families are declared here so next/font can hash and preload
 * them once. Each area's layout then selects the family it needs off the
 * token, rather than every page shipping all three.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  )
}
