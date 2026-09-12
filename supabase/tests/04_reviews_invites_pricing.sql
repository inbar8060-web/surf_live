-- =============================================================================
-- 04  Reviews and confidentiality, invites, price history, scheduling guards
-- =============================================================================
\set ON_ERROR_STOP on
\set QUIET on

select test.act_as_server();

-- Noa's booking on session 1 is approved, so she counts as having attended.
update public.reservations set status = 'approved'
where id = 'bbbbbbbb-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------------
-- Only someone who attended may review the session
-- ---------------------------------------------------------------------------
select test.act_as('55555555-5555-5555-5555-555555555555');   -- Tom, did not attend

select test.rejects(
  $sql$ insert into public.session_reviews (slot_id, client_id, author_display_name, rating, body)
        values ('aaaaaaaa-0000-0000-0000-000000000001',
                '55555555-5555-5555-5555-555555555555', 'Tom', 5, 'was not there') $sql$,
  'a member cannot review a session they did not attend');

select test.rejects(
  $sql$ insert into public.session_reviews (slot_id, client_id, author_display_name, rating, body)
        values ('aaaaaaaa-0000-0000-0000-000000000001',
                '44444444-4444-4444-4444-444444444444', 'Noa', 1, 'posted as someone else') $sql$,
  'a member cannot post a review in another member''s name');

-- ---------------------------------------------------------------------------
-- The attendee can, and the display name is stamped by the server
-- ---------------------------------------------------------------------------
select test.act_as('44444444-4444-4444-4444-444444444444');

insert into public.session_reviews (slot_id, client_id, author_display_name, rating, title, body)
values ('aaaaaaaa-0000-0000-0000-000000000001',
        '44444444-4444-4444-4444-444444444444',
        'Definitely The Admin', 5, 'Great first lesson', 'Patient and clear.');

select test.check(
  (select author_display_name from public.session_reviews
   where client_id = '44444444-4444-4444-4444-444444444444') = 'Noa',
  'the author name is stamped from the profile, not taken from the request');

select test.check(
  (select count(*) from public.session_reviews
   where slot_id = 'aaaaaaaa-0000-0000-0000-000000000001'
     and client_id = '44444444-4444-4444-4444-444444444444') = 1,
  'the review is stored');

select test.rejects(
  $sql$ insert into public.session_reviews (slot_id, client_id, author_display_name, rating)
        values ('aaaaaaaa-0000-0000-0000-000000000001',
                '44444444-4444-4444-4444-444444444444', 'Noa', 1) $sql$,
  'a member cannot review the same session twice');

-- ---------------------------------------------------------------------------
-- The wall is public to members; moderation is not
-- ---------------------------------------------------------------------------
select test.act_as('55555555-5555-5555-5555-555555555555');

select test.check(
  (select count(*) from public.public_session_reviews) = 1,
  'another member can read the published review on the wall');

select test.act_as('44444444-4444-4444-4444-444444444444');

update public.session_reviews set is_published = false, hidden_reason = 'hiding my own bad review'
where client_id = '44444444-4444-4444-4444-444444444444';

select test.check(
  (select is_published from public.session_reviews
   where client_id = '44444444-4444-4444-4444-444444444444') = true,
  'a member cannot unpublish or moderate their own review');

-- ---------------------------------------------------------------------------
-- Private feedback about an instructor is invisible to that instructor
-- ---------------------------------------------------------------------------
insert into public.instructor_reviews (client_id, instructor_id, reservation_id, rating, body)
values ('44444444-4444-4444-4444-444444444444',
        '22222222-2222-2222-2222-222222222222',
        'bbbbbbbb-0000-0000-0000-000000000001', 2, 'Turned up late twice.');

select test.check(
  (select count(*) from public.instructor_reviews) = 0,
  'even the author cannot read back private feedback (admin eyes only)');

select test.act_as('22222222-2222-2222-2222-222222222222');
select test.check(
  (select count(*) from public.instructor_reviews) = 0,
  'the instructor being reviewed cannot read the feedback about them');

