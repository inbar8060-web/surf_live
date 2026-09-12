-- =============================================================================
-- 06  Tenant isolation: two clubs that must never see each other
-- =============================================================================
-- These assertions are the ones that matter most in this suite. Each of the
-- four isolation mechanisms is exercised on its own, then the policy audit at
-- the end fails the build if any future table or policy forgets the club.
\set ON_ERROR_STOP on
\set QUIET on

select test.act_as_server();

select id as club_a from public.clubs where slug = 'surfer-live' \gset

-- A second club, provisioned the way the platform does it.
select id as club_b from public.provision_club('Reef Riders', 'reef-riders', '', 'admin@reef.local') \gset
update public.clubs set status = 'active' where id = :'club_b';

select test.check(
  (select count(*) from public.club_settings where club_id = :'club_b') = 1,
  'provisioning a club creates its own settings row');

-- The listing's details travel with the club and are public — nothing else is.
select id as club_c from public.provision_club(
  'Bay Surf', 'bay-surf', 'https://maps.app.goo.gl/bay', 'admin@bay.local', 'Europe/Lisbon',
  '{"address":"1 Beach Road, Ericeira","phone":"+351912345678","website":"https://bay.example",
    "opening_hours":["Monday: 9:00 – 18:00","Tuesday: Closed"],"latitude":38.96,"longitude":-9.42,"place_id":"ChIJtest"}'::jsonb
) \gset
update public.clubs set status = 'active' where id = :'club_c';
select test.check(
  (select address = '1 Beach Road, Ericeira' and contact_phone = '+351912345678' and website = 'https://bay.example'
      and opening_hours = '["Monday: 9:00 – 18:00","Tuesday: Closed"]'::jsonb and spot_latitude = 38.96
      and timezone = 'Europe/Lisbon' and place_id = 'ChIJtest'
   from public.club_settings where club_id = :'club_c'),
  'provisioning stores the listing''s details on the club''s own settings row');
update public.club_settings set contact_email = 'private@bay.local' where club_id = :'club_c';
select test.check(
  (select address = '1 Beach Road, Ericeira' and jsonb_array_length(opening_hours) = 2 and website = 'https://bay.example'
   from public.club_public_profile('bay-surf')),
  'the public profile carries the listing''s address, hours and website');
select test.check(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'club_settings' and column_name = 'contact_email'
  ) or not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'club_public_profile'
      and pg_get_function_result(p.oid) like '%contact_email%'
  ),
  'the public profile never exposes the club''s inbox');
select test.rejects(
  $sql$ select public.provision_club('Bad', 'bad-hours', '', 'x@y.local', 'UTC',
        '{"opening_hours":["1","2","3","4","5","6","7","8"]}'::jsonb) $sql$,
  'a listing cannot carry more than seven lines of hours');

-- Club B's people. Same roles, different club.
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('b1111111-1111-1111-1111-111111111111', 'admin@reef.local',
   format('{"role":"admin","club_id":"%s","full_name":"Reef Admin"}', :'club_b')::jsonb, '{}'),
  ('b2222222-2222-2222-2222-222222222222', 'coach@reef.local',
   format('{"role":"instructor","club_id":"%s","full_name":"Reef Coach"}', :'club_b')::jsonb, '{}'),
  ('b4444444-4444-4444-4444-444444444444', 'surfer@reef.local',
   format('{"role":"client","club_id":"%s","full_name":"Reef Surfer"}', :'club_b')::jsonb, '{}');

-- Names are unique within a club, not across the platform: club B may reuse
-- club A's category slug and asset tag without either side noticing.
insert into public.categories (club_id, name, slug, kind) values (:'club_b', 'Group lessons', 'group-lessons', 'lesson');
select test.check(
  (select count(*) from public.categories where slug = 'group-lessons') = 2,
  'two clubs may both use the same category slug');
insert into public.inventory_types (club_id, category_id, name, kind, daily_price_cents)
select :'club_b', id, 'Soft-top 8''0"', 'board', 9000 from public.categories where slug = 'group-lessons' and club_id = :'club_b';
insert into public.inventory_items (club_id, type_id, asset_tag)
select :'club_b', id, (select min(asset_tag) from public.inventory_items) from public.inventory_types where club_id = :'club_b';
select test.check(
  (select count(distinct club_id) from public.inventory_items where asset_tag = (select min(asset_tag) from public.inventory_items)) = 2,
  'two clubs may both tag a board with the same asset tag');

