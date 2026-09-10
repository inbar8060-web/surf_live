-- =============================================================================
-- 0001  Extensions, private schema, enums
-- =============================================================================
-- `app` holds security-definer helpers used by RLS policies. It is deliberately
-- NOT added to Supabase's exposed schemas, so PostgREST cannot call it directly.

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "citext"   with schema extensions;

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enumerated domains
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('admin', 'instructor', 'client');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.category_kind as enum ('lesson', 'rental', 'service');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.slot_status as enum ('open', 'blocked', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.reservation_status as enum
    ('pending', 'approved', 'rejected', 'cancelled', 'completed', 'no_show');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.package_status as enum ('active', 'expired', 'cancelled', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.inventory_status as enum ('available', 'rented', 'maintenance', 'retired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.rental_status as enum ('reserved', 'out', 'returned', 'overdue', 'lost');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_kind as enum ('reservation', 'package', 'rental', 'tip');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum
    ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.skill_level as enum ('beginner', 'intermediate', 'advanced', 'pro');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function app.touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
