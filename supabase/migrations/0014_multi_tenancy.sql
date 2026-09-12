-- =============================================================================
-- 0014  Multi-tenancy: one database, many clubs, no way to cross between them
-- =============================================================================
-- Every club-owned row carries `club_id`. Four independent mechanisms each
-- refuse a cross-club row on their own, so a mistake in one layer is caught
-- by the next:
--
--   1. `club_id` is NOT NULL on every tenant table. A row cannot exist without
--      belonging to exactly one club.
--   2. Every RLS policy is conjoined with `club_id = app.current_club_id()`.
--      A club's user cannot read or write another club's row even through a
--      bug in application code, because the database will not return it.
--   3. Composite foreign keys: a reservation references its session as
--      (club_id, slot_id) → time_slots (club_id, id). A booking that points at
--      another club's session is a constraint violation, not a data error.
--   4. A trigger on every tenant table fills `club_id` from the caller's own
--      club, refuses a value that differs from it, and refuses to change it
--      afterwards.
--
-- A user belongs to exactly one club, held on their profile. There is no
-- "current club" chosen at request time and no default club to fall back to:
-- a member of club A visiting club B's address is simply someone with no
-- rights there. The platform operator (super_admin) belongs to no club and,
-- deliberately, no policy on a tenant table mentions them at all — what they
-- can see is defined by the aggregate views at the end of this file.

-- ---------------------------------------------------------------------------
-- clubs
-- ---------------------------------------------------------------------------
create table if not exists public.clubs (
  id               uuid primary key default extensions.gen_random_uuid(),
  -- becomes the subdomain: <slug>.<platform domain>
  slug             text not null unique
                     check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 40),
  name             text not null check (length(btrim(name)) between 2 and 120),
  maps_url         text check (
                     maps_url ~ '^https://(www\.)?google\.[a-z.]+/maps' or
                     maps_url ~ '^https://maps\.app\.goo\.gl/' or
                     maps_url ~ '^https://goo\.gl/maps/'),
  admin_email      extensions.citext not null,
  status           text not null default 'provisioning'
                     check (status in ('provisioning', 'active', 'suspended', 'archived')),
  suspended_at     timestamptz,
  suspended_reason text check (length(suspended_reason) <= 500),
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- names the platform itself uses; a club can never take one
create or replace function app.reserved_slug(p_slug text)
returns boolean language sql immutable as $$
  select p_slug in ('www', 'admin', 'platform', 'api', 'app', 'mail', 'support', 'static', 'assets')
$$;

alter table public.clubs drop constraint if exists clubs_slug_not_reserved;
alter table public.clubs add constraint clubs_slug_not_reserved check (not app.reserved_slug(slug));

drop trigger if exists clubs_touch on public.clubs;
create trigger clubs_touch before update on public.clubs
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- The first club: the one whose data is already here
-- ---------------------------------------------------------------------------
insert into public.clubs (slug, name, admin_email, status)
select 'surfer-live', coalesce(cs.club_name, 'Surfer Live'), 'admin@surferlive.test', 'active'
from public.club_settings cs
where not exists (select 1 from public.clubs)
limit 1;

-- ---------------------------------------------------------------------------
-- profiles: the club a person belongs to
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists club_id uuid references public.clubs(id) on delete restrict;

update public.profiles set club_id = (select id from public.clubs order by created_at limit 1)
where club_id is null and role <> 'super_admin';

alter table public.profiles drop constraint if exists profiles_club_matches_role;
alter table public.profiles add constraint profiles_club_matches_role
  check ((role = 'super_admin') = (club_id is null));

create index if not exists profiles_club_idx on public.profiles (club_id, role) where is_active;

-- ---------------------------------------------------------------------------
-- Role helpers
-- ---------------------------------------------------------------------------
create or replace function app.is_super_admin()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role = 'super_admin'
  )
$$;

-- The caller's club. Null for the platform operator and for anonymous
-- requests, and null means no tenant row matches any policy below.
create or replace function app.current_club_id()
returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select p.club_id from public.profiles p where p.id = auth.uid() and p.is_active
$$;

-- ---------------------------------------------------------------------------
-- club_id on every tenant table, backfilled from the first club, then
-- locked NOT NULL
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  v_default uuid := (select id from public.clubs order by created_at limit 1);
begin
  foreach t in array array[
    'instructors','clients','categories','services','time_slots','time_slot_instructors',
    'reservations','package_templates','client_packages','package_ledger','inventory_types',
    'inventory_items','rentals','payments','tips','instructor_reviews','session_reviews',
    'registration_invites','audit_log','price_history','document_signatures'
  ] loop
    execute format('alter table public.%I add column if not exists club_id uuid references public.clubs(id) on delete restrict', t);
    execute format('update public.%I set club_id = $1 where club_id is null', t) using v_default;
    execute format('alter table public.%I alter column club_id set not null', t);
    execute format('create index if not exists %I on public.%I (club_id)', t || '_club_idx', t);
  end loop;
end $$;

-- The read models from 0008 reference columns that change below (club_settings.id
-- in particular). They are dropped here and rebuilt, club-scoped, further down.
do $$
declare v text;
begin
  foreach v in array array[
    'staff_reservation_queue','inventory_overview','instructor_roster','staff_slot_overview',
    'public_session_reviews','my_rentals','my_packages','my_bookings','slot_catalog','instructor_directory'
  ] loop
    execute format('drop view if exists public.%I', v);
  end loop;
end $$;

-- club_settings: one row per club, keyed by the club
alter table public.club_settings add column if not exists club_id uuid references public.clubs(id) on delete cascade;
update public.club_settings set club_id = (select id from public.clubs order by created_at limit 1) where club_id is null;
alter table public.club_settings alter column club_id set not null;
alter table public.club_settings drop constraint if exists club_settings_pkey;
alter table public.club_settings drop constraint if exists club_settings_id_check;
alter table public.club_settings drop column if exists id;
alter table public.club_settings add primary key (club_id);

-- ---------------------------------------------------------------------------
-- Composite keys, so a child row can only reference a parent in its own club
-- ---------------------------------------------------------------------------
alter table public.categories        add constraint categories_club_id_key        unique (club_id, id);
alter table public.services          add constraint services_club_id_key          unique (club_id, id);
alter table public.time_slots        add constraint time_slots_club_id_key        unique (club_id, id);
alter table public.clients           add constraint clients_club_profile_key      unique (club_id, profile_id);
alter table public.instructors       add constraint instructors_club_profile_key  unique (club_id, profile_id);
alter table public.reservations      add constraint reservations_club_id_key      unique (club_id, id);
alter table public.package_templates add constraint package_templates_club_id_key unique (club_id, id);
alter table public.client_packages   add constraint client_packages_club_id_key   unique (club_id, id);
alter table public.inventory_types   add constraint inventory_types_club_id_key   unique (club_id, id);
alter table public.inventory_items   add constraint inventory_items_club_id_key   unique (club_id, id);
alter table public.payments          add constraint payments_club_id_key          unique (club_id, id);

