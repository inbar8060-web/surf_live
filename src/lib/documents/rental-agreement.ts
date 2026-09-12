import type { Block, DocumentContext, SignableDocument } from './types'

/**
 * Boards rental agreement.
 *
 * The damage schedule below is carried over verbatim from the club's reference
 * form, including its US dollar amounts. Review it — and the currency — before
 * this goes in front of real members; the figures are the operator's
 * commercial terms, not something the app should quietly localise.
 *
 * Any change to the amounts is a change to the contract: bump `version`.
 */
const DAMAGE_CURRENCY = 'USD'

const STANDARD_BOARD_FEES = [
  'Broken fin box surfboards — $50',
  'Missing leash — $35',
  'Broken leash — $20',
  'Dings, scratches, and other fixable damages — $10 up to $70',
  'Destroyed board — replacement fee not to exceed $250',
  'Missing fin — $15',
  'Missing lycra — $25',
  'Torn lycra — $20',
]

const PERFORMANCE_BOARD_FEES = [
  'Broken fin box, high-performance surfboards — $100; SUP or longboards — $100',
  'Broken or missing fin — $25; centre fin for SUP or longboards — $50',
  'Broken paddle — $100; 100% carbon paddle — $250',
  'Dings, scratches, and other fixable damages — $30 up to $300',
  'Destroyed board — replacement fee not to exceed $500 per high-performance surfboard or Torq longboard',
  'Destroyed SUP — replacement fee not to exceed $700',
]

export const RENTAL_AGREEMENT: SignableDocument = {
  key: 'rental_agreement',
  version: '2026-09-1',
  title: 'Boards Rental Agreement',
  summary:
    'Sets out how gear must be returned and what damage costs. Required before you can take a board out.',

  fields: [
    {
      id: 'board_type',
      label: 'Type of board',
      kind: 'select',
      options: ['Shortboard', 'Softboard', 'Longboard', 'Bodyboard', 'SUP'],
      required: true,
    },
  ],

  body: ({ clubName }: DocumentContext): Block[] => [
    {
      kind: 'paragraph',
      text: 'I oblige myself to return the board in the same conditions as I received.',
    },
    {
      kind: 'paragraph',
      text: `For any damage to the board, I will be charged the following (amounts in ${DAMAGE_CURRENCY}):`,
    },
    { kind: 'list', title: 'Normal surfboards', items: STANDARD_BOARD_FEES },
    {
      kind: 'list',
      title: 'High-performance surfboards, Torq longboards, SUP',
      items: PERFORMANCE_BOARD_FEES,
    },
    { kind: 'heading', text: 'Please note' },
    {
      kind: 'emphatic',
      text:
        'If you return your surfboard later than 24 hours from the time you rented it, you will be charged an ' +
        'additional day.',
    },
    {
      kind: 'paragraph',
      text:
        `This agreement covers every item of equipment ${clubName} hands to me, for as long as it is in my ` +
        'care, and remains in force for future rentals until it is replaced by a newer version.',
    },
  ],

  acknowledgements: [
    {
      id: 'agree_to_terms',
      label: 'I agree with everything that is written above.',
      required: true,
    },
  ],
}
