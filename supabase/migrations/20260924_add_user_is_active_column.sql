-- ==============================================================================
-- Migration: 20260924_add_user_is_active_column.sql
-- Description: Add is_active column to public.users table and define
--              check_user_active_status trigger function.
-- ==============================================================================

BEGIN;

-- 1. إضافة حقل حالة نشاط الحساب لجدول المستخدمين إن لم يكن موجوداً
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. فهرس لتسريع الاستعلام عن حالة الحساب
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users(is_active);

-- 3. سياسة الأمان / دالة التحقق من حالة نشاط الحساب
CREATE OR REPLACE FUNCTION public.check_user_active_status()
RETURNS TRIGGER AS 
BEGIN
  IF NEW.is_active = FALSE THEN
    -- يمكن استخدامه لتسجيل حدث أمني في audit_logs
    RAISE NOTICE 'User account is deactivated';
  END IF;
  RETURN NEW;
END;
 LANGUAGE plpgsql;

-- 4. مشغل الأمان للتنفيذ عند تحديث حالة المستخدم
DROP TRIGGER IF EXISTS trg_check_user_active_status ON public.users;
CREATE TRIGGER trg_check_user_active_status
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.check_user_active_status();

-- 5. تحديث كاش PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
