-- Migration: Add fuel_consumption_rate column to public.trucks table
-- Description: Configurable fuel consumption rate per truck (e.g. 36% / 36 L/100km), adjustable manually or via tracked fuel consumption analytics.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trucks'
      AND column_name = 'fuel_consumption_rate'
  ) THEN
    ALTER TABLE public.trucks
    ADD COLUMN fuel_consumption_rate DECIMAL(5,2) DEFAULT 36.00;
  END IF;
END $$;

-- Update existing records to default 36.00 if null
UPDATE public.trucks
SET fuel_consumption_rate = 36.00
WHERE fuel_consumption_rate IS NULL;

COMMENT ON COLUMN public.trucks.fuel_consumption_rate IS 'Target/configured fuel consumption rate in L/100km or % (default 36.00), modifiable after real fuel tracking.';
