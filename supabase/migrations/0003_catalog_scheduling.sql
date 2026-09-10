-- =============================================================================
-- 0003  Catalog (categories, services, prices) and scheduling (slots, bookings)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default extensions.gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 2 and 80),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind        public.category_kind not null default 'lesson',
  description text check (length(description) <= 1000),
  sort_order  smallint not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists categories_touch on public.categories;
create trigger categories_touch before update on public.categories
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- services : the bookable/priced products inside a category
-- ---------------------------------------------------------------------------
create table if not exists public.services (
  id               uuid primary key default extensions.gen_random_uuid(),
  category_id      uuid not null references public.categories(id) on delete restrict,
  name             text not null check (length(btrim(name)) between 2 and 120),
  description      text check (length(description) <= 2000),
  duration_minutes smallint not null default 90 check (duration_minutes between 15 and 600),
  default_capacity smallint not null default 6 check (default_capacity between 1 and 100),
  -- money is always integer minor units; never floats
  price_cents      integer not null check (price_cents >= 0),
  currency         char(3) not null default 'ILS',
  min_level        public.skill_level,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists services_category_idx on public.services (category_id) where is_active;

drop trigger if exists services_touch on public.services;
create trigger services_touch before update on public.services
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- price_history : every price change on any priced entity, appended by trigger
-- ---------------------------------------------------------------------------
create table if not exists public.price_history (
  id            bigint generated always as identity primary key,
  entity_type   text not null check (entity_type in ('service', 'inventory_type', 'package_template', 'time_slot')),
  entity_id     uuid not null,
  old_price_cents integer,
  new_price_cents integer not null,
  currency      char(3) not null default 'ILS',
  changed_by    uuid references public.profiles(id) on delete set null,
  note          text check (length(note) <= 500),
  created_at    timestamptz not null default now()
);

create index if not exists price_history_entity_idx
  on public.price_history (entity_type, entity_id, created_at desc);

-- ---------------------------------------------------------------------------
-- time_slots : a concrete session on the calendar
-- ---------------------------------------------------------------------------
create table if not exists public.time_slots (
  id                 uuid primary key default extensions.gen_random_uuid(),
  service_id         uuid not null references public.services(id) on delete restrict,
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,
  capacity           smallint not null check (capacity between 1 and 100),
  status             public.slot_status not null default 'open',
  -- set when an admin blocks the slot, shown to staff only
  block_reason       text check (length(block_reason) <= 500),
  location           text check (length(location) <= 200),
  -- overrides services.price_cents when not null
  price_cents_override integer check (price_cents_override >= 0),
  whatsapp_group_url text check (whatsapp_group_url ~ '^https://chat\.whatsapp\.com/[A-Za-z0-9]{10,40}$'),
  notes              text check (length(notes) <= 1000),
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint time_slots_time_order check (ends_at > starts_at),
  constraint time_slots_sane_length check (ends_at - starts_at <= interval '12 hours')
);

create index if not exists time_slots_starts_idx  on public.time_slots (starts_at);
create index if not exists time_slots_service_idx on public.time_slots (service_id, starts_at);

drop trigger if exists time_slots_touch on public.time_slots;
create trigger time_slots_touch before update on public.time_slots
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- time_slot_instructors : admin attaches instructors to slots
-- ---------------------------------------------------------------------------
create table if not exists public.time_slot_instructors (
  slot_id       uuid not null references public.time_slots(id) on delete cascade,
  instructor_id uuid not null references public.instructors(profile_id) on delete cascade,
  is_lead       boolean not null default false,
  assigned_by   uuid references public.profiles(id) on delete set null,
  assigned_at   timestamptz not null default now(),
  primary key (slot_id, instructor_id)
);

create index if not exists tsi_instructor_idx on public.time_slot_instructors (instructor_id);

-- one lead per slot
create unique index if not exists tsi_single_lead_idx
  on public.time_slot_instructors (slot_id) where is_lead;

-- ---------------------------------------------------------------------------
-- reservations
-- ---------------------------------------------------------------------------
create table if not exists public.reservations (
  id                uuid primary key default extensions.gen_random_uuid(),
  slot_id           uuid not null references public.time_slots(id) on delete restrict,
  client_id         uuid not null references public.clients(profile_id) on delete cascade,
  status            public.reservation_status not null default 'pending',
  participants      smallint not null default 1 check (participants between 1 and 20),
  -- when redeemed from a lesson package instead of paid per-session
  client_package_id uuid,
  price_cents       integer not null default 0 check (price_cents >= 0),
  currency          char(3) not null default 'ILS',
  payment_id        uuid,
  client_note       text check (length(client_note) <= 1000),
  staff_note        text check (length(staff_note) <= 1000),
  -- audit of the decision
  decided_by        uuid references public.profiles(id) on delete set null,
  decided_at        timestamptz,
  rejection_reason  text check (length(rejection_reason) <= 500),
  -- bumped every time the client edits an approved booking (forces re-approval)
  revision          integer not null default 1 check (revision >= 1),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- a client may hold only one live booking per slot
create unique index if not exists reservations_one_live_per_slot
  on public.reservations (slot_id, client_id)
  where status in ('pending', 'approved');

create index if not exists reservations_slot_idx   on public.reservations (slot_id, status);
create index if not exists reservations_client_idx on public.reservations (client_id, created_at desc);
create index if not exists reservations_pending_idx on public.reservations (created_at) where status = 'pending';

drop trigger if exists reservations_touch on public.reservations;
create trigger reservations_touch before update on public.reservations
  for each row execute function app.touch_updated_at();