-- Club B's own catalogue and a session.
insert into public.categories (club_id, name, slug, kind) values (:'club_b', 'Reef lessons', 'reef-lessons', 'lesson');
insert into public.services (club_id, category_id, name, duration_minutes, default_capacity, price_cents)
select :'club_b', id, 'Reef group', 90, 6, 20000 from public.categories where slug = 'reef-lessons';
insert into public.time_slots (id, club_id, service_id, starts_at, ends_at, capacity)
select 'bbbbbbbb-0000-0000-0000-000000000001', :'club_b', id, now() + interval '5 days', now() + interval '5 days 90 minutes', 6
from public.services where name = 'Reef group';
insert into public.time_slot_instructors (club_id, slot_id, instructor_id, is_lead)
values (:'club_b', 'bbbbbbbb-0000-0000-0000-000000000001', 'b2222222-2222-2222-2222-222222222222', true);

-- ---------------------------------------------------------------------------
-- 1. Reads: a club's staff and members see nothing of the other club
-- ---------------------------------------------------------------------------
select test.act_as('11111111-1111-1111-1111-111111111111');   -- club A admin

select test.check(
  (select count(*) from public.profiles where club_id = :'club_b') = 0,
  'an administrator sees no profile from another club');
select test.check(
  (select count(*) from public.time_slots where id = 'bbbbbbbb-0000-0000-0000-000000000001') = 0,
  'an administrator sees no session from another club');
select test.check(
  (select count(*) from public.categories where slug = 'reef-lessons') = 0,
  'an administrator sees no catalogue entry from another club');
select test.check(
  (select count(*) from public.club_settings) = 1,
  'an administrator sees exactly one settings row: their own club''s');
select test.check(
  (select count(*) from public.clubs) = 1,
  'an administrator sees exactly one club: their own');
select test.check(
  (select count(*) from public.staff_slot_overview where slot_id = 'bbbbbbbb-0000-0000-0000-000000000001') = 0,
  'the staff schedule view is scoped to the caller''s club');

select test.act_as('b4444444-4444-4444-4444-444444444444');   -- club B member

select test.check(
  (select count(*) from public.slot_catalog) = 1
  and (select count(*) from public.slot_catalog where slot_id = 'bbbbbbbb-0000-0000-0000-000000000001') = 1,
  'a member''s catalogue holds their own club''s sessions and none of club A''s');
select test.check(
  (select count(*) from public.instructor_directory) = 1,
  'a member sees only their own club''s instructors');

-- ---------------------------------------------------------------------------
-- 2. Writes: the composite keys and the trigger each refuse a cross-club row
-- ---------------------------------------------------------------------------
-- A club B member tries to book a club A session by id.
select test.rejects(
  $sql$ insert into public.reservations (slot_id, client_id, participants)
        values ('aaaaaaaa-0000-0000-0000-000000000002', 'b4444444-4444-4444-4444-444444444444', 1) $sql$,
  'a member cannot book a session that belongs to another club');

-- and cannot smuggle it in by naming the other club outright
select test.rejects(
  format($sql$ insert into public.reservations (club_id, slot_id, client_id, participants)
        values ('%s', 'aaaaaaaa-0000-0000-0000-000000000002', 'b4444444-4444-4444-4444-444444444444', 1) $sql$, :'club_a'),
  'a member cannot write a row into another club by naming it');

-- Even the server, which bypasses policies, is stopped by the composite key.
select test.act_as_server();
select test.rejects(
  format($sql$ insert into public.reservations (club_id, slot_id, client_id, participants)
        values ('%s', 'aaaaaaaa-0000-0000-0000-000000000002', 'b4444444-4444-4444-4444-444444444444', 1) $sql$, :'club_b'),
  'server code cannot pair a club B member with a club A session (composite key)');
select test.rejects(
  format($sql$ insert into public.time_slot_instructors (club_id, slot_id, instructor_id)
        values ('%s', 'bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222') $sql$, :'club_b'),
  'server code cannot assign a club A instructor to a club B session');
select test.rejects(
  format($sql$ insert into public.time_slots (club_id, service_id, starts_at, ends_at, capacity)
        select '%s', id, now() + interval '1 day', now() + interval '1 day 1 hour', 4
        from public.services where name = 'Reef group' $sql$, :'club_a'),
  'a session cannot be created in club A on a club B service');
select test.rejects(
  $sql$ insert into public.time_slots (service_id, starts_at, ends_at, capacity)
        select id, now() + interval '1 day', now() + interval '1 day 1 hour', 4
        from public.services where name = 'Reef group' $sql$,
  'server code must always say which club a row belongs to — there is no default');

-- A row never moves between clubs.
select test.rejects(
  format($sql$ update public.time_slots set club_id = '%s' where id = 'bbbbbbbb-0000-0000-0000-000000000001' $sql$, :'club_a'),
  'a row cannot be moved to another club');
select test.rejects(
  format($sql$ update public.profiles set club_id = '%s' where id = 'b4444444-4444-4444-4444-444444444444' $sql$, :'club_a'),
  'a person cannot be moved to another club');

