-- Migration: Add preferred_language to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'ar';

-- Ensure users can read and update their own profile
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own profile') THEN
    CREATE POLICY "Users can read own profile"
      ON users FOR SELECT
      USING (id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile') THEN
    CREATE POLICY "Users can update own profile"
      ON users FOR UPDATE
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
  END IF;
END $$;
