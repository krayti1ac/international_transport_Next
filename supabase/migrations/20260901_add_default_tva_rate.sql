-- Add default_tva_rate to system_settings if it doesn't exist
ALTER TABLE IF EXISTS public.system_settings 
ADD COLUMN IF NOT EXISTS default_tva_rate NUMERIC DEFAULT 20;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
