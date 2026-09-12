-- =============================================================================
-- 0016  Every form of a Google Maps link
-- =============================================================================
-- The Places API hands back the listing's canonical link as
-- https://maps.google.com/?cid=…, which the original rule did not accept — it
-- only knew the /maps path and the two short-link hosts. The rule now matches
-- the parser in src/lib/places/maps-link.ts: the maps.google.<tld> host with
-- any path, the (www.)google.<tld> host on /maps, and the two short-link hosts.

alter table public.clubs drop constraint if exists clubs_maps_url_check;
alter table public.clubs add constraint clubs_maps_url_check check (
  maps_url ~ '^https://maps\.google\.[a-z]{2,3}(\.[a-z]{2})?/' or
  maps_url ~ '^https://(www\.)?google\.[a-z]{2,3}(\.[a-z]{2})?/maps' or
  maps_url ~ '^https://maps\.app\.goo\.gl/' or
  maps_url ~ '^https://goo\.gl/maps/'
);
