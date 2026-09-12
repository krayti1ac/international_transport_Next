-- ==============================================================================
-- Migration: 20260923_add_device_license_number.sql
-- Description: Add license_number column to company_devices table
--              License number format: TB-{company_id_padded}-{device_id_suffix}-{seq}
-- ==============================================================================

BEGIN;

-- 1. Add license_number column
ALTER TABLE public.company_devices
  ADD COLUMN IF NOT EXISTS license_number TEXT UNIQUE;

-- 2. Create index for fast license lookups
CREATE INDEX IF NOT EXISTS idx_company_devices_license_number
  ON public.company_devices(license_number);

-- 3. Backfill existing devices with generated license numbers
--    Format: TB-{company_id_padded_3}-{device_id_last_4}-{id}
UPDATE public.company_devices
SET license_number = 'TB-' || LPAD(company_id::text, 3, '0') || '-' || UPPER(RIGHT(device_id, 4)) || '-' || LPAD(id::text, 3, '0')
WHERE license_number IS NULL;

COMMIT;
