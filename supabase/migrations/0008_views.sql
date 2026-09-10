-- =============================================================================
-- 0008  Read models
-- =============================================================================
-- These views run with the definer's rights (the Supabase owner role), so each
-- one carries its own WHERE clause naming exactly who may see the row. They
-- exist so a client can read the parts of a slot, an instructor or a review
-- that concern them, without being granted access to the staff columns on the
-- underlying tables.

-- ---------------------------------------------------------------------------
-- instructor_directory : the safe public face of an instructor
-- ---------------------------------------------------------------------------
create or replace view public.instructor_directory
with (security_barrier = true) as
select
  i.profile_id,
  p.full_name,
  p.avatar_url,
  i.bio,
  i.specialties,
  i.certifications,
  i.languages,
  i.whatsapp_phone,
  i.calendar_color,
  p.is_active
from public.instructors i
join public.profiles p on p.id = i.profile_id
where p.is_active;

grant select on public.instructor_directory to authenticated;

-- ---------------------------------------------------------------------------
-- slot_catalog : bookable sessions, as a client (or a visitor) may see them
-- ---------------------------------------------------------------------------
create or replace view public.slot_catalog
with (security_barrier = true) as
select
  ts.id                                   as slot_id,
  ts.starts_at,
  ts.ends_at,
  ts.location,
  ts.capacity,
  coalesce(booked.seats_taken, 0)         as seats_taken,
  greatest(ts.capacity - coalesce(booked.seats_taken, 0), 0) as seats_left,
  coalesce(ts.price_cents_override, s.price_cents) as price_cents,
  s.currency,
  s.id                                    as service_id,
  s.name                                  as service_name,
  s.description                           as service_description,
  s.duration_minutes,
  s.min_level,
  c.id                                    as category_id,
  c.name                                  as category_name,
  c.slug                                  as category_slug,
  c.kind                                  as category_kind,
  coalesce(staff.names, array[]::text[])  as instructor_names,
  coalesce(staff.ids, array[]::uuid[])    as instructor_ids
from public.time_slots ts
join public.services   s on s.id = ts.service_id
join public.categories c on c.id = s.category_id
left join lateral (
  select sum(r.participants)::int as seats_taken
  from public.reservations r
  where r.slot_id = ts.id and r.status in ('pending', 'approved')
) booked on true
left join lateral (
  select array_agg(p.full_name order by tsi.is_lead desc, p.full_name) as names,
         array_agg(p.id       order by tsi.is_lead desc, p.full_name) as ids
  from public.time_slot_instructors tsi
  join public.profiles p on p.id = tsi.instructor_id
  where tsi.slot_id = ts.id
) staff on true
where ts.status = 'open'
  and s.is_active
  and c.is_active
  and ts.starts_at > now();

grant select on public.slot_catalog to authenticated;

