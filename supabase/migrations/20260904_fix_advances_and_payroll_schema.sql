-- ============================================================
-- Migration: 20260904_fix_advances_and_payroll_schema.sql
-- Description:
--   1. Adds missing columns to advances (date, amount, currency, reason, etc.)
--   2. Creates fine_penalties table if not exists with RLS
--   3. Adds missing columns to driver_salaries (amount, currency, period_start, period_end, etc.)
--   4. Adds missing columns to treasury_transactions (reference, created_by, reconciliation_status)
--   5. Reloads PostgREST schema cache
-- ============================================================

-- 1. Ensure columns exist on advances table
ALTER TABLE IF EXISTS public.advances
ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'MAD',
ADD COLUMN IF NOT EXISTS reason TEXT,
ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS extra_advances NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS driver_allowance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS receipt_expenses NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cmr_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS unloading_date_export TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS unloading_date_import TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- Backfill date from created_at if date is null
UPDATE public.advances
SET date = created_at
WHERE date IS NULL;

-- Backfill currency if null
UPDATE public.advances
SET currency = 'MAD'
WHERE currency IS NULL;

-- Backfill is_deleted if null
UPDATE public.advances
SET is_deleted = false
WHERE is_deleted IS NULL;

-- Create index on advances for faster payroll lookups
CREATE INDEX IF NOT EXISTS idx_advances_driver_date ON public.advances(driver_id, date);
CREATE INDEX IF NOT EXISTS idx_advances_date ON public.advances(date);

-- 2. Create fine_penalties table if not exists
CREATE TABLE IF NOT EXISTS public.fine_penalties (
  id BIGSERIAL PRIMARY KEY,
  driver_id BIGINT REFERENCES public.drivers(id) ON DELETE SET NULL,
  driver_name TEXT,
  advance_id BIGINT,
  trip_order_id BIGINT,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'MAD',
  fine_type VARCHAR(100) DEFAULT 'violation',
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  deducted_from_settlement BOOLEAN DEFAULT false,
  deducted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on fine_penalties
ALTER TABLE public.fine_penalties ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins full access on fine_penalties'
  ) THEN
    CREATE POLICY "Admins full access on fine_penalties"
      ON public.fine_penalties FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Secretaries manage fine_penalties'
  ) THEN
    CREATE POLICY "Secretaries manage fine_penalties"
      ON public.fine_penalties FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'secretary')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Drivers read own fine_penalties'
  ) THEN
    CREATE POLICY "Drivers read own fine_penalties"
      ON public.fine_penalties FOR SELECT
      USING (
        driver_id IN (
          SELECT id FROM drivers WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 3. Ensure columns exist on driver_salaries table
ALTER TABLE IF EXISTS public.driver_salaries
ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'MAD',
ADD COLUMN IF NOT EXISTS period_start DATE,
ADD COLUMN IF NOT EXISTS period_end DATE,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'settled',
ADD COLUMN IF NOT EXISTS created_by UUID,
ADD COLUMN IF NOT EXISTS advance_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_driver_salaries_driver_period ON public.driver_salaries(driver_id, period_start, period_end);

-- 4. Ensure columns exist on treasury_transactions table
ALTER TABLE IF EXISTS public.treasury_transactions
ADD COLUMN IF NOT EXISTS reference TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID,
ADD COLUMN IF NOT EXISTS reconciliation_status VARCHAR(50) DEFAULT 'unreconciled';

-- 5. Refresh PostgREST schema cache so changes take effect immediately
NOTIFY pgrst, 'reload schema';

