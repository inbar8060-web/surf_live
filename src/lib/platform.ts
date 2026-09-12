/** Shared constants for the operator area. */

/** The operator's clock. Club screens use each club's own zone; this area has one. */
export const PLATFORM_TZ = 'Asia/Jerusalem'

export const CLUB_STATUS_LABEL: Record<string, string> = {
  provisioning: 'Setting up',
  active: 'Active',
  suspended: 'Paused',
  archived: 'Archived',
}

/** Status wording differs by who is reading: the same state is "needs your
 *  reply" to the operator and "sent to the platform" to the club. */
export const SUPPORT_STATUS_LABEL: Record<'super_admin' | 'admin', Record<string, string>> = {
  super_admin: {
    open: 'With the assistant',
    awaiting_platform: 'Needs your reply',
    awaiting_club: 'Waiting for the club',
    closed: 'Closed',
  },
  admin: {
    open: 'With the assistant',
    awaiting_platform: 'Sent to the platform',
    awaiting_club: 'The platform replied',
    closed: 'Closed',
  },
}
