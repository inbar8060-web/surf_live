-- =============================================================================
-- 0009  Callable operations (RPC)
-- =============================================================================
-- Multi-step staff operations that must be atomic. Each one re-checks the
-- caller's role itself, so being reachable over PostgREST is not a privilege.

-- ---------------------------------------------------------------------------
-- Stock level for a type: add units or retire spare ones to reach `p_desired`.
-- Units that are currently rented out are never taken away.
-- ---------------------------------------------------------------------------
create or replace function public.set_inventory_quantity(
  p_type_id uuid,
  p_desired integer,
  p_asset_prefix text default null
)
returns table (total_units integer, available_units integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_current integer;
  v_delta   integer;
  v_prefix  text;
  v_seq     integer;
  i         integer;
begin
  if not app.is_admin() then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;
  if p_desired < 0 or p_desired > 1000 then
    raise exception 'Quantity must be between 0 and 1000' using errcode = '23514';
  end if;

  perform 1 from public.inventory_types where id = p_type_id for update;
  if not found then
    raise exception 'Inventory type not found' using errcode = '23503';
  end if;

  select count(*) into v_current
  from public.inventory_items
  where type_id = p_type_id and status <> 'retired';

  v_delta := p_desired - v_current;
  v_prefix := coalesce(nullif(btrim(p_asset_prefix), ''),
                       upper(left(regexp_replace(
                         (select name from public.inventory_types where id = p_type_id),
                         '[^a-zA-Z0-9]', '', 'g'), 4)));
  if v_prefix = '' then v_prefix := 'ITEM'; end if;

  if v_delta > 0 then
    -- The sequence is scoped to the PREFIX, not to the type. Two types can
    -- derive the same four-letter prefix ("Full suit 3/2 M" and "... L" both
    -- give FULL), and asset_tag is globally unique, so counting per type would
    -- generate a tag that already belongs to the neighbouring type.
    select coalesce(max(nullif(regexp_replace(asset_tag, '^.*-', ''), '')::int), 0)
      into v_seq
    from public.inventory_items
    where asset_tag ~ ('^' || v_prefix || '-[0-9]+$');

    for i in 1..v_delta loop
      insert into public.inventory_items (type_id, asset_tag)
      values (p_type_id, v_prefix || '-' || lpad((v_seq + i)::text, 4, '0'));
    end loop;

  elsif v_delta < 0 then
    -- retire only idle units, newest first
    with victims as (
      select id from public.inventory_items
      where type_id = p_type_id and status in ('available', 'maintenance')
      order by created_at desc
      limit (-v_delta)
      for update skip locked
    )
    update public.inventory_items set status = 'retired'
    where id in (select id from victims);
  end if;

  return query
  select count(*) filter (where status <> 'retired')::int,
         count(*) filter (where status = 'available')::int
  from public.inventory_items where type_id = p_type_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Attach a lesson package to a client.
-- ---------------------------------------------------------------------------
create or replace function public.grant_client_package(
  p_client_id   uuid,
  p_template_id uuid,
  p_note        text default null
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_tpl public.package_templates%rowtype;
  v_id  uuid;
begin
  if not app.is_admin() then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;

  select * into v_tpl from public.package_templates where id = p_template_id and is_active;
  if not found then
    raise exception 'Package template not found or inactive' using errcode = '23503';
  end if;
  perform 1 from public.clients where profile_id = p_client_id;
  if not found then
    raise exception 'Client not found' using errcode = '23503';
  end if;

  insert into public.client_packages
    (client_id, template_id, name, lessons_total, lessons_remaining,
     price_cents, currency, expires_at, granted_by, notes)
  values
    (p_client_id, v_tpl.id, v_tpl.name, v_tpl.lessons_count, 0,
     v_tpl.price_cents, v_tpl.currency,
     now() + make_interval(days => v_tpl.validity_days), auth.uid(), p_note)
  returning id into v_id;

  -- the ledger grants the credits, keeping one source of truth
  insert into public.package_ledger (client_package_id, delta, reason, created_by, note)
  values (v_id, v_tpl.lessons_count, 'grant', auth.uid(), p_note);

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Extend a package: add lessons and/or push the expiry date out.
-- ---------------------------------------------------------------------------
create or replace function public.extend_client_package(
  p_package_id   uuid,
  p_extra_lessons integer default 0,
  p_extra_days    integer default 0,
  p_note          text default null
)
returns public.client_packages
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_pkg public.client_packages%rowtype;
begin
  if not app.is_admin() then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;
  if p_extra_lessons < 0 or p_extra_lessons > 200 or p_extra_days < 0 or p_extra_days > 1095 then
    raise exception 'Extension out of range' using errcode = '23514';
  end if;
  if p_extra_lessons = 0 and p_extra_days = 0 then
    raise exception 'Nothing to extend' using errcode = '23514';
  end if;

  select * into v_pkg from public.client_packages where id = p_package_id for update;
  if not found then
    raise exception 'Package not found' using errcode = '23503';
  end if;
  if v_pkg.status = 'cancelled' then
    raise exception 'A cancelled package cannot be extended' using errcode = '23514';
  end if;

  if p_extra_days > 0 then
    update public.client_packages
    set expires_at = greatest(expires_at, now()) + make_interval(days => p_extra_days),
        status = case when status = 'expired' then 'active'::public.package_status else status end
    where id = p_package_id;
  end if;

  if p_extra_lessons > 0 then
    update public.client_packages
    set lessons_total = lessons_total + p_extra_lessons
    where id = p_package_id;

    insert into public.package_ledger (client_package_id, delta, reason, created_by, note)
    values (p_package_id, p_extra_lessons, 'extend', auth.uid(), p_note);
  end if;

  select * into v_pkg from public.client_packages where id = p_package_id;
  return v_pkg;
end;
$$;

-- ---------------------------------------------------------------------------
-- Dismiss a package outright: zero the remaining credits and close it.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_client_package(
  p_package_id uuid,
  p_reason     text
)
returns public.client_packages
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_pkg public.client_packages%rowtype;
begin
  if not app.is_admin() then
    raise exception 'Administrator role required' using errcode = '42501';
  end if;

  select * into v_pkg from public.client_packages where id = p_package_id for update;
  if not found then
    raise exception 'Package not found' using errcode = '23503';
  end if;
  if v_pkg.status = 'cancelled' then
    return v_pkg;
  end if;

  if v_pkg.lessons_remaining > 0 then
    insert into public.package_ledger (client_package_id, delta, reason, created_by, note)
    values (p_package_id, -v_pkg.lessons_remaining, 'revoke', auth.uid(), p_reason);
  end if;

  update public.client_packages
  set status = 'cancelled', cancelled_at = now(), cancelled_reason = p_reason
  where id = p_package_id
  returning * into v_pkg;

  return v_pkg;
end;
$$;

-- ---------------------------------------------------------------------------
-- Expire packages whose validity has run out. Safe to run from a cron job.
-- ---------------------------------------------------------------------------
create or replace function public.expire_stale_packages()
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer;
begin
  update public.client_packages
  set status = 'expired'
  where status = 'active' and expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: revoke from the world, hand out deliberately.
-- ---------------------------------------------------------------------------
revoke all on function public.set_inventory_quantity(uuid, integer, text) from public;
revoke all on function public.grant_client_package(uuid, uuid, text) from public;
revoke all on function public.extend_client_package(uuid, integer, integer, text) from public;
revoke all on function public.cancel_client_package(uuid, text) from public;
revoke all on function public.expire_stale_packages() from public;

grant execute on function public.set_inventory_quantity(uuid, integer, text) to authenticated;
grant execute on function public.grant_client_package(uuid, uuid, text) to authenticated;
grant execute on function public.extend_client_package(uuid, integer, integer, text) to authenticated;
grant execute on function public.cancel_client_package(uuid, text) to authenticated;
grant execute on function public.expire_stale_packages() to service_role;
