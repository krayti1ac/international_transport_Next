-- Ensure drivers table has visa columns
ALTER TABLE IF EXISTS public.drivers
ADD COLUMN IF NOT EXISTS visa_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS visa_expiry_date DATE,
ADD COLUMN IF NOT EXISTS has_valid_visa BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.drivers.visa_number IS 'رقم تأشيرة شنغن أو التأشيرة الدولية للسائق';
COMMENT ON COLUMN public.drivers.visa_expiry_date IS 'تاريخ انتهاء صلاحية التأشيرة';
COMMENT ON COLUMN public.drivers.has_valid_visa IS 'هل التأشيرة سارية المفعول (true إذا كانت هناك صلاحية لم تنته بعد)';

-- Backfill: mark drivers with a valid future expiry
UPDATE public.drivers
SET has_valid_visa = (visa_expiry_date IS NOT NULL AND visa_expiry_date >= CURRENT_DATE)
WHERE has_valid_visa IS NULL;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';