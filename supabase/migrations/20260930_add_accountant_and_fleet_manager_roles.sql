-- ==============================================================================
-- Migration: 20260930_add_accountant_and_fleet_manager_roles.sql
-- Description: Expand User Roles with Accountant and Fleet Manager & configure RLS
-- ==============================================================================

BEGIN;

-- 1. تحديث قيد التحقق من أدوار المستخدمين في جدول public.users ليشمل الأدوار الجديدة
ALTER TABLE public.users 
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users 
  ADD CONSTRAINT users_role_check 
  CHECK (role IN ('super_admin', 'admin', 'secretary', 'driver', 'accountant', 'fleet_manager'));

-- 2. توثيق الصلاحيات الجديدة في سياسات الأمان على مستوى الصفوف (RLS)
-- السماح للمحاسب بالوصول إلى الجداول المالية لشركته
DROP POLICY IF EXISTS "accountant_finance_access" ON public.treasury_transactions;
CREATE POLICY "accountant_finance_access" ON public.treasury_transactions
  FOR ALL
  TO authenticated
  USING (
    company_id = public.current_company_id() 
    AND (
      EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('admin', 'accountant')
      )
    )
  );

-- السماح لمدير الأسطول بإدارة وثائق وصيانة ومركبات شركته
DROP POLICY IF EXISTS "fleet_manager_maintenance_access" ON public.truck_maintenance;
CREATE POLICY "fleet_manager_maintenance_access" ON public.truck_maintenance
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trucks 
      WHERE trucks.id = truck_maintenance.truck_id 
      AND trucks.company_id = public.current_company_id()
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('admin', 'fleet_manager', 'secretary')
      )
    )
  );

COMMIT;

-- تحديث كاش PostgREST
NOTIFY pgrst, 'reload schema';

