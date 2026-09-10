-- ==============================================================================
-- Migration: 20260909_multi_tenant_saas.sql
-- Description: Multi-Tenancy SaaS Architecture, Companies Table, Tenant Isolation & RLS
-- ==============================================================================

BEGIN;

-- 1. جدول الشركات (Companies Table)
CREATE TABLE IF NOT EXISTS public.companies (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  ice TEXT,
  logo_url TEXT,
  currency TEXT NOT NULL DEFAULT 'MAD',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. إدراج الشركة الافتراضية الأولى بناءً على إعدادات المنظومة القائمة
DO $$
DECLARE
  v_company_name TEXT := 'ترانس بودانون الدولية';
  v_logo_url TEXT := NULL;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_settings') THEN
    SELECT COALESCE(company_name, 'ترانس بودانون الدولية'), logo_url 
    INTO v_company_name, v_logo_url 
    FROM public.system_settings 
    WHERE id = 1 
    LIMIT 1;
  END IF;

  INSERT INTO public.companies (id, name, logo_url, currency, is_active)
  VALUES (1, COALESCE(v_company_name, 'ترانس بودانون الدولية'), v_logo_url, 'MAD', TRUE)
  ON CONFLICT (id) DO UPDATE 
    SET name = EXCLUDED.name,
        logo_url = COALESCE(EXCLUDED.logo_url, public.companies.logo_url);

  PERFORM setval('public.companies_id_seq', GREATEST((SELECT MAX(id) FROM public.companies), 1));
END $$;

-- 3. ربط جدول المستخدمين بالشركة (Users Table)
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE;

-- تعيين الشركة رقم 1 لكافة المستخدمين القائمين
UPDATE public.users SET company_id = 1 WHERE company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_company_id ON public.users (company_id);

-- 4. الدوال المساعدة لعزل المستأجرين (Multi-Tenant Helper Functions)
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS BIGINT AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_company_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
      AND role = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 5. إضافة عمود company_id والفهارس والقيم التلقائية لكافة الجداول التشغيلية
DO $$
DECLARE
  operational_tables TEXT[] := ARRAY[
    'trip_orders',
    'trips',
    'trucks',
    'trailers',
    'drivers',
    'clients',
    'invoices',
    'treasury_transactions',
    'bank_accounts',
    'cash_boxes',
    'payments',
    'payment_invoice_allocations',
    'advances',
    'emergency_advance_requests',
    'driver_salaries',
    'secretary_cash',
    'truck_maintenance',
    'fine_penalties',
    'fleet_documents',
    'fleet_document_renewals',
    'transport_routes',
    'maintenance_schedules',
    'audit_logs'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY operational_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE', t);
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN company_id SET DEFAULT public.current_company_id()', t);
      EXECUTE format('UPDATE public.%I SET company_id = 1 WHERE company_id IS NULL', t);
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (company_id)', 'idx_' || t || '_company_id', t);
    END IF;
  END LOOP;
END $$;

-- 6. تفعيل وحماية جدول الشركات RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own company" ON public.companies;
CREATE POLICY "Users can view their own company"
  ON public.companies FOR SELECT
  TO authenticated
  USING (
    id = public.current_company_id()
  );

DROP POLICY IF EXISTS "Admins can update their own company" ON public.companies;
CREATE POLICY "Admins can update their own company"
  ON public.companies FOR UPDATE
  TO authenticated
  USING (
    id = public.current_company_id() AND public.is_company_admin()
  )
  WITH CHECK (
    id = public.current_company_id() AND public.is_company_admin()
  );

-- 7. تحديث سياسات الأمان RLS على الجداول التشغيلية لضمان العزل التام للشركات

-- أ. الرحلات (trip_orders)
DROP POLICY IF EXISTS "Trips: Management full access" ON public.trip_orders;
DROP POLICY IF EXISTS "Users can only view their company trips" ON public.trip_orders;
DROP POLICY IF EXISTS "Tenant isolation: Management trips" ON public.trip_orders;
CREATE POLICY "Tenant isolation: Management trips"
  ON public.trip_orders FOR ALL
  TO authenticated
  USING (
    company_id = public.current_company_id() AND public.is_management()
  )
  WITH CHECK (
    company_id = public.current_company_id() AND public.is_management()
  );

DROP POLICY IF EXISTS "Trips: Driver read assigned trips" ON public.trip_orders;
DROP POLICY IF EXISTS "Tenant isolation: Driver read assigned trips" ON public.trip_orders;
CREATE POLICY "Tenant isolation: Driver read assigned trips"
  ON public.trip_orders FOR SELECT
  TO authenticated
  USING (
    company_id = public.current_company_id() AND driver_id = public.get_current_driver_id()
  );

DROP POLICY IF EXISTS "Trips: Driver update status on assigned trips" ON public.trip_orders;
DROP POLICY IF EXISTS "Tenant isolation: Driver update assigned trips" ON public.trip_orders;
CREATE POLICY "Tenant isolation: Driver update assigned trips"
  ON public.trip_orders FOR UPDATE
  TO authenticated
  USING (
    company_id = public.current_company_id() AND driver_id = public.get_current_driver_id()
  )
  WITH CHECK (
    company_id = public.current_company_id() AND driver_id = public.get_current_driver_id()
  );

-- ب. الشاحنات والمقطورات (trucks & trailers)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trucks') THEN
    DROP POLICY IF EXISTS "Tenant isolation: Trucks access" ON public.trucks;
    CREATE POLICY "Tenant isolation: Trucks access"
      ON public.trucks FOR ALL
      TO authenticated
      USING (company_id = public.current_company_id())
      WITH CHECK (company_id = public.current_company_id());
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trailers') THEN
    DROP POLICY IF EXISTS "Tenant isolation: Trailers access" ON public.trailers;
    CREATE POLICY "Tenant isolation: Trailers access"
      ON public.trailers FOR ALL
      TO authenticated
      USING (company_id = public.current_company_id())
      WITH CHECK (company_id = public.current_company_id());
  END IF;
END $$;

-- ج. الفواتير (invoices)
DROP POLICY IF EXISTS "Management manage invoices" ON public.invoices;
DROP POLICY IF EXISTS "Tenant isolation: Invoices access" ON public.invoices;
CREATE POLICY "Tenant isolation: Invoices access"
  ON public.invoices FOR ALL
  TO authenticated
  USING (
    company_id = public.current_company_id() AND public.is_management()
  )
  WITH CHECK (
    company_id = public.current_company_id() AND public.is_management()
  );

-- د. العملاء (clients)
DROP POLICY IF EXISTS "Tenant isolation: Clients access" ON public.clients;
CREATE POLICY "Tenant isolation: Clients access"
  ON public.clients FOR ALL
  TO authenticated
  USING (
    company_id = public.current_company_id() AND public.is_management()
  )
  WITH CHECK (
    company_id = public.current_company_id() AND public.is_management()
  );

-- هـ. الخزينة والمدفوعات والحسابات البنكية (Treasury, Payments & Accounts)
DROP POLICY IF EXISTS "Management manage treasury" ON public.treasury_transactions;
DROP POLICY IF EXISTS "Tenant isolation: Treasury access" ON public.treasury_transactions;
CREATE POLICY "Tenant isolation: Treasury access"
  ON public.treasury_transactions FOR ALL
  TO authenticated
  USING (
    company_id = public.current_company_id() AND public.is_management()
  )
  WITH CHECK (
    company_id = public.current_company_id() AND public.is_management()
  );

DROP POLICY IF EXISTS "Management manage bank_accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Tenant isolation: Bank accounts access" ON public.bank_accounts;
CREATE POLICY "Tenant isolation: Bank accounts access"
  ON public.bank_accounts FOR ALL
  TO authenticated
  USING (
    company_id = public.current_company_id() AND public.is_management()
  )
  WITH CHECK (
    company_id = public.current_company_id() AND public.is_management()
  );

DROP POLICY IF EXISTS "Management manage cash_boxes" ON public.cash_boxes;
DROP POLICY IF EXISTS "Tenant isolation: Cash boxes access" ON public.cash_boxes;
CREATE POLICY "Tenant isolation: Cash boxes access"
  ON public.cash_boxes FOR ALL
  TO authenticated
  USING (
    company_id = public.current_company_id() AND public.is_management()
  )
  WITH CHECK (
    company_id = public.current_company_id() AND public.is_management()
  );

DROP POLICY IF EXISTS "Management manage payments" ON public.payments;
DROP POLICY IF EXISTS "Tenant isolation: Payments access" ON public.payments;
CREATE POLICY "Tenant isolation: Payments access"
  ON public.payments FOR ALL
  TO authenticated
  USING (
    company_id = public.current_company_id() AND public.is_management()
  )
  WITH CHECK (
    company_id = public.current_company_id() AND public.is_management()
  );

-- و. السائقين (drivers)
DROP POLICY IF EXISTS "Tenant isolation: Drivers management" ON public.drivers;
CREATE POLICY "Tenant isolation: Drivers management"
  ON public.drivers FOR ALL
  TO authenticated
  USING (
    company_id = public.current_company_id() AND public.is_management()
  )
  WITH CHECK (
    company_id = public.current_company_id() AND public.is_management()
  );

DROP POLICY IF EXISTS "Tenant isolation: Driver read own profile" ON public.drivers;
CREATE POLICY "Tenant isolation: Driver read own profile"
  ON public.drivers FOR SELECT
  TO authenticated
  USING (
    company_id = public.current_company_id() AND user_id = auth.uid()
  );

-- ز. الصيانة ووصولات الوقود (truck_maintenance)
DROP POLICY IF EXISTS "Maintenance: Management manage all" ON public.truck_maintenance;
DROP POLICY IF EXISTS "Tenant isolation: Maintenance management" ON public.truck_maintenance;
CREATE POLICY "Tenant isolation: Maintenance management"
  ON public.truck_maintenance FOR ALL
  TO authenticated
  USING (
    company_id = public.current_company_id() AND public.is_management()
  )
  WITH CHECK (
    company_id = public.current_company_id() AND public.is_management()
  );

DROP POLICY IF EXISTS "Maintenance: Driver insert fuel receipts" ON public.truck_maintenance;
DROP POLICY IF EXISTS "Tenant isolation: Driver insert fuel receipts" ON public.truck_maintenance;
CREATE POLICY "Tenant isolation: Driver insert fuel receipts"
  ON public.truck_maintenance FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.current_company_id() AND (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'driver') 
      OR public.is_management()
    )
  );

