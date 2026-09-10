-- =============================================================================
-- 0004  Lesson packages, inventory, rentals
-- =============================================================================

create extension if not exists "btree_gist" with schema extensions;

-- ---------------------------------------------------------------------------
-- package_templates : what the admin can attach to a client
-- ---------------------------------------------------------------------------
create table if not exists public.package_templates (
  id            uuid primary key default extensions.gen_random_uuid(),
  category_id   uuid references public.categories(id) on delete set null,
  name          text not null check (length(btrim(name)) between 2 and 120),
  description   text check (length(description) <= 1000),
  lessons_count smallint not null check (lessons_count between 1 and 200),
  price_cents   integer not null check (price_cents >= 0),
  currency      char(3) not null default 'ILS',
  validity_days smallint not null default 180 check (validity_days between 1 and 1095),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists package_templates_touch on public.package_templates;
create trigger package_templates_touch before update on public.package_templates
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- client_packages : a package attached to one client
-- lessons_remaining is maintained by trigger from package_ledger; never written
-- directly by the application.
-- ---------------------------------------------------------------------------
create table if not exists public.client_packages (
  id                 uuid primary key default extensions.gen_random_uuid(),
  client_id          uuid not null references public.clients(profile_id) on delete cascade,
  template_id        uuid references public.package_templates(id) on delete set null,
  name               text not null check (length(btrim(name)) between 2 and 120),
  lessons_total      smallint not null check (lessons_total between 1 and 500),
  lessons_remaining  smallint not null check (lessons_remaining >= 0),
  status             public.package_status not null default 'active',
  price_cents        integer not null default 0 check (price_cents >= 0),
  currency           char(3) not null default 'ILS',
  payment_id         uuid,
  purchased_at       timestamptz not null default now(),
  expires_at         timestamptz not null,
  cancelled_at       timestamptz,
  cancelled_reason   text check (length(cancelled_reason) <= 500),
  granted_by         uuid references public.profiles(id) on delete set null,
  notes              text check (length(notes) <= 1000),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint client_packages_remaining_le_total check (lessons_remaining <= lessons_total)
);

create index if not exists client_packages_client_idx on public.client_packages (client_id, status);
create index if not exists client_packages_expiry_idx on public.client_packages (expires_at)
  where status = 'active';

drop trigger if exists client_packages_touch on public.client_packages;
create trigger client_packages_touch before update on public.client_packages
  for each row execute function app.touch_updated_at();

-- reservations may be paid from a package
alter table public.reservations
  drop constraint if exists reservations_client_package_fk;
alter table public.reservations
  add constraint reservations_client_package_fk
  foreign key (client_package_id) references public.client_packages(id) on delete set null;

-- ---------------------------------------------------------------------------
-- package_ledger : append-only record of every credit movement
-- ---------------------------------------------------------------------------
create table if not exists public.package_ledger (
  id                bigint generated always as identity primary key,
  client_package_id uuid not null references public.client_packages(id) on delete cascade,
  reservation_id    uuid references public.reservations(id) on delete set null,
  -- negative = lesson consumed, positive = granted / extended / refunded
  delta             smallint not null check (delta <> 0),
  reason            text not null check (reason in
                      ('grant', 'redeem', 'refund', 'extend', 'revoke', 'expire', 'adjust')),
  note              text check (length(note) <= 500),
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index if not exists package_ledger_pkg_idx on public.package_ledger (client_package_id, created_at desc);

-- ---------------------------------------------------------------------------
-- inventory_types : the "type" the admin manages (quantity = live item count)
-- ---------------------------------------------------------------------------
create table if not exists public.inventory_types (
  id                uuid primary key default extensions.gen_random_uuid(),
  category_id       uuid references public.categories(id) on delete set null,
  name              text not null check (length(btrim(name)) between 2 and 120),
  kind              text not null default 'board'
                      check (kind in ('board', 'wetsuit', 'leash', 'fins', 'sup', 'kayak', 'other')),
  description       text check (length(description) <= 1000),
  brand             text check (length(brand) <= 80),
  size_label        text check (length(size_label) <= 40),
  daily_price_cents integer not null default 0 check (daily_price_cents >= 0),
  currency          char(3) not null default 'ILS',
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists inventory_types_touch on public.inventory_types;
create trigger inventory_types_touch before update on public.inventory_types
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- inventory_items : one physical unit
-- ---------------------------------------------------------------------------
create table if not exists public.inventory_items (
  id          uuid primary key default extensions.gen_random_uuid(),
  type_id     uuid not null references public.inventory_types(id) on delete restrict,
  asset_tag   text not null unique check (length(btrim(asset_tag)) between 1 and 40),
  status      public.inventory_status not null default 'available',
  condition   text not null default 'good' check (condition in ('new', 'good', 'fair', 'poor')),
  acquired_on date,
  notes       text check (length(notes) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists inventory_items_type_idx on public.inventory_items (type_id, status);

drop trigger if exists inventory_items_touch on public.inventory_items;
create trigger inventory_items_touch before update on public.inventory_items
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- rentals : a board is out of stock from checkout until hand-back
-- ---------------------------------------------------------------------------
create table if not exists public.rentals (
  id             uuid primary key default extensions.gen_random_uuid(),
  client_id      uuid not null references public.clients(profile_id) on delete restrict,
  item_id        uuid not null references public.inventory_items(id) on delete restrict,
  start_date     date not null,
  end_date       date not null,
  status         public.rental_status not null default 'reserved',
  price_cents    integer not null default 0 check (price_cents >= 0),
  currency       char(3) not null default 'ILS',
  payment_id     uuid,
  checked_out_at timestamptz,
  returned_at    timestamptz,
  condition_out  text check (condition_out in ('new', 'good', 'fair', 'poor')),
  condition_in   text check (condition_in in ('new', 'good', 'fair', 'poor')),
  damage_note    text check (length(damage_note) <= 1000),
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint rentals_date_order check (end_date >= start_date),
  -- the same physical item can never be double-booked over overlapping days
  constraint rentals_no_overlap exclude using gist (
    item_id with =,
    daterange(start_date, end_date, '[]') with &&
  ) where (status in ('reserved', 'out', 'overdue'))
);

create index if not exists rentals_client_idx on public.rentals (client_id, start_date desc);
create index if not exists rentals_open_idx   on public.rentals (end_date)
  where status in ('reserved', 'out', 'overdue');

drop trigger if exists rentals_touch on public.rentals;
create trigger rentals_touch before update on public.rentals
  for each row execute function app.touch_updated_at();
