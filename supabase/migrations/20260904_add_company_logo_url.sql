-- Add company logo URL column to system_settings
ALTER TABLE IF EXISTS public.system_settings
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Create the 'settings' storage bucket if it doesn't exist (for company logo and other app assets)
INSERT INTO storage.buckets (id, name, public)
VALUES ('settings', 'settings', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: allow public read on the settings bucket so the logo can be loaded without auth
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public read settings bucket'
  ) THEN
    CREATE POLICY "Public read settings bucket"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'settings');
  END IF;
END $$;

-- RLS: allow admins to upload/update/delete in the settings bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage settings bucket'
  ) THEN
    CREATE POLICY "Admins manage settings bucket"
      ON storage.objects FOR ALL
      USING (
        bucket_id = 'settings'
        AND EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.role = 'admin'
        )
      )
      WITH CHECK (
        bucket_id = 'settings'
        AND EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.role = 'admin'
        )
      );
  END IF;
END $$;

-- Refresh PostgREST schema cache so the new column is visible immediately
NOTIFY pgrst, 'reload schema';