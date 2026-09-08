-- ==============================================================================
-- Migration: 20260910_super_admin_role_and_policies.sql
-- Description: Super Admin Role, Helper Functions, and Central Companies RLS Policies
-- ==============================================================================

BEGIN;

-- 1. دالة مساعدة للتحقق من دور المدير العام (Super Admin)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
      AND role = 'super_admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. تحديث دالة is_management لتشمل المدير العام (Super Admin)
CREATE OR REPLACE FUNCTION public.is_management()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin', 'secretary')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. تحديث قيد التحقق على عمود الدور في جدول المستخدمين (إن وجد)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints cc
    JOIN information_schema.constraint_column_usage ccu ON cc.constraint_name = ccu.constraint_name
    WHERE ccu.table_name = 'users' AND ccu.column_name = 'role'
  ) THEN
    ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE public.users ADD CONSTRAINT users_role_check 
      CHECK (role IN ('super_admin', 'admin', 'secretary', 'driver'));
  END IF;
END $$;

-- 4. سياسات الوصول والحماية لجدول الشركات (companies)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own company" ON public.companies;
CREATE POLICY "Users can view their own company"
  ON public.companies FOR SELECT
  TO authenticated
  USING (
    id = public.current_company_id() OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "Super admins can manage all companies" ON public.companies;
CREATE POLICY "Super admins can manage all companies"
  ON public.companies FOR ALL
  TO authenticated
  USING (
    public.is_super_admin()
  )
  WITH CHECK (
    public.is_super_admin()
  );

-- 5. تمكين المدير العام من إدارة جميع حسابات المستخدمين عبر المستأجرين
DROP POLICY IF EXISTS "Super admins full access on users" ON public.users;
CREATE POLICY "Super admins full access on users"
  ON public.users FOR ALL
  TO authenticated
  USING (
    public.is_super_admin()
  )
  WITH CHECK (
    public.is_super_admin()
  );

COMMIT;

