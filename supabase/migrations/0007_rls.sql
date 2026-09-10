-- =============================================================================
-- 0007  Row Level Security
-- =============================================================================
-- Default-deny: every table gets RLS, privileges are revoked wholesale and then
-- granted back per verb. Anything not named below is unreachable with an anon
-- or authenticated JWT, and only reachable by trusted server code holding the
-- service role key.
--
-- FORCE ROW LEVEL SECURITY is deliberately NOT set. Forcing it would subject the
-- table owner to these policies too, and the owner is exactly what the
-- security-definer views in 0008 and the trigger functions in 0006 run as —
-- every policy here is written `TO authenticated`, so none would match the owner
-- and those reads would silently return nothing. Nothing in the application
-- connects as the owner: browser sessions use the anon key plus a user JWT, and
-- server code uses the service role, which bypasses RLS by design and only ever
-- runs behind a role guard.

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','instructors','clients','club_settings','audit_log',
    'categories','services','price_history','time_slots','time_slot_instructors',
    'reservations','package_templates','client_packages','package_ledger',
    'inventory_types','inventory_items','rentals','payments','tips',
    'instructor_reviews','session_reviews','registration_invites'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- profiles
-- Clients cannot change their own personal details by design: no self-update
-- policy exists. Passwords are changed through GoTrue, not this table.
-- ---------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update on public.profiles to authenticated;   -- narrowed by policy below

create policy profiles_select_self on public.profiles
  for select to authenticated using (id = auth.uid());

create policy profiles_select_admin on public.profiles
  for select to authenticated using (app.is_admin());

-- instructors see their colleagues and the clients they actually teach
create policy profiles_select_staff on public.profiles
  for select to authenticated
  using (app.is_instructor() and (role = 'instructor' or app.teaches_client(id)));

create policy profiles_update_admin on public.profiles
  for update to authenticated using (app.is_admin()) with check (app.is_admin());

-- ---------------------------------------------------------------------------
-- instructors
-- ---------------------------------------------------------------------------
-- Privileges are granted COLUMN BY COLUMN, omitting payout_account_ref.
-- A table-wide `grant select` followed by a column-level `revoke` does NOT
-- work in Postgres: the table grant keeps permitting every column, and the
-- revoke silently achieves nothing. Withholding the column is the only way to
-- withhold it, so payout handles never reach a browser session.
grant select (profile_id, bio, specialties, certifications, languages,
              whatsapp_phone, calendar_color, hired_at, created_at, updated_at)
  on public.instructors to authenticated;
grant update (bio, specialties, certifications, languages,
              whatsapp_phone, calendar_color, hired_at)
  on public.instructors to authenticated;
grant insert, delete on public.instructors to authenticated;

create policy instructors_select_all on public.instructors
  for select to authenticated using (true);

create policy instructors_update_self on public.instructors
  for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy instructors_admin_all on public.instructors
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

-- ---------------------------------------------------------------------------
-- clients
-- admin_notes is revoked at column level: staff read it through server code
-- holding the service role, never through a browser session.
-- ---------------------------------------------------------------------------
-- Same rule as above: admin_notes is simply never granted, so it is invisible
-- to every browser session including an administrator's. Staff read and write
-- it through server code holding the service role, behind a role guard.
grant select (profile_id, level, birth_date, emergency_contact_name,
              emergency_contact_phone, medical_notes, waiver_signed_at,
              height_cm, weight_kg, created_at, updated_at)
  on public.clients to authenticated;
grant update (level, birth_date, emergency_contact_name, emergency_contact_phone,
              medical_notes, waiver_signed_at, height_cm, weight_kg)
  on public.clients to authenticated;
grant insert, delete on public.clients to authenticated;

create policy clients_select_self on public.clients
  for select to authenticated using (profile_id = auth.uid());

create policy clients_select_staff on public.clients
  for select to authenticated
  using (app.is_admin() or (app.is_instructor() and app.teaches_client(profile_id)));

create policy clients_admin_all on public.clients
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