-- ---------------------------------------------------------------------------
-- 3. Staff decisions do not reach across clubs
-- ---------------------------------------------------------------------------
select test.act_as('b4444444-4444-4444-4444-444444444444');
insert into public.reservations (slot_id, client_id, participants)
values ('bbbbbbbb-0000-0000-0000-000000000001', 'b4444444-4444-4444-4444-444444444444', 1);

select test.act_as('22222222-2222-2222-2222-222222222222');   -- club A instructor
do $$
declare n integer;
begin
  update public.reservations set status = 'approved'
  where slot_id = 'bbbbbbbb-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  perform test.check(n = 0, 'a club A instructor cannot decide a club B booking');
end $$;

select test.act_as('11111111-1111-1111-1111-111111111111');   -- club A admin
select test.rejects(
  format($sql$ select public.grant_client_package('b4444444-4444-4444-4444-444444444444', '%s', 'x') $sql$,
    (select id from public.package_templates limit 1)),
  'a club A administrator cannot attach a club A package to a club B member');

-- ---------------------------------------------------------------------------
-- 4. The platform operator: counts, never rows
-- ---------------------------------------------------------------------------
select test.act_as('99999999-9999-9999-9999-999999999999');

select test.check(
  (select count(*) from public.clubs) = 3,
  'the operator sees every club');
select test.check(
  (select count(*) from public.club_statistics) = 3
  and (select members from public.club_statistics where slug = 'reef-riders') = 1,
  'the operator sees per-club counts');
select test.check(
  (select count(*) from public.profiles) = 1,
  'the operator sees no club member, instructor or administrator — only themselves');
select test.check(
  (select count(*) from public.reservations) = 0
  and (select count(*) from public.payments) = 0
  and (select count(*) from public.document_signatures) = 0
  and (select count(*) from public.clients) = 0,
  'the operator can read no booking, payment, signature or member record');
select test.check(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name in ('club_statistics', 'club_activity')
      and (column_name ~ 'cents|amount|price|email|phone|name$' and column_name not in ('name'))
  ),
  'the operator''s views carry no amount of money and no personal contact detail');

-- No policy on club_settings mentions the operator, so the row is invisible
-- to the UPDATE and nothing changes — RLS filters rather than raising.
with touched as (
  update public.club_settings set club_name = 'Renamed' where club_id = :'club_b' returning 1
)
select count(*) as touched from touched \gset
select test.check(:touched = 0, 'the operator cannot edit a club''s own settings');
select test.act_as_server();
select test.check(
  (select club_name from public.club_settings where club_id = :'club_b') = 'Reef Riders',
  'the club''s settings are genuinely untouched afterwards');
select test.act_as('99999999-9999-9999-9999-999999999999');

-- ---------------------------------------------------------------------------
-- 5. Audit: every policy on every tenant table names the club
-- ---------------------------------------------------------------------------
select test.act_as_server();

select test.check(
  not exists (
    select 1
    from pg_policies p
    join information_schema.columns c
      on c.table_schema = p.schemaname and c.table_name = p.tablename and c.column_name = 'club_id'
    where p.schemaname = 'public'
      and p.tablename not in ('clubs', 'plans', 'support_conversations', 'support_messages', 'platform_audit_log')
      and coalesce(p.qual, '') not like '%club_id%'
      and coalesce(p.with_check, '') not like '%club_id%'
      -- two exemptions: reading your own profile row, which carries no
      -- club-scoped data of anyone else; and the operator's own policies on
      -- the billing tables (named *_platform), since the operator has no club
      and not (p.tablename = 'profiles' and p.policyname = 'profiles_select_self')
      and not (p.policyname like '%\_platform' and p.qual like '%is_super_admin()%')
  ),
  'every policy on every club-scoped table is conjoined with the club');

select test.check(
  not exists (
    select 1 from information_schema.tables t
    where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
      and t.table_name not in ('clubs', 'profiles', 'platform_audit_log', 'plans')
      and not exists (
        select 1 from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = t.table_name and c.column_name = 'club_id'
      )
  ),
  'every table except clubs, profiles, plans and the platform audit carries club_id');

select test.check(
  not exists (
    select 1 from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'club_id' and c.is_nullable = 'YES'
      and c.table_name not in ('profiles', 'platform_audit_log', 'plans')
  ),
  'club_id is NOT NULL on every club-scoped table');

select test.act_as_server();

-- ---------------------------------------------------------------------------
-- 6. Plans: limits hold in the database; billing rows stay inside the club
-- ---------------------------------------------------------------------------
select test.act_as_server();

