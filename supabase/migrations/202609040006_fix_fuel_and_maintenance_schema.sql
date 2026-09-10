-- ============================================================
-- Migration: 20260904_fix_fuel_and_maintenance_schema.sql
-- Description:
--   1. Ensures truck_maintenance has both (type, date, notes) and (expense_type, maintenance_date, description)
--   2. Ensures truck_locations has timestamp and recorded_at
--   3. Creates truck_location_history view pointing to truck_locations for backwards compatibility
--   4. Reloads PostgREST schema cache
-- ============================================================

-- 1. Ensure columns exist on truck_maintenance
ALTER TABLE IF EXISTS public.truck_maintenance
ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'fuel',
ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'MAD';

-- Backfill type from expense_type if type is null
UPDATE public.truck_maintenance
SET type = COALESCE(expense_type, 'fuel')
WHERE type IS NULL;

-- Backfill date from maintenance_date if date is null
UPDATE public.truck_maintenance
SET date = COALESCE(maintenance_date, created_at, NOW())
WHERE date IS NULL;

-- Backfill notes from description if notes is null
UPDATE public.truck_maintenance
SET notes = description
WHERE notes IS NULL;

-- 2. Ensure columns exist on truck_locations
ALTER TABLE IF EXISTS public.truck_locations
ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW();

-- Backfill timestamp from recorded_at
UPDATE public.truck_locations
SET timestamp = COALESCE(recorded_at, NOW())
WHERE timestamp IS NULL;

-- 3. Create view for truck_location_history if missing
CREATE OR REPLACE VIEW public.truck_location_history AS
SELECT 
  id,
  truck_id,
  driver_id,
  trip_id,
  latitude,
  longitude,
  speed,
  heading,
  accuracy,
  recorded_at,
  COALESCE(timestamp, recorded_at) AS timestamp
FROM public.truck_locations;

-- 4. Enable RLS and grants on view
GRANT SELECT ON public.truck_location_history TO authenticated;
GRANT SELECT ON public.truck_location_history TO anon;

-- 5. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

