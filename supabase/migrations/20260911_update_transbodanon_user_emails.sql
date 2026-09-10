-- ==============================================================================
-- Migration: 20260911_update_transbodanon_user_emails.sql
-- Description: Update Trans Bodanon company user email addresses:
--   1. Admin:     hisaltan@admin.com  -> admin@transbodanon.com
--   2. Secretary: iman@admin.com      -> iman@transbodanon.com
--   3. Driver:    krayti3ac@gmail.com -> hamza@transbodanon.com
-- ==============================================================================

BEGIN;

-- ضمان وجود الأعمدة الإضافية في جدول المستخدمين
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS theme_mode TEXT DEFAULT 'system';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'ar';

-- 1. تحديث حساب المدير (Admin)
-- تحديث في جدول الهوية والمصادقة (auth.users)
UPDATE auth.users
SET email = 'admin@transbodanon.com',
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"email": "admin@transbodanon.com"}'::jsonb,
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    updated_at = NOW()
WHERE LOWER(email) = 'hisaltan@admin.com';

-- تحديث في جدول الملفات الشخصية للمستخدمين (public.users)
UPDATE public.users
SET email = 'admin@transbodanon.com'
WHERE LOWER(email) = 'hisaltan@admin.com';


-- 2. تحديث حساب السكرتيرة (Secretary - Iman)
-- تحديث في جدول الهوية والمصادقة (auth.users)
UPDATE auth.users
SET email = 'iman@transbodanon.com',
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"email": "iman@transbodanon.com"}'::jsonb,
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    updated_at = NOW()
WHERE LOWER(email) = 'iman@admin.com';

-- تحديث في جدول الملفات الشخصية للمستخدمين (public.users)
UPDATE public.users
SET email = 'iman@transbodanon.com',
    name = COALESCE(NULLIF(name, ''), 'إيمان')
WHERE LOWER(email) = 'iman@admin.com';


-- 3. تحديث حساب السائق (Driver - Hamza)
-- تحديث في جدول الهوية والمصادقة (auth.users)
UPDATE auth.users
SET email = 'hamza@transbodanon.com',
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"email": "hamza@transbodanon.com"}'::jsonb,
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    updated_at = NOW()
WHERE LOWER(email) = 'krayti3ac@gmail.com';

-- تحديث في جدول الملفات الشخصية للمستخدمين (public.users)
UPDATE public.users
SET email = 'hamza@transbodanon.com',
    name = COALESCE(NULLIF(name, ''), 'حمزة')
WHERE LOWER(email) = 'krayti3ac@gmail.com';

COMMIT;