-- Club B goes on the Beach plan: ten instructors, a hundred payments a month.
insert into public.club_subscriptions (club_id, plan_key, status, provider, provider_subscription_id)
values (:'club_b', 'beach', 'active', 'mock', 'mock_sub_b');

do $$
declare i integer;
begin
  -- b2 is already an instructor; add nine more to reach ten
  for i in 1..9 loop
    insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
      (('b2222222-2222-2222-2222-2222222222' || lpad(i::text, 2, '0'))::uuid,
       'coach' || i || '@reef.local',
       format('{"role":"instructor","club_id":"%s","full_name":"Coach %s"}',
              (select id from public.clubs where slug = 'reef-riders'), i)::jsonb, '{}');
  end loop;
end $$;
select test.check(
  (select count(*) from public.profiles where club_id = :'club_b' and role = 'instructor' and is_active) = 10,
  'a Beach Vibes club can hold ten instructors');
select test.rejects(
  format($sql$ insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
    ('b2222222-2222-2222-2222-222222222299', 'coach99@reef.local',
     '{"role":"instructor","club_id":"%s","full_name":"Coach 99"}', '{}') $sql$, :'club_b'),
  'the eleventh instructor is refused, with the plan named');
select test.rejects(
  $sql$ update public.profiles set role = 'instructor' where id = 'b4444444-4444-4444-4444-444444444444' $sql$,
  'promoting a member to instructor counts against the same limit');

-- Club A (unlimited, surfing) is untouched by club B's plan.
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('a2222222-2222-2222-2222-222222222211', 'extra-coach@test.local',
   format('{"role":"instructor","club_id":"%s","full_name":"Extra Coach"}', :'club_a')::jsonb, '{}');
select test.check(
  (select role from public.profiles where id = 'a2222222-2222-2222-2222-222222222211') = 'instructor',
  'another club''s limit does not apply here');

-- payments per month: fill the Beach allowance, then one more
do $$
declare i integer; v_club uuid := (select id from public.clubs where slug = 'reef-riders');
begin
  for i in 1..100 loop
    insert into public.payments (club_id, client_id, kind, amount_cents, currency, status, provider)
    values (v_club, 'b4444444-4444-4444-4444-444444444444', 'tip', 1000, 'ILS', 'succeeded', 'mock');
  end loop;
end $$;
select test.rejects(
  format($sql$ insert into public.payments (club_id, client_id, kind, amount_cents, currency, status, provider)
        values ('%s', 'b4444444-4444-4444-4444-444444444444', 'tip', 1000, 'ILS', 'pending', 'mock') $sql$, :'club_b'),
  'the hundred-and-first payment in a month is refused on Beach Vibes');

-- A club's administrator sees only their own subscription and payout account.
select test.act_as('11111111-1111-1111-1111-111111111111');
select test.check(
  (select count(*) from public.club_subscriptions) = 1
  and (select club_id from public.club_subscriptions) = :'club_a',
  'an administrator sees exactly their own club''s subscription');
select test.check(
  (select count(*) from public.club_payment_accounts where club_id <> :'club_a') = 0,
  'an administrator sees no other club''s payout account');

-- Legal acceptance: own rows only, and never rewritten.
select test.act_as('b4444444-4444-4444-4444-444444444444');
insert into public.legal_acceptances (user_id, document_key, version) values ('b4444444-4444-4444-4444-444444444444', 'terms', '2026-09-1');
select test.check(
  (select count(*) from public.legal_acceptances where user_id = 'b4444444-4444-4444-4444-444444444444') = 1,
  'a member records their own acceptance');
select test.rejects(
  $sql$ insert into public.legal_acceptances (user_id, document_key, version)
        values ('b2222222-2222-2222-2222-222222222222', 'terms', '2026-09-1') $sql$,
  'a member cannot record an acceptance for somebody else');
select test.rejects(
  $sql$ update public.legal_acceptances set version = 'other' where user_id = 'b4444444-4444-4444-4444-444444444444' $sql$,
  'an acceptance cannot be altered');
select test.act_as('11111111-1111-1111-1111-111111111111');
select test.check(
  (select count(*) from public.legal_acceptances) = 0,
  'a club A administrator sees no club B acceptance');

-- The operator: billing and money per club, still not one payment row.
select test.act_as('99999999-9999-9999-9999-999999999999');
select test.check(
  (select count(*) from public.club_subscriptions) >= 2,
  'the operator sees every club''s subscription');
select test.check(
  (select gross_cents from public.platform_club_finance where club_id = :'club_b') = 100000,
  'the operator sees a club''s monthly totals');
select test.check(
  (select count(*) from public.payments) = 0,
  'the operator still reads no individual payment');
select test.check(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'platform_club_finance'
      and column_name ~ 'client|email|phone|name'
  ),
  'the operator''s finance view names no client');

select test.act_as_server();
