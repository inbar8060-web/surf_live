-- =============================================================================
-- 0006  Security helpers and business-rule triggers
-- =============================================================================
-- Everything in this file is defence-in-depth: even a caller holding a valid
-- JWT and writing straight to PostgREST cannot violate these rules.

-- ---------------------------------------------------------------------------
-- Role helpers. SECURITY DEFINER so RLS on profiles cannot recurse; search_path
-- is pinned so they cannot be hijacked by a shadowing object.
-- ---------------------------------------------------------------------------
create or replace function app.role()
returns public.app_role
language sql stable security definer set search_path = public, pg_temp as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.is_active
$$;

create or replace function app.is_admin()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role = 'admin'
  )
$$;

create or replace function app.is_instructor()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role = 'instructor'
  )
$$;

create or replace function app.is_client()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role = 'client'
  )
$$;

-- Is the caller an instructor assigned to this slot?
create or replace function app.teaches_slot(p_slot uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.time_slot_instructors tsi
    where tsi.slot_id = p_slot and tsi.instructor_id = auth.uid()
  )
$$;

-- Is the caller an instructor who taught this client at least once?
create or replace function app.teaches_client(p_client uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.reservations r
    join public.time_slot_instructors tsi on tsi.slot_id = r.slot_id
    where r.client_id = p_client
      and tsi.instructor_id = auth.uid()
      and r.status in ('approved', 'completed')
  )
$$;

-- Did this client actually take part in this slot? Gate for both review kinds.
create or replace function app.attended_slot(p_client uuid, p_slot uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.reservations r
    where r.client_id = p_client and r.slot_id = p_slot
      and r.status in ('approved', 'completed')
  )
$$;

-- Repeated at the end of this file so helpers added later are covered too.
grant execute on all functions in schema app to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- New auth user -> profile. The role is read from app_metadata, which only the
-- service role can set; user_metadata (client-writable) is never trusted here.
-- ---------------------------------------------------------------------------
create or replace function app.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_role public.app_role;
  v_name text;
  v_phone text;
