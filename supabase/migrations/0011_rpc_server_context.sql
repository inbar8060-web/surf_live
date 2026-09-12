-- =============================================================================
-- 0011  Let trusted server code call the staff RPCs
-- =============================================================================
-- The four staff operations in 0009 gate on app.is_admin(), which reads
-- auth.uid(). That is right for a request carrying a JWT, but it also locks out
-- the service role, where auth.uid() is null — so a cron job, a data migration
-- or a seed script could not call them at all.
--
-- The guard now accepts either an administrator's JWT or a null uid, which only
-- occurs for the service role and for SQL run directly against the database.
-- Both are already fully privileged: the service role bypasses RLS by design,
-- so this grants no reach that context did not already have. It is the same
-- stance the reservation trigger in 0006 takes.
--
-- The application still proves admin the strong way: the Server Actions call
-- these through the *user's* client, so the caller's own JWT is what satisfies
-- app.is_admin().

create or replace function app.can_administer()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is null or app.is_admin()
$$;

comment on function app.can_administer() is
  'True for an administrator JWT, or for trusted server contexts (service role, direct SQL) where auth.uid() is null.';

grant execute on function app.can_administer() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Swap the guard in each of the four operations.
-- ---------------------------------------------------------------------------
do $$
declare
  fn text;
  src text;
begin
  foreach fn in array array[
    'public.set_inventory_quantity(uuid, integer, text)',
    'public.grant_client_package(uuid, uuid, text)',
    'public.extend_client_package(uuid, integer, integer, text)',
    'public.cancel_client_package(uuid, text)'
  ] loop
    src := pg_get_functiondef(fn::regprocedure);
    src := replace(src, 'if not app.is_admin() then', 'if not app.can_administer() then');
    execute src;
  end loop;
end $$;