-- Names that were unique across the one club are now unique within each club:
-- two clubs may both have a "group-lessons" category, a board tagged SOFT-0001
-- and a member with the same phone number. Email stays global — it is the
-- sign-in identity, one account per address.
alter table public.categories      drop constraint if exists categories_slug_key;
alter table public.categories      add constraint categories_club_slug_key unique (club_id, slug);
alter table public.inventory_items drop constraint if exists inventory_items_asset_tag_key;
alter table public.inventory_items add constraint inventory_items_club_asset_tag_key unique (club_id, asset_tag);
drop index if exists public.profiles_phone_key;
create unique index profiles_phone_key on public.profiles (club_id, phone) where phone is not null;

alter table public.services
  add constraint services_category_same_club foreign key (club_id, category_id)
  references public.categories (club_id, id) on delete restrict;

alter table public.time_slots
  add constraint time_slots_service_same_club foreign key (club_id, service_id)
  references public.services (club_id, id) on delete restrict;

alter table public.time_slot_instructors
  add constraint tsi_slot_same_club foreign key (club_id, slot_id)
  references public.time_slots (club_id, id) on delete cascade,
  add constraint tsi_instructor_same_club foreign key (club_id, instructor_id)
  references public.instructors (club_id, profile_id) on delete cascade;

alter table public.reservations
  add constraint reservations_slot_same_club foreign key (club_id, slot_id)
  references public.time_slots (club_id, id) on delete restrict,
  add constraint reservations_client_same_club foreign key (club_id, client_id)
  references public.clients (club_id, profile_id) on delete cascade,
  add constraint reservations_package_same_club foreign key (club_id, client_package_id)
  references public.client_packages (club_id, id) on delete set null,
  add constraint reservations_payment_same_club foreign key (club_id, payment_id)
  references public.payments (club_id, id) on delete set null;

alter table public.client_packages
  add constraint client_packages_client_same_club foreign key (club_id, client_id)
  references public.clients (club_id, profile_id) on delete cascade,
  add constraint client_packages_template_same_club foreign key (club_id, template_id)
  references public.package_templates (club_id, id) on delete set null;

alter table public.package_ledger
  add constraint package_ledger_package_same_club foreign key (club_id, client_package_id)
  references public.client_packages (club_id, id) on delete cascade;

alter table public.inventory_items
  add constraint inventory_items_type_same_club foreign key (club_id, type_id)
  references public.inventory_types (club_id, id) on delete restrict;

alter table public.rentals
  add constraint rentals_client_same_club foreign key (club_id, client_id)
  references public.clients (club_id, profile_id) on delete restrict,
  add constraint rentals_item_same_club foreign key (club_id, item_id)
  references public.inventory_items (club_id, id) on delete restrict;

alter table public.payments
  add constraint payments_client_same_club foreign key (club_id, client_id)
  references public.clients (club_id, profile_id) on delete restrict;

alter table public.tips
  add constraint tips_client_same_club foreign key (club_id, client_id)
  references public.clients (club_id, profile_id) on delete restrict,
  add constraint tips_instructor_same_club foreign key (club_id, instructor_id)
  references public.instructors (club_id, profile_id) on delete restrict,
  add constraint tips_payment_same_club foreign key (club_id, payment_id)
  references public.payments (club_id, id) on delete restrict;

alter table public.instructor_reviews
  add constraint instructor_reviews_client_same_club foreign key (club_id, client_id)
  references public.clients (club_id, profile_id) on delete cascade,
  add constraint instructor_reviews_instructor_same_club foreign key (club_id, instructor_id)
  references public.instructors (club_id, profile_id) on delete cascade;

alter table public.session_reviews
  add constraint session_reviews_slot_same_club foreign key (club_id, slot_id)
  references public.time_slots (club_id, id) on delete cascade,
  add constraint session_reviews_client_same_club foreign key (club_id, client_id)
  references public.clients (club_id, profile_id) on delete cascade;

alter table public.document_signatures
  add constraint document_signatures_client_same_club foreign key (club_id, client_id)
  references public.clients (club_id, profile_id) on delete cascade;

-- the role rows belong to the same club as the profile they extend
create or replace function app.guard_role_row_club()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_club uuid;
begin
  select club_id into v_club from public.profiles where id = new.profile_id;
  if v_club is null then
    raise exception 'A % row needs a profile that belongs to a club', tg_table_name using errcode = '23514';
  end if;
  if new.club_id is null then
    new.club_id := v_club;
  elsif new.club_id <> v_club then
    raise exception 'The % row must be in the same club as its profile', tg_table_name using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists clients_club_guard on public.clients;
create trigger clients_club_guard before insert or update on public.clients
  for each row execute function app.guard_role_row_club();

drop trigger if exists instructors_club_guard on public.instructors;
create trigger instructors_club_guard before insert or update on public.instructors
  for each row execute function app.guard_role_row_club();

-- ---------------------------------------------------------------------------
-- The club column is set from the caller and then never moves
-- ---------------------------------------------------------------------------
create or replace function app.set_club_id()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_mine uuid := app.current_club_id();
begin
  if tg_op = 'UPDATE' then
    if new.club_id is distinct from old.club_id then
      raise exception 'A row cannot be moved to another club' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.club_id is null then
    new.club_id := v_mine;
  end if;

  if new.club_id is null then
    -- server code holding the service role must always say which club it means
    raise exception 'club_id is required on %', tg_table_name using errcode = '23502';
  end if;

  -- a signed-in club user may only write into their own club
  if auth.uid() is not null and v_mine is not null and new.club_id <> v_mine then
    raise exception 'Cross-club write refused on %', tg_table_name using errcode = '42501';
  end if;

  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'categories','services','time_slots','time_slot_instructors','reservations',
    'package_templates','client_packages','package_ledger','inventory_types','inventory_items',
    'rentals','payments','tips','instructor_reviews','session_reviews','registration_invites',
    'audit_log','price_history','document_signatures','club_settings'
  ] loop
    -- named to sort first: Postgres fires same-event triggers alphabetically,
    -- and every other rule on the row must see club_id already filled in
    execute format('drop trigger if exists %I on public.%I', '_00_set_club', t);
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function app.set_club_id()',
      '_00_set_club', t);
  end loop;
end $$;

-- profiles: the club is fixed at creation
create or replace function app.guard_profile_club()
returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.club_id is distinct from old.club_id then
    raise exception 'A person cannot be moved to another club' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_club_fixed on public.profiles;
