-- =============================================================================
-- 03  Lesson packages, inventory and rentals
-- =============================================================================
\set ON_ERROR_STOP on
\set QUIET on

select test.act_as_server();

-- ---------------------------------------------------------------------------
-- Attaching a package issues its credits through the ledger
-- ---------------------------------------------------------------------------
select test.act_as('11111111-1111-1111-1111-111111111111');   -- admin

select public.grant_client_package(
  '55555555-5555-5555-5555-555555555555',
  (select id from public.package_templates where name = 'Starter pack - 5 lessons'),
  'Paid at the desk'
) as package_id \gset

select test.check(
  (select lessons_remaining from public.client_packages where id = :'package_id') = 5,
  'attaching a package issues its lessons');

select test.check(
  (select count(*) from public.package_ledger
   where client_package_id = :'package_id' and reason = 'grant') = 1,
  'the credits arrive through the append-only ledger');

-- ---------------------------------------------------------------------------
-- A member cannot help themselves to a package
-- ---------------------------------------------------------------------------
select test.act_as('55555555-5555-5555-5555-555555555555');

select test.rejects(
  format($sql$ select public.grant_client_package(
      '55555555-5555-5555-5555-555555555555', '%s', 'self-service') $sql$,
    (select id from public.package_templates where name = 'Starter pack - 5 lessons')),
  'a member cannot attach a package to themselves');

select test.rejects(
  format($sql$ select public.extend_client_package('%s', 10, 0, 'more please') $sql$, :'package_id'),
  'a member cannot extend their own package');

-- ---------------------------------------------------------------------------
-- Booking with a package: free at the point of use, credit spent on approval
-- ---------------------------------------------------------------------------
select test.act_as_server();

insert into public.time_slots (id, service_id, starts_at, ends_at, capacity)
select 'aaaaaaaa-0000-0000-0000-000000000002',
       s.id, now() + interval '9 days', now() + interval '9 days 90 minutes', 6
from public.services s where s.name = 'Beginner group lesson';

insert into public.time_slot_instructors (slot_id, instructor_id, is_lead)
values ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', true);

select test.act_as('55555555-5555-5555-5555-555555555555');

insert into public.reservations (id, slot_id, client_id, participants, client_package_id)
values ('bbbbbbbb-0000-0000-0000-000000000002',
        'aaaaaaaa-0000-0000-0000-000000000002',
        '55555555-5555-5555-5555-555555555555', 1, :'package_id');

select test.check(
  (select price_cents from public.reservations where id = 'bbbbbbbb-0000-0000-0000-000000000002') = 0,
  'a booking paid from a package costs nothing at the point of booking');

select test.check(
  (select lessons_remaining from public.my_packages where id = :'package_id') = 5,
  'no credit is spent while the request is still pending');

select test.act_as('22222222-2222-2222-2222-222222222222');   -- the instructor approves
update public.reservations set status = 'approved'
where id = 'bbbbbbbb-0000-0000-0000-000000000002';

select test.act_as_server();
select test.check(
  (select lessons_remaining from public.client_packages where id = :'package_id') = 4,
  'approving the booking spends exactly one lesson');

-- Cancelling gives the credit back, once.
update public.reservations set status = 'cancelled'
where id = 'bbbbbbbb-0000-0000-0000-000000000002';

select test.check(
  (select lessons_remaining from public.client_packages where id = :'package_id') = 5,
  'cancelling the booking returns the lesson');

select test.check(
  (select count(*) from public.package_ledger
   where reservation_id = 'bbbbbbbb-0000-0000-0000-000000000002' and reason = 'refund') = 1,
  'the refund is recorded exactly once');

-- ---------------------------------------------------------------------------
-- Extending and dismissing
-- ---------------------------------------------------------------------------
select test.act_as('11111111-1111-1111-1111-111111111111');

select public.extend_client_package(:'package_id', 3, 30, 'goodwill');
select test.check(
  (select lessons_remaining from public.client_packages where id = :'package_id') = 8,
  'extending adds lessons');

select public.cancel_client_package(:'package_id', 'refunded in cash');
select test.check(
  (select status from public.client_packages where id = :'package_id') = 'cancelled'
  and (select lessons_remaining from public.client_packages where id = :'package_id') = 0,
  'dismissing a package writes off what is left');

