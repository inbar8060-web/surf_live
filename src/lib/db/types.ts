/**
 * Hand-maintained mirror of the SQL schema.
 *
 * Regenerate with `npx supabase gen types typescript --local > src/lib/db/types.ts`
 * once a Supabase project is linked; until then this file is the contract that
 * keeps queries honest. Column names here must match supabase/migrations.
 *
 * Everything below is a `type` alias, never an `interface`: supabase-js
 * constrains schemas to `Record<string, unknown>`, and an interface has no
 * implicit index signature, so switching one back to `interface` silently
 * collapses every query result to `never`.
 */

export type AppRole = 'admin' | 'instructor' | 'client' | 'super_admin'
export type ClubStatus = 'provisioning' | 'active' | 'suspended' | 'archived'
export type CategoryKind = 'lesson' | 'rental' | 'service'
export type SlotStatus = 'open' | 'blocked' | 'cancelled'
export type ReservationStatus =
  | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed' | 'no_show'
export type PackageStatus = 'active' | 'expired' | 'cancelled' | 'completed'
export type InventoryStatus = 'available' | 'rented' | 'maintenance' | 'retired'
export type RentalStatus = 'reserved' | 'out' | 'returned' | 'overdue' | 'lost'
export type PaymentKind = 'reservation' | 'package' | 'rental' | 'tip'
export type PaymentStatus =
  | 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'cancelled'
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'pro'

