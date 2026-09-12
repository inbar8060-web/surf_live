-- =============================================================================
-- 05  Signing at registration: what is recorded, and what is not
-- =============================================================================
\set ON_ERROR_STOP on
\set QUIET on

select test.act_as_server();

-- ---------------------------------------------------------------------------
-- The table holds no document content at all
-- ---------------------------------------------------------------------------
select test.check(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'document_signatures'
      and column_name in ('body', 'content', 'document', 'pdf', 'signature_image', 'html')
  ),
  'document_signatures has no column that could hold a document or a signature image');

-- ---------------------------------------------------------------------------
-- A member records their own signature
-- ---------------------------------------------------------------------------
select test.act_as('44444444-4444-4444-4444-444444444444');

insert into public.document_signatures (client_id, document_key, version, media_consent)
values ('44444444-4444-4444-4444-444444444444', 'waiver', '2026-09-1', true);

select test.check(
  (select count(*) from public.document_signatures) = 1,
  'a member can record their own signature');

select test.rejects(
  $sql$ insert into public.document_signatures (client_id, document_key, version)
        values ('55555555-5555-5555-5555-555555555555', 'waiver', '2026-09-1') $sql$,
  'a member cannot sign on another member''s behalf');

select test.rejects(
  $sql$ insert into public.document_signatures (client_id, document_key, version)
        values ('44444444-4444-4444-4444-444444444444', 'waiver', '2026-09-1') $sql$,
  'signing the same version twice is refused rather than duplicated');

-- A newer version of the wording is a separate, signable document.
insert into public.document_signatures (client_id, document_key, version)
values ('44444444-4444-4444-4444-444444444444', 'rental_agreement', '2026-09-1');

select test.check(
  (select count(*) from public.document_signatures) = 2,
  'the second required document is recorded separately');

-- ---------------------------------------------------------------------------
-- The record is evidence: it cannot be rewritten or removed
-- ---------------------------------------------------------------------------
select test.rejects(
  $sql$ update public.document_signatures set version = 'backdated'
        where client_id = '44444444-4444-4444-4444-444444444444' and document_key = 'waiver' $sql$,
  'the signed version cannot be altered after the fact');

select test.rejects(
  $sql$ update public.document_signatures set media_consent = false
        where client_id = '44444444-4444-4444-4444-444444444444' and document_key = 'waiver' $sql$,
  'a recorded consent decision cannot be quietly flipped');

select test.rejects(
  $sql$ delete from public.document_signatures
        where client_id = '44444444-4444-4444-4444-444444444444' $sql$,
  'a signature record cannot be deleted');

-- Delivery state is the one thing that may change: an email can be retried.
select test.act_as_server();
update public.document_signatures
set delivered_at = now(),
    document_sha256 = repeat('a', 64)
where client_id = '44444444-4444-4444-4444-444444444444';

select test.check(
  (select count(*) from public.document_signatures where delivered_at is not null) = 2,
  'delivery state can be updated so a failed send can be retried');

-- ---------------------------------------------------------------------------
-- Signing the waiver feeds the flag the staff screens already use
-- ---------------------------------------------------------------------------
select test.check(
  (select waiver_signed_at from public.clients
   where profile_id = '44444444-4444-4444-4444-444444444444') is not null,
  'signing the waiver sets clients.waiver_signed_at for the staff screens');

select test.check(
  (select waiver_signed_at from public.clients
   where profile_id = '55555555-5555-5555-5555-555555555555') is null,
  'a member who has not signed still shows as having no waiver');

-- ---------------------------------------------------------------------------
-- Who can read the record
-- ---------------------------------------------------------------------------
select test.act_as('55555555-5555-5555-5555-555555555555');
select test.check(
  (select count(*) from public.document_signatures) = 0,
  'a member cannot see another member''s signatures');

select test.act_as('22222222-2222-2222-2222-222222222222');
select test.check(
  (select count(*) from public.document_signatures) = 0,
  'an instructor cannot read the signature records');

select test.act_as('11111111-1111-1111-1111-111111111111');
select test.check(
  (select count(*) from public.document_signatures) = 2,
  'an administrator can see who has signed what');

select test.act_as_server();

-- The digest is written once and then fixed.
select test.rejects(
  $sql$ update public.document_signatures set document_sha256 = repeat('b', 64)
        where client_id = '44444444-4444-4444-4444-444444444444' $sql$,
  'the recorded digest cannot be changed once it is set');
