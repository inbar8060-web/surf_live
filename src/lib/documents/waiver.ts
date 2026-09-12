import type { Block, DocumentContext, SignableDocument } from './types'

/**
 * Waiver and release of liability.
 *
 * Wording follows the club's reference form. The operator's name is injected
 * rather than hard-coded, so the same text serves whichever club runs the app.
 *
 * Changing any wording below is a new version: bump `version`, because the
 * version string is the only record of what a member actually agreed to.
 */
export const WAIVER: SignableDocument = {
  key: 'waiver',
  version: '2026-09-1',
  title: 'Waiver and Release of Liability',
  summary:
    'Confirms you understand the risks of surfing and releases the club from liability. Required before your first session.',

  body: ({ clubName }: DocumentContext): Block[] => [
    { kind: 'heading', text: 'Please read carefully' },
    {
      kind: 'paragraph',
      text:
        `In consideration for taking surf lessons from ${clubName} and as a prerequisite, I hereby covenant ` +
        `that I am familiar with the hazards of the ocean and recognize that ${clubName} cannot control the ` +
        'environment and that the environment can change without warning making participation in surfing ' +
        'hazardous. I realize that certain environmental conditions like the wind, fog, currents (including ' +
        'riptides), waves (including swells, breaking waves, and whitewater), rocks, sand bars, reefs, piers, ' +
        'jetties, breakwaters, sea animals, surfboard, other objects in the water, and others in the water can ' +
        'cause injury to me.',
    },
    {
      kind: 'paragraph',
      text:
        'I hereby represent that I know to swim and feel comfortable in the water, or if I am uncomfortable in ' +
        `the water or do not know how to swim I will immediately inform ${clubName} prior to proceeding with my ` +
        `lesson. Also, included in the services provided by ${clubName} is the furnishing of surf equipment ` +
        `(surfboard, rash guard, leash, etc.). Accordingly, while it will endeavor to provide the appropriate ` +
        `equipment, ${clubName} does not manufacture the equipment provided and makes no warranty as to the ` +
        'fitness of such equipment for the purpose of surfing.',
    },
    {
      kind: 'paragraph',
      text:
        `${clubName} emphasizes safety in the lessons and endeavors to keep every pupil as safe as possible. I ` +
        'acknowledge that participation in an activity like surfing involves the risk of injury and can possibly ' +
        'lead to serious and permanent bodily injury, disability, or death. I will ensure that, while ' +
        `participating in any surfing activity with ${clubName} I will familiarize myself with my surroundings ` +
        'and avoid injury to myself and others.',
    },
    {
      kind: 'emphatic',
      text:
        `With the above understanding I hereby release and hold harmless ${clubName} or any of the staff, ` +
        'owners, or any affiliate association from any and all liability or responsibility, negligence causes ' +
        'of action, claims, and damages of every kind which may arise out of my participation in any ' +
        `activities involving ${clubName}.`,
    },
    {
      kind: 'paragraph',
      text:
        'I, the undersigned participant, affirm that I am of the age of 18 years or older and that I am freely ' +
        'signing this agreement. I certify that I have read this agreement, that I fully understand its ' +
        'content, and that this release cannot be modified orally. I am aware that this is a release of ' +
        'liability and a contract and that I am signing it of my own free will.',
    },
  ],

  acknowledgements: [
    {
      id: 'read_and_understood',
      label:
        'I have read and understood this agreement, I am 18 years or older, and I am signing it of my own free will.',
      required: true,
    },
    {
      /*
       * Deliberately optional and never pre-ticked. The reference form carries
       * media consent inside the same document, but consent that cannot be
       * refused is not consent — a member can decline this and still surf.
       */
      id: 'media_consent',
      label: 'I consent to the use of photographic materials for marketing purposes. (Optional)',
      required: false,
    },
  ],
}
