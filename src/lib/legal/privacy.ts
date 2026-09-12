import type { Block } from '@/lib/documents/types'
import { PLATFORM, type LegalDocument } from './types'

const P = PLATFORM

export const PRIVACY: LegalDocument = {
  key: 'privacy',
  version: '2026-09-1',
  title: 'Privacy Policy',
  summary: 'What personal data the platform handles, why, and what rights you have.',
  audience: ['admin', 'instructor', 'client'],
  consent: 'I have read the Privacy Policy and understand how my data is handled.',
  body: ({ clubName }): Block[] => [
    { kind: 'paragraph', text: `Last updated: 1 September 2026. This policy explains how ${P.legalName} ("${P.name}", "we") handles personal data in the ${P.name} platform (the "Service"). It applies to Club administrators, instructors and members alike.` },

    { kind: 'heading', text: '1. Who is responsible for your data' },
    { kind: 'paragraph', text: `Each surf club, school or retreat centre using the Service (a "Club") decides what data to collect about its members and instructors and why. For that data the Club is the controller and ${P.name} is its processor: we handle it on the Club's instructions, to run the Service. ${clubName ? `Your Club is ${clubName}; questions about how it uses your data go to it first.` : ''} For the data we collect about Club administrators as our own customers — account details, billing, support conversations — ${P.name} is the controller.` },

    { kind: 'heading', text: '2. What we collect' },
    { kind: 'list', items: [
      'Account data: name, email, phone number, password (stored only as a one-way hash), role, language.',
      'Member profile data entered by you or the Club: skill level, height and weight for board fit, emergency contact, medical notes you choose to share, notes the Club keeps.',
      'Bookings, packages, rentals, tips, reviews and messages within the Service.',
      'Signing records: which document version you signed and when. The signed document itself is emailed to you and to the Club and is not stored in the Service.',
      'Payment records: amount, currency, status and a payment reference. Card numbers and wallet details are handled by our payment partner and never reach the Service.',
      'Technical data: IP address, browser type, and the time of sign-ins and sensitive actions, kept in an audit log.',
      'Support conversations between a Club administrator and the platform, including reports written by an automated assistant from the administrator\'s own words.',
    ] },

    { kind: 'heading', text: '3. Why we use it' },
    { kind: 'list', items: [
      'To provide the Service: accounts, bookings, schedules, gear, payments, reviews, messages.',
      'To keep the Service safe: authentication, fraud and abuse prevention, the audit trail, rate limiting.',
      'To send the emails the Service needs: registration links, signed documents, booking updates, plan invoices.',
      'To bill Clubs for their plan and to support them.',
      'To produce statistics for a Club about its own activity, and for the platform about each Club\'s volume — never individual member data at the platform level.',
      'To comply with law and to establish or defend legal claims.',
    ] },
    { kind: 'paragraph', text: 'We do not sell personal data and do not use it for third-party advertising.' },

    { kind: 'heading', text: '4. Separation between Clubs' },
    { kind: 'paragraph', text: 'Every record in the Service is tagged with the Club it belongs to, and the database enforces that a Club\'s staff and members can only ever read or write their own Club\'s records. The platform operator can see how much activity a Club has — counts and totals — but not the people behind it.' },

    { kind: 'heading', text: '5. Who we share it with' },
    { kind: 'list', items: [
      'Your Club, which is the reason the data exists.',
      'Instructors of your Club, who see the members booked into their sessions and the details needed to teach them safely.',
      'Service providers who host and run the Service: database and authentication hosting, application hosting, email delivery, the payment partner (for payments), a maps provider (for the Club\'s public address), a marine forecast provider (which receives only the Club\'s coordinates), and an AI provider for the support assistant (which receives only what an administrator types in a support conversation).',
      'Authorities where the law requires it.',
    ] },
    { kind: 'paragraph', text: 'Our providers process data under contracts that limit them to providing their service to us. Some are located outside your country; where required, transfers are covered by appropriate safeguards.' },

    { kind: 'heading', text: '6. How long we keep it' },
    { kind: 'paragraph', text: 'Data is kept while your account is active and for as long as the Club or the law needs it afterwards — booking and payment records for accounting periods, signing records for the limitation period of claims. Audit logs are append-only and kept for the life of the Club\'s account. When a Club leaves the platform its data is archived and then deleted under its agreement with us.' },

    { kind: 'heading', text: '7. Your rights' },
    { kind: 'paragraph', text: 'Depending on where you live you may have the right to access, correct, delete or receive a copy of your data, to object to or restrict its processing, and to complain to a supervisory authority. You can change your password in the Service at any time. For anything else, ask your Club, which can act in the Service directly; if you cannot reach the Club, contact us and we will help.' },

    { kind: 'heading', text: '8. Security' },
    { kind: 'paragraph', text: 'Data is encrypted in transit, stored with a hosting provider certified to recognised security standards, and protected by role-based access enforced in the database itself. Passwords are hashed. Privileged actions are logged. No system is perfectly secure; if we learn of a breach affecting you we will notify your Club and, where required, you and the relevant authority.' },

    { kind: 'heading', text: '9. Children' },
    { kind: 'paragraph', text: 'Accounts are held by adults. A Club may enrol a minor under a parent\'s or guardian\'s account; the parent or guardian is responsible for that account and for the data entered in it.' },

    { kind: 'heading', text: '10. Cookies' },
    { kind: 'paragraph', text: 'The Service uses only the cookies it needs to keep you signed in and to protect forms against forgery. It sets no advertising or cross-site tracking cookies.' },

    { kind: 'heading', text: '11. Changes' },
    { kind: 'paragraph', text: 'We may update this policy; the date at the top changes when we do, and you will be asked to acknowledge a material change the next time you sign in.' },

    { kind: 'heading', text: '12. Contact' },
    { kind: 'paragraph', text: `${P.legalName} · ${P.website} · ${P.contactEmail}` },
  ],
}
