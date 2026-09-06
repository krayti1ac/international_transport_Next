-- Phase 9: Driver Fines & Risk Management
-- 1. Ensure fine_penalties table exists with all required columns
CREATE TABLE IF NOT EXISTS public.fine_penalties (
  id BIGSERIAL PRIMARY KEY,
  driver_id BIGINT REFERENCES public.drivers(id) ON DELETE SET NULL,
  driver_name TEXT NOT NULL DEFAULT '',
  advance_id BIGINT REFERENCES public.advances(id) ON DELETE SET NULL,
  trip_order_id BIGINT REFERENCES public.trip_orders(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  currency TEXT NOT NULL DEFAULT 'MAD',
  fine_type TEXT NOT NULL DEFAULT 'other',
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  deducted_from_settlement BOOLEAN NOT NULL DEFAULT FALSE,
  deducted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Performance indexes for payroll and trip joins
CREATE INDEX IF NOT EXISTS idx_fines_driver_deducted
  ON public.fine_penalties (driver_id, deducted_from_settlement);

CREATE INDEX IF NOT EXISTS idx_fines_trip_order
  ON public.fine_penalties (trip_order_id);

-- 3. Enable RLS
ALTER TABLE public.fine_penalties ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if they exist
DROP POLICY IF EXISTS "Management manage all fine_penalties" ON public.fine_penalties;
DROP POLICY IF EXISTS "Drivers view their own fine_penalties" ON public.fine_penalties;
DROP POLICY IF EXISTS "Admins full access on fine_penalties" ON public.fine_penalties;
DROP POLICY IF EXISTS "Secretaries manage fine_penalties" ON public.fine_penalties;
DROP POLICY IF EXISTS "Drivers read own fine_penalties" ON public.fine_penalties;

-- 5. Management policy (admin + secretary) via is_management()
CREATE POLICY "Management manage all fine_penalties"
  ON public.fine_penalties FOR ALL
  TO authenticated
  USING (public.is_management())
  WITH CHECK (public.is_management());

-- 6. Drivers can view their own fines
CREATE POLICY "Drivers view their own fine_penalties"
  ON public.fine_penalties FOR SELECT
  TO authenticated
  USING (
    driver_id IN (
      SELECT id FROM public.drivers WHERE user_id = auth.uid()
    )
  );

-- 7. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