-- ---------------------------------------------------------------------------
-- club_settings : readable by everyone signed in, writable by admins
-- ---------------------------------------------------------------------------
grant select on public.club_settings to authenticated, anon;
grant update on public.club_settings to authenticated;

create policy club_settings_read on public.club_settings
  for select to authenticated, anon using (true);
create policy club_settings_write on public.club_settings
  for update to authenticated using (app.is_admin()) with check (app.is_admin());

-- ---------------------------------------------------------------------------
-- catalog : categories and services are public reading material
-- ---------------------------------------------------------------------------
grant select on public.categories, public.services to authenticated, anon;
grant insert, update, delete on public.categories, public.services to authenticated;

create policy categories_read on public.categories
  for select to authenticated, anon using (is_active or app.is_admin() or app.is_instructor());
create policy categories_admin on public.categories
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy services_read on public.services
  for select to authenticated, anon using (is_active or app.is_admin() or app.is_instructor());
create policy services_admin on public.services
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

-- ---------------------------------------------------------------------------
-- price_history : admins only, and append-only by trigger
-- ---------------------------------------------------------------------------
grant select on public.price_history to authenticated;
create policy price_history_admin on public.price_history
  for select to authenticated using (app.is_admin());

-- ---------------------------------------------------------------------------
-- time_slots : staff work on the base table. Clients never touch it directly;
-- they read the slot_catalog / my_bookings views, which project only the
-- columns they are allowed to see.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.time_slots to authenticated;

create policy time_slots_staff_read on public.time_slots
  for select to authenticated using (app.is_admin() or app.is_instructor());
create policy time_slots_admin_write on public.time_slots
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

grant select, insert, update, delete on public.time_slot_instructors to authenticated;

create policy tsi_staff_read on public.time_slot_instructors
  for select to authenticated using (app.is_admin() or app.is_instructor());
create policy tsi_admin_write on public.time_slot_instructors
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

-- ---------------------------------------------------------------------------
-- reservations
--   client    : own rows, may create and may edit (trigger forces re-approval)
--   instructor: rows on slots they are assigned to, may decide them
--   admin     : everything
-- ---------------------------------------------------------------------------
-- staff_note is omitted from SELECT: a member has a policy allowing them to
-- read their own reservation row, and a table-wide grant would hand them the
-- staff's private note on it. Staff read that column through the
-- staff_reservation_queue view instead.
--
-- UPDATE is narrower still. price_cents, revision and the decision fields are
-- set by the trigger in 0006 and are never writable from a request, so no
-- caller can price their own booking or backdate a decision.
grant select (id, slot_id, client_id, status, participants, client_package_id,
              price_cents, currency, payment_id, client_note, rejection_reason,
              revision, decided_by, decided_at, created_at, updated_at)
  on public.reservations to authenticated;
grant update (slot_id, status, participants, client_package_id, client_note,
              rejection_reason)
  on public.reservations to authenticated;
grant insert on public.reservations to authenticated;
grant delete on public.reservations to authenticated;

create policy reservations_select_own on public.reservations
  for select to authenticated using (client_id = auth.uid());
create policy reservations_select_staff on public.reservations
  for select to authenticated using (app.is_admin() or app.teaches_slot(slot_id));

create policy reservations_insert_own on public.reservations
  for insert to authenticated with check (client_id = auth.uid() and app.is_client());

create policy reservations_update_own on public.reservations
  for update to authenticated
  using (client_id = auth.uid()) with check (client_id = auth.uid());

create policy reservations_update_staff on public.reservations
  for update to authenticated
  using (app.is_admin() or app.teaches_slot(slot_id))
  with check (app.is_admin() or app.teaches_slot(slot_id));

create policy reservations_delete_admin on public.reservations
  for delete to authenticated using (app.is_admin());

-- ---------------------------------------------------------------------------
-- packages
-- ---------------------------------------------------------------------------
grant select on public.package_templates to authenticated;
grant insert, update, delete on public.package_templates to authenticated;
create policy package_templates_read on public.package_templates
  for select to authenticated using (is_active or app.is_admin());
create policy package_templates_admin on public.package_templates
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