begin
  v_role := coalesce(
    nullif(new.raw_app_meta_data ->> 'role', '')::public.app_role,
    'client'
  );
  v_name := coalesce(
    nullif(btrim(new.raw_app_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(new.email, 'member'), '@', 1)
  );
  v_phone := nullif(btrim(coalesce(
    new.raw_app_meta_data ->> 'phone',
    new.phone
  )), '');

  insert into public.profiles (id, role, full_name, email, phone)
  values (
    new.id,
    v_role,
    left(v_name, 120),
    new.email,
    case when v_phone ~ '^\+[1-9][0-9]{6,14}$' then v_phone else null end
  )
  on conflict (id) do nothing;

  if v_role = 'instructor' then
    insert into public.instructors (profile_id) values (new.id) on conflict do nothing;
  elsif v_role = 'client' then
    insert into public.clients (profile_id) values (new.id) on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- ---------------------------------------------------------------------------
-- profiles guard: only admins may change role / is_active, and the last active
-- admin can never be demoted or deactivated.
-- ---------------------------------------------------------------------------
create or replace function app.guard_profile_changes()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- service_role (server-side admin tasks) bypasses the caller checks
  if auth.uid() is not null and not app.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Only an administrator can change a role' using errcode = '42501';
    end if;
    if new.is_active is distinct from old.is_active then
      raise exception 'Only an administrator can activate or deactivate an account'
        using errcode = '42501';
    end if;
  end if;

  if old.role = 'admin' and (new.role <> 'admin' or new.is_active = false) then
    if (select count(*) from public.profiles
        where role = 'admin' and is_active and id <> old.id) = 0 then
      raise exception 'The last active administrator cannot be removed'
        using errcode = '23514';
    end if;
  end if;

  -- keep the role-specific row in step when an admin converts an account
  if new.role is distinct from old.role then
    if new.role = 'instructor' then
      insert into public.instructors (profile_id) values (new.id) on conflict do nothing;
    elsif new.role = 'client' then
      insert into public.clients (profile_id) values (new.id) on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function app.guard_profile_changes();

-- ---------------------------------------------------------------------------
-- Reservation rules.
--
--   * price is always computed server-side from the slot/service, never taken
--     from the caller;
--   * capacity is enforced under a row lock on the slot, so two concurrent
--     bookings cannot oversell;
--   * a client editing an approved booking sends it back to 'pending'
--     (re-approval), bumping the revision;
--   * only legal status transitions are accepted.
-- ---------------------------------------------------------------------------
create or replace function app.enforce_reservation_rules()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_slot        public.time_slots%rowtype;
  v_service     public.services%rowtype;
  v_unit_cents  integer;
  v_taken       integer;
  -- auth.uid() is null == trusted server-side context (service role / SQL job)
  v_is_staff    boolean := auth.uid() is null or app.is_admin() or app.teaches_slot(new.slot_id);
  v_is_owner    boolean := auth.uid() = new.client_id;
  v_window_h    smallint;
  v_material    boolean := false;
  v_pkg         public.client_packages%rowtype;
begin
  -- lock the slot: serialises concurrent bookings for the same session
  select * into v_slot from public.time_slots where id = new.slot_id for update;
  if not found then
    raise exception 'Time slot not found' using errcode = '23503';
  end if;
  select * into v_service from public.services where id = v_slot.service_id;
  select cancellation_window_hours into v_window_h from public.club_settings where id = 1;

  if tg_op = 'UPDATE' then
    v_material := (new.slot_id      is distinct from old.slot_id)
               or (new.participants is distinct from old.participants)
               or (new.client_package_id is distinct from old.client_package_id);
  end if;

  -- ---- who may do what -----------------------------------------------------
  if tg_op = 'INSERT' then
    if not (v_is_owner or v_is_staff or auth.uid() is null) then
      raise exception 'You may only book for yourself' using errcode = '42501';
    end if;
    -- a client's own request always starts as pending; staff may book directly
    if not v_is_staff then
      new.status := 'pending';
    end if;
  else
    if v_is_owner and not v_is_staff then
      -- clients may edit the booking or cancel it, nothing else
      if new.status is distinct from old.status
         and new.status not in ('pending', 'cancelled') then
        raise exception 'You cannot set a booking to %', new.status using errcode = '42501';
      end if;
      if old.status in ('completed', 'no_show', 'rejected') then
        raise exception 'This booking is closed and can no longer be changed'
          using errcode = '42501';
      end if;
      if (v_material or new.status = 'cancelled')
         and v_slot.starts_at - now() < make_interval(hours => coalesce(v_window_h, 12)) then
        raise exception 'Changes are closed % hours before the session; contact the club',
          coalesce(v_window_h, 12) using errcode = '42501';
      end if;
      -- staff-only fields stay as they were
      new.rejection_reason := old.rejection_reason;
      new.staff_note       := old.staff_note;
      new.decided_by       := old.decided_by;
      new.client_id        := old.client_id;
      -- any material change sends an approved booking back for re-approval
      if v_material and old.status = 'approved' then
        new.status   := 'pending';
        new.revision := old.revision + 1;
      end if;
    end if;
  end if;

  -- ---- slot must be bookable ----------------------------------------------
  if (tg_op = 'INSERT' or v_material) and new.status in ('pending', 'approved') then
    if v_slot.status <> 'open' then
      raise exception 'This time slot is % and cannot be booked', v_slot.status
        using errcode = '23514';
    end if;
    if v_slot.starts_at <= now() and not v_is_staff then
      raise exception 'This time slot has already started' using errcode = '23514';
    end if;
    if v_service.min_level is not null and not v_is_staff then
      if (select c.level from public.clients c where c.profile_id = new.client_id)
         < v_service.min_level then
        raise exception 'This session requires level % or above', v_service.min_level
          using errcode = '23514';
      end if;
    end if;
  end if;

  -- ---- price: computed here, never trusted from the caller -----------------
  if tg_op = 'INSERT' or v_material then
    v_unit_cents := coalesce(v_slot.price_cents_override, v_service.price_cents);
    new.currency := v_service.currency;

    if new.client_package_id is not null then
      select * into v_pkg from public.client_packages
        where id = new.client_package_id for update;
      if not found or v_pkg.client_id <> new.client_id then
        raise exception 'That lesson package does not belong to this client'
          using errcode = '42501';
      end if;
      if v_pkg.status <> 'active' or v_pkg.expires_at < now() then
        raise exception 'That lesson package is no longer active' using errcode = '23514';
      end if;
      if v_pkg.lessons_remaining < 1 and (tg_op = 'INSERT' or old.client_package_id is distinct from new.client_package_id) then
        raise exception 'That lesson package has no lessons left' using errcode = '23514';
      end if;
      new.price_cents := 0;
    else
      new.price_cents := v_unit_cents * new.participants;
    end if;
  end if;

  -- ---- capacity ------------------------------------------------------------
  if new.status in ('pending', 'approved') then
    select coalesce(sum(r.participants), 0) into v_taken
    from public.reservations r
    where r.slot_id = new.slot_id
      and r.status in ('pending', 'approved')
      and (tg_op = 'INSERT' or r.id <> new.id);

    if v_taken + new.participants > v_slot.capacity then
      raise exception 'Only % place(s) left in this session', v_slot.capacity - v_taken
        using errcode = '23514';
    end if;
  end if;

  -- ---- decision bookkeeping ------------------------------------------------
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status in ('approved', 'rejected', 'completed', 'no_show') then
      new.decided_by := coalesce(auth.uid(), new.decided_by);
      new.decided_at := now();
    elsif new.status = 'pending' then
      new.decided_by := null;
      new.decided_at := null;
      new.rejection_reason := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_rules on public.reservations;
create trigger reservations_rules before insert or update on public.reservations
  for each row execute function app.enforce_reservation_rules();

-- ---------------------------------------------------------------------------
-- Package credits follow the booking lifecycle automatically.
-- ---------------------------------------------------------------------------
create or replace function app.sync_package_credits()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_redeemed boolean;
begin
  if new.client_package_id is null then
    return new;
  end if;

  select exists (
    select 1 from public.package_ledger
    where reservation_id = new.id and reason = 'redeem'
  ) into v_redeemed;

  -- consumed once the booking is confirmed
  if new.status in ('approved', 'completed') and not v_redeemed then
    insert into public.package_ledger (client_package_id, reservation_id, delta, reason, created_by, note)
    values (new.client_package_id, new.id, -1, 'redeem', auth.uid(), 'Booking confirmed');

  -- given back if the confirmed booking later falls away
  elsif new.status in ('cancelled', 'rejected') and v_redeemed then
    if not exists (
      select 1 from public.package_ledger
      where reservation_id = new.id and reason = 'refund'
    ) then
      insert into public.package_ledger (client_package_id, reservation_id, delta, reason, created_by, note)
      values (new.client_package_id, new.id, 1, 'refund', auth.uid(), 'Booking ' || new.status);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_package_sync on public.reservations;
create trigger reservations_package_sync after insert or update of status on public.reservations
  for each row execute function app.sync_package_credits();

-- ---------------------------------------------------------------------------
-- The ledger is the single source of truth for remaining lessons.
-- ---------------------------------------------------------------------------
create or replace function app.apply_package_ledger()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_pkg public.client_packages%rowtype;
  v_new integer;
begin
  select * into v_pkg from public.client_packages where id = new.client_package_id for update;
  if not found then
    raise exception 'Package not found' using errcode = '23503';
  end if;

  v_new := v_pkg.lessons_remaining + new.delta;
  if v_new < 0 then
    raise exception 'That package has no lessons left' using errcode = '23514';
  end if;

  update public.client_packages
  set lessons_remaining = v_new,
      lessons_total = greatest(lessons_total, v_new),
      -- every branch is cast: a CASE of bare literals resolves to text, which
      -- will not assign to a package_status column
      status = case
                 when status = 'cancelled' then 'cancelled'::public.package_status
                 when v_new = 0 then 'completed'::public.package_status
                 when expires_at < now() then 'expired'::public.package_status
                 else 'active'::public.package_status
               end
  where id = new.client_package_id;

  return new;
end;
$$;

drop trigger if exists package_ledger_apply on public.package_ledger;
create trigger package_ledger_apply after insert on public.package_ledger
  for each row execute function app.apply_package_ledger();

-- the ledger is append-only
create or replace function app.reject_mutation()
returns trigger
language plpgsql set search_path = pg_catalog, pg_temp as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end;
$$;

drop trigger if exists package_ledger_immutable on public.package_ledger;
create trigger package_ledger_immutable before update or delete on public.package_ledger
  for each row execute function app.reject_mutation();

drop trigger if exists audit_log_immutable on public.audit_log;
create trigger audit_log_immutable before update or delete on public.audit_log
  for each row execute function app.reject_mutation();

drop trigger if exists price_history_immutable on public.price_history;
create trigger price_history_immutable before update or delete on public.price_history
  for each row execute function app.reject_mutation();

-- ---------------------------------------------------------------------------
-- Rentals hold a physical item out of stock from check-out until hand-back.
-- ---------------------------------------------------------------------------
create or replace function app.sync_rental_inventory()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_item public.inventory_items%rowtype;
  v_type public.inventory_types%rowtype;
  v_days integer;
begin
  select * into v_item from public.inventory_items where id = new.item_id for update;
  if not found then
    raise exception 'Inventory item not found' using errcode = '23503';
  end if;

  if tg_op = 'INSERT' then
    if v_item.status in ('maintenance', 'retired') then
      raise exception 'Item % is % and cannot be rented', v_item.asset_tag, v_item.status
        using errcode = '23514';
    end if;
    -- price is derived from the type, never supplied by the caller
    select * into v_type from public.inventory_types where id = v_item.type_id;
    v_days := (new.end_date - new.start_date) + 1;
    new.price_cents := v_type.daily_price_cents * v_days;
    new.currency := v_type.currency;
  end if;

  if tg_op = 'UPDATE' then
    if new.status = 'out' and old.status <> 'out' then
      new.checked_out_at := coalesce(new.checked_out_at, now());
    end if;
    if new.status = 'returned' and old.status <> 'returned' then
      new.returned_at := coalesce(new.returned_at, now());
    end if;
    if old.status = 'returned' and new.status <> 'returned' then
      raise exception 'A returned rental cannot be reopened' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists rentals_rules on public.rentals;
create trigger rentals_rules before insert or update on public.rentals
  for each row execute function app.sync_rental_inventory();

create or replace function app.apply_rental_item_status()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status in ('out', 'overdue') then
    update public.inventory_items set status = 'rented'
    where id = new.item_id and status <> 'retired';
  elsif new.status in ('returned', 'reserved') then
    -- only release the item when no other live rental holds it
    if not exists (
      select 1 from public.rentals r
      where r.item_id = new.item_id and r.id <> new.id
        and r.status in ('out', 'overdue')
    ) then
      update public.inventory_items
      -- cast both branches: a bare CASE resolves to text and will not assign
      set status = case
                     when new.condition_in = 'poor' then 'maintenance'::public.inventory_status
                     else 'available'::public.inventory_status
                   end
      where id = new.item_id and status = 'rented';
    end if;
  elsif new.status = 'lost' then
    update public.inventory_items set status = 'retired' where id = new.item_id;
  end if;
  return new;
end;
$$;

drop trigger if exists rentals_item_status on public.rentals;
create trigger rentals_item_status after insert or update of status on public.rentals
  for each row execute function app.apply_rental_item_status();

-- ---------------------------------------------------------------------------
-- Price changes are recorded automatically for every priced entity.
-- ---------------------------------------------------------------------------
create or replace function app.record_price_change()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_old integer;
  v_new integer;
  v_type text;
begin
  if tg_table_name = 'services' then
    v_old := old.price_cents;       v_new := new.price_cents;       v_type := 'service';
  elsif tg_table_name = 'inventory_types' then
    v_old := old.daily_price_cents; v_new := new.daily_price_cents; v_type := 'inventory_type';
  elsif tg_table_name = 'package_templates' then
    v_old := old.price_cents;       v_new := new.price_cents;       v_type := 'package_template';
  elsif tg_table_name = 'time_slots' then
    v_old := old.price_cents_override; v_new := new.price_cents_override; v_type := 'time_slot';
  else
    return new;
  end if;

  if v_new is distinct from v_old and v_new is not null then
    insert into public.price_history
      (entity_type, entity_id, old_price_cents, new_price_cents, currency, changed_by)
    values (v_type, new.id, v_old, v_new, new.currency, auth.uid());
  end if;

  return new;
end;
$$;

drop trigger if exists services_price_history on public.services;
create trigger services_price_history after update of price_cents on public.services
  for each row execute function app.record_price_change();

drop trigger if exists inventory_types_price_history on public.inventory_types;
create trigger inventory_types_price_history after update of daily_price_cents on public.inventory_types
  for each row execute function app.record_price_change();

drop trigger if exists package_templates_price_history on public.package_templates;
create trigger package_templates_price_history after update of price_cents on public.package_templates
  for each row execute function app.record_price_change();

drop trigger if exists time_slots_price_history on public.time_slots;
create trigger time_slots_price_history after update of price_cents_override on public.time_slots
  for each row execute function app.record_price_change();

-- ---------------------------------------------------------------------------
-- Reviews may only be written by someone who actually attended, and the public
-- feed's author name is stamped server-side.
-- ---------------------------------------------------------------------------
create or replace function app.guard_session_review()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if not app.attended_slot(new.client_id, new.slot_id) then
      raise exception 'You can only review a session you attended' using errcode = '42501';
    end if;
    select coalesce(nullif(split_part(p.full_name, ' ', 1), ''), 'Surfer')
      into new.author_display_name
    from public.profiles p where p.id = new.client_id;
    new.is_published := true;
  else
    -- a client editing their own review cannot change moderation state
    if auth.uid() = new.client_id and not app.is_admin() then
      new.is_published  := old.is_published;
      new.hidden_reason := old.hidden_reason;
      new.client_id     := old.client_id;
      new.slot_id       := old.slot_id;
      new.author_display_name := old.author_display_name;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists session_reviews_guard on public.session_reviews;
create trigger session_reviews_guard before insert or update on public.session_reviews
  for each row execute function app.guard_session_review();

create or replace function app.guard_instructor_review()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.reservation_id is not null then
    if not exists (
      select 1
      from public.reservations r
      join public.time_slot_instructors tsi on tsi.slot_id = r.slot_id
      where r.id = new.reservation_id
        and r.client_id = new.client_id
        and tsi.instructor_id = new.instructor_id
        and r.status in ('approved', 'completed')
    ) then
      raise exception 'You can only review an instructor who taught your session'
        using errcode = '42501';
    end if;
  elsif not app.teaches_client(new.client_id) and not exists (
      select 1
      from public.reservations r
      join public.time_slot_instructors tsi on tsi.slot_id = r.slot_id
      where r.client_id = new.client_id
        and tsi.instructor_id = new.instructor_id
        and r.status in ('approved', 'completed')
  ) then
    raise exception 'You can only review an instructor who taught you' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists instructor_reviews_guard on public.instructor_reviews;
create trigger instructor_reviews_guard before insert on public.instructor_reviews
  for each row execute function app.guard_instructor_review();

-- ---------------------------------------------------------------------------
-- An instructor cannot be assigned to two overlapping slots.
-- ---------------------------------------------------------------------------
create or replace function app.guard_instructor_overlap()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_conflict text;
begin
  select s2.starts_at::text into v_conflict
  from public.time_slot_instructors tsi
  join public.time_slots s2 on s2.id = tsi.slot_id
  join public.time_slots s1 on s1.id = new.slot_id
  where tsi.instructor_id = new.instructor_id
    and tsi.slot_id <> new.slot_id
    and s2.status <> 'cancelled'
    and tstzrange(s1.starts_at, s1.ends_at, '[)') && tstzrange(s2.starts_at, s2.ends_at, '[)')
  limit 1;

  if v_conflict is not null then
    raise exception 'That instructor already teaches an overlapping session at %', v_conflict
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists tsi_overlap_guard on public.time_slot_instructors;
create trigger tsi_overlap_guard before insert or update on public.time_slot_instructors
  for each row execute function app.guard_instructor_overlap();

-- ---------------------------------------------------------------------------
-- Blocking a slot pulls its live bookings back to pending so staff must
-- explicitly re-decide them.
-- ---------------------------------------------------------------------------
create or replace function app.handle_slot_block()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.reservations
    set status = 'cancelled', staff_note = coalesce(staff_note, '') || ' [session cancelled]'
    where slot_id = new.id and status in ('pending', 'approved');
  end if;
  return new;
end;
$$;

drop trigger if exists time_slots_block on public.time_slots;
create trigger time_slots_block after update of status on public.time_slots
  for each row execute function app.handle_slot_block();

-- ---------------------------------------------------------------------------
-- Re-run the grant now that every helper in this file exists. RLS policies call
-- app.is_admin() and friends as the *invoking* role, so a missing EXECUTE here
-- turns into a permission error on an ordinary query.
-- ---------------------------------------------------------------------------
grant execute on all functions in schema app to authenticated, service_role;
