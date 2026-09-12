-- ==============================================================================
-- Migration: 20260923_add_user_id_to_company_devices.sql
-- Description: Add user_id column to company_devices for user-device scoping,
--              update RLS policies, and add index for performance.
-- ==============================================================================

BEGIN;

-- 1. Add user_id column to company_devices
ALTER TABLE public.company_devices
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. Add index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_company_devices_user_id ON public.company_devices(user_id);

-- 3. Update RLS policies to include user_id scoping
-- Users can view devices of their company OR their own devices
DROP POLICY IF EXISTS "Users can view devices of their company" ON public.company_devices;
CREATE POLICY "Users can view devices of their company"
  ON public.company_devices
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.current_company_id() 
    OR public.is_company_admin()
    OR user_id = auth.uid()
  );

-- Users can manage their own devices OR company admin can manage all company devices
DROP POLICY IF EXISTS "Admins can manage company devices" ON public.company_devices;
CREATE POLICY "Admins can manage company devices"
  ON public.company_devices
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    OR company_id = public.current_company_id() 
    OR public.is_company_admin()
  )
  WITH CHECK (
    user_id = auth.uid()
    OR company_id = public.current_company_id() 
    OR public.is_company_admin()
  );

COMMIT;
