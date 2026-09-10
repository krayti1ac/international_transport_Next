-- Migration: 20260917_add_client_logo_url.sql
-- Description: Add logo_url column to public.clients table

ALTER TABLE IF EXISTS public.clients
ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN public.clients.logo_url IS 'رابط شعار العميل أو صورته (Client Logo / Photo URL)';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
