-- =============================================================================
-- 0002  Identity: profiles, instructors, clients, club settings, audit log
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles : one row per auth.users row, holds the authoritative role
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         public.app_role not null default 'client',
  full_name    text not null check (length(btrim(full_name)) between 2 and 120),
  email        extensions.citext,
  -- E.164 so wa.me / tel: links can be built without further cleaning
  phone        text check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  avatar_url   text,
  locale       text not null default 'en' check (locale in ('en', 'he')),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role) where is_active;
create unique index if not exists profiles_phone_key on public.profiles (phone) where phone is not null;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- instructors
-- ---------------------------------------------------------------------------
create table if not exists public.instructors (
  profile_id       uuid primary key references public.profiles(id) on delete cascade,
  bio              text check (length(bio) <= 2000),
  specialties      text[] not null default '{}',
  certifications   text[] not null default '{}',
  languages        text[] not null default '{en}',
  -- separate from profiles.phone: the number clients are allowed to message
  whatsapp_phone   text check (whatsapp_phone ~ '^\+[1-9][0-9]{6,14}$'),
  calendar_color   text not null default '#0ea5e9' check (calendar_color ~ '^#[0-9a-fA-F]{6}$'),
  -- payout handle for tips (provider account id, never raw bank details)
  payout_account_ref text,
  hired_at         date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists instructors_touch on public.instructors;
create trigger instructors_touch before update on public.instructors
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  profile_id            uuid primary key references public.profiles(id) on delete cascade,
  level                 public.skill_level not null default 'beginner',
  birth_date            date check (birth_date > '1900-01-01' and birth_date < current_date),
  emergency_contact_name  text check (length(emergency_contact_name) <= 120),
  emergency_contact_phone text check (emergency_contact_phone ~ '^\+[1-9][0-9]{6,14}$'),
  medical_notes         text check (length(medical_notes) <= 2000),
  -- staff-only free text; never exposed to the client by RLS
  admin_notes           text check (length(admin_notes) <= 4000),
  waiver_signed_at      timestamptz,
  height_cm             smallint check (height_cm between 50 and 250),
  weight_kg             smallint check (weight_kg between 20 and 250),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

drop trigger if exists clients_touch on public.clients;
create trigger clients_touch before update on public.clients
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- club_settings : single-row configuration (spot coordinates, currency, ...)
-- ---------------------------------------------------------------------------
create table if not exists public.club_settings (
  id                smallint primary key default 1 check (id = 1),
  club_name         text not null default 'Surfer Live',
  timezone          text not null default 'Asia/Jerusalem',
  currency          char(3) not null default 'ILS',
  spot_name         text not null default 'Home break',
  spot_latitude     numeric(8,5) not null default 32.08088,
  spot_longitude    numeric(8,5) not null default 34.76765,
  contact_phone     text check (contact_phone ~ '^\+[1-9][0-9]{6,14}$'),
  cancellation_window_hours smallint not null default 12 check (cancellation_window_hours between 0 and 168),
  tips_enabled      boolean not null default true,
  updated_at        timestamptz not null default now()
);

insert into public.club_settings (id) values (1) on conflict (id) do nothing;

drop trigger if exists club_settings_touch on public.club_settings;
create trigger club_settings_touch before update on public.club_settings
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- audit_log : append-only trail of every privileged mutation
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles(id) on delete set null,
  actor_role  public.app_role,
  action      text not null check (length(action) between 3 and 80),
  entity      text not null check (length(entity) between 2 and 60),
  entity_id   text,
  before      jsonb,
  after       jsonb,
  ip          inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_entity_idx  on public.audit_log (entity, entity_id, created_at desc);
create index if not exists audit_log_actor_idx   on public.audit_log (actor_id, created_at desc);
