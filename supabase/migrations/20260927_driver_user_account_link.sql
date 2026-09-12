-- ==============================================================================
-- Migration: 20260927_driver_user_account_link.sql
-- Description: Ensure user_id and company_id exist on public.drivers and are properly indexed
-- ==============================================================================

DO $$
BEGIN
  -- 1. Ensure user_id column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.drivers ADD COLUMN user_id UUID;
  END IF;

  -- 2. Ensure company_id column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE public.drivers ADD COLUMN company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;

  -- 3. Create performance indexes
  CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON public.drivers(user_id);
  CREATE INDEX IF NOT EXISTS idx_drivers_company_id ON public.drivers(company_id);
END $$;