create trigger profiles_club_fixed before update of club_id on public.profiles
  for each row execute function app.guard_profile_club();

-- ---------------------------------------------------------------------------
-- New accounts take their club from app_metadata — set only by server code —
-- and there is no fallback. An account with no club is refused outright.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- One routine turns an auth.users row into a profile, used by both the insert
-- and the metadata-update trigger.
--
-- GoTrue's admin createUser writes the auth row first and applies app_metadata
-- in a follow-up UPDATE (see 0010). Until that metadata names a role — and,
-- for anyone but the operator, a club — nothing is created: a profile is never
-- given a default club, and an auth row that never receives its metadata gets
-- no profile at all and cannot sign in. That is the safe failure.
-- ---------------------------------------------------------------------------
create or replace function app.materialise_profile(
  p_id uuid, p_email text, p_phone text, p_app jsonb, p_user jsonb
)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_role  public.app_role;
  v_club  uuid;
  v_name  text;
  v_phone text;
  v_have  public.profiles;
begin
  v_role := nullif(p_app ->> 'role', '')::public.app_role;
  v_club := nullif(p_app ->> 'club_id', '')::uuid;

  if v_role is null then
    return;   -- metadata not applied yet; the update trigger will call again
  end if;

  if v_role = 'super_admin' then
    v_club := null;
  elsif v_club is null then
    raise exception 'A % account must be created for a specific club', v_role using errcode = '23502';
  elsif not exists (select 1 from public.clubs where id = v_club and status in ('provisioning', 'active')) then
    raise exception 'That club does not exist or is not accepting accounts' using errcode = '23503';
  end if;

  v_name := nullif(btrim(coalesce(p_app ->> 'full_name', p_user ->> 'full_name')), '');
  v_phone := nullif(btrim(coalesce(p_app ->> 'phone', p_phone)), '');
  if v_phone !~ '^\+[1-9][0-9]{6,14}$' then v_phone := null; end if;

  select * into v_have from public.profiles where id = p_id;

  if v_have.id is null then
    insert into public.profiles (id, role, club_id, full_name, email, phone)
    values (
      p_id, v_role, v_club,
      left(coalesce(v_name, split_part(coalesce(p_email, 'member'), '@', 1)), 120),
      p_email, v_phone
    );
  else
    -- The role is authoritative and always applied; the club never moves
    -- (guard_profile_club refuses it), so a metadata write naming a different
    -- club is a mistake and is refused rather than obeyed.
    if v_have.club_id is distinct from v_club then
      raise exception 'An account cannot be moved to another club' using errcode = '42501';
    end if;
    update public.profiles set role = v_role where id = p_id and role is distinct from v_role;

    -- Name and phone are only filled in while they are still the values
    -- derived at sign-up; once staff have edited them, the profile wins.
    if v_name is not null then
      update public.profiles set full_name = left(v_name, 120)
      where id = p_id and full_name = split_part(coalesce(p_email, 'member'), '@', 1);
    end if;
    if v_phone is not null then
      update public.profiles set phone = v_phone where id = p_id and phone is null;
    end if;
  end if;

  if v_role = 'instructor' then
    insert into public.instructors (profile_id, club_id) values (p_id, v_club) on conflict do nothing;
  elsif v_role = 'client' then
    insert into public.clients (profile_id, club_id) values (p_id, v_club) on conflict do nothing;
  end if;
end;
$$;

create or replace function app.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.materialise_profile(new.id, new.email, new.phone, new.raw_app_meta_data, new.raw_user_meta_data);
  return new;
end;
$$;

create or replace function app.sync_user_metadata()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.raw_app_meta_data is not distinct from old.raw_app_meta_data then
    return new;
  end if;
  perform app.materialise_profile(new.id, new.email, new.phone, new.raw_app_meta_data, new.raw_user_meta_data);
  return new;
end;
$$;

-- the role-row creation in the two existing role-change paths must carry the club
create or replace function app.guard_profile_changes()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is not null and not app.is_admin() and not app.is_super_admin() then
    if new.role is distinct from old.role then
      raise exception 'Only an administrator can change a role' using errcode = '42501';
    end if;
    if new.is_active is distinct from old.is_active then
      raise exception 'Only an administrator can activate or deactivate an account' using errcode = '42501';
    end if;
  end if;

  -- nobody becomes or stops being the platform operator through this table
  if (new.role = 'super_admin') <> (old.role = 'super_admin') then
    raise exception 'The platform role cannot be granted or removed here' using errcode = '42501';
  end if;

  if old.role = 'admin' and (new.role <> 'admin' or new.is_active = false) then
    if (select count(*) from public.profiles
        where role = 'admin' and is_active and club_id = old.club_id and id <> old.id) = 0 then
      raise exception 'The last active administrator of this club cannot be removed' using errcode = '23514';
    end if;
  end if;

  if new.role is distinct from old.role then
    if new.role = 'instructor' then
      insert into public.instructors (profile_id, club_id) values (new.id, new.club_id) on conflict do nothing;
    elsif new.role = 'client' then
      insert into public.clients (profile_id, club_id) values (new.id, new.club_id) on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

-- The booking rules from 0006 read the cancellation window from the single
-- settings row that used to exist. Rewritten in place to read the row of the
-- booking's own club, keeping one source for the rest of that function.
do $$
declare src text;
begin
  src := pg_get_functiondef('app.enforce_reservation_rules()'::regprocedure);
  src := replace(src,
    'select cancellation_window_hours into v_window_h from public.club_settings where id = 1;',
    'select cancellation_window_hours into v_window_h from public.club_settings where club_id = new.club_id;');
  execute src;
end $$;

-- Trigger and RPC bodies from 0006/0009 insert ledger, stock and price-history
-- rows. Those inserts now name the club explicitly, taken from the row that
-- caused them, so they hold when the caller is server code with no club of its
-- own. Each rewrite asserts it changed something: a silent no-op here would be
-- a policy hole discovered in production.
create or replace function app.rewrite_function(p_fn regprocedure, p_from text, p_to text)
returns void language plpgsql as $$
declare src text;
begin
  src := pg_get_functiondef(p_fn);
  if position(p_from in src) = 0 then
    raise exception 'rewrite_function: pattern not found in %: %', p_fn, left(p_from, 60);
  end if;
  execute replace(src, p_from, p_to);
end;
$$;

