-- Migration: 20261005_multi_branch_architecture.sql
-- Description: Multi-Branch Hubs Architecture & Tenant Isolation for Trans Bodanon TMS

-- 1. جدول فروع الشركة (Company Branches)
CREATE TABLE IF NOT EXISTS public.company_branches (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(50) NOT NULL,
  country VARCHAR(5) NOT NULL DEFAULT 'MA', -- 'MA', 'ES', 'FR'
  city VARCHAR(100) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(150),
  is_headquarters BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  default_cash_box_id BIGINT REFERENCES public.cash_boxes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- 2. ربط الفروع بالكيانات التشغيلية الرئيسية
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES public.company_branches(id) ON DELETE SET NULL;

ALTER TABLE public.trucks 
  ADD COLUMN IF NOT EXISTS home_branch_id BIGINT REFERENCES public.company_branches(id) ON DELETE SET NULL;

ALTER TABLE public.trip_orders 
  ADD COLUMN IF NOT EXISTS origin_branch_id BIGINT REFERENCES public.company_branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS destination_branch_id BIGINT REFERENCES public.company_branches(id) ON DELETE SET NULL;

ALTER TABLE public.cash_boxes 
  ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES public.company_branches(id) ON DELETE SET NULL;

-- 3. تفعيل الأمان وسياسات RLS لعزل الفروع
ALTER TABLE public.company_branches ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'company_branches' 
      AND policyname = 'branch_tenant_isolation'
  ) THEN
    CREATE POLICY "branch_tenant_isolation" ON public.company_branches
      FOR ALL TO authenticated
      USING (company_id = public.current_company_id());
  END IF;
END $$;

-- 4. فهارس تسريع الاستعلامات والتقارير
CREATE INDEX IF NOT EXISTS idx_company_branches_company ON public.company_branches(company_id);
CREATE INDEX IF NOT EXISTS idx_users_branch ON public.users(branch_id);
CREATE INDEX IF NOT EXISTS idx_trucks_home_branch ON public.trucks(home_branch_id);
CREATE INDEX IF NOT EXISTS idx_trip_orders_branches ON public.trip_orders(origin_branch_id, destination_branch_id);
CREATE INDEX IF NOT EXISTS idx_cash_boxes_branch ON public.cash_boxes(branch_id);

