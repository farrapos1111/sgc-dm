-- Remove overload ambígua: a versão com _starts_on DEFAULT NULL já cobre o caso de 3 args.
-- PostgREST/supabase-js falhava com:
-- "Could not choose the best candidate function between transfer_region_office(...)"

DROP FUNCTION IF EXISTS public.transfer_region_office(uuid, public.org_role, uuid);