select app.rewrite_function('app.sync_package_credits()',
  'insert into public.package_ledger (client_package_id, reservation_id, delta, reason, created_by, note)
    values (new.client_package_id, new.id, -1,',
  'insert into public.package_ledger (club_id, client_package_id, reservation_id, delta, reason, created_by, note)
    values (new.club_id, new.client_package_id, new.id, -1,');
select app.rewrite_function('app.sync_package_credits()',
  'insert into public.package_ledger (client_package_id, reservation_id, delta, reason, created_by, note)
      values (new.client_package_id, new.id, 1,',
  'insert into public.package_ledger (club_id, client_package_id, reservation_id, delta, reason, created_by, note)
      values (new.club_id, new.client_package_id, new.id, 1,');

select app.rewrite_function('app.record_price_change()',
  'insert into public.price_history
      (entity_type, entity_id, old_price_cents, new_price_cents, currency, changed_by)
    values (v_type, new.id,',
  'insert into public.price_history
      (club_id, entity_type, entity_id, old_price_cents, new_price_cents, currency, changed_by)
    values (new.club_id, v_type, new.id,');

select app.rewrite_function('public.grant_client_package(uuid, uuid, text)',
  'insert into public.client_packages
    (client_id, template_id, name, lessons_total, lessons_remaining,
     price_cents, currency, expires_at, granted_by, notes)
  values
    (p_client_id, v_tpl.id,',
  'insert into public.client_packages
    (club_id, client_id, template_id, name, lessons_total, lessons_remaining,
     price_cents, currency, expires_at, granted_by, notes)
  values
    (v_tpl.club_id, p_client_id, v_tpl.id,');
select app.rewrite_function('public.grant_client_package(uuid, uuid, text)',
  'insert into public.package_ledger (client_package_id, delta, reason, created_by, note)
  values (v_id, v_tpl.lessons_count,',
  'insert into public.package_ledger (club_id, client_package_id, delta, reason, created_by, note)
  values (v_tpl.club_id, v_id, v_tpl.lessons_count,');

select app.rewrite_function('public.extend_client_package(uuid, integer, integer, text)',
  'insert into public.package_ledger (client_package_id, delta, reason, created_by, note)
    values (p_package_id, p_extra_lessons,',
  'insert into public.package_ledger (club_id, client_package_id, delta, reason, created_by, note)
    values (v_pkg.club_id, p_package_id, p_extra_lessons,');

select app.rewrite_function('public.cancel_client_package(uuid, text)',
  'insert into public.package_ledger (client_package_id, delta, reason, created_by, note)
    values (p_package_id, -v_pkg.lessons_remaining,',
  'insert into public.package_ledger (club_id, client_package_id, delta, reason, created_by, note)
    values (v_pkg.club_id, p_package_id, -v_pkg.lessons_remaining,');

select app.rewrite_function('public.set_inventory_quantity(uuid, integer, text)',
  'insert into public.inventory_items (type_id, asset_tag)
      values (p_type_id,',
  'insert into public.inventory_items (club_id, type_id, asset_tag)
      values ((select club_id from public.inventory_types where id = p_type_id), p_type_id,');

-- the staff RPCs must also refuse to reach across clubs
create or replace function app.can_administer()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is null or app.is_admin()
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security, rebuilt with the club conjunct on every policy
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

alter table public.clubs enable row level security;
revoke all on public.clubs from anon, authenticated;
grant select on public.clubs to authenticated;
grant insert, update on public.clubs to authenticated;

-- a club's own users may read their club's row; the operator reads them all
create policy clubs_select_own on public.clubs
  for select to authenticated using (id = app.current_club_id());
create policy clubs_platform on public.clubs
  for all to authenticated using (app.is_super_admin()) with check (app.is_super_admin());

-- profiles ------------------------------------------------------------------
create policy profiles_select_self on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_select_admin on public.profiles
  for select to authenticated using (app.is_admin() and club_id = app.current_club_id());
create policy profiles_select_staff on public.profiles
  for select to authenticated
  using (app.is_instructor() and club_id = app.current_club_id()
         and (role = 'instructor' or app.teaches_client(id)));
create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (app.is_admin() and club_id = app.current_club_id())
  with check (app.is_admin() and club_id = app.current_club_id());

-- instructors ---------------------------------------------------------------
create policy instructors_select_club on public.instructors
  for select to authenticated using (club_id = app.current_club_id());
create policy instructors_update_self on public.instructors
  for update to authenticated
  using (profile_id = auth.uid() and club_id = app.current_club_id())
  with check (profile_id = auth.uid() and club_id = app.current_club_id());
create policy instructors_admin_all on public.instructors
  for all to authenticated
  using (app.is_admin() and club_id = app.current_club_id())
  with check (app.is_admin() and club_id = app.current_club_id());

-- clients -------------------------------------------------------------------
create policy clients_select_self on public.clients
  for select to authenticated using (profile_id = auth.uid() and club_id = app.current_club_id());
create policy clients_select_staff on public.clients
  for select to authenticated
  using (club_id = app.current_club_id()
         and (app.is_admin() or (app.is_instructor() and app.teaches_client(profile_id))));
create policy clients_admin_all on public.clients
  for all to authenticated
  using (app.is_admin() and club_id = app.current_club_id())
  with check (app.is_admin() and club_id = app.current_club_id());

-- club_settings: no longer anonymous — the landing page uses club_public_profile()
revoke select on public.club_settings from anon;
create policy club_settings_read on public.club_settings
  for select to authenticated using (club_id = app.current_club_id());
create policy club_settings_write on public.club_settings
  for update to authenticated
  using (app.is_admin() and club_id = app.current_club_id())
  with check (app.is_admin() and club_id = app.current_club_id());

-- catalog: signed-in members only, within the club
revoke select on public.categories, public.services from anon;
create policy categories_read on public.categories
  for select to authenticated
  using (club_id = app.current_club_id() and (is_active or app.is_admin() or app.is_instructor()));
create policy categories_admin on public.categories
  for all to authenticated
  using (app.is_admin() and club_id = app.current_club_id())
  with check (app.is_admin() and club_id = app.current_club_id());

create policy services_read on public.services
  for select to authenticated
  using (club_id = app.current_club_id() and (is_active or app.is_admin() or app.is_instructor()));
create policy services_admin on public.services
  for all to authenticated
  using (app.is_admin() and club_id = app.current_club_id())
  with check (app.is_admin() and club_id = app.current_club_id());

create policy price_history_admin on public.price_history
  for select to authenticated using (app.is_admin() and club_id = app.current_club_id());

-- schedule ------------------------------------------------------------------
create policy time_slots_staff_read on public.time_slots
  for select to authenticated
  using (club_id = app.current_club_id() and (app.is_admin() or app.is_instructor()));
create policy time_slots_admin_write on public.time_slots
  for all to authenticated
  using (app.is_admin() and club_id = app.current_club_id())
  with check (app.is_admin() and club_id = app.current_club_id());

create policy tsi_staff_read on public.time_slot_instructors
  for select to authenticated
  using (club_id = app.current_club_id() and (app.is_admin() or app.is_instructor()));
create policy tsi_admin_write on public.time_slot_instructors
  for all to authenticated
  using (app.is_admin() and club_id = app.current_club_id())
  with check (app.is_admin() and club_id = app.current_club_id());

-- reservations --------------------------------------------------------------
create policy reservations_select_own on public.reservations
  for select to authenticated using (client_id = auth.uid() and club_id = app.current_club_id());
create policy reservations_select_staff on public.reservations
  for select to authenticated
  using (club_id = app.current_club_id() and (app.is_admin() or app.teaches_slot(slot_id)));
create policy reservations_insert_own on public.reservations
  for insert to authenticated
  with check (client_id = auth.uid() and app.is_client() and club_id = app.current_club_id());
create policy reservations_update_own on public.reservations
  for update to authenticated
  using (client_id = auth.uid() and club_id = app.current_club_id())
  with check (client_id = auth.uid() and club_id = app.current_club_id());
create policy reservations_update_staff on public.reservations
  for update to authenticated
  using (club_id = app.current_club_id() and (app.is_admin() or app.teaches_slot(slot_id)))
  with check (club_id = app.current_club_id() and (app.is_admin() or app.teaches_slot(slot_id)));
create policy reservations_delete_admin on public.reservations
  for delete to authenticated using (app.is_admin() and club_id = app.current_club_id());

-- packages ------------------------------------------------------------------
create policy package_templates_read on public.package_templates
  for select to authenticated using (club_id = app.current_club_id() and (is_active or app.is_admin()));
create policy package_templates_admin on public.package_templates
  for all to authenticated
  using (app.is_admin() and club_id = app.current_club_id())
  with check (app.is_admin() and club_id = app.current_club_id());

create policy client_packages_select_own on public.client_packages
  for select to authenticated using (client_id = auth.uid() and club_id = app.current_club_id());
create policy client_packages_select_staff on public.client_packages
  for select to authenticated
  using (club_id = app.current_club_id()
         and (app.is_admin() or (app.is_instructor() and app.teaches_client(client_id))));
create policy client_packages_admin on public.client_packages
  for all to authenticated
  using (app.is_admin() and club_id = app.current_club_id())
  with check (app.is_admin() and club_id = app.current_club_id());

create policy package_ledger_select_own on public.package_ledger
  for select to authenticated
  using (club_id = app.current_club_id() and exists (
    select 1 from public.client_packages cp
    where cp.id = client_package_id and cp.client_id = auth.uid()));
create policy package_ledger_admin on public.package_ledger
  for all to authenticated
  using (app.is_admin() and club_id = app.current_club_id())
  with check (app.is_admin() and club_id = app.current_club_id());

-- inventory -----------------------------------------------------------------
create policy inventory_types_read on public.inventory_types
  for select to authenticated
  using (club_id = app.current_club_id() and (app.is_admin() or app.is_instructor()));
create policy inventory_types_admin on public.inventory_types
  for all to authenticated
  using (app.is_admin() and club_id = app.current_club_id())
  with check (app.is_admin() and club_id = app.current_club_id());

create policy inventory_items_read on public.inventory_items
  for select to authenticated
  using (club_id = app.current_club_id() and (app.is_admin() or app.is_instructor()));
create policy inventory_items_admin on public.inventory_items
  for all to authenticated
  using (app.is_admin() and club_id = app.current_club_id())
  with check (app.is_admin() and club_id = app.current_club_id());

create policy rentals_select_own on public.rentals
  for select to authenticated using (client_id = auth.uid() and club_id = app.current_club_id());
create policy rentals_select_staff on public.rentals
  for select to authenticated
  using (club_id = app.current_club_id() and (app.is_admin() or app.is_instructor()));
create policy rentals_admin on public.rentals
  for all to authenticated
  using (app.is_admin() and club_id = app.current_club_id())
  with check (app.is_admin() and club_id = app.current_club_id());

-- payments and tips ---------------------------------------------------------
create policy payments_select_own on public.payments
  for select to authenticated using (client_id = auth.uid() and club_id = app.current_club_id());
create policy payments_select_admin on public.payments
  for select to authenticated using (app.is_admin() and club_id = app.current_club_id());

create policy tips_select_own on public.tips
  for select to authenticated
  using (club_id = app.current_club_id()
         and (client_id = auth.uid() or instructor_id = auth.uid() or app.is_admin()));

-- reviews -------------------------------------------------------------------
create policy instructor_reviews_insert_own on public.instructor_reviews
  for insert to authenticated
  with check (client_id = auth.uid() and app.is_client() and club_id = app.current_club_id());
create policy instructor_reviews_select_admin on public.instructor_reviews
  for select to authenticated using (app.is_admin() and club_id = app.current_club_id());

create policy session_reviews_read on public.session_reviews
  for select to authenticated
  using (club_id = app.current_club_id() and (is_published or client_id = auth.uid() or app.is_admin()));
create policy session_reviews_insert_own on public.session_reviews
  for insert to authenticated
  with check (client_id = auth.uid() and app.is_client() and club_id = app.current_club_id());
create policy session_reviews_update_own on public.session_reviews
  for update to authenticated
  using (client_id = auth.uid() and club_id = app.current_club_id())
  with check (client_id = auth.uid() and club_id = app.current_club_id());
create policy session_reviews_admin on public.session_reviews
  for all to authenticated
  using (app.is_admin() and club_id = app.current_club_id())
  with check (app.is_admin() and club_id = app.current_club_id());

-- invites, audit, signatures ------------------------------------------------
create policy invites_admin on public.registration_invites
  for select to authenticated using (app.is_admin() and club_id = app.current_club_id());
create policy invites_admin_update on public.registration_invites
  for update to authenticated
  using (app.is_admin() and club_id = app.current_club_id())
  with check (app.is_admin() and club_id = app.current_club_id());

create policy audit_log_admin on public.audit_log
  for select to authenticated using (app.is_admin() and club_id = app.current_club_id());

create policy document_signatures_insert_own on public.document_signatures
  for insert to authenticated
  with check (client_id = auth.uid() and app.is_client() and club_id = app.current_club_id());
create policy document_signatures_select_own on public.document_signatures
  for select to authenticated using (client_id = auth.uid() and club_id = app.current_club_id());
create policy document_signatures_select_admin on public.document_signatures
  for select to authenticated using (app.is_admin() and club_id = app.current_club_id());

-- ---------------------------------------------------------------------------
-- Read models, each scoped to the caller's club
-- ---------------------------------------------------------------------------
drop view if exists public.staff_reservation_queue;
drop view if exists public.inventory_overview;
drop view if exists public.instructor_roster;
drop view if exists public.staff_slot_overview;
drop view if exists public.public_session_reviews;
drop view if exists public.my_rentals;
drop view if exists public.my_packages;
drop view if exists public.my_bookings;
drop view if exists public.slot_catalog;
drop view if exists public.instructor_directory;

create view public.instructor_directory with (security_barrier = true) as
select i.profile_id, p.full_name, p.avatar_url, i.bio, i.specialties, i.certifications,
       i.languages, i.whatsapp_phone, i.calendar_color, p.is_active
from public.instructors i
join public.profiles p on p.id = i.profile_id
where p.is_active and i.club_id = app.current_club_id();

create view public.slot_catalog with (security_barrier = true) as
select
  ts.id as slot_id, ts.starts_at, ts.ends_at, ts.location, ts.capacity,
  coalesce(booked.seats_taken, 0) as seats_taken,
  greatest(ts.capacity - coalesce(booked.seats_taken, 0), 0) as seats_left,
  coalesce(ts.price_cents_override, s.price_cents) as price_cents,
  s.currency, s.id as service_id, s.name as service_name, s.description as service_description,
  s.duration_minutes, s.min_level,
  c.id as category_id, c.name as category_name, c.slug as category_slug, c.kind as category_kind,
  coalesce(staff.names, array[]::text[]) as instructor_names,
  coalesce(staff.ids, array[]::uuid[]) as instructor_ids
from public.time_slots ts
join public.services   s on s.id = ts.service_id
join public.categories c on c.id = s.category_id
left join lateral (
  select sum(r.participants)::int as seats_taken from public.reservations r
  where r.slot_id = ts.id and r.status in ('pending', 'approved')
) booked on true
left join lateral (
  select array_agg(p.full_name order by tsi.is_lead desc, p.full_name) as names,
         array_agg(p.id order by tsi.is_lead desc, p.full_name) as ids
  from public.time_slot_instructors tsi join public.profiles p on p.id = tsi.instructor_id
  where tsi.slot_id = ts.id
) staff on true
where ts.status = 'open' and s.is_active and c.is_active and ts.starts_at > now()
  and ts.club_id = app.current_club_id();

create view public.my_bookings with (security_barrier = true) as
select
  r.id as reservation_id, r.status, r.participants, r.price_cents, r.currency, r.client_note,
  r.rejection_reason, r.revision, r.created_at, r.client_package_id,
  ts.id as slot_id, ts.starts_at, ts.ends_at, ts.location, ts.status as slot_status, ts.whatsapp_group_url,
  s.name as service_name, s.duration_minutes, c.name as category_name,
  lead_i.profile_id as instructor_id, lead_i.full_name as instructor_name, lead_i.whatsapp_phone as instructor_whatsapp,
  (ts.starts_at - now()) > make_interval(hours => (select cancellation_window_hours from public.club_settings where club_id = r.club_id))
    and r.status in ('pending', 'approved') as can_modify,
  exists (select 1 from public.session_reviews sr where sr.slot_id = ts.id and sr.client_id = r.client_id) as has_session_review
from public.reservations r
join public.time_slots ts on ts.id = r.slot_id
join public.services   s  on s.id = ts.service_id
join public.categories c  on c.id = s.category_id
left join lateral (
  select p.id as profile_id, p.full_name, i.whatsapp_phone
  from public.time_slot_instructors tsi
  join public.profiles p on p.id = tsi.instructor_id
  join public.instructors i on i.profile_id = tsi.instructor_id
  where tsi.slot_id = ts.id order by tsi.is_lead desc, p.full_name limit 1
) lead_i on true
where r.client_id = auth.uid() and r.club_id = app.current_club_id();

create view public.my_packages with (security_barrier = true) as
select cp.id, cp.name, cp.lessons_total, cp.lessons_remaining, cp.status, cp.purchased_at, cp.expires_at,
       cp.currency, cp.price_cents,
       (cp.status = 'active' and cp.expires_at > now() and cp.lessons_remaining > 0) as is_usable
from public.client_packages cp
where cp.client_id = auth.uid() and cp.club_id = app.current_club_id();

create view public.my_rentals with (security_barrier = true) as
select rt.id, rt.start_date, rt.end_date, rt.status, rt.price_cents, rt.currency, rt.checked_out_at, rt.returned_at,
       it.asset_tag, ity.name as item_name, ity.kind as item_kind, ity.size_label
from public.rentals rt
join public.inventory_items it on it.id = rt.item_id
join public.inventory_types ity on ity.id = it.type_id
where rt.client_id = auth.uid() and rt.club_id = app.current_club_id();

create view public.public_session_reviews with (security_barrier = true) as
select sr.id, sr.rating, sr.title, sr.body, sr.author_display_name, sr.created_at, sr.slot_id,
       ts.starts_at as session_starts_at, s.name as service_name, c.name as category_name
from public.session_reviews sr
join public.time_slots ts on ts.id = sr.slot_id
join public.services   s  on s.id = ts.service_id
join public.categories c  on c.id = s.category_id
where sr.is_published and sr.club_id = app.current_club_id();

create view public.staff_slot_overview with (security_barrier = true) as
select
  ts.id as slot_id, ts.starts_at, ts.ends_at, ts.status, ts.location, ts.capacity,
  ts.block_reason, ts.notes, ts.whatsapp_group_url,
  s.id as service_id, s.name as service_name, c.name as category_name,
  coalesce(agg.seats_taken, 0) as seats_taken, coalesce(agg.pending_count, 0) as pending_count,
  coalesce(staff.names, array[]::text[]) as instructor_names,
  coalesce(staff.ids, array[]::uuid[]) as instructor_ids,
  (auth.uid() = any(coalesce(staff.ids, array[]::uuid[]))) as is_mine
from public.time_slots ts
join public.services   s on s.id = ts.service_id
join public.categories c on c.id = s.category_id
left join lateral (
  select sum(r.participants) filter (where r.status in ('pending','approved'))::int as seats_taken,
         count(*) filter (where r.status = 'pending')::int as pending_count
  from public.reservations r where r.slot_id = ts.id
) agg on true
left join lateral (
  select array_agg(p.full_name order by tsi.is_lead desc) as names, array_agg(p.id order by tsi.is_lead desc) as ids
  from public.time_slot_instructors tsi join public.profiles p on p.id = tsi.instructor_id
  where tsi.slot_id = ts.id
) staff on true
where (app.is_admin() or app.is_instructor()) and ts.club_id = app.current_club_id();

create view public.instructor_roster with (security_barrier = true) as
select
  ts.id as slot_id, ts.starts_at, ts.ends_at, ts.location, ts.status as slot_status,
  ts.whatsapp_group_url, ts.notes as slot_notes, s.name as service_name, c.name as category_name,
  r.id as reservation_id, r.status as reservation_status, r.participants, r.client_note, r.revision,
  cl.profile_id as client_id, p.full_name as client_name, p.phone as client_phone, p.email as client_email,
  cl.level as client_level, cl.medical_notes, cl.emergency_contact_name, cl.emergency_contact_phone, cl.waiver_signed_at
from public.time_slots ts
join public.services   s on s.id = ts.service_id
join public.categories c on c.id = s.category_id
join public.time_slot_instructors tsi on tsi.slot_id = ts.id
left join public.reservations r on r.slot_id = ts.id and r.status in ('pending','approved','completed')
left join public.clients  cl on cl.profile_id = r.client_id
left join public.profiles p  on p.id = cl.profile_id
where (tsi.instructor_id = auth.uid() or app.is_admin()) and ts.club_id = app.current_club_id();

create view public.inventory_overview with (security_barrier = true) as
select ity.id, ity.name, ity.kind, ity.brand, ity.size_label, ity.daily_price_cents, ity.currency, ity.is_active, ity.category_id,
  count(it.id)::int as total_units,
  count(it.id) filter (where it.status = 'available')::int as available_units,
  count(it.id) filter (where it.status = 'rented')::int as rented_units,
  count(it.id) filter (where it.status = 'maintenance')::int as maintenance_units,
  count(it.id) filter (where it.status = 'retired')::int as retired_units
from public.inventory_types ity
left join public.inventory_items it on it.type_id = ity.id
where (app.is_admin() or app.is_instructor()) and ity.club_id = app.current_club_id()
group by ity.id;

create view public.staff_reservation_queue with (security_barrier = true) as
select
  r.id as reservation_id, r.status, r.participants, r.price_cents, r.currency, r.client_note, r.staff_note,
  r.rejection_reason, r.revision, r.created_at, r.client_package_id,
  ts.id as slot_id, ts.starts_at, ts.ends_at, ts.location, ts.status as slot_status, ts.capacity, ts.whatsapp_group_url,
  s.name as service_name, c.name as category_name,
  p.id as client_id, p.full_name as client_name, p.phone as client_phone, p.email as client_email,
  cl.level as client_level, cl.medical_notes, cl.waiver_signed_at,
  coalesce(staff.names, array[]::text[]) as instructor_names,
  coalesce(staff.ids, array[]::uuid[]) as instructor_ids
from public.reservations r
join public.time_slots ts on ts.id = r.slot_id
join public.services   s  on s.id = ts.service_id
join public.categories c  on c.id = s.category_id
join public.clients   cl  on cl.profile_id = r.client_id
join public.profiles   p  on p.id = cl.profile_id
left join lateral (
  select array_agg(pi.full_name order by tsi.is_lead desc) as names, array_agg(pi.id order by tsi.is_lead desc) as ids
  from public.time_slot_instructors tsi join public.profiles pi on pi.id = tsi.instructor_id
  where tsi.slot_id = ts.id
) staff on true
where (app.is_admin() or app.teaches_slot(ts.id)) and r.club_id = app.current_club_id();

do $$
declare v text;
begin
  foreach v in array array[
    'instructor_directory','slot_catalog','my_bookings','my_packages','my_rentals','public_session_reviews',
    'staff_slot_overview','instructor_roster','inventory_overview','staff_reservation_queue'
  ] loop
    execute format('revoke all on public.%I from anon, authenticated', v);
    execute format('grant select on public.%I to authenticated', v);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- What an anonymous visitor to <club>.<domain> may know: the club's public face
-- ---------------------------------------------------------------------------
create or replace function public.club_public_profile(p_slug text)
returns table (
  club_id uuid, slug text, name text, spot_name text, timezone text,
  spot_latitude numeric, spot_longitude numeric, contact_phone text, maps_url text, status text
)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.id, c.slug, c.name, cs.spot_name, cs.timezone, cs.spot_latitude, cs.spot_longitude,
         cs.contact_phone, c.maps_url, c.status
  from public.clubs c
  left join public.club_settings cs on cs.club_id = c.id
  where c.slug = p_slug and c.status in ('active', 'suspended')
$$;

revoke all on function public.club_public_profile(text) from public;
grant execute on function public.club_public_profile(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Platform operator: what they may see, and what they may not
-- ---------------------------------------------------------------------------
-- The operator gets counts, never rows. These views are the whole of their
-- reach into club data: no member name, contact, note, signature or amount of
-- money appears in any of them.

create or replace view public.club_statistics with (security_barrier = true) as
select
  c.id as club_id, c.slug, c.name, c.status, c.created_at,
  (select count(*) from public.profiles p where p.club_id = c.id and p.role = 'client' and p.is_active)::int as members,
  (select count(*) from public.profiles p where p.club_id = c.id and p.role = 'instructor' and p.is_active)::int as instructors,
  (select count(*) from public.profiles p where p.club_id = c.id and p.role = 'admin' and p.is_active)::int as admins,
  (select count(*) from public.time_slots t where t.club_id = c.id)::int as sessions_total,
  (select count(*) from public.time_slots t where t.club_id = c.id and t.starts_at > now() and t.status = 'open')::int as sessions_upcoming,
  (select count(*) from public.reservations r where r.club_id = c.id and r.status = 'pending')::int as bookings_pending,
  (select count(*) from public.reservations r where r.club_id = c.id and r.status = 'approved')::int as bookings_approved,
  (select count(*) from public.reservations r where r.club_id = c.id and r.status = 'completed')::int as bookings_completed,
  (select count(*) from public.rentals rt where rt.club_id = c.id and rt.status in ('out','overdue'))::int as rentals_open,
  (select count(*) from public.client_packages cp where cp.club_id = c.id and cp.status = 'active')::int as packages_active,
  (select count(*) from public.session_reviews sr where sr.club_id = c.id and sr.is_published)::int as reviews_public,
  (select count(*) from public.document_signatures d where d.club_id = c.id)::int as documents_signed,
  (select count(*) from public.document_signatures d where d.club_id = c.id and d.delivered_at is null and d.delivery_error is not null)::int as documents_undelivered,
  (select count(*) from public.payments py where py.club_id = c.id and py.status = 'failed')::int as payments_failed,
  (select max(a.created_at) from public.audit_log a where a.club_id = c.id) as last_activity_at
from public.clubs c
where app.is_super_admin();

-- volume by operation: how many of each thing happened, per club, per day
create or replace view public.club_activity with (security_barrier = true) as
select a.club_id, date_trunc('day', a.created_at)::date as day,
       split_part(a.action, '.', 1) as operation, a.action, count(*)::int as events
from public.audit_log a
where app.is_super_admin()
group by a.club_id, date_trunc('day', a.created_at), a.action;

revoke all on public.club_statistics, public.club_activity from anon, authenticated;
grant select on public.club_statistics, public.club_activity to authenticated;

-- the operator's own actions, kept apart from any club's trail
create table if not exists public.platform_audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null check (length(action) between 3 and 80),
  club_id     uuid references public.clubs(id) on delete set null,
  detail      jsonb,
  ip          inet,
  created_at  timestamptz not null default now()
);

alter table public.platform_audit_log enable row level security;
revoke all on public.platform_audit_log from anon, authenticated;
grant select on public.platform_audit_log to authenticated;
create policy platform_audit_read on public.platform_audit_log
  for select to authenticated using (app.is_super_admin());

drop trigger if exists platform_audit_immutable on public.platform_audit_log;
create trigger platform_audit_immutable before update or delete on public.platform_audit_log
  for each row execute function app.reject_mutation();

-- ---------------------------------------------------------------------------
-- Support: a club administrator talks to the platform
-- ---------------------------------------------------------------------------
create table if not exists public.support_conversations (
  id               uuid primary key default extensions.gen_random_uuid(),
  club_id          uuid not null references public.clubs(id) on delete cascade,
  opened_by        uuid not null references public.profiles(id) on delete restrict,
  subject          text not null check (length(btrim(subject)) between 3 and 200),
  -- 'bot' while the assistant is gathering the report; 'human' once handed over
  kind             text not null default 'bot' check (kind in ('bot', 'human')),
  status           text not null default 'open'
                     check (status in ('open', 'awaiting_platform', 'awaiting_club', 'closed')),
  category         text check (category in ('bug', 'question', 'billing', 'feature', 'urgent', 'other')),
  severity         text check (severity in ('low', 'medium', 'high', 'critical')),
  -- the structured report the assistant assembled; free of member data by construction
  report           jsonb,
  last_message_at  timestamptz not null default now(),
  closed_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists support_conversations_club_idx on public.support_conversations (club_id, last_message_at desc);
create index if not exists support_conversations_open_idx on public.support_conversations (status, last_message_at desc)
  where status <> 'closed';

drop trigger if exists support_conversations_touch on public.support_conversations;
create trigger support_conversations_touch before update on public.support_conversations
  for each row execute function app.touch_updated_at();

create table if not exists public.support_messages (
  id               bigint generated always as identity primary key,
  conversation_id  uuid not null references public.support_conversations(id) on delete cascade,
  club_id          uuid not null references public.clubs(id) on delete cascade,
  sender_role      text not null check (sender_role in ('admin', 'super_admin', 'bot')),
  sender_id        uuid references public.profiles(id) on delete set null,
  body             text not null check (length(body) between 1 and 8000),
  created_at       timestamptz not null default now()
);

create index if not exists support_messages_conversation_idx on public.support_messages (conversation_id, created_at);

-- a message always sits in its conversation's club
create or replace function app.guard_support_message()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_club uuid;
begin
  select club_id into v_club from public.support_conversations where id = new.conversation_id;
  if v_club is null then
    raise exception 'Conversation not found' using errcode = '23503';
  end if;
  new.club_id := v_club;

  -- a signed-in sender is who they say they are
  if auth.uid() is not null then
    new.sender_id := auth.uid();
    if app.is_super_admin() then
      new.sender_role := 'super_admin';
    elsif app.is_admin() and v_club = app.current_club_id() then
      new.sender_role := 'admin';
    else
      raise exception 'Not a party to this conversation' using errcode = '42501';
    end if;
  end if;

  update public.support_conversations
  set last_message_at = now(),
      status = case
                 when new.sender_role = 'super_admin' then 'awaiting_club'
                 when new.sender_role = 'admin' and kind = 'human' then 'awaiting_platform'
                 else status
               end
  where id = new.conversation_id and status <> 'closed';

  return new;
end;
$$;

drop trigger if exists support_messages_guard on public.support_messages;
create trigger support_messages_guard before insert on public.support_messages
  for each row execute function app.guard_support_message();

drop trigger if exists support_messages_immutable on public.support_messages;
create trigger support_messages_immutable before update or delete on public.support_messages
  for each row execute function app.reject_mutation();

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
revoke all on public.support_conversations, public.support_messages from anon, authenticated;
grant select, insert, update on public.support_conversations to authenticated;
grant select, insert on public.support_messages to authenticated;

create policy support_conv_club_admin on public.support_conversations
  for select to authenticated using (app.is_admin() and club_id = app.current_club_id());
create policy support_conv_club_admin_insert on public.support_conversations
  for insert to authenticated
  with check (app.is_admin() and club_id = app.current_club_id() and opened_by = auth.uid());
create policy support_conv_club_admin_update on public.support_conversations
  for update to authenticated
  using (app.is_admin() and club_id = app.current_club_id())
  with check (app.is_admin() and club_id = app.current_club_id());
create policy support_conv_platform on public.support_conversations
  for all to authenticated using (app.is_super_admin()) with check (app.is_super_admin());

create policy support_msg_club_admin on public.support_messages
  for select to authenticated using (app.is_admin() and club_id = app.current_club_id());
create policy support_msg_club_admin_insert on public.support_messages
  for insert to authenticated with check (app.is_admin() and club_id = app.current_club_id());
create policy support_msg_platform on public.support_messages
  for all to authenticated using (app.is_super_admin()) with check (app.is_super_admin());

-- support tables take their club from the conversation / caller like the rest
drop trigger if exists _00_set_club on public.support_conversations;
create trigger _00_set_club before insert or update on public.support_conversations
  for each row execute function app.set_club_id();

-- ---------------------------------------------------------------------------
-- Provisioning a club is one atomic step: the row, its settings, its audit line
-- ---------------------------------------------------------------------------
create or replace function public.provision_club(
  p_name text, p_slug text, p_maps_url text, p_admin_email text, p_timezone text default 'Asia/Jerusalem'
)
returns public.clubs
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_club public.clubs;
begin
  if not (auth.uid() is null or app.is_super_admin()) then
    raise exception 'Platform operator role required' using errcode = '42501';
  end if;

  insert into public.clubs (slug, name, maps_url, admin_email, status, created_by)
  values (p_slug, p_name, nullif(p_maps_url, ''), p_admin_email, 'provisioning', auth.uid())
  returning * into v_club;

  insert into public.club_settings (club_id, club_name, timezone, spot_name)
  values (v_club.id, p_name, p_timezone, p_name);

  insert into public.platform_audit_log (actor_id, action, club_id, detail)
  values (auth.uid(), 'club.provisioned', v_club.id, jsonb_build_object('slug', p_slug));

  return v_club;
end;
$$;

revoke all on function public.provision_club(text, text, text, text, text) from public;
grant execute on function public.provision_club(text, text, text, text, text) to authenticated;

grant execute on all functions in schema app to authenticated, service_role;
