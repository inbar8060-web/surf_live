import type { Block } from '@/lib/documents/types'
import { PLATFORM, type LegalDocument } from './types'

const P = PLATFORM

export const INSTRUCTOR_AGREEMENT: LegalDocument = {
  key: 'instructor_agreement',
  version: '2026-09-1',
  title: 'Instructor Agreement',
  summary: 'What using the platform as an instructor means, and what is expected of you.',
  audience: ['instructor'],
  consent: 'I have read and accept the Instructor Agreement.',
  body: ({ clubName }): Block[] => [
    { kind: 'paragraph', text: `Last updated: 1 September 2026. This agreement applies to anyone using ${P.name} as an instructor${clubName ? ` for ${clubName}` : ''}. It sits alongside the Terms of Service and the Privacy Policy.` },

    { kind: 'heading', text: '1. Your relationship' },
    { kind: 'paragraph', text: `You are engaged by your Club, not by ${P.name}. Nothing here creates employment, partnership or agency between you and ${P.name}. Your pay, hours, qualifications, insurance and conduct are matters between you and the Club.` },

    { kind: 'heading', text: '2. What you can see, and why' },
    { kind: 'paragraph', text: 'The Service shows you the members booked into your sessions and, for every group at the Club, who is in it — name, level, phone number, and safety notes such as medical information a member chose to share. This is so you can teach safely and reach a member on the day.' },
    { kind: 'list', title: 'You agree to:', items: [
      'Use that information only to run your sessions and keep your students safe.',
      'Not copy, export or share it outside the Service, except the day\'s schedule export the Service provides for your own use on the beach, which you will delete after the day.',
      'Not contact a member for any purpose unrelated to their sessions with the Club, and not to solicit them away from the Club.',
      'Keep your account private. Sign out on a shared device.',
    ] },

    { kind: 'heading', text: '3. Sessions and approvals' },
    { kind: 'paragraph', text: 'You may approve or decline booking requests for your own sessions. Decline only for a good reason and record it; the member sees your decision. Sessions you cannot run must be reported to the Club at once so it can block them and tell members.' },

    { kind: 'heading', text: '4. Safety' },
    { kind: 'paragraph', text: 'You confirm you hold the qualifications your Club requires, that you will not teach when you are unfit to, and that you will follow the Club\'s safety rules and local regulations. A member marked "no waiver" has not signed the Club\'s release: do not take them into the water until they have.' },

    { kind: 'heading', text: '5. Reviews and tips' },
    { kind: 'paragraph', text: 'Members may review a session publicly and may review you privately to the Club\'s administrator. Private reviews are not shown to you; the Club decides what to share. Tips a member leaves through the Service are paid to the Club\'s account and passed to you under the Club\'s arrangement, not by Surfer Live.' },

    { kind: 'heading', text: '6. Your data' },
    { kind: 'paragraph', text: 'Your name, photo, bio and qualifications are shown to the Club\'s members so they can choose and contact you. Your phone number is shown to members booked with you so they can message you. Ask the Club to change or remove any of it.' },

    { kind: 'heading', text: '7. Ending' },
    { kind: 'paragraph', text: 'The Club may deactivate your account when your engagement ends. Your obligations about members\' information continue after that.' },

    { kind: 'heading', text: '8. Governing law' },
    { kind: 'paragraph', text: `This agreement is governed by ${P.governingLaw} and subject to ${P.courts}.` },

    { kind: 'heading', text: '9. Contact' },
    { kind: 'paragraph', text: `${P.legalName} · ${P.website} · ${P.contactEmail}` },
  ],
}
