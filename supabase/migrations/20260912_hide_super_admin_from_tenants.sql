-- ==============================================================================
-- Migration: 20260912_hide_super_admin_from_tenants.sql
-- Description: Disconnect Super Admins from tenant company IDs and secure users RLS
-- ==============================================================================

BEGIN;

-- 1. تعيين company_id إلى NULL لأي حساب مشرف عام (Super Admin) لضمان عدم ارتباطه بأي شركة مستأجرة
UPDATE public.users 
SET company_id = NULL 
WHERE role = 'super_admin';

-- 2. حماية وتحديث سياسات الوصول لجدول المستخدمين (public.users)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- حذف أي سياسات سابقة لـ SELECT على المستخدمين لتجنب التعارض
DROP POLICY IF EXISTS "Users can view members of their own company" ON public.users;
DROP POLICY IF EXISTS "Users can view users in same company" ON public.users;
DROP POLICY IF EXISTS "Users can view their own company users" ON public.users;

-- سياسة SELECT: المشرف العام يرى كل المستخدمين، بينما مستخدمو الشركات يرون مستخدمي شركتهم فقط ويُحجب عنهم المشرف العام تماماً
CREATE POLICY "Users can view members of their own company"
  ON public.users FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR
    (
      company_id IS NOT NULL 
      AND company_id = public.current_company_id() 
      AND role != 'super_admin'
    )
  );

-- سياسة INSERT: المشرف العام فقط يمكنه إنشاء مشرف عام، ومسؤولو الشركات ينشئون لمستخدمي شركتهم
DROP POLICY IF EXISTS "Users can insert members into their company" ON public.users;
CREATE POLICY "Users can insert members into their company"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR
    (
      public.is_company_admin()
      AND company_id = public.current_company_id()
      AND role != 'super_admin'
    )
  );

-- سياسة UPDATE: المشرف العام فقط يمكنه تعديل حسابات المشرف العام
DROP POLICY IF EXISTS "Users can update members of their company" ON public.users;
CREATE POLICY "Users can update members of their company"
  ON public.users FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    OR
    (
      public.is_company_admin()
      AND company_id = public.current_company_id()
      AND role != 'super_admin'
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR
    (
      public.is_company_admin()
      AND company_id = public.current_company_id()
      AND role != 'super_admin'
    )
  );

-- سياسة DELETE: المشرف العام فقط يمكنه حذف حسابات المشرف العام
DROP POLICY IF EXISTS "Users can delete members of their company" ON public.users;
CREATE POLICY "Users can delete members of their company"
  ON public.users FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin()
    OR
    (
      public.is_company_admin()
      AND company_id = public.current_company_id()
      AND role != 'super_admin'
    )
  );

COMMIT;