-- ---------------------------------------------------------------------------
-- my_bookings : the caller's own reservations, with everything the client
-- screen needs (including the instructor's WhatsApp number for one-tap chat).
-- ---------------------------------------------------------------------------
create or replace view public.my_bookings
with (security_barrier = true) as
select
  r.id                as reservation_id,
  r.status,
  r.participants,
  r.price_cents,
  r.currency,
  r.client_note,
  r.rejection_reason,
  r.revision,
  r.created_at,
  r.client_package_id,
  ts.id               as slot_id,
  ts.starts_at,
  ts.ends_at,
  ts.location,
  ts.status           as slot_status,
  ts.whatsapp_group_url,
  s.name              as service_name,
  s.duration_minutes,
  c.name              as category_name,
  lead_i.profile_id   as instructor_id,
  lead_i.full_name    as instructor_name,
  lead_i.whatsapp_phone as instructor_whatsapp,
  -- the client may still edit until the club's cancellation window closes
  (ts.starts_at - now())
    > make_interval(hours => (select cancellation_window_hours from public.club_settings where id = 1))
    and r.status in ('pending', 'approved')            as can_modify,
  exists (
    select 1 from public.session_reviews sr
    where sr.slot_id = ts.id and sr.client_id = r.client_id
  )                                                     as has_session_review
from public.reservations r
join public.time_slots ts on ts.id = r.slot_id
join public.services   s  on s.id = ts.service_id
join public.categories c  on c.id = s.category_id
left join lateral (
  select p.id as profile_id, p.full_name, i.whatsapp_phone
  from public.time_slot_instructors tsi
  join public.profiles    p on p.id = tsi.instructor_id
  join public.instructors i on i.profile_id = tsi.instructor_id
  where tsi.slot_id = ts.id
  order by tsi.is_lead desc, p.full_name
  limit 1
) lead_i on true
where r.client_id = auth.uid();

grant select on public.my_bookings to authenticated;

-- ---------------------------------------------------------------------------
-- my_packages / my_rentals
-- ---------------------------------------------------------------------------
create or replace view public.my_packages
with (security_barrier = true) as
select cp.id, cp.name, cp.lessons_total, cp.lessons_remaining, cp.status,
       cp.purchased_at, cp.expires_at, cp.currency, cp.price_cents,
       (cp.status = 'active' and cp.expires_at > now() and cp.lessons_remaining > 0) as is_usable
from public.client_packages cp
where cp.client_id = auth.uid();

grant select on public.my_packages to authenticated;

create or replace view public.my_rentals
with (security_barrier = true) as
select rt.id, rt.start_date, rt.end_date, rt.status, rt.price_cents, rt.currency,
       rt.checked_out_at, rt.returned_at,
       it.asset_tag, ity.name as item_name, ity.kind as item_kind, ity.size_label
from public.rentals rt
join public.inventory_items it on it.id = rt.item_id
join public.inventory_types ity on ity.id = it.type_id
where rt.client_id = auth.uid();

grant select on public.my_rentals to authenticated;

-- ---------------------------------------------------------------------------
-- public_session_reviews : the wall every client can scroll
-- ---------------------------------------------------------------------------
create or replace view public.public_session_reviews
with (security_barrier = true) as
select
  sr.id,
  sr.rating,
  sr.title,
  sr.body,
  sr.author_display_name,
  sr.created_at,
  sr.slot_id,
  ts.starts_at as session_starts_at,
  s.name       as service_name,
  c.name       as category_name
from public.session_reviews sr
join public.time_slots ts on ts.id = sr.slot_id
join public.services   s  on s.id = ts.service_id
join public.categories c  on c.id = s.category_id
where sr.is_published;

grant select on public.public_session_reviews to authenticated;

-- ---------------------------------------------------------------------------
-- staff_slot_overview : instructors may look at every group, read only.
-- ---------------------------------------------------------------------------
create or replace view public.staff_slot_overview
with (security_barrier = true) as
select
  ts.id as slot_id, ts.starts_at, ts.ends_at, ts.status, ts.location,
  ts.capacity, ts.block_reason, ts.notes, ts.whatsapp_group_url,
  s.id as service_id, s.name as service_name, c.name as category_name,
  coalesce(agg.seats_taken, 0)  as seats_taken,
  coalesce(agg.pending_count, 0) as pending_count,
  coalesce(staff.names, array[]::text[]) as instructor_names,
  coalesce(staff.ids, array[]::uuid[])   as instructor_ids,
  (auth.uid() = any(coalesce(staff.ids, array[]::uuid[]))) as is_mine
from public.time_slots ts
join public.services   s on s.id = ts.service_id
join public.categories c on c.id = s.category_id
left join lateral (
  select sum(r.participants) filter (where r.status in ('pending','approved'))::int as seats_taken,
         count(*) filter (where r.status = 'pending')::int as pending_count
  from public.reservations r where r.slot_id = ts.id
) agg on true
left join lateral (
  select array_agg(p.full_name order by tsi.is_lead desc) as names,
         array_agg(p.id order by tsi.is_lead desc)        as ids
  from public.time_slot_instructors tsi
  join public.profiles p on p.id = tsi.instructor_id
  where tsi.slot_id = ts.id
) staff on true
where app.is_admin() or app.is_instructor();

grant select on public.staff_slot_overview to authenticated;

-- ---------------------------------------------------------------------------
-- instructor_roster : the caller's own sessions with client contact details.
-- Powers today's schedule export, the click-to-call list and the WhatsApp
-- group button. Restricted to the instructor teaching the slot, or an admin.
-- ---------------------------------------------------------------------------
create or replace view public.instructor_roster
with (security_barrier = true) as
select
  ts.id as slot_id, ts.starts_at, ts.ends_at, ts.location, ts.status as slot_status,
  ts.whatsapp_group_url, ts.notes as slot_notes,
  s.name as service_name, c.name as category_name,
  r.id as reservation_id, r.status as reservation_status, r.participants,
  r.client_note, r.revision,
  cl.profile_id as client_id, p.full_name as client_name, p.phone as client_phone,
  p.email as client_email, cl.level as client_level,
  cl.medical_notes, cl.emergency_contact_name, cl.emergency_contact_phone,
  cl.waiver_signed_at
from public.time_slots ts
join public.services   s on s.id = ts.service_id
join public.categories c on c.id = s.category_id
join public.time_slot_instructors tsi on tsi.slot_id = ts.id
left join public.reservations r on r.slot_id = ts.id and r.status in ('pending','approved','completed')
left join public.clients  cl on cl.profile_id = r.client_id
left join public.profiles p  on p.id = cl.profile_id
where tsi.instructor_id = auth.uid() or app.is_admin();

grant select on public.instructor_roster to authenticated;

-- ---------------------------------------------------------------------------
-- inventory_overview : type-level stock counts for the admin screen
-- ---------------------------------------------------------------------------
create or replace view public.inventory_overview
with (security_barrier = true) as
select
  ity.id, ity.name, ity.kind, ity.brand, ity.size_label,
  ity.daily_price_cents, ity.currency, ity.is_active, ity.category_id,
  count(it.id)::int                                                  as total_units,
  count(it.id) filter (where it.status = 'available')::int           as available_units,
  count(it.id) filter (where it.status = 'rented')::int              as rented_units,
  count(it.id) filter (where it.status = 'maintenance')::int         as maintenance_units,
  count(it.id) filter (where it.status = 'retired')::int             as retired_units
from public.inventory_types ity
left join public.inventory_items it on it.type_id = ity.id
where app.is_admin() or app.is_instructor()
group by ity.id;

grant select on public.inventory_overview to authenticated;

-- ---------------------------------------------------------------------------
-- staff_reservation_queue : every booking a member of staff may act on, with
-- the client and session details the decision needs.
--
-- Admins see all of them. An instructor sees only bookings on sessions they
-- are assigned to — including, deliberately, sessions that have no instructor
-- yet, which stay visible to admins alone.
-- ---------------------------------------------------------------------------
create or replace view public.staff_reservation_queue
with (security_barrier = true) as
select
  r.id             as reservation_id,
  r.status,
  r.participants,
  r.price_cents,
  r.currency,
  r.client_note,
  r.staff_note,
  r.rejection_reason,
  r.revision,
  r.created_at,
  r.client_package_id,
  ts.id            as slot_id,
  ts.starts_at,
  ts.ends_at,
  ts.location,
  ts.status        as slot_status,
  ts.capacity,
  ts.whatsapp_group_url,
  s.name           as service_name,
  c.name           as category_name,
  p.id             as client_id,
  p.full_name      as client_name,
  p.phone          as client_phone,
  p.email          as client_email,
  cl.level         as client_level,
  cl.medical_notes,
  cl.waiver_signed_at,
  coalesce(staff.names, array[]::text[]) as instructor_names,
  coalesce(staff.ids, array[]::uuid[])   as instructor_ids
from public.reservations r
join public.time_slots ts on ts.id = r.slot_id
join public.services   s  on s.id = ts.service_id
join public.categories c  on c.id = s.category_id
join public.clients   cl  on cl.profile_id = r.client_id
join public.profiles   p  on p.id = cl.profile_id
left join lateral (
  select array_agg(pi.full_name order by tsi.is_lead desc) as names,
         array_agg(pi.id order by tsi.is_lead desc)        as ids
  from public.time_slot_instructors tsi
  join public.profiles pi on pi.id = tsi.instructor_id
  where tsi.slot_id = ts.id
) staff on true
where app.is_admin() or app.teaches_slot(ts.id);

grant select on public.staff_reservation_queue to authenticated;

-- ---------------------------------------------------------------------------
-- Views are read models only. Supabase's default privileges hand new objects in
-- `public` to anon and authenticated, so revoke first and grant back the single
-- verb each one needs.
-- ---------------------------------------------------------------------------
do $$
declare v text;
begin
  foreach v in array array[
    'instructor_directory','slot_catalog','my_bookings','my_packages','my_rentals',
    'public_session_reviews','staff_slot_overview','instructor_roster',
    'inventory_overview','staff_reservation_queue'
  ] loop
    execute format('revoke all on public.%I from anon, authenticated', v);
    execute format('grant select on public.%I to authenticated', v);
  end loop;
end $$;
