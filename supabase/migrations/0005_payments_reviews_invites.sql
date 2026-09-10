-- =============================================================================
-- 0005  Payments, tips, reviews, registration invites
-- =============================================================================

-- ---------------------------------------------------------------------------
-- payments : one row per provider charge attempt. Amounts are authoritative
-- server-side; the browser never supplies them.
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id            uuid primary key default extensions.gen_random_uuid(),
  client_id     uuid not null references public.clients(profile_id) on delete restrict,
  kind          public.payment_kind not null,
  amount_cents  integer not null check (amount_cents > 0),
  currency      char(3) not null default 'ILS',
  status        public.payment_status not null default 'pending',
  provider      text not null default 'stripe' check (provider in ('stripe', 'manual', 'mock')),
  -- provider session / intent id; unique so webhook replays are idempotent
  provider_ref  text,
  description   text check (length(description) <= 300),
  metadata      jsonb not null default '{}'::jsonb,
  failure_reason text check (length(failure_reason) <= 500),
  succeeded_at  timestamptz,
  refunded_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists payments_provider_ref_key
  on public.payments (provider, provider_ref) where provider_ref is not null;
create index if not exists payments_client_idx on public.payments (client_id, created_at desc);

drop trigger if exists payments_touch on public.payments;
create trigger payments_touch before update on public.payments
  for each row execute function app.touch_updated_at();

alter table public.reservations    drop constraint if exists reservations_payment_fk;
alter table public.reservations    add  constraint reservations_payment_fk
  foreign key (payment_id) references public.payments(id) on delete set null;
alter table public.client_packages drop constraint if exists client_packages_payment_fk;
alter table public.client_packages add  constraint client_packages_payment_fk
  foreign key (payment_id) references public.payments(id) on delete set null;
alter table public.rentals         drop constraint if exists rentals_payment_fk;
alter table public.rentals         add  constraint rentals_payment_fk
  foreign key (payment_id) references public.payments(id) on delete set null;

-- ---------------------------------------------------------------------------
-- tips : client -> instructor, always backed by a payments row
-- ---------------------------------------------------------------------------
create table if not exists public.tips (
  id             uuid primary key default extensions.gen_random_uuid(),
  client_id      uuid not null references public.clients(profile_id) on delete restrict,
  instructor_id  uuid not null references public.instructors(profile_id) on delete restrict,
  reservation_id uuid references public.reservations(id) on delete set null,
  payment_id     uuid not null references public.payments(id) on delete restrict,
  amount_cents   integer not null check (amount_cents between 100 and 10000000),
  currency       char(3) not null default 'ILS',
  message        text check (length(message) <= 300),
  created_at     timestamptz not null default now()
);

create index if not exists tips_instructor_idx on public.tips (instructor_id, created_at desc);
create index if not exists tips_client_idx     on public.tips (client_id, created_at desc);

-- ---------------------------------------------------------------------------
-- instructor_reviews : private feedback, visible to admins only
-- ---------------------------------------------------------------------------
create table if not exists public.instructor_reviews (
  id             uuid primary key default extensions.gen_random_uuid(),
  client_id      uuid not null references public.clients(profile_id) on delete cascade,
  instructor_id  uuid not null references public.instructors(profile_id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete set null,
  rating         smallint not null check (rating between 1 and 5),
  body           text check (length(body) <= 4000),
  admin_read_at  timestamptz,
  created_at     timestamptz not null default now()
);

-- one private review per client per booking
create unique index if not exists instructor_reviews_once
  on public.instructor_reviews (client_id, reservation_id) where reservation_id is not null;
create index if not exists instructor_reviews_instructor_idx
  on public.instructor_reviews (instructor_id, created_at desc);

-- ---------------------------------------------------------------------------
-- session_reviews : public wall, one per client per slot
-- author_display_name is denormalised so the public feed never needs to read
-- other clients' profiles.
-- ---------------------------------------------------------------------------
create table if not exists public.session_reviews (
  id                  uuid primary key default extensions.gen_random_uuid(),
  slot_id             uuid not null references public.time_slots(id) on delete cascade,
  client_id           uuid not null references public.clients(profile_id) on delete cascade,
  author_display_name text not null,
  rating              smallint not null check (rating between 1 and 5),
  title               text check (length(title) <= 120),
  body                text check (length(body) <= 4000),
  -- admins can unpublish abusive content without deleting the record
  is_published        boolean not null default true,
  hidden_reason       text check (length(hidden_reason) <= 500),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists session_reviews_once on public.session_reviews (slot_id, client_id);
create index if not exists session_reviews_feed_idx on public.session_reviews (created_at desc)
  where is_published;

drop trigger if exists session_reviews_touch on public.session_reviews;
create trigger session_reviews_touch before update on public.session_reviews
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- registration_invites : single-use, hashed, expiring links
-- The raw token is shown to the admin exactly once and never stored.
-- ---------------------------------------------------------------------------
create table if not exists public.registration_invites (
  id           uuid primary key default extensions.gen_random_uuid(),
  -- sha256(token) hex; lookups are by hash so a DB leak yields no usable links
  token_hash   text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  role         public.app_role not null default 'client',
  email        extensions.citext,
  phone        text check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  full_name    text check (length(full_name) <= 120),
  note         text check (length(note) <= 500),
  expires_at   timestamptz not null,
  used_at      timestamptz,
  used_by      uuid references public.profiles(id) on delete set null,
  revoked_at   timestamptz,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint invite_not_used_and_revoked check (used_at is null or revoked_at is null)
);

create index if not exists registration_invites_open_idx on public.registration_invites (created_at desc)
  where used_at is null and revoked_at is null;
