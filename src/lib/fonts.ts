import { Manrope, Nunito_Sans, Outfit } from 'next/font/google'

/**
 * Each interface has its own voice, so the three areas load different faces.
 *
 * Loaded through next/font so the files are self-hosted and hashed at build
 * time: no request to fonts.gstatic.com at runtime, no layout shift, and
 * nothing to add to the CSP's connect-src.
 *
 * The variables are attached to <html> once, in the root layout; each area's
 * layout then picks the family it needs off the token, so a member page never
 * pays for Manrope and an admin page never pays for Outfit.
 */

export const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-outfit',
  display: 'swap',
})

export const nunitoSans = Nunito_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-nunito',
  display: 'swap',
})

export const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
})

export const fontVariables = `${outfit.variable} ${nunitoSans.variable} ${manrope.variable}`
