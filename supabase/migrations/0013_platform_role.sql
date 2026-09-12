-- =============================================================================
-- 0013  Platform operator role
-- =============================================================================
-- A super administrator runs the platform, not a club. They are deliberately a
-- fourth role rather than a flag on 'admin', so that not one existing policy —
-- every one of which grants an administrator reach into member data — applies
-- to them by accident.
--
-- Postgres refuses to *use* a new enum value in the transaction that added it,
-- and each migration runs as one transaction. That is why this file holds
-- nothing else: the value has to be committed before 0014 can reference it.

alter type public.app_role add value if not exists 'super_admin';
