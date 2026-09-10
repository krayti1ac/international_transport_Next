-- Migration: 20260915_add_driver_photo_url.sql
-- Description: Add photo_url column to drivers table and setup driver-photos storage bucket

-- 1. Add photo_url column to drivers table
ALTER TABLE IF EXISTS public.drivers
ADD COLUMN IF NOT EXISTS photo_url TEXT;

COMMENT ON COLUMN public.drivers.photo_url IS 'رابط الصورة الشخصية للسائق (Avatar / Photo URL)';

-- 2. Create the 'driver-photos' storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-photos', 'driver-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS: allow public read on driver-photos bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public read driver-photos bucket'
  ) THEN
    CREATE POLICY "Public read driver-photos bucket"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'driver-photos');
  END IF;
END $$;

-- 4. RLS: allow authenticated users / admins / secretaries to manage driver-photos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users manage driver-photos bucket'
  ) THEN
    CREATE POLICY "Authenticated users manage driver-photos bucket"
      ON storage.objects FOR ALL
      TO authenticated
      USING (bucket_id = 'driver-photos')
      WITH CHECK (bucket_id = 'driver-photos');
  END IF;
END $$;

-- 5. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
