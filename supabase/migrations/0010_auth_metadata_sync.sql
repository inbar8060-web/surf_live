-- =============================================================================
-- 0010  Keep the profile in step with auth.users app_metadata
-- =============================================================================
-- GoTrue's admin createUser writes the row first and applies app_metadata in a
-- follow-up UPDATE. The AFTER INSERT trigger in 0006 therefore reads the row
-- before the role is on it, and every account lands as the default 'client'.
--
-- This adds the missing half: when app_metadata changes, the profile follows.
-- Reading the role from app_metadata is safe because only the service role can
-- write it — a user editing their own (writable) user_metadata still cannot
-- promote themselves.

create or replace function app.sync_user_metadata()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_role  public.app_role;
  v_name  text;
  v_phone text;
begin
  if new.raw_app_meta_data is not distinct from old.raw_app_meta_data then
    return new;
  end if;

  v_role := nullif(new.raw_app_meta_data ->> 'role', '')::public.app_role;
  if v_role is null then
    return new;
  end if;

  -- The role is authoritative and always applied. The guard trigger on
  -- profiles still runs, so the last active administrator is still protected.
  update public.profiles
  set role = v_role
  where id = new.id and role is distinct from v_role;

  -- Name and phone are only filled in while they are still the values derived
  -- at sign-up. Once staff have edited them, the profile wins — otherwise any
  -- later metadata write would silently revert an administrator's correction.
  v_name := nullif(btrim(new.raw_app_meta_data ->> 'full_name'), '');
  if v_name is not null then
    update public.profiles
    set full_name = left(v_name, 120)
    where id = new.id
      and full_name = split_part(coalesce(new.email, 'member'), '@', 1);
  end if;

  v_phone := nullif(btrim(new.raw_app_meta_data ->> 'phone'), '');
  if v_phone ~ '^\+[1-9][0-9]{6,14}$' then
    update public.profiles
    set phone = v_phone
    where id = new.id and phone is null;
  end if;

  -- Make sure the role-specific row exists for the role we just applied.
  if v_role = 'instructor' then
    insert into public.instructors (profile_id) values (new.id) on conflict do nothing;
  elsif v_role = 'client' then
    insert into public.clients (profile_id) values (new.id) on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_metadata_changed on auth.users;
create trigger on_auth_user_metadata_changed
  after update of raw_app_meta_data on auth.users
  for each row execute function app.sync_user_metadata();

grant execute on all functions in schema app to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Remove the role row an account no longer needs.
--
-- The insert trigger provisions a `clients` row for every new account (the
-- default role), so an account that turns out to be staff is left carrying one.
-- A leftover row means an instructor or administrator can be picked in a
-- "choose a member" list and booked onto a session as if they were a customer.
--
-- Only rows with no history are removed. If someone has genuinely trained at
-- the club and later becomes an instructor, their record stays put.
-- ---------------------------------------------------------------------------
create or replace function app.prune_role_rows(p_id uuid, p_role public.app_role)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_role <> 'client' then
    delete from public.clients c
    where c.profile_id = p_id
      and not exists (select 1 from public.reservations    r where r.client_id     = p_id)
      and not exists (select 1 from public.client_packages k where k.client_id     = p_id)
      and not exists (select 1 from public.rentals         t where t.client_id     = p_id)
      and not exists (select 1 from public.payments        y where y.client_id     = p_id)
      and not exists (select 1 from public.session_reviews s where s.client_id     = p_id)
      and not exists (select 1 from public.instructor_reviews i where i.client_id  = p_id);
  end if;

  if p_role <> 'instructor' then
    delete from public.instructors n
    where n.profile_id = p_id
      and not exists (select 1 from public.time_slot_instructors a where a.instructor_id = p_id)
      and not exists (select 1 from public.tips               t where t.instructor_id = p_id)
      and not exists (select 1 from public.instructor_reviews i where i.instructor_id = p_id);
  end if;
end;
$$;

create or replace function app.apply_role_change()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.prune_role_rows(new.id, new.role);
  return new;
end;
$$;

drop trigger if exists profiles_role_applied on public.profiles;
create trigger profiles_role_applied after update of role on public.profiles
  for each row when (old.role is distinct from new.role)
  execute function app.apply_role_change();

grant execute on all functions in schema app to authenticated, service_role;
