-- Add client_type to clients table if it doesn't exist
-- Values: 'export' (رحلات الذهاب) or 'import' (رحلات العودة), mutually exclusive
ALTER TABLE IF EXISTS public.clients 
ADD COLUMN IF NOT EXISTS client_type VARCHAR(20) DEFAULT 'export' 
CHECK (client_type IN ('export', 'import'));

-- Backfill existing records if any have NULL
UPDATE public.clients 
SET client_type = 'export' 
WHERE client_type IS NULL;

-- Add descriptive comment
COMMENT ON COLUMN public.clients.client_type IS 'نوع رحلات العميل: export (رحلات الذهاب) أو import (رحلات العودة) حصرياً';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

