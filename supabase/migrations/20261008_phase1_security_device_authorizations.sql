-- ==============================================================================
-- Migration: 20261008_phase1_security_device_authorizations.sql
-- Description: Phase 1: Security Hardening, Device Binding Authorizations View,
--              Multi-Tenant JWT Claims Isolation, and Enhanced RLS Enforcement
-- ==============================================================================

BEGIN;

-- 1. Create or replace view public.device_authorizations
CREATE OR REPLACE VIEW public.device_authorizations AS
SELECT
  id,
  company_id,
  user_id,
  device_id,
  device_name,
  device_type,
  license_number,
  is_active,
  last_active_at,
  created_at
FROM public.company_devices;

-- 2. Enhance current_company_id() to support direct JWT claims and user lookup
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS BIGINT AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true)::json->>'company_id', '')::bigint,
    NULLIF(current_setting('request.jwt.claim.company_id', true), '')::bigint,
    (SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 3. Grant permissions on device_authorizations view
GRANT SELECT ON public.device_authorizations TO authenticated;
GRANT SELECT ON public.device_authorizations TO anon;

-- 4. Re-affirm RLS policy on trip_orders and trips for strict tenant isolation
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trip_orders') THEN
    ALTER TABLE public.trip_orders ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trips') THEN
    ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "tenant_isolation_trips" ON public.trips;
    CREATE POLICY "tenant_isolation_trips" ON public.trips
      FOR ALL
      TO authenticated
      USING (company_id = public.current_company_id())
      WITH CHECK (company_id = public.current_company_id());
  END IF;
END $$;

COMMIT;

