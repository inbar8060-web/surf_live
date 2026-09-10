-- =============================================================================
-- 01  Account provisioning, role guards, and who can read what
-- =============================================================================
\set ON_ERROR_STOP on
\set QUIET on

select test.act_as_server();

-- ---------------------------------------------------------------------------
-- Provisioning: the role comes from app_metadata, which a user cannot write to
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'admin@test.local',
   '{"role":"admin","full_name":"Ava Admin","phone":"+972500000001"}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'maya@test.local',
   '{"role":"instructor","full_name":"Maya Instructor","phone":"+972500000002"}', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'dan@test.local',
   '{"role":"instructor","full_name":"Dan Instructor","phone":"+972500000003"}', '{}'),
  ('44444444-4444-4444-4444-444444444444', 'noa@test.local',
   '{"role":"client","full_name":"Noa Client","phone":"+972500000004"}', '{}'),
  ('55555555-5555-5555-5555-555555555555', 'tom@test.local',
   '{"role":"client","full_name":"Tom Client","phone":"+972500000005"}', '{}');

select test.check(
  (select count(*) from public.profiles) = 5,
  'a profile row is created for every auth user');

select test.check(
  (select role from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 'admin',
  'the role is taken from app_metadata');

select test.check(
  (select count(*) from public.instructors) = 2 and (select count(*) from public.clients) = 2,
  'the role-specific row is created alongside the profile');

-- A user who puts role=admin in their own (writable) user_metadata stays a client.
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('66666666-6666-6666-6666-666666666666', 'sneaky@test.local',
   '{"role":"client","full_name":"Sneaky Client"}', '{"role":"admin"}');

select test.check(
  (select role from public.profiles where id = '66666666-6666-6666-6666-666666666666') = 'client',
  'user_metadata cannot be used to self-promote to admin');

-- ---------------------------------------------------------------------------
-- Clients cannot change their own personal details
-- ---------------------------------------------------------------------------
select test.act_as('44444444-4444-4444-4444-444444444444');

select test.check(
  (select count(*) from public.profiles) = 1,
  'a client sees only their own profile row');

do $$
declare n integer;
begin
  update public.profiles set full_name = 'Renamed Myself'
  where id = '44444444-4444-4444-4444-444444444444';
  get diagnostics n = row_count;
  perform test.check(n = 0, 'a client cannot rename themselves (no update policy matches)');
end $$;

-- No policy's USING clause matches, so the row is invisible to the UPDATE and
-- nothing changes. RLS filters rather than raising, which is the correct and
-- quieter behaviour: the point to assert is that the role did not move.
do $$
declare n integer;
begin
  update public.profiles set role = 'admin'
  where id = '44444444-4444-4444-4444-444444444444';
  get diagnostics n = row_count;
  perform test.check(n = 0, 'a client''s attempt to promote themselves updates no rows');
end $$;

select test.act_as_server();
select test.check(
  (select role from public.profiles where id = '44444444-4444-4444-4444-444444444444') = 'client'
  and (select full_name from public.profiles where id = '44444444-4444-4444-4444-444444444444') = 'Noa Client',
  'the client''s role and name are genuinely unchanged afterwards');
select test.act_as('44444444-4444-4444-4444-444444444444');

-- ---------------------------------------------------------------------------
-- Column-level protection of staff-only notes
-- ---------------------------------------------------------------------------
select test.rejects(
  $sql$ select admin_notes from public.clients where profile_id = '44444444-4444-4444-4444-444444444444' $sql$,
  'a client cannot read the internal notes held about them');

-- ---------------------------------------------------------------------------
-- Members have no direct read on the staff schedule tables
-- ---------------------------------------------------------------------------
select test.check(
  (select count(*) from public.time_slots) = 0,
  'a client reads nothing from time_slots directly (they use slot_catalog)');

-- ---------------------------------------------------------------------------
-- Instructors see colleagues, not unrelated members
-- ---------------------------------------------------------------------------
select test.act_as('22222222-2222-2222-2222-222222222222');

select test.check(
  (select count(*) from public.profiles where role = 'instructor') = 2,
  'an instructor can see their colleagues');

select test.check(
  (select count(*) from public.profiles where role = 'client') = 0,
  'an instructor cannot see members they have never taught');

select test.check(
  (select count(*) from public.audit_log) = 0,
  'an instructor cannot read the audit trail');

-- ---------------------------------------------------------------------------
-- Admin sees everything
-- ---------------------------------------------------------------------------
select test.act_as('11111111-1111-1111-1111-111111111111');

select test.check(
  (select count(*) from public.profiles) = 6,
  'an admin can see every profile');

-- ---------------------------------------------------------------------------
-- The last active admin cannot be removed
-- ---------------------------------------------------------------------------
select test.rejects(
  $sql$ update public.profiles set role = 'client' where id = '11111111-1111-1111-1111-111111111111' $sql$,
  'the last active administrator cannot be demoted');

select test.act_as_server();
