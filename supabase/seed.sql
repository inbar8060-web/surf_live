-- =============================================================================
-- Development seed. Safe to re-run: every insert is keyed and idempotent.
-- Accounts are NOT created here — run `npm run seed:users` (scripts/seed-users.ts)
-- so that GoTrue hashes the passwords properly.
-- =============================================================================

-- Everything below is seeded into the first club. A second club starts empty:
-- its administrator builds its own catalogue, which is the point of tenancy.

update public.club_settings
set club_name = 'Surfer Live',
    timezone = 'Asia/Jerusalem',
    currency = 'ILS',
    spot_name = 'Hilton Beach, Tel Aviv',
    spot_latitude = 32.08800,
    spot_longitude = 34.76800
where club_id = (select id from public.clubs where slug = 'surfer-live');

insert into public.categories (club_id, name, slug, kind, description, sort_order) values
  ((select id from public.clubs where slug = 'surfer-live'), 'Group lessons',      'group-lessons',      'lesson',  'Small groups, all levels', 10),
  ((select id from public.clubs where slug = 'surfer-live'), 'Private lessons',    'private-lessons',    'lesson',  'One instructor, one surfer', 20),
  ((select id from public.clubs where slug = 'surfer-live'), 'Kids club',          'kids-club',          'lesson',  'Ages 7-14', 30),
  ((select id from public.clubs where slug = 'surfer-live'), 'Board rental',       'board-rental',       'rental',  'Soft-tops, funboards, shortboards', 40),
  ((select id from public.clubs where slug = 'surfer-live'), 'Wetsuit rental',     'wetsuit-rental',     'rental',  'Full suits and shorties', 50)
on conflict (club_id, slug) do nothing;

insert into public.services (club_id, category_id, name, description, duration_minutes, default_capacity, price_cents, min_level)
select c.club_id, c.id, v.name, v.description, v.duration, v.capacity, v.price, v.min_level::public.skill_level
from (values
  ('group-lessons',   'Beginner group lesson', 'Whitewater, board handling, first rides', 90,  8, 18000, null),
  ('group-lessons',   'Improver group lesson', 'Green waves, turning, positioning',       120, 6, 22000, 'intermediate'),
  ('private-lessons', 'Private lesson',        'Fully tailored 1:1 coaching',             60,  1, 45000, null),
  ('kids-club',       'Kids surf session',     'Play-led session for 7-14 year olds',     90, 10, 15000, null)
) as v(slug, name, description, duration, capacity, price, min_level)
join public.categories c on c.slug = v.slug
where not exists (select 1 from public.services s where s.name = v.name);

insert into public.package_templates (club_id, category_id, name, description, lessons_count, price_cents, validity_days)
select c.club_id, c.id, v.name, v.description, v.lessons, v.price, v.days
from (values
  ('group-lessons',   'Starter pack - 5 lessons',  'Five group lessons, use within 6 months', 5,  80000, 180),
  ('group-lessons',   'Season pack - 10 lessons',  'Ten group lessons, use within a year',   10, 150000, 365),
  ('private-lessons', 'Private pack - 5 lessons',  'Five private lessons',                    5, 200000, 365)
) as v(slug, name, description, lessons, price, days)
join public.categories c on c.slug = v.slug
where not exists (select 1 from public.package_templates t where t.name = v.name);

insert into public.inventory_types (club_id, category_id, name, kind, brand, size_label, daily_price_cents)
select c.club_id, c.id, v.name, v.kind, v.brand, v.size, v.price
from (values
  ('board-rental',   'Soft-top 8''0"',   'board',   'Torq',     '8''0"', 12000),
  ('board-rental',   'Funboard 7''2"',   'board',   'NSP',      '7''2"', 14000),
  ('board-rental',   'Shortboard 6''0"', 'board',   'Lost',     '6''0"', 16000),
  ('wetsuit-rental', 'Full suit 3/2 M',  'wetsuit', 'Rip Curl', 'M',      6000),
  ('wetsuit-rental', 'Full suit 3/2 L',  'wetsuit', 'Rip Curl', 'L',      6000)
) as v(slug, name, kind, brand, size, price)
join public.categories c on c.slug = v.slug
where not exists (select 1 from public.inventory_types t where t.name = v.name);

-- Give every type a starting stock of 6 units.
-- The running number is per PREFIX rather than per type: several types can
-- shorten to the same four letters, and asset_tag is unique across the club.
do $$
declare r record; have integer; seq integer; tag text;
begin
  for r in select id, club_id, name from public.inventory_types order by name loop
    select count(*) into have from public.inventory_items where type_id = r.id;
    tag := upper(left(regexp_replace(r.name, '[^a-zA-Z0-9]', '', 'g'), 4));

    select coalesce(max(nullif(regexp_replace(asset_tag, '^.*-', ''), '')::int), 0)
      into seq
    from public.inventory_items
    where asset_tag ~ ('^' || tag || '-[0-9]+$');

    while have < 6 loop
      have := have + 1;
      seq  := seq + 1;
      insert into public.inventory_items (club_id, type_id, asset_tag)
      values (r.club_id, r.id, tag || '-' || lpad(seq::text, 4, '0'));
    end loop;
  end loop;
end $$;

-- The seeded club is on the top plan with payouts connected, so the demo
-- administrator lands on the desk rather than in onboarding. Both rows are the
-- development provider's — nothing here talks to a real payment service.
insert into public.club_subscriptions (club_id, plan_key, status, provider, provider_subscription_id, current_period_start, current_period_end)
select id, 'surfing', 'active', 'mock', 'mock_sub_surfer-live', date_trunc('month', now()), date_trunc('month', now()) + interval '1 month'
from public.clubs where slug = 'surfer-live'
on conflict (club_id) do nothing;

insert into public.club_payment_accounts (club_id, provider, account_id, country, default_currency, charges_enabled, payouts_enabled, details_submitted, status)
select id, 'mock', 'mock_acct_surfer-live', 'IL', 'ILS', true, true, true, 'active'
from public.clubs where slug = 'surfer-live'
on conflict (club_id) do nothing;
