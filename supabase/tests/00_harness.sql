-- =============================================================================
-- Test harness
-- =============================================================================
-- These tests run against a plain Postgres bootstrapped by
-- scripts/pg-bootstrap.sql, which supplies the few Supabase platform objects
-- the schema depends on (auth.users, auth.uid(), the three API roles).
--
-- `act_as` switches to the `authenticated` role and sets the JWT subject claim,
-- which is exactly what PostgREST does per request — so every assertion below
-- exercises the real RLS policies, not an approximation of them.

create schema if not exists test;

create or replace function test.check(p_condition boolean, p_what text)
returns void language plpgsql as $$
begin
  if p_condition then
    raise notice '  ok    %', p_what;
  else
    raise exception 'FAILED: %', p_what;
  end if;
end;
$$;

-- Assert that a statement is rejected. Takes the SQL as text so the failure is
-- contained; returns the error message for further inspection.
create or replace function test.rejects(p_sql text, p_what text)
returns text language plpgsql as $$
declare v_msg text;
begin
  begin
    execute p_sql;
  exception when others then
    v_msg := sqlerrm;
  end;

  if v_msg is null then
    raise exception 'FAILED: % (the statement was allowed, but should not have been)', p_what;
  end if;

  raise notice '  ok    % [%]', p_what, left(v_msg, 90);
  return v_msg;
end;
$$;

create or replace function test.act_as(p_user uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, false);
  execute 'set role authenticated';
end;
$$;

-- Back to the trusted server context (service role / SQL migrations).
create or replace function test.act_as_server()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

-- The assertions run while acting as `authenticated`, so that role needs to be
-- able to call them. Nothing here touches application data.
grant usage on schema test to authenticated, anon;
grant execute on all functions in schema test to authenticated, anon;