select test.check(
  (select count(*) from public.package_ledger where client_package_id = :'package_id') = 5,
  'every credit movement is still on the ledger (grant, redeem, refund, extend, revoke)');

-- ---------------------------------------------------------------------------
-- The ledger and the audit trail are append-only
-- ---------------------------------------------------------------------------
select test.act_as_server();

select test.rejects(
  $sql$ update public.package_ledger set delta = 99 where id = (select min(id) from public.package_ledger) $sql$,
  'the package ledger cannot be edited after the fact');

select test.rejects(
  $sql$ delete from public.package_ledger where id = (select min(id) from public.package_ledger) $sql$,
  'the package ledger cannot be deleted from');

insert into public.audit_log (actor_id, actor_role, action, entity)
values ('11111111-1111-1111-1111-111111111111', 'admin', 'test.event', 'test');

select test.rejects(
  $sql$ update public.audit_log set action = 'rewritten' where id = (select min(id) from public.audit_log) $sql$,
  'the audit trail cannot be rewritten');

-- ---------------------------------------------------------------------------
-- Stock levels
-- ---------------------------------------------------------------------------
select test.act_as('11111111-1111-1111-1111-111111111111');

select total_units from public.set_inventory_quantity(
  (select id from public.inventory_types where name = 'Soft-top 8''0"'), 9) \gset

select test.check(:total_units = 9, 'an admin can raise the stock level of a gear type');

-- Capture the id while still acting as an admin: a member cannot read
-- inventory_types at all, and an empty id would make this pass for the wrong
-- reason (a uuid cast error rather than the role check).
select id as softtop_id from public.inventory_types where name = 'Soft-top 8''0"' \gset

select test.act_as('55555555-5555-5555-5555-555555555555');
select test.check(
  (select count(*) from public.inventory_types) = 0,
  'a member cannot read the gear catalogue at all');
select test.rejects(
  format($sql$ select public.set_inventory_quantity('%s', 50) $sql$, :'softtop_id'),
  'a member cannot change stock levels');

-- ---------------------------------------------------------------------------
-- A rental takes the board out of stock until it is handed back
-- ---------------------------------------------------------------------------
select test.act_as_server();

select id from public.inventory_items
where type_id = (select id from public.inventory_types where name = 'Soft-top 8''0"')
  and status = 'available' order by asset_tag limit 1 \gset board_

insert into public.rentals (id, client_id, item_id, start_date, end_date, status)
values ('cccccccc-0000-0000-0000-000000000001',
        '44444444-4444-4444-4444-444444444444', :'board_id',
        current_date, current_date + 3, 'out');

select test.check(
  (select status from public.inventory_items where id = :'board_id') = 'rented',
  'handing a board over takes it out of stock');

select test.check(
  (select price_cents from public.rentals where id = 'cccccccc-0000-0000-0000-000000000001') = 48000,
  'the rental price is derived from the gear type and the number of days (4 x 12000)');

select test.rejects(
  format($sql$ insert into public.rentals (client_id, item_id, start_date, end_date, status)
               values ('55555555-5555-5555-5555-555555555555', '%s',
                       current_date + 1, current_date + 2, 'reserved') $sql$, :'board_id'),
  'the same board cannot be rented to two people over overlapping dates');

update public.rentals set status = 'returned', condition_in = 'good'
where id = 'cccccccc-0000-0000-0000-000000000001';

select test.check(
  (select status from public.inventory_items where id = :'board_id') = 'available',
  'booking the board back in returns it to stock');

-- A board that comes back damaged goes to maintenance, not back on the rack.
insert into public.rentals (id, client_id, item_id, start_date, end_date, status)
values ('cccccccc-0000-0000-0000-000000000002',
        '44444444-4444-4444-4444-444444444444', :'board_id',
        current_date + 10, current_date + 11, 'out');

update public.rentals set status = 'returned', condition_in = 'poor', damage_note = 'cracked nose'
where id = 'cccccccc-0000-0000-0000-000000000002';

select test.check(
  (select status from public.inventory_items where id = :'board_id') = 'maintenance',
  'a board returned in poor condition goes to maintenance');

select test.act_as_server();
