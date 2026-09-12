-- =============================================================================
-- 0012  Signing at registration: waiver and boards rental agreement
-- =============================================================================
-- The signed documents themselves are NOT stored here, or anywhere else in the
-- database. They are rendered in memory at the moment of signing, emailed to
-- the member and to the club, and discarded. The member and the club each hold
-- the only copies.
--
-- What this table records is the *event*: who signed, which document, which
-- version of its wording, when, and whether the email went out. That much is
-- unavoidable — the app has to know whether a member may book or take a board,
-- and the instructor and admin screens already surface "NO WAIVER".
--
-- Two deliberate lines:
--   * document_sha256 is a one-way digest of the emailed PDF, not the PDF. It
--     lets the club prove a copy produced later is the one that was signed.
--   * media_consent is stored because it is a standing permission the club has
--     to honour afterwards. The other form answers (board type) are not stored:
--     they describe the document, and they live in the emailed copy.

-- ---------------------------------------------------------------------------
-- Where the club's copy is sent.
-- ---------------------------------------------------------------------------
alter table public.club_settings
  add column if not exists contact_email extensions.citext;

comment on column public.club_settings.contact_email is
  'Club inbox that receives a copy of every signed document. Falls back to the active administrators when empty.';

-- ---------------------------------------------------------------------------
-- document_signatures
-- ---------------------------------------------------------------------------
create table if not exists public.document_signatures (
  id              bigint generated always as identity primary key,
  client_id       uuid not null references public.clients(profile_id) on delete cascade,
  document_key    text not null check (document_key in ('waiver', 'rental_agreement')),
  -- the version string from the document module, so it is always knowable
  -- which wording was agreed to
  version         text not null check (length(version) between 1 and 40),
  signed_at       timestamptz not null default now(),
  -- standing permission, only meaningful for the waiver
  media_consent   boolean,
  -- sha256 hex of the PDF that was emailed; never the PDF itself
  document_sha256 text check (document_sha256 ~ '^[0-9a-f]{64}$'),
  delivered_at    timestamptz,
  delivery_error  text check (length(delivery_error) <= 500),
  ip              inet,
  user_agent      text,
  created_at      timestamptz not null default now()
);

-- Re-signing the same wording is a no-op rather than a second record.
create unique index if not exists document_signatures_once
  on public.document_signatures (client_id, document_key, version);

create index if not exists document_signatures_client_idx
  on public.document_signatures (client_id, signed_at desc);
create index if not exists document_signatures_undelivered_idx
  on public.document_signatures (signed_at) where delivered_at is null;

-- ---------------------------------------------------------------------------
-- The evidentiary columns are immutable; only delivery state may be updated
-- (an email can be retried, a signature cannot be rewritten).
-- ---------------------------------------------------------------------------
create or replace function app.guard_document_signature()
returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'A signature record cannot be deleted' using errcode = '42501';
  end if;

  if new.client_id    is distinct from old.client_id
     or new.document_key is distinct from old.document_key
     or new.version      is distinct from old.version
     or new.signed_at    is distinct from old.signed_at
     or new.media_consent is distinct from old.media_consent then
    raise exception 'A signature record cannot be altered after the fact'
      using errcode = '42501';
  end if;

  -- The digest is written once, when the copy is actually sent, and is fixed
  -- from then on. It is null until delivery, so it cannot simply be immutable.
  if old.document_sha256 is not null
     and new.document_sha256 is distinct from old.document_sha256 then
    raise exception 'The document digest cannot be changed once recorded'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists document_signatures_immutable on public.document_signatures;
create trigger document_signatures_immutable before update or delete on public.document_signatures
  for each row execute function app.guard_document_signature();

-- ---------------------------------------------------------------------------
-- Keep clients.waiver_signed_at in step, so the screens that already show
-- "NO WAIVER" keep working without knowing about this table.
-- ---------------------------------------------------------------------------
create or replace function app.apply_waiver_signature()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.document_key = 'waiver' then
    update public.clients
    set waiver_signed_at = new.signed_at
    where profile_id = new.client_id
      and (waiver_signed_at is null or waiver_signed_at < new.signed_at);
  end if;
  return new;
end;
$$;

drop trigger if exists document_signatures_apply_waiver on public.document_signatures;
create trigger document_signatures_apply_waiver after insert on public.document_signatures
  for each row execute function app.apply_waiver_signature();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.document_signatures enable row level security;
revoke all on public.document_signatures from anon, authenticated;

grant select, insert on public.document_signatures to authenticated;

-- A member may record their own signature and read back what they have signed.
create policy document_signatures_insert_own on public.document_signatures
  for insert to authenticated
  with check (client_id = auth.uid() and app.is_client());

create policy document_signatures_select_own on public.document_signatures
  for select to authenticated using (client_id = auth.uid());

-- Administrators can see who has signed what. Instructors cannot: they only
-- need the waiver flag, which already reaches them through clients.
create policy document_signatures_select_admin on public.document_signatures
  for select to authenticated using (app.is_admin());

grant execute on all functions in schema app to authenticated, service_role;
