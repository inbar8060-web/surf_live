-- Minimal stand-in for the Supabase platform objects, so the migrations in
-- supabase/migrations can be executed and verified against a plain Postgres.
-- This file is a test fixture; it is never applied to a real project.

create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists graphql_public;

do $$ begin create role anon nologin;          exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin;  exception when duplicate_object then null; end $$;

grant usage on schema public, extensions to anon, authenticated, service_role;

create extension if not exists pgcrypto with schema extensions;

create table if not exists auth.users (
  id uuid primary key default extensions.gen_random_uuid(),
  email text,
  phone text,
  encrypted_password text,
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- auth.uid() reads the request JWT claims; tests set request.jwt.claim.sub.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;
