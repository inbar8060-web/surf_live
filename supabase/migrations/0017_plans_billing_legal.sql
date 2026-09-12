-- =============================================================================
-- 0017  Plans, billing, payouts and legal acceptance
-- =============================================================================
-- A club's administrator, once their account exists, chooses a plan, pays for
-- it, connects the club's own payout account, and only then reaches the desk.
-- This migration holds the four things that make that true:
--
--   plans                  the three tiers and their limits (platform-global)
--   club_subscriptions     which plan each club is on and whether it is paid
--   club_payment_accounts  the club's connected payout account — an id only;
--                          no credentials, no bank details, ever
--   legal_acceptances      who accepted which version of which document, when
--
-- plus the triggers that make plan limits real (an eleventh instructor on the
-- ten-instructor plan is refused by the database, not by a screen) and the
-- aggregate views each finance dashboard reads.

-- ---------------------------------------------------------------------------
-- plans
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  key                        text primary key check (key ~ '^[a-z_]{2,40}$'),
  name                       text not null check (length(name) between 2 and 60),
  tagline                    text check (length(tagline) <= 200),
  price_cents                integer not null check (price_cents >= 0),
  currency                   char(3) not null default 'USD',
  sort_order                 smallint not null default 0,
  -- null means unlimited
  max_instructors            integer check (max_instructors > 0),
  max_new_clients_per_month  integer check (max_new_clients_per_month > 0),
  max_payments_per_month     integer check (max_payments_per_month > 0),
  wallet_payments            boolean not null default true,
  -- which report periods the finance screen offers
  reports                    text[] not null default '{monthly}',
  -- none: statistics only · internal: payments management · full: everything + export
  financial_dashboard        text not null default 'none'
                               check (financial_dashboard in ('none', 'internal', 'full')),
  is_active                  boolean not null default true,
  created_at                 timestamptz not null default now()
);

insert into public.plans
  (key, name, tagline, price_cents, sort_order, max_instructors, max_new_clients_per_month,
   max_payments_per_month, reports, financial_dashboard)
values
  ('beach',   'Beach Vibes',   'For a club finding its feet',
   15000, 10, 10, 100, 100, '{monthly}', 'none'),
  ('ocean',   'Ocean Vibes',   'For a busy club with a full roster',
   27500, 20, 25, 220, 300, '{monthly,quarterly,yearly}', 'internal'),
  ('surfing', 'Surfing Vibes', 'No limits, full financial picture',
   55000, 30, null, null, null, '{monthly,quarterly,yearly}', 'full')
on conflict (key) do nothing;

alter table public.plans enable row level security;
revoke all on public.plans from anon, authenticated;
grant select on public.plans to anon, authenticated;
create policy plans_public_read on public.plans for select to anon, authenticated using (is_active);

