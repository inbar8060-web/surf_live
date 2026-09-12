-- =============================================================================
-- 0018  Review fixes: limits that hold under concurrency, one Maps rule, tidy-up
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Plan limits: serialise per club before counting, so two inserts arriving
-- together at the cap cannot both pass. The advisory lock lives for the
-- transaction and is keyed on the club, so clubs never wait on each other.
-- ---------------------------------------------------------------------------
create or replace function app.enforce_plan_limits_profile()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_plan public.plans;
  v_count integer;
  v_becoming_instructor boolean;
begin
  if new.club_id is null then return new; end if;

  v_becoming_instructor :=
    new.role = 'instructor' and new.is_active
    and (tg_op = 'INSERT' or old.role <> 'instructor' or not old.is_active);

  if v_becoming_instructor or (tg_op = 'INSERT' and new.role = 'client') then
    v_plan := app.club_plan(new.club_id);
    if v_plan.key is not null then
      perform pg_advisory_xact_lock(hashtext('plan-limit:' || new.club_id::text));
    end if;
  end if;

  if v_becoming_instructor and v_plan.key is not null and v_plan.max_instructors is not null then
    select count(*) into v_count from public.profiles
    where club_id = new.club_id and role = 'instructor' and is_active and id <> new.id;
    if v_count >= v_plan.max_instructors then
      raise exception 'Instructors: your plan "%" allows % instructors and the club already has %. Upgrade under Club → Plan to add more.',
        v_plan.name, v_plan.max_instructors, v_count using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'INSERT' and new.role = 'client' and v_plan.key is not null and v_plan.max_new_clients_per_month is not null then
    select count(*) into v_count from public.profiles
    where club_id = new.club_id and role = 'client'
      and created_at >= date_trunc('month', now()) and id <> new.id;
    if v_count >= v_plan.max_new_clients_per_month then
      raise exception 'Members: your plan "%" allows % new members a month and the club has reached that this month. Upgrade under Club → Plan, or add them next month.',
        v_plan.name, v_plan.max_new_clients_per_month using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create or replace function app.enforce_plan_limits_payment()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_plan public.plans;
  v_count integer;
begin
  v_plan := app.club_plan(new.club_id);
  if v_plan.key is not null and v_plan.max_payments_per_month is not null then
    perform pg_advisory_xact_lock(hashtext('plan-limit:' || new.club_id::text));
    select count(*) into v_count from public.payments
    where club_id = new.club_id and status not in ('failed', 'cancelled')
      and created_at >= date_trunc('month', now());
    if v_count >= v_plan.max_payments_per_month then
      raise exception 'Payments: the club''s plan "%" allows % payments a month and has reached that this month. The club can upgrade under Club → Plan.',
        v_plan.name, v_plan.max_payments_per_month using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

-- the counts above, and the operator's finance view, walk these
create index if not exists payments_club_month_idx
  on public.payments (club_id, created_at) where status not in ('failed', 'cancelled');
create index if not exists profiles_club_role_created_idx
  on public.profiles (club_id, role, created_at);
create index if not exists audit_log_club_created_idx
  on public.audit_log (club_id, created_at desc);

-- ---------------------------------------------------------------------------
-- One rule for a Google Maps link. The application normalises the pasted
-- link (unwrapping the consent page, making the path explicit) before it is
-- stored, and this rule accepts exactly what that normaliser lets through.
-- ---------------------------------------------------------------------------
alter table public.clubs drop constraint if exists clubs_maps_url_check;
alter table public.clubs add constraint clubs_maps_url_check check (
  maps_url ~ '^https://maps\.google\.[a-z]{2,3}(\.[a-z]{2})?/' or
  maps_url ~ '^https://(www\.)?google\.[a-z]{2,3}(\.[a-z]{2})?/maps' or
  maps_url ~ '^https://maps\.app\.goo\.gl/' or
  maps_url ~ '^https://goo\.gl/'
);

-- ---------------------------------------------------------------------------
-- 0014 used a helper to patch function bodies in place. Its work is done; a
-- callable that rewrites arbitrary functions has no business staying around.
-- ---------------------------------------------------------------------------
drop function if exists app.rewrite_function(regprocedure, text, text);
