-- Migration: 20260916_add_user_avatar_url.sql
-- Description: Add avatar_url column to public.users table

ALTER TABLE IF EXISTS public.users
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN public.users.avatar_url IS 'رابط الصورة الرمزية أو الشخصية للمستخدم (Avatar / Photo URL)';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
