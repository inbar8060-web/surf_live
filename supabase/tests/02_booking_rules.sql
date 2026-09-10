-- =============================================================================
-- 02  Booking rules: pricing, capacity, re-approval, who may decide
-- =============================================================================
\set ON_ERROR_STOP on
\set QUIET on

select test.act_as_server();

-- A session next week, capacity 2, taught by Maya.
insert into public.time_slots (id, service_id, starts_at, ends_at, capacity, location)
select 'aaaaaaaa-0000-0000-0000-000000000001',
       s.id, now() + interval '7 days', now() + interval '7 days 90 minutes', 2, 'Main beach'
from public.services s where s.name = 'Beginner group lesson';

insert into public.time_slot_instructors (slot_id, instructor_id, is_lead)
values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', true);

-- ---------------------------------------------------------------------------
-- The price and the status are decided by the server, not by the caller
-- ---------------------------------------------------------------------------
select test.act_as('44444444-4444-4444-4444-444444444444');

insert into public.reservations (id, slot_id, client_id, participants, status, price_cents)
values ('bbbbbbbb-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000001',
        '44444444-4444-4444-4444-444444444444',
        2, 'approved', 1);   -- a forged "already approved, costs 1 agora"

select test.check(
  (select status from public.reservations where id = 'bbbbbbbb-0000-0000-0000-000000000001') = 'pending',
  'a booking sent as "approved" is forced back to pending');

select test.check(
  (select price_cents from public.reservations where id = 'bbbbbbbb-0000-0000-0000-000000000001') = 36000,
  'the price is recomputed server-side (2 x 18000), ignoring the posted amount');

-- ---------------------------------------------------------------------------
-- Capacity is enforced
-- ---------------------------------------------------------------------------
select test.act_as('55555555-5555-5555-5555-555555555555');

select test.rejects(
  $sql$ insert into public.reservations (slot_id, client_id, participants)
        values ('aaaaaaaa-0000-0000-0000-000000000001',
                '55555555-5555-5555-5555-555555555555', 1) $sql$,
  'the session cannot be oversold beyond its capacity');

-- ---------------------------------------------------------------------------
-- Only the instructor assigned to the session may decide its requests
-- ---------------------------------------------------------------------------
select test.act_as('33333333-3333-3333-3333-333333333333');   -- Dan, not on this session

do $$
declare n integer;
begin
  update public.reservations set status = 'approved'
  where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  perform test.check(n = 0, 'an instructor cannot decide a request on someone else''s session');
end $$;

select test.check(
  (select count(*) from public.reservations) = 0,
  'an unassigned instructor cannot even see the request');

select test.act_as('22222222-2222-2222-2222-222222222222');   -- Maya, the lead

select test.check(
  (select count(*) from public.reservations) = 1,
  'the assigned instructor can see the request');

update public.reservations set status = 'approved'
where id = 'bbbbbbbb-0000-0000-0000-000000000001';

select test.check(
  (select status from public.reservations where id = 'bbbbbbbb-0000-0000-0000-000000000001') = 'approved',
  'the assigned instructor can approve it');

select test.check(
  (select decided_by from public.reservations where id = 'bbbbbbbb-0000-0000-0000-000000000001')
    = '22222222-2222-2222-2222-222222222222'
  and (select decided_at from public.reservations where id = 'bbbbbbbb-0000-0000-0000-000000000001') is not null,
  'the decision is stamped with who made it and when');

-- ---------------------------------------------------------------------------
-- A member changing an approved booking sends it back for re-approval
-- ---------------------------------------------------------------------------
select test.act_as('44444444-4444-4444-4444-444444444444');

update public.reservations set participants = 1
where id = 'bbbbbbbb-0000-0000-0000-000000000001';

select test.check(
  (select status from public.reservations where id = 'bbbbbbbb-0000-0000-0000-000000000001') = 'pending',
  'changing an approved booking returns it to pending');

select test.check(
  (select revision from public.reservations where id = 'bbbbbbbb-0000-0000-0000-000000000001') = 2,
  'the revision number is bumped so staff can see it changed');

select test.check(
  (select price_cents from public.reservations where id = 'bbbbbbbb-0000-0000-0000-000000000001') = 18000,
  'the price is recalculated for the new number of places');

select test.check(
  (select decided_by from public.reservations where id = 'bbbbbbbb-0000-0000-0000-000000000001') is null,
  'the previous decision is cleared');

-- A member cannot approve their own booking.
select test.rejects(
  $sql$ update public.reservations set status = 'approved'
        where id = 'bbbbbbbb-0000-0000-0000-000000000001' $sql$,
  'a member cannot approve their own booking');

-- ---------------------------------------------------------------------------
-- Members are isolated from each other
-- ---------------------------------------------------------------------------
select test.act_as('55555555-5555-5555-5555-555555555555');

select test.check(
  (select count(*) from public.reservations) = 0,
  'a member cannot see another member''s bookings');

select test.check(
  (select count(*) from public.my_bookings) = 0,
  'the my_bookings view is scoped to the caller');

-- ---------------------------------------------------------------------------
-- The catalog view reflects the seats already taken
-- ---------------------------------------------------------------------------
select test.check(
  (select seats_taken from public.slot_catalog
   where slot_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 1,
  'slot_catalog reports the seats already taken');

-- The member-facing view must not carry staff columns at all: not hidden by a
-- policy, simply absent from the projection.
select test.check(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'slot_catalog'
      and column_name in ('whatsapp_group_url', 'notes', 'block_reason', 'created_by')
  ),
  'slot_catalog does not carry staff-only columns at all');

select test.act_as_server();