select test.act_as('11111111-1111-1111-1111-111111111111');
select test.check(
  (select count(*) from public.instructor_reviews) = 1,
  'an administrator can read it');

-- An instructor cannot review themselves well to game the record.
select test.act_as('22222222-2222-2222-2222-222222222222');
select test.rejects(
  $sql$ insert into public.instructor_reviews (client_id, instructor_id, rating)
        values ('44444444-4444-4444-4444-444444444444',
                '22222222-2222-2222-2222-222222222222', 5) $sql$,
  'an instructor cannot file feedback on behalf of a member');

-- ---------------------------------------------------------------------------
-- Registration invites
-- ---------------------------------------------------------------------------
select test.act_as_server();

insert into public.registration_invites (club_id, token_hash, role, email, expires_at, created_by)
values ((select club_id from public.profiles where id = '11111111-1111-1111-1111-111111111111'), encode(extensions.digest('a-test-token', 'sha256'), 'hex'), 'client', 'new@test.local',
        now() + interval '3 days', '11111111-1111-1111-1111-111111111111');

select test.act_as('44444444-4444-4444-4444-444444444444');
select test.check(
  (select count(*) from public.registration_invites) = 0,
  'a member cannot enumerate registration links');

select test.act_as('22222222-2222-2222-2222-222222222222');
select test.check(
  (select count(*) from public.registration_invites) = 0,
  'an instructor cannot enumerate registration links either');

select test.act_as('11111111-1111-1111-1111-111111111111');
select test.check(
  (select count(*) from public.registration_invites) = 1,
  'an administrator can see the open invitations');

select test.check(
  (select token_hash from public.registration_invites) ~ '^[0-9a-f]{64}$',
  'only the hash of the token is stored, never the token itself');

-- ---------------------------------------------------------------------------
-- Price changes are recorded automatically
-- ---------------------------------------------------------------------------
select id as svc_id from public.services where name = 'Beginner group lesson' \gset

update public.services set price_cents = 19500 where id = :'svc_id';

select test.check(
  (select count(*) from public.price_history
   where entity_type = 'service' and entity_id = :'svc_id'
     and old_price_cents = 18000 and new_price_cents = 19500) = 1,
  'changing a price appends the old and new figures to price_history');

select test.act_as('44444444-4444-4444-4444-444444444444');
select test.check(
  (select count(*) from public.price_history) = 0,
  'members cannot read the pricing history');

-- ---------------------------------------------------------------------------
-- Scheduling guards
-- ---------------------------------------------------------------------------
select test.act_as_server();

-- An instructor cannot be in two places at once.
insert into public.time_slots (id, club_id, service_id, starts_at, ends_at, capacity)
values ('aaaaaaaa-0000-0000-0000-000000000003', (select club_id from public.services where id = :'svc_id'), :'svc_id',
        now() + interval '7 days 30 minutes', now() + interval '7 days 120 minutes', 5);

select test.rejects(
  $sql$ insert into public.time_slot_instructors (slot_id, instructor_id)
        values ('aaaaaaaa-0000-0000-0000-000000000003',
                '22222222-2222-2222-2222-222222222222') $sql$,
  'an instructor cannot be assigned to two overlapping sessions');

-- Cancelling a session releases the bookings on it.
select test.check(
  (select status from public.reservations where id = 'bbbbbbbb-0000-0000-0000-000000000001') = 'approved',
  'the booking is approved before the session is cancelled');

update public.time_slots set status = 'cancelled'
where id = 'aaaaaaaa-0000-0000-0000-000000000001';

select test.check(
  (select status from public.reservations where id = 'bbbbbbbb-0000-0000-0000-000000000001') = 'cancelled',
  'cancelling a session cancels the live bookings on it');

-- A blocked session disappears from the members' catalogue.
select test.check(
  (select count(*) from public.slot_catalog
   where slot_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0,
  'a cancelled session is off the members'' booking list');

select test.act_as_server();