export type Profile = {
  id: string
  role: AppRole
  /** Null only for the platform operator. Fixed at creation; never moves. */
  club_id: string | null
  full_name: string
  email: string | null
  phone: string | null
  avatar_url: string | null
  locale: 'en' | 'he'
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Instructor = {
  club_id: string
  profile_id: string
  bio: string | null
  specialties: string[]
  certifications: string[]
  languages: string[]
  whatsapp_phone: string | null
  calendar_color: string
  hired_at: string | null
  created_at: string
  updated_at: string
}

export type Client = {
  club_id: string
  profile_id: string
  level: SkillLevel
  birth_date: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  medical_notes: string | null
  admin_notes: string | null
  waiver_signed_at: string | null
  height_cm: number | null
  weight_kg: number | null
  created_at: string
  updated_at: string
}

export type ClubSettings = {
  club_id: string
  club_name: string
  timezone: string
  currency: string
  spot_name: string
  spot_latitude: number
  spot_longitude: number
  contact_phone: string | null
  /** Club inbox that receives a copy of every signed document. */
  contact_email: string | null
  cancellation_window_hours: number
  tips_enabled: boolean
  /** From the Google Maps listing; the club may correct them. */
  address: string | null
  website: string | null
  /** One line per day as the listing prints them. */
  opening_hours: string[]
  place_id: string | null
  updated_at: string
}

export type Category = {
  club_id: string
  id: string
  name: string
  slug: string
  kind: CategoryKind
  description: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Service = {
  club_id: string
  id: string
  category_id: string
  name: string
  description: string | null
  duration_minutes: number
  default_capacity: number
  price_cents: number
  currency: string
  min_level: SkillLevel | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type TimeSlot = {
  club_id: string
  id: string
  service_id: string
  starts_at: string
  ends_at: string
  capacity: number
  status: SlotStatus
  block_reason: string | null
  location: string | null
  price_cents_override: number | null
  whatsapp_group_url: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type TimeSlotInstructor = {
  club_id: string
  slot_id: string
  instructor_id: string
  is_lead: boolean
  assigned_by: string | null
  assigned_at: string
}

export type Reservation = {
  club_id: string
  id: string
  slot_id: string
  client_id: string
  status: ReservationStatus
  participants: number
  client_package_id: string | null
  price_cents: number
  currency: string
  payment_id: string | null
  client_note: string | null
  staff_note: string | null
  decided_by: string | null
  decided_at: string | null
  rejection_reason: string | null
  revision: number
  created_at: string
  updated_at: string
}

export type PackageTemplate = {
  club_id: string
  id: string
  category_id: string | null
  name: string
  description: string | null
  lessons_count: number
  price_cents: number
  currency: string
  validity_days: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type ClientPackage = {
  club_id: string
  id: string
  client_id: string
  template_id: string | null
  name: string
  lessons_total: number
  lessons_remaining: number
  status: PackageStatus
  price_cents: number
  currency: string
  payment_id: string | null
  purchased_at: string
  expires_at: string
  cancelled_at: string | null
  cancelled_reason: string | null
  granted_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type PackageLedgerEntry = {
  club_id: string
  id: number
  client_package_id: string
  reservation_id: string | null
  delta: number
  reason: 'grant' | 'redeem' | 'refund' | 'extend' | 'revoke' | 'expire' | 'adjust'
  note: string | null
  created_by: string | null
  created_at: string
}

export type InventoryType = {
  club_id: string
  id: string
  category_id: string | null
  name: string
  kind: 'board' | 'wetsuit' | 'leash' | 'fins' | 'sup' | 'kayak' | 'other'
  description: string | null
  brand: string | null
  size_label: string | null
  daily_price_cents: number
  currency: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type InventoryItem = {
  club_id: string
  id: string
  type_id: string
  asset_tag: string
  status: InventoryStatus
  condition: 'new' | 'good' | 'fair' | 'poor'
  acquired_on: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type Rental = {
  club_id: string
  id: string
  client_id: string
  item_id: string
  start_date: string
  end_date: string
  status: RentalStatus
  price_cents: number
  currency: string
  payment_id: string | null
  checked_out_at: string | null
  returned_at: string | null
  condition_out: string | null
  condition_in: string | null
  damage_note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type Payment = {
  club_id: string
  id: string
  client_id: string
  kind: PaymentKind
  amount_cents: number
  currency: string
  status: PaymentStatus
  provider: 'stripe' | 'manual' | 'mock'
  provider_ref: string | null
  description: string | null
  metadata: Record<string, unknown>
  failure_reason: string | null
  succeeded_at: string | null
  refunded_at: string | null
  /** The club's payout account the charge went through. */
  account_id: string | null
  /** The platform's share, fixed at checkout time. */
  platform_fee_cents: number
  created_at: string
  updated_at: string
}

export type Tip = {
  club_id: string
  id: string
  client_id: string
  instructor_id: string
  reservation_id: string | null
  payment_id: string
  amount_cents: number
  currency: string
  message: string | null
  created_at: string
}

export type InstructorReview = {
  club_id: string
  id: string
  client_id: string
  instructor_id: string
  reservation_id: string | null
  rating: number
  body: string | null
  admin_read_at: string | null
  created_at: string
}

export type SessionReview = {
  club_id: string
  id: string
  slot_id: string
  client_id: string
  author_display_name: string
  rating: number
  title: string | null
  body: string | null
  is_published: boolean
  hidden_reason: string | null
  created_at: string
  updated_at: string
}

export type RegistrationInvite = {
  club_id: string
  id: string
  token_hash: string
  role: AppRole
  email: string | null
  phone: string | null
  full_name: string | null
  note: string | null
  expires_at: string
  used_at: string | null
  used_by: string | null
  revoked_at: string | null
  created_by: string | null
  created_at: string
}

export type DocumentSignature = {
  club_id: string
  id: number
  client_id: string
  document_key: 'waiver' | 'rental_agreement'
  /** Version string of the wording that was agreed to. */
  version: string
  signed_at: string
  /** Standing permission; only meaningful for the waiver. */
  media_consent: boolean | null
  /** sha256 of the emailed PDF — never the PDF itself. */
  document_sha256: string | null
  delivered_at: string | null
  delivery_error: string | null
  ip: string | null
  user_agent: string | null
  created_at: string
}

export type AuditLogEntry = {
  club_id: string
  id: number
  actor_id: string | null
  actor_role: AppRole | null
  action: string
  entity: string
  entity_id: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  ip: string | null
  user_agent: string | null
  created_at: string
}

export type PriceHistoryEntry = {
  club_id: string
  id: number
  entity_type: 'service' | 'inventory_type' | 'package_template' | 'time_slot'
  entity_id: string
  old_price_cents: number | null
  new_price_cents: number
  currency: string
  changed_by: string | null
  note: string | null
  created_at: string
}

/* ------------------------------------------------------------------ views */

export type InstructorDirectoryRow = {
  profile_id: string
  full_name: string
  avatar_url: string | null
  bio: string | null
  specialties: string[]
  certifications: string[]
  languages: string[]
  whatsapp_phone: string | null
  calendar_color: string
  is_active: boolean
}

export type SlotCatalogRow = {
  slot_id: string
  starts_at: string
  ends_at: string
  location: string | null
  capacity: number
  seats_taken: number
  seats_left: number
  price_cents: number
  currency: string
  service_id: string
  service_name: string
  service_description: string | null
  duration_minutes: number
  min_level: SkillLevel | null
  category_id: string
  category_name: string
  category_slug: string
  category_kind: CategoryKind
  instructor_names: string[]
  instructor_ids: string[]
}

export type MyBookingRow = {
  reservation_id: string
  status: ReservationStatus
  participants: number
  price_cents: number
  currency: string
  client_note: string | null
  rejection_reason: string | null
  revision: number
  created_at: string
  client_package_id: string | null
  slot_id: string
  starts_at: string
  ends_at: string
  location: string | null
  slot_status: SlotStatus
  whatsapp_group_url: string | null
  service_name: string
  duration_minutes: number
  category_name: string
  instructor_id: string | null
  instructor_name: string | null
  instructor_whatsapp: string | null
  can_modify: boolean
  has_session_review: boolean
}

export type MyPackageRow = {
  id: string
  name: string
  lessons_total: number
  lessons_remaining: number
  status: PackageStatus
  purchased_at: string
  expires_at: string
  currency: string
  price_cents: number
  is_usable: boolean
}

export type MyRentalRow = {
  id: string
  start_date: string
  end_date: string
  status: RentalStatus
  price_cents: number
  currency: string
  checked_out_at: string | null
  returned_at: string | null
  asset_tag: string
  item_name: string
  item_kind: string
  size_label: string | null
}

export type PublicSessionReviewRow = {
  id: string
  rating: number
  title: string | null
  body: string | null
  author_display_name: string
  created_at: string
  slot_id: string
  session_starts_at: string
  service_name: string
  category_name: string
}

export type StaffSlotOverviewRow = {
  slot_id: string
  starts_at: string
  ends_at: string
  status: SlotStatus
  location: string | null
  capacity: number
  block_reason: string | null
  notes: string | null
  whatsapp_group_url: string | null
  service_id: string
  service_name: string
  category_name: string
  seats_taken: number
  pending_count: number
  instructor_names: string[]
  instructor_ids: string[]
  is_mine: boolean
}

export type InstructorRosterRow = {
  slot_id: string
  starts_at: string
  ends_at: string
  location: string | null
  slot_status: SlotStatus
  whatsapp_group_url: string | null
  slot_notes: string | null
  service_name: string
  category_name: string
  reservation_id: string | null
  reservation_status: ReservationStatus | null
  participants: number | null
  client_note: string | null
  revision: number | null
  client_id: string | null
  client_name: string | null
  client_phone: string | null
  client_email: string | null
  client_level: SkillLevel | null
  medical_notes: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  waiver_signed_at: string | null
}

export type StaffReservationQueueRow = {
  reservation_id: string
  status: ReservationStatus
  participants: number
  price_cents: number
  currency: string
  client_note: string | null
  staff_note: string | null
  rejection_reason: string | null
  revision: number
  created_at: string
  client_package_id: string | null
  slot_id: string
  starts_at: string
  ends_at: string
  location: string | null
  slot_status: SlotStatus
  capacity: number
  whatsapp_group_url: string | null
  service_name: string
  category_name: string
  client_id: string
  client_name: string
  client_phone: string | null
  client_email: string | null
  client_level: SkillLevel
  medical_notes: string | null
  waiver_signed_at: string | null
  instructor_names: string[]
  instructor_ids: string[]
}

export type InventoryOverviewRow = {
  id: string
  name: string
  kind: string
  brand: string | null
  size_label: string | null
  daily_price_cents: number
  currency: string
  is_active: boolean
  category_id: string | null
  total_units: number
  available_units: number
  rented_units: number
  maintenance_units: number
  retired_units: number
}

/* ------------------------------------------------------------- platform */

export type Club = {
  id: string
  slug: string
  name: string
  maps_url: string | null
  admin_email: string
  status: ClubStatus
  suspended_at: string | null
  suspended_reason: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type PlatformAuditLogEntry = {
  id: number
  actor_id: string | null
  action: string
  club_id: string | null
  detail: Record<string, unknown> | null
  ip: string | null
  created_at: string
}

export type SupportConversation = {
  id: string
  club_id: string
  opened_by: string
  subject: string
  kind: 'bot' | 'human'
  status: 'open' | 'awaiting_platform' | 'awaiting_club' | 'closed'
  category: 'bug' | 'question' | 'billing' | 'feature' | 'urgent' | 'other' | null
  severity: 'low' | 'medium' | 'high' | 'critical' | null
  report: Record<string, unknown> | null
  last_message_at: string
  closed_at: string | null
  created_at: string
  updated_at: string
}

export type SupportMessage = {
  id: number
  conversation_id: string
  club_id: string
  sender_role: 'admin' | 'super_admin' | 'bot'
  sender_id: string | null
  body: string
  created_at: string
}

/** Counts only — the operator never sees a row of club data. */
export type ClubStatisticsRow = {
  club_id: string
  slug: string
  name: string
  status: ClubStatus
  created_at: string
  members: number
  instructors: number
  admins: number
  sessions_total: number
  sessions_upcoming: number
  bookings_pending: number
  bookings_approved: number
  bookings_completed: number
  rentals_open: number
  packages_active: number
  reviews_public: number
  documents_signed: number
  documents_undelivered: number
  payments_failed: number
  last_activity_at: string | null
}

export type ClubActivityRow = {
  club_id: string
  day: string
  operation: string
  action: string
  events: number
}

export type ClubPublicProfile = {
  club_id: string
  slug: string
  name: string
  spot_name: string | null
  timezone: string | null
  spot_latitude: number | null
  spot_longitude: number | null
  contact_phone: string | null
  maps_url: string | null
  status: ClubStatus
  address: string | null
  website: string | null
  opening_hours: string[]
}

export type PlanKey = 'beach' | 'ocean' | 'surfing'
export type FinancialDashboard = 'none' | 'internal' | 'full'
export type ReportPeriod = 'monthly' | 'quarterly' | 'yearly'

export type Plan = {
  key: PlanKey
  name: string
  tagline: string | null
  price_cents: number
  currency: string
  sort_order: number
  /** null = unlimited */
  max_instructors: number | null
  max_new_clients_per_month: number | null
  max_payments_per_month: number | null
  wallet_payments: boolean
  reports: ReportPeriod[]
  financial_dashboard: FinancialDashboard
  is_active: boolean
  created_at: string
}

export type SubscriptionStatus = 'incomplete' | 'active' | 'past_due' | 'canceled'

export type ClubSubscription = {
  id: string
  club_id: string
  plan_key: PlanKey
  status: SubscriptionStatus
  provider: 'stripe' | 'mock'
  provider_customer_id: string | null
  provider_subscription_id: string | null
  provider_checkout_ref: string | null
  current_period_start: string | null
  current_period_end: string | null
  canceled_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type PayoutAccountStatus = 'onboarding' | 'active' | 'restricted' | 'disabled'

/** The club's payout account at the provider. An id and its state — never a credential. */
export type ClubPaymentAccount = {
  club_id: string
  provider: 'stripe_connect' | 'mock'
  account_id: string
  country: string | null
  default_currency: string | null
  charges_enabled: boolean
  payouts_enabled: boolean
  details_submitted: boolean
  requirements_due: string[]
  status: PayoutAccountStatus
  platform_fee_bps: number
  created_at: string
  updated_at: string
}

export type LegalDocumentKey = 'terms' | 'privacy' | 'club_agreement' | 'instructor_agreement'

export type LegalAcceptance = {
  id: number
  club_id: string
  user_id: string
  document_key: LegalDocumentKey
  version: string
  accepted_at: string
  ip: string | null
  user_agent: string | null
}

/** Per club, per month — sums and counts only. */
export type PlatformClubFinanceRow = {
  club_id: string
  month: string
  currency: string
  payments_succeeded: number
  payments_failed: number
  payments_refunded: number
  gross_cents: number
  refunded_cents: number
  platform_fee_cents: number
  tips_cents: number
}

/* ------------------------------------------------- supabase-js Database map */

type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] }
type View<Row> = { Row: Row; Relationships: [] }

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile>
      instructors: Table<Instructor>
      clients: Table<Client>
      club_settings: Table<ClubSettings>
      categories: Table<Category>
      services: Table<Service>
      time_slots: Table<TimeSlot>
      time_slot_instructors: Table<TimeSlotInstructor>
      reservations: Table<Reservation>
      package_templates: Table<PackageTemplate>
      client_packages: Table<ClientPackage>
      package_ledger: Table<PackageLedgerEntry>
      inventory_types: Table<InventoryType>
      inventory_items: Table<InventoryItem>
      rentals: Table<Rental>
      payments: Table<Payment>
      tips: Table<Tip>
      instructor_reviews: Table<InstructorReview>
      session_reviews: Table<SessionReview>
      registration_invites: Table<RegistrationInvite>
      audit_log: Table<AuditLogEntry>
      price_history: Table<PriceHistoryEntry>
      document_signatures: Table<DocumentSignature>
      clubs: Table<Club>
      platform_audit_log: Table<PlatformAuditLogEntry>
      support_conversations: Table<SupportConversation>
      support_messages: Table<SupportMessage>
      plans: Table<Plan>
      club_subscriptions: Table<ClubSubscription>
      club_payment_accounts: Table<ClubPaymentAccount>
      legal_acceptances: Table<LegalAcceptance>
    }
    Views: {
      instructor_directory: View<InstructorDirectoryRow>
      slot_catalog: View<SlotCatalogRow>
      my_bookings: View<MyBookingRow>
      my_packages: View<MyPackageRow>
      my_rentals: View<MyRentalRow>
      public_session_reviews: View<PublicSessionReviewRow>
      staff_slot_overview: View<StaffSlotOverviewRow>
      instructor_roster: View<InstructorRosterRow>
      staff_reservation_queue: View<StaffReservationQueueRow>
      inventory_overview: View<InventoryOverviewRow>
      club_statistics: View<ClubStatisticsRow>
      club_activity: View<ClubActivityRow>
      platform_club_finance: View<PlatformClubFinanceRow>
    }
    Functions: {
      set_inventory_quantity: {
        Args: { p_type_id: string; p_desired: number; p_asset_prefix?: string | null }
        Returns: { total_units: number; available_units: number }[]
      }
      grant_client_package: {
        Args: { p_client_id: string; p_template_id: string; p_note?: string | null }
        Returns: string
      }
      extend_client_package: {
        Args: {
          p_package_id: string
          p_extra_lessons?: number
          p_extra_days?: number
          p_note?: string | null
        }
        Returns: ClientPackage
      }
      cancel_client_package: {
        Args: { p_package_id: string; p_reason: string }
        Returns: ClientPackage
      }
      expire_stale_packages: { Args: Record<string, never>; Returns: number }
      provision_club: {
        Args: {
          p_name: string
          p_slug: string
          p_maps_url: string
          p_admin_email: string
          p_timezone?: string
          p_details?: Record<string, unknown>
        }
        Returns: Club
      }
      club_public_profile: { Args: { p_slug: string }; Returns: ClubPublicProfile[] }
      club_plan_usage: {
        Args: Record<string, never>
        Returns: { instructors: number; new_clients_this_month: number; payments_this_month: number }[]
      }
    }
    Enums: {
      app_role: AppRole
      club_status: ClubStatus
      category_kind: CategoryKind
      slot_status: SlotStatus
      reservation_status: ReservationStatus
      package_status: PackageStatus
      inventory_status: InventoryStatus
      rental_status: RentalStatus
      payment_kind: PaymentKind
      payment_status: PaymentStatus
      skill_level: SkillLevel
    }
    CompositeTypes: Record<string, never>
  }
}