grant select, insert, update, delete on public.client_packages to authenticated;
create policy client_packages_select_own on public.client_packages
  for select to authenticated using (client_id = auth.uid());
create policy client_packages_select_staff on public.client_packages
  for select to authenticated
  using (app.is_admin() or (app.is_instructor() and app.teaches_client(client_id)));
create policy client_packages_admin on public.client_packages
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

grant select, insert on public.package_ledger to authenticated;
create policy package_ledger_select_own on public.package_ledger
  for select to authenticated
  using (exists (
    select 1 from public.client_packages cp
    where cp.id = client_package_id and cp.client_id = auth.uid()
  ));
create policy package_ledger_admin on public.package_ledger
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

-- ---------------------------------------------------------------------------
-- inventory : staff read, admin write
-- ---------------------------------------------------------------------------
grant select on public.inventory_types, public.inventory_items to authenticated;
grant insert, update, delete on public.inventory_types, public.inventory_items to authenticated;

create policy inventory_types_read on public.inventory_types
  for select to authenticated using (app.is_admin() or app.is_instructor());
create policy inventory_types_admin on public.inventory_types
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy inventory_items_read on public.inventory_items
  for select to authenticated using (app.is_admin() or app.is_instructor());
create policy inventory_items_admin on public.inventory_items
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

-- ---------------------------------------------------------------------------
-- rentals
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.rentals to authenticated;
create policy rentals_select_own on public.rentals
  for select to authenticated using (client_id = auth.uid());
create policy rentals_select_staff on public.rentals
  for select to authenticated using (app.is_admin() or app.is_instructor());
create policy rentals_admin on public.rentals
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

-- ---------------------------------------------------------------------------
-- payments and tips : rows are created by server code only (service role).
-- Clients may read their own history; instructors see tips addressed to them.
-- ---------------------------------------------------------------------------
grant select on public.payments to authenticated;
create policy payments_select_own on public.payments
  for select to authenticated using (client_id = auth.uid());
create policy payments_select_admin on public.payments
  for select to authenticated using (app.is_admin());

grant select on public.tips to authenticated;
create policy tips_select_own on public.tips
  for select to authenticated
  using (client_id = auth.uid() or instructor_id = auth.uid() or app.is_admin());

-- ---------------------------------------------------------------------------
-- reviews
--   instructor_reviews : written by the client, read by admins only.
--                        The reviewed instructor can never read them.
--   session_reviews    : public wall for signed-in clients.
-- ---------------------------------------------------------------------------
grant select, insert on public.instructor_reviews to authenticated;
create policy instructor_reviews_insert_own on public.instructor_reviews
  for insert to authenticated with check (client_id = auth.uid() and app.is_client());
create policy instructor_reviews_select_admin on public.instructor_reviews
  for select to authenticated using (app.is_admin());

grant select, insert, update on public.session_reviews to authenticated;
grant delete on public.session_reviews to authenticated;

create policy session_reviews_read on public.session_reviews
  for select to authenticated using (is_published or client_id = auth.uid() or app.is_admin());
create policy session_reviews_insert_own on public.session_reviews
  for insert to authenticated with check (client_id = auth.uid() and app.is_client());
create policy session_reviews_update_own on public.session_reviews
  for update to authenticated
  using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy session_reviews_admin on public.session_reviews
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

-- ---------------------------------------------------------------------------
-- registration_invites : admins list and revoke them. Redemption happens in a
-- security-definer RPC, so an unauthenticated visitor never selects this table.
-- ---------------------------------------------------------------------------
grant select, update on public.registration_invites to authenticated;
create policy invites_admin on public.registration_invites
  for select to authenticated using (app.is_admin());
create policy invites_admin_update on public.registration_invites
  for update to authenticated using (app.is_admin()) with check (app.is_admin());

-- ---------------------------------------------------------------------------
-- audit_log : admins read, nobody writes through the API
-- ---------------------------------------------------------------------------
grant select on public.audit_log to authenticated;
create policy audit_log_admin on public.audit_log
  for select to authenticated using (app.is_admin());

-- sequences are never needed by browser sessions
revoke all on all sequences in schema public from anon, authenticated;
