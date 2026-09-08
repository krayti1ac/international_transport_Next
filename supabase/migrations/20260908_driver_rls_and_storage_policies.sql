-- ==============================================================================
-- Migration: 20260908_driver_rls_and_storage_policies.sql
-- Description: Driver RLS policies, storage bucket policies, and field security
-- ==============================================================================

-- 1. دوال مساعدة للتحقق من الأدوار ومعرف السائق (Helper Functions)
CREATE OR REPLACE FUNCTION public.is_management()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
      AND role IN ('admin', 'secretary')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- استخراج معرف السائق الرقمي (driver_id) المقترن بالحساب الحالي
CREATE OR REPLACE FUNCTION public.get_current_driver_id()
RETURNS BIGINT AS $$
  SELECT id FROM public.drivers WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. تفعيل RLS على الجداول الحيوية والمالية
ALTER TABLE public.treasury_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.truck_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_advance_requests ENABLE ROW LEVEL SECURITY;

-- 3. عزل الجداول المالية (الإدارة والسكرتارية فقط)
DROP POLICY IF EXISTS "Management manage treasury" ON public.treasury_transactions;
CREATE POLICY "Management manage treasury" 
  ON public.treasury_transactions FOR ALL 
  TO authenticated 
  USING (public.is_management()) 
  WITH CHECK (public.is_management());

DROP POLICY IF EXISTS "Management manage bank_accounts" ON public.bank_accounts;
CREATE POLICY "Management manage bank_accounts" 
  ON public.bank_accounts FOR ALL 
  TO authenticated 
  USING (public.is_management()) 
  WITH CHECK (public.is_management());

DROP POLICY IF EXISTS "Management manage cash_boxes" ON public.cash_boxes;
CREATE POLICY "Management manage cash_boxes" 
  ON public.cash_boxes FOR ALL 
  TO authenticated 
  USING (public.is_management()) 
  WITH CHECK (public.is_management());

DROP POLICY IF EXISTS "Management manage invoices" ON public.invoices;
CREATE POLICY "Management manage invoices" 
  ON public.invoices FOR ALL 
  TO authenticated 
  USING (public.is_management()) 
  WITH CHECK (public.is_management());

DROP POLICY IF EXISTS "Management manage payments" ON public.payments;
CREATE POLICY "Management manage payments" 
  ON public.payments FOR ALL 
  TO authenticated 
  USING (public.is_management()) 
  WITH CHECK (public.is_management());

-- 4. سياسات الرحلات والشحنات (Trip Orders)
DROP POLICY IF EXISTS "Trips: Management full access" ON public.trip_orders;
CREATE POLICY "Trips: Management full access"
  ON public.trip_orders FOR ALL
  TO authenticated
  USING (public.is_management())
  WITH CHECK (public.is_management());

DROP POLICY IF EXISTS "Trips: Driver read assigned trips" ON public.trip_orders;
CREATE POLICY "Trips: Driver read assigned trips"
  ON public.trip_orders FOR SELECT
  TO authenticated
  USING (driver_id = public.get_current_driver_id());

DROP POLICY IF EXISTS "Trips: Driver update status on assigned trips" ON public.trip_orders;
CREATE POLICY "Trips: Driver update status on assigned trips"
  ON public.trip_orders FOR UPDATE
  TO authenticated
  USING (driver_id = public.get_current_driver_id())
  WITH CHECK (driver_id = public.get_current_driver_id());

-- 5. سياسات السلف والمصاريف الميدانية (Advances & Fuel Receipts)
DROP POLICY IF EXISTS "Advances: Driver view own advances" ON public.advances;
CREATE POLICY "Advances: Driver view own advances" 
  ON public.advances FOR SELECT 
  TO authenticated 
  USING (driver_id = public.get_current_driver_id());

DROP POLICY IF EXISTS "Advances: Management manage" ON public.advances;
CREATE POLICY "Advances: Management manage" 
  ON public.advances FOR ALL 
  TO authenticated 
  USING (public.is_management()) 
  WITH CHECK (public.is_management());

DROP POLICY IF EXISTS "Maintenance: Management manage all" ON public.truck_maintenance;
CREATE POLICY "Maintenance: Management manage all" 
  ON public.truck_maintenance FOR ALL 
  TO authenticated 
  USING (public.is_management()) 
  WITH CHECK (public.is_management());

DROP POLICY IF EXISTS "Maintenance: Driver insert fuel receipts" ON public.truck_maintenance;
CREATE POLICY "Maintenance: Driver insert fuel receipts" 
  ON public.truck_maintenance FOR INSERT 
  TO authenticated 
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'driver') 
    OR public.is_management()
  );

-- 6. سياسات حاويات التخزين (Storage Buckets)
DROP POLICY IF EXISTS "Storage: Authenticated users can upload fuel receipts" ON storage.objects;
CREATE POLICY "Storage: Authenticated users can upload fuel receipts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'fuel-receipts');

DROP POLICY IF EXISTS "Storage: Authenticated users can view fuel receipts" ON storage.objects;
CREATE POLICY "Storage: Authenticated users can view fuel receipts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'fuel-receipts');