-- ح. السلف ومخالفات السائقين (advances & fine_penalties)
DROP POLICY IF EXISTS "Advances: Management manage" ON public.advances;
DROP POLICY IF EXISTS "Tenant isolation: Advances management" ON public.advances;
CREATE POLICY "Tenant isolation: Advances management"
  ON public.advances FOR ALL
  TO authenticated
  USING (
    company_id = public.current_company_id() AND public.is_management()
  )
  WITH CHECK (
    company_id = public.current_company_id() AND public.is_management()
  );

DROP POLICY IF EXISTS "Advances: Driver view own advances" ON public.advances;
DROP POLICY IF EXISTS "Tenant isolation: Driver view own advances" ON public.advances;
CREATE POLICY "Tenant isolation: Driver view own advances"
  ON public.advances FOR SELECT
  TO authenticated
  USING (
    company_id = public.current_company_id() AND driver_id = public.get_current_driver_id()
  );

DROP POLICY IF EXISTS "Management manage all fine_penalties" ON public.fine_penalties;
DROP POLICY IF EXISTS "Tenant isolation: Fine penalties management" ON public.fine_penalties;
CREATE POLICY "Tenant isolation: Fine penalties management"
  ON public.fine_penalties FOR ALL
  TO authenticated
  USING (
    company_id = public.current_company_id() AND public.is_management()
  )
  WITH CHECK (
    company_id = public.current_company_id() AND public.is_management()
  );

COMMIT;
