-- Migration: 20260918_add_provider_logo_url.sql
-- Description: Add logo_url and photo_url columns to public.providers table

ALTER TABLE IF EXISTS public.providers
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS photo_url TEXT;

COMMENT ON COLUMN public.providers.logo_url IS 'رابط شعار أو صورة المزود / الورشة (Provider Logo / Photo URL)';
COMMENT ON COLUMN public.providers.photo_url IS 'صورة الورشة أو المزود البديلة (Provider Photo URL)';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
