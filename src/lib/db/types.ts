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

export type AppRole = 'admin' | 'instructor' | 'client'
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
  id: number
  club_name: string
  timezone: string
  currency: string
  spot_name: string
  spot_latitude: number
  spot_longitude: number
  contact_phone: string | null
  cancellation_window_hours: number
  tips_enabled: boolean
  updated_at: string
}

export type Category = {
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
  slot_id: string
  instructor_id: string
  is_lead: boolean
  assigned_by: string | null
  assigned_at: string
}

export type Reservation = {
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
  created_at: string
  updated_at: string
}

export type Tip = {
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

export type AuditLogEntry = {
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
    }
    Enums: {
      app_role: AppRole
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