-- ---------------------------------------------------------------------------
-- club_subscriptions
-- ---------------------------------------------------------------------------
create table if not exists public.club_subscriptions (
  id                        uuid primary key default extensions.gen_random_uuid(),
  club_id                   uuid not null unique references public.clubs(id) on delete cascade,
  plan_key                  text not null references public.plans(key),
  status                    text not null default 'incomplete'
                              check (status in ('incomplete', 'active', 'past_due', 'canceled')),
  provider                  text not null check (provider in ('stripe', 'mock')),
  provider_customer_id      text,
  provider_subscription_id  text,
  provider_checkout_ref     text,
  current_period_start      timestamptz,
  current_period_end        timestamptz,
  canceled_at               timestamptz,
  created_by                uuid references public.profiles(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create unique index if not exists club_subscriptions_provider_ref_key
  on public.club_subscriptions (provider, provider_subscription_id) where provider_subscription_id is not null;

drop trigger if exists _00_set_club on public.club_subscriptions;
create trigger _00_set_club before insert or update on public.club_subscriptions
  for each row execute function app.set_club_id();
drop trigger if exists club_subscriptions_touch on public.club_subscriptions;
create trigger club_subscriptions_touch before update on public.club_subscriptions
  for each row execute function app.touch_updated_at();

alter table public.club_subscriptions enable row level security;
revoke all on public.club_subscriptions from anon, authenticated;
grant select, update on public.club_subscriptions to authenticated;

create policy club_subscriptions_admin_read on public.club_subscriptions
  for select to authenticated using (app.is_admin() and club_id = app.current_club_id());
create policy club_subscriptions_platform on public.club_subscriptions
  for all to authenticated using (app.is_super_admin()) with check (app.is_super_admin());

-- ---------------------------------------------------------------------------
-- club_payment_accounts — the club's own payout account at the provider
-- ---------------------------------------------------------------------------
create table if not exists public.club_payment_accounts (
  club_id            uuid primary key references public.clubs(id) on delete cascade,
  provider           text not null check (provider in ('stripe_connect', 'mock')),
  -- the provider's account id (acct_…). The only thing held about the account.
  account_id         text not null check (length(account_id) between 3 and 120),
  country            char(2),
  default_currency   char(3),
  charges_enabled    boolean not null default false,
  payouts_enabled    boolean not null default false,
  details_submitted  boolean not null default false,
  requirements_due   jsonb not null default '[]'::jsonb check (jsonb_typeof(requirements_due) = 'array'),
  status             text not null default 'onboarding'
                       check (status in ('onboarding', 'active', 'restricted', 'disabled')),
  -- the platform's share of each payment, in basis points; set by the operator
  platform_fee_bps   integer not null default 0 check (platform_fee_bps between 0 and 3000),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (provider, account_id)
);

drop trigger if exists _00_set_club on public.club_payment_accounts;
create trigger _00_set_club before insert or update on public.club_payment_accounts
  for each row execute function app.set_club_id();
drop trigger if exists club_payment_accounts_touch on public.club_payment_accounts;
create trigger club_payment_accounts_touch before update on public.club_payment_accounts
  for each row execute function app.touch_updated_at();

alter table public.club_payment_accounts enable row level security;
revoke all on public.club_payment_accounts from anon, authenticated;
grant select, update on public.club_payment_accounts to authenticated;

create policy club_payment_accounts_admin_read on public.club_payment_accounts
  for select to authenticated using (app.is_admin() and club_id = app.current_club_id());
create policy club_payment_accounts_platform on public.club_payment_accounts
  for all to authenticated using (app.is_super_admin()) with check (app.is_super_admin());

-- Each payment remembers the account it was charged through and the platform's
-- share, so the finance screens can be rebuilt from the rows alone.
alter table public.payments
  add column if not exists account_id          text,
  add column if not exists platform_fee_cents  integer not null default 0 check (platform_fee_cents >= 0);

-- ---------------------------------------------------------------------------
-- legal_acceptances — the event, never the text (which lives in code, versioned)
-- ---------------------------------------------------------------------------
create table if not exists public.legal_acceptances (
  id            bigint generated always as identity primary key,
  club_id       uuid not null references public.clubs(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  document_key  text not null
                  check (document_key in ('terms', 'privacy', 'club_agreement', 'instructor_agreement')),
  version       text not null check (length(version) between 1 and 40),
  accepted_at   timestamptz not null default now(),
  ip            inet,
  user_agent    text,
  unique (user_id, document_key, version)
);

create index if not exists legal_acceptances_user_idx on public.legal_acceptances (user_id);

drop trigger if exists _00_set_club on public.legal_acceptances;
create trigger _00_set_club before insert or update on public.legal_acceptances
  for each row execute function app.set_club_id();
drop trigger if exists legal_acceptances_immutable on public.legal_acceptances;
create trigger legal_acceptances_immutable before update or delete on public.legal_acceptances
  for each row execute function app.reject_mutation();

alter table public.legal_acceptances enable row level security;
revoke all on public.legal_acceptances from anon, authenticated;
grant select, insert on public.legal_acceptances to authenticated;

create policy legal_acceptances_select on public.legal_acceptances
  for select to authenticated
  using (club_id = app.current_club_id() and (user_id = auth.uid() or app.is_admin()));
create policy legal_acceptances_insert_own on public.legal_acceptances
  for insert to authenticated
  with check (user_id = auth.uid() and club_id = app.current_club_id());

-- ---------------------------------------------------------------------------
-- Plan limits, enforced where they cannot be bypassed
-- ---------------------------------------------------------------------------
-- A club with no live subscription has no plan and therefore no limits here:
-- its administrator cannot reach the desk until one is paid, so nothing is
-- being counted. Once a plan is live, the plan's numbers are the law.
create or replace function app.club_plan(p_club uuid)
returns public.plans
language sql stable security definer set search_path = public, pg_temp as $$
  select p.*
  from public.club_subscriptions s
  join public.plans p on p.key = s.plan_key
  where s.club_id = p_club and s.status in ('active', 'past_due')
  limit 1
$$;

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

  if v_becoming_instructor then
    v_plan := app.club_plan(new.club_id);
    if v_plan.key is not null and v_plan.max_instructors is not null then
      select count(*) into v_count from public.profiles
      where club_id = new.club_id and role = 'instructor' and is_active and id <> new.id;
      if v_count >= v_plan.max_instructors then
        raise exception 'Instructors: your plan "%" allows % instructors and the club already has %. Upgrade under Club → Plan to add more.',
          v_plan.name, v_plan.max_instructors, v_count using errcode = 'P0001';
      end if;
    end if;
  end if;

  if tg_op = 'INSERT' and new.role = 'client' then
    v_plan := app.club_plan(new.club_id);
    if v_plan.key is not null and v_plan.max_new_clients_per_month is not null then
      select count(*) into v_count from public.profiles
      where club_id = new.club_id and role = 'client'
        and created_at >= date_trunc('month', now()) and id <> new.id;
      if v_count >= v_plan.max_new_clients_per_month then
        raise exception 'Members: your plan "%" allows % new members a month and the club has reached that this month. Upgrade under Club → Plan, or add them next month.',
          v_plan.name, v_plan.max_new_clients_per_month using errcode = 'P0001';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists zz_plan_limits on public.profiles;
create trigger zz_plan_limits before insert or update of role, is_active on public.profiles
  for each row execute function app.enforce_plan_limits_profile();

create or replace function app.enforce_plan_limits_payment()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_plan public.plans;
  v_count integer;
begin
  v_plan := app.club_plan(new.club_id);
  if v_plan.key is not null and v_plan.max_payments_per_month is not null then
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

drop trigger if exists zz_plan_limits on public.payments;
create trigger zz_plan_limits before insert on public.payments
  for each row execute function app.enforce_plan_limits_payment();

-- ---------------------------------------------------------------------------
-- Finance, aggregated
-- ---------------------------------------------------------------------------
-- The operator's picture: per club, per month, sums and counts. No client, no
-- booking, no single payment row — the same discipline as club_statistics,
-- now with money in it because the operator bills the clubs and earns a share.
create or replace view public.platform_club_finance with (security_barrier = true) as
select
  p.club_id,
  date_trunc('month', coalesce(p.succeeded_at, p.created_at))::date as month,
  p.currency,
  count(*) filter (where p.status = 'succeeded')::int  as payments_succeeded,
  count(*) filter (where p.status = 'failed')::int     as payments_failed,
  count(*) filter (where p.status = 'refunded')::int   as payments_refunded,
  coalesce(sum(p.amount_cents) filter (where p.status = 'succeeded'), 0)::bigint as gross_cents,
  coalesce(sum(p.amount_cents) filter (where p.status = 'refunded'), 0)::bigint  as refunded_cents,
  coalesce(sum(p.platform_fee_cents) filter (where p.status = 'succeeded'), 0)::bigint as platform_fee_cents,
  coalesce(sum(p.amount_cents) filter (where p.status = 'succeeded' and p.kind = 'tip'), 0)::bigint as tips_cents
from public.payments p
where app.is_super_admin()
group by p.club_id, date_trunc('month', coalesce(p.succeeded_at, p.created_at)), p.currency;

revoke all on public.platform_club_finance from anon, authenticated;
grant select on public.platform_club_finance to authenticated;

-- the club's own count of what it has used this month, for the plan screen
create or replace function public.club_plan_usage()
returns table (instructors int, new_clients_this_month int, payments_this_month int)
language sql stable security definer set search_path = public, pg_temp as $$
  select
    (select count(*) from public.profiles
       where club_id = app.current_club_id() and role = 'instructor' and is_active)::int,
    (select count(*) from public.profiles
       where club_id = app.current_club_id() and role = 'client'
         and created_at >= date_trunc('month', now()))::int,
    (select count(*) from public.payments
       where club_id = app.current_club_id() and status not in ('failed', 'cancelled')
         and created_at >= date_trunc('month', now()))::int
  where app.is_admin()
$$;
revoke all on function public.club_plan_usage() from public;
grant execute on function public.club_plan_usage() to authenticated;

grant execute on all functions in schema app to authenticated, service_role;
