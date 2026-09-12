-- =============================================================================
-- 0015  What the Google Maps listing says about a club
-- =============================================================================
-- A club is created from its Google Maps link. The listing supplies the name,
-- the street address, opening hours, phone and website, and the pin the
-- forecast is read from. Those facts live on club_settings — the club's own
-- row, which its administrator may correct afterwards — and the public ones
-- are handed to visitors through club_public_profile().

alter table public.club_settings
  add column if not exists address       text check (length(address) <= 300),
  add column if not exists website       text check (website ~ '^https?://' and length(website) <= 300),
  -- one line per day, as the listing prints them: ["Monday: 8:00 AM – 6:00 PM", ...]
  add column if not exists opening_hours jsonb not null default '[]'::jsonb
    check (jsonb_typeof(opening_hours) = 'array' and jsonb_array_length(opening_hours) <= 7),
  add column if not exists place_id      text check (length(place_id) <= 200);

-- ---------------------------------------------------------------------------
-- provision_club takes the listing's details in one jsonb argument, so the
-- signature does not grow a column at a time. Every key is optional.
-- ---------------------------------------------------------------------------
drop function if exists public.provision_club(text, text, text, text, text);

create or replace function public.provision_club(
  p_name text, p_slug text, p_maps_url text, p_admin_email text,
  p_timezone text default 'Asia/Jerusalem',
  p_details jsonb default '{}'::jsonb
)
returns public.clubs
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_club  public.clubs;
  v_hours jsonb;
begin
  if not (auth.uid() is null or app.is_super_admin()) then
    raise exception 'Platform operator role required' using errcode = '42501';
  end if;

  v_hours := coalesce(p_details -> 'opening_hours', '[]'::jsonb);
  if jsonb_typeof(v_hours) <> 'array' then v_hours := '[]'::jsonb; end if;

  insert into public.clubs (slug, name, maps_url, admin_email, status, created_by)
  values (p_slug, p_name, nullif(p_maps_url, ''), p_admin_email, 'provisioning', auth.uid())
  returning * into v_club;

  insert into public.club_settings (
    club_id, club_name, timezone, spot_name, spot_latitude, spot_longitude,
    contact_phone, address, website, opening_hours, place_id
  )
  values (
    v_club.id, p_name, p_timezone, p_name,
    coalesce((p_details ->> 'latitude')::numeric,  32.08088),
    coalesce((p_details ->> 'longitude')::numeric, 34.76765),
    nullif(p_details ->> 'phone', ''),
    nullif(p_details ->> 'address', ''),
    nullif(p_details ->> 'website', ''),
    v_hours,
    nullif(p_details ->> 'place_id', '')
  );

  insert into public.platform_audit_log (actor_id, action, club_id, detail)
  values (auth.uid(), 'club.provisioned', v_club.id, jsonb_build_object('slug', p_slug));

  return v_club;
end;
$$;

revoke all on function public.provision_club(text, text, text, text, text, jsonb) from public;
grant execute on function public.provision_club(text, text, text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- The public profile grows the listing's public facts. Contact email, the
-- cancellation window and the rest of the settings row stay private.
-- ---------------------------------------------------------------------------
drop function if exists public.club_public_profile(text);

create or replace function public.club_public_profile(p_slug text)
returns table (
  club_id uuid, slug text, name text, spot_name text, timezone text,
  spot_latitude numeric, spot_longitude numeric, contact_phone text, maps_url text, status text,
  address text, website text, opening_hours jsonb
)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.id, c.slug, c.name, cs.spot_name, cs.timezone, cs.spot_latitude, cs.spot_longitude,
         cs.contact_phone, c.maps_url, c.status::text,
         cs.address, cs.website, coalesce(cs.opening_hours, '[]'::jsonb)
  from public.clubs c
  left join public.club_settings cs on cs.club_id = c.id
  where c.slug = p_slug and c.status in ('active', 'suspended')
$$;

revoke all on function public.club_public_profile(text) from public;
grant execute on function public.club_public_profile(text) to anon, authenticated;
