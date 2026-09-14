-- Migration: 20261006_add_user_phone_and_personal_email.sql
-- Description: Add phone and personal_email columns to public.users table

ALTER TABLE IF EXISTS public.users
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS personal_email TEXT;

COMMENT ON COLUMN public.users.phone IS 'رقم الهاتف الشخصي للمستخدم للتواصل والإشعارات المباشرة';
COMMENT ON COLUMN public.users.personal_email IS 'البريد الإلكتروني الشخصي في هاتف المستخدم لاستلام بيانات الدخول والسرية';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_personal_email ON public.users(personal_email);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';