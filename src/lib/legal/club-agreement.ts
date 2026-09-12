import type { Block } from '@/lib/documents/types'
import { PLATFORM, type LegalDocument } from './types'

const P = PLATFORM

export const CLUB_AGREEMENT: LegalDocument = {
  key: 'club_agreement',
  version: '2026-09-1',
  title: 'Club Service Agreement',
  summary: 'The terms on which a club subscribes to and operates on Surfer Live.',
  audience: ['admin'],
  consent: 'I am authorised to bind the club, and I accept the Club Service Agreement on its behalf.',
  body: ({ clubName }): Block[] => [
    { kind: 'paragraph', text: `Last updated: 1 September 2026. This agreement is between ${P.legalName} ("${P.name}") and the surf club, school or retreat centre named in the account (the "Club"${clubName ? `, ${clubName}` : ''}). By accepting it, the administrator confirms they are authorised to bind the Club. It sits alongside the Terms of Service and the Privacy Policy.` },

    { kind: 'heading', text: '1. The Service' },
    { kind: 'paragraph', text: `${P.name} provides the Club with its own address on the platform and the software to run its schedule, instructors, members, gear, bookings, payments and reports. ${P.name} does not provide surf instruction and takes no part in the Club's relationship with its members and staff.` },

    { kind: 'heading', text: '2. Plans and fees' },
    { kind: 'list', items: [
      'The Club chooses a plan (Beach Vibes, Ocean Vibes or Surfing Vibes). Each plan sets a monthly fee and limits on registered instructors, new members per month and payments per month, and decides which reports and dashboards are available. The current plans and prices are shown in the Service.',
      'The plan fee is billed monthly in advance to the card on file, in US dollars, through our payment partner. Taxes are added where they apply.',
      'The Club may upgrade at any time; the difference is prorated. Downgrades take effect at the next billing date and only if the Club is within the lower plan\'s limits.',
      'If a payment fails the Club has 14 days to settle it. After that the Club\'s address shows a holding page to members until it is paid; the Club\'s data is not deleted.',
      'Fees paid are not refundable, except where the law requires it or where the Service was unavailable for a prolonged period through our fault.',
      `${P.name} may change plan prices with 30 days' notice; the change applies from the Club's next billing date after the notice period.`,
    ] },

    { kind: 'heading', text: '3. Member payments and payouts' },
    { kind: 'list', items: [
      'Member payments are processed through the Club\'s own connected account at our payment partner, opened by the Club during onboarding. The Club is the merchant of record for every member payment: it is responsible for refunds, chargebacks, disputes, receipts and any tax on its sales.',
      `${P.name} may deduct a platform fee from each member payment at the rate shown in the Club's settings at the time of the payment. The rate for a Club is set by ${P.name} and communicated before it applies.`,
      'Payouts to the Club\'s bank account are made by the payment partner under its schedule and terms. The Club must complete the partner\'s identity and bank verification; until it does, online payments are not available on the Club\'s address.',
      `${P.name} never holds the Club's funds and never has access to the Club's bank credentials.`,
    ] },

    { kind: 'heading', text: '4. The Club\'s responsibilities' },
    { kind: 'list', items: [
      'To hold the licences, insurance and permissions its activities require, and to comply with the law where it operates.',
      'To ensure its members sign a waiver and, where applicable, a rental agreement before their first session, using the documents provided in the Service or its own.',
      'To keep its members\' and staff\'s data accurate, to collect only what it needs, and to answer their requests about their data. The Club is the data controller for that data; the Data Processing terms in section 6 apply.',
      'To ensure only authorised people hold administrator accounts, and to remove access promptly when someone leaves.',
      'Not to use the Service for anything unlawful, and to keep its public page (name, address, hours, reviews) accurate.',
    ] },

    { kind: 'heading', text: '5. Instructors' },
    { kind: 'paragraph', text: `Instructors are engaged by the Club, not by ${P.name}. The Club is responsible for their qualifications, conduct and pay, and for any tips members leave them through the Service, which are paid to the Club's account.` },

    { kind: 'heading', text: '6. Data processing' },
    { kind: 'list', items: [
      `${P.name} processes the Club's member and staff data only to provide the Service and on the Club's documented instructions, which include this agreement and the way the Club configures the Service.`,
      'Every record is tagged with the Club and access is enforced in the database, so no other Club and no platform operator screen can read a member\'s record.',
      `${P.name} uses sub-processors for hosting, authentication, email, payments, maps, forecasts and the support assistant, listed in the Privacy Policy, and will give notice before adding one.`,
      `${P.name} will assist the Club with data subject requests, security incidents and audits to the extent reasonably needed, and will notify the Club without undue delay of a personal data breach affecting its data.`,
      'On termination the Club may export its data; after 90 days it is deleted from the live Service and, in the ordinary course, from backups.',
    ] },

    { kind: 'heading', text: '7. Availability and support' },
    { kind: 'paragraph', text: `${P.name} aims for continuous availability and will schedule maintenance outside the Club's usual hours where it can. Support is available through the Service's support screen; the assistant answers first and a person follows. There is no guaranteed response time unless agreed separately in writing.` },

    { kind: 'heading', text: '8. Intellectual property and the Club\'s content' },
    { kind: 'paragraph', text: `The Service belongs to ${P.legalName}. The Club's name, logo, descriptions, prices and its members' content belong to the Club and its members; the Club grants ${P.name} a licence to host and display them to provide the Service.` },

    { kind: 'heading', text: '9. Liability' },
    { kind: 'emphatic', text: `${P.name} is not liable for injury, loss or damage arising from the Club's activities, equipment or staff, or for the acts of the payment partner. ${P.name}'s total liability to the Club under this agreement in any twelve-month period is limited to the plan fees the Club paid in that period. Neither party is liable to the other for indirect or consequential loss, or loss of profit.` },
    { kind: 'paragraph', text: 'Nothing excludes liability that cannot be excluded by law. The Club will indemnify Surfer Live against claims by its members, staff or authorities arising from the Club\'s activities or its breach of this agreement.' },

    { kind: 'heading', text: '10. Term and termination' },
    { kind: 'list', items: [
      'This agreement runs month to month with the plan. The Club may cancel at any time from its plan settings; access continues to the end of the paid period.',
      `${P.name} may suspend the Club's address for non-payment, for a material breach that is not cured within 14 days of notice, or where required by law or by the payment partner. ${P.name} may terminate for convenience with 60 days' notice.`,
      'After termination the Club\'s address stops answering and its members can no longer sign in. Sections 6 (data), 9 (liability), 11 (law) and any unpaid fees survive.',
    ] },

    { kind: 'heading', text: '11. Governing law' },
    { kind: 'paragraph', text: `This agreement is governed by ${P.governingLaw} and subject to ${P.courts}.` },

    { kind: 'heading', text: '12. Contact' },
    { kind: 'paragraph', text: `${P.legalName} · ${P.website} · ${P.contactEmail}` },
  ],
}
