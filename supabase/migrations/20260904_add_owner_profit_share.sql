-- Add owner_profit_share column to system_settings if it doesn't exist
ALTER TABLE IF EXISTS public.system_settings
ADD COLUMN IF NOT EXISTS owner_profit_share NUMERIC DEFAULT 0;

-- Refresh PostgREST schema cache so the new column is visible immediately
NOTIFY pgrst, 'reload schema';
