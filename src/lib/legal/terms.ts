import type { Block } from '@/lib/documents/types'
import { PLATFORM, type LegalDocument } from './types'

const P = PLATFORM

export const TERMS: LegalDocument = {
  key: 'terms',
  version: '2026-09-1',
  title: 'Terms of Service',
  summary: 'The agreement between you and Surfer Live for using the platform.',
  audience: ['admin', 'instructor', 'client'],
  consent: 'I have read and accept the Terms of Service.',
  body: ({ clubName }): Block[] => [
    { kind: 'paragraph', text: `Last updated: 1 September 2026. These Terms of Service (the "Terms") govern your use of the ${P.name} platform, website and applications (the "Service"), operated by ${P.legalName} ("${P.name}", "we", "us"). By creating an account or using the Service you agree to these Terms. If you do not agree, do not use the Service.` },

    { kind: 'heading', text: '1. What the Service is' },
    { kind: 'paragraph', text: `${P.name} is a booking and inventory platform used by surf clubs, surf schools and retreat centres ("Clubs"). A Club uses the Service to publish sessions, manage instructors, gear and members, and take bookings and payments. Members and instructors use it to book, teach and communicate with their Club.` },
    { kind: 'paragraph', text: `${P.name} provides the software. It is not a party to the arrangement between a Club and its members or instructors, does not provide surf instruction, and does not own, operate or supervise any Club. ${clubName ? `Your Club is ${clubName}.` : ''}` },

    { kind: 'heading', text: '2. Accounts' },
    { kind: 'list', items: [
      'Accounts are created by a Club, or through a registration link a Club issues. You must give accurate information and keep it up to date.',
      'You are responsible for everything done under your account and for keeping your password private. Tell your Club and us at once if you believe your account has been used without your permission.',
      'You must be at least 18 years old to hold an account. A parent or legal guardian may hold an account on behalf of a minor and is responsible for it.',
      'We may suspend or close an account that breaches these Terms, is used for fraud or abuse, or is required to be closed by law.',
    ] },

    { kind: 'heading', text: '3. Bookings, payments and refunds' },
    { kind: 'paragraph', text: 'Sessions, lessons, packages, rentals and their prices are set by the Club. A booking is a request until the Club approves it. Payment for a Club\'s services is made to the Club: card and digital wallet payments are processed by our payment partner on the Club\'s own account, and the Club is the merchant of record. Refunds, cancellations and changes are governed by the Club\'s own policy, which the Club shows you before you book.' },
    { kind: 'paragraph', text: `${P.name} does not hold your money. We do not see or store card numbers; they are handled by the payment partner under its own terms and security certification.` },

    { kind: 'heading', text: '4. Safety and your Club\'s documents' },
    { kind: 'paragraph', text: 'Surfing and water activities carry real risk. Your Club will ask you to read and sign its own waiver, release of liability and rental agreement before your first session. Those documents are between you and the Club. Follow the instructions of your instructors, tell the Club about any medical condition that matters, and do not take part if you are not fit to.' },

    { kind: 'heading', text: '5. Acceptable use' },
    { kind: 'list', items: [
      'Do not use the Service to harass, threaten or discriminate against anyone.',
      'Do not upload content that is unlawful, infringing, or that you do not have the right to share.',
      'Do not attempt to access another person\'s or another Club\'s data, probe or disrupt the Service, or bypass its security.',
      'Do not use automated means to scrape or overload the Service.',
      'Reviews you post must be your own honest experience.',
    ] },

    { kind: 'heading', text: '6. Content and reviews' },
    { kind: 'paragraph', text: 'You keep ownership of what you write and upload. You grant the Club and us a licence to display it within the Service for the purpose it was given — a public review on the Club\'s page, a private review to the Club\'s administrator, a photo on your profile. A Club may moderate public reviews on its own page. We may remove content that breaches these Terms.' },

    { kind: 'heading', text: '7. Privacy' },
    { kind: 'paragraph', text: `How we handle personal data is described in our Privacy Policy, which forms part of these Terms. In short: your Club controls the data it collects about you; ${P.name} processes it on the Club's behalf to run the Service and holds each Club's data separately from every other Club's.` },

    { kind: 'heading', text: '8. Availability and changes' },
    { kind: 'paragraph', text: 'We aim to keep the Service available at all times but do not guarantee it. We may change, suspend or withdraw features, and will give reasonable notice of changes that materially reduce what the Service does. Surf, wave and weather figures are forecasts from third-party services, shown for convenience; they are not a safety assessment.' },

    { kind: 'heading', text: '9. Intellectual property' },
    { kind: 'paragraph', text: `The Service, its design, software and trademarks belong to ${P.legalName} and its licensors. These Terms give you a personal, non-transferable right to use the Service; they do not transfer any ownership.` },

    { kind: 'heading', text: '10. Liability' },
    { kind: 'emphatic', text: `To the fullest extent permitted by law, ${P.name} is not liable for any injury, loss or damage arising from surf or water activities, from the acts or omissions of a Club or its staff, or from the Club's equipment. ${P.name}'s total liability to you for any claim connected with the Service is limited to the greater of the fees you paid to ${P.name} in the twelve months before the claim, or 100 US dollars.` },
    { kind: 'paragraph', text: 'Nothing in these Terms excludes liability that cannot be excluded by law, including liability for death or personal injury caused by our own negligence, or for fraud.' },

    { kind: 'heading', text: '11. Termination' },
    { kind: 'paragraph', text: 'You may stop using the Service at any time and ask your Club to close your account. A Club may close the accounts of its members and instructors under its own policy. We may terminate these Terms with you if you materially breach them. Sections that by their nature should survive — content licences, liability, governing law — survive termination.' },

    { kind: 'heading', text: '12. Governing law' },
    { kind: 'paragraph', text: `These Terms are governed by ${P.governingLaw}. Disputes are subject to ${P.courts}, without prejudice to any mandatory consumer protection you enjoy in the country where you live.` },

    { kind: 'heading', text: '13. Changes to these Terms' },
    { kind: 'paragraph', text: 'We may update these Terms. The version date at the top changes when we do, and you will be asked to accept the new version the next time you sign in if the change is material. Continued use after that is acceptance.' },

    { kind: 'heading', text: '14. Contact' },
    { kind: 'paragraph', text: `${P.legalName} · ${P.website} · ${P.contactEmail}` },
  ],
}
