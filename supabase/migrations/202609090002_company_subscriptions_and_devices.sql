-- ==============================================================================
-- Migration: 20260909_company_subscriptions_and_devices.sql
-- Description: Add Subscription Details (Annual Cost, Activation Dates, Device Limits)
--              and Company Devices Management Table
-- ==============================================================================

BEGIN;

-- 1. إضافة حقول الاشتراك السنوي والأجهزة لجدول الشركات (companies)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS subscription_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_start_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS subscription_end_date DATE DEFAULT (CURRENT_DATE + INTERVAL '1 year'),
  ADD COLUMN IF NOT EXISTS max_devices INTEGER NOT NULL DEFAULT 5;

-- تحديث السجلات القائمة إذا كانت فارغة
UPDATE public.companies 
SET 
  subscription_start_date = COALESCE(subscription_start_date, CURRENT_DATE),
  subscription_end_date = COALESCE(subscription_end_date, CURRENT_DATE + INTERVAL '1 year'),
  max_devices = COALESCE(max_devices, 5),
  subscription_cost = COALESCE(subscription_cost, 0)
WHERE subscription_start_date IS NULL OR subscription_end_date IS NULL;

-- 2. إنشاء جدول أجهزة الشركة (company_devices)
CREATE TABLE IF NOT EXISTS public.company_devices (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL DEFAULT 'desktop', -- 'desktop', 'mobile', 'tablet'
  os TEXT,
  browser TEXT,
  ip_address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_company_device UNIQUE (company_id, device_id)
);

-- 3. الفهارس لتسريع البحث
CREATE INDEX IF NOT EXISTS idx_company_devices_company_id ON public.company_devices(company_id);
CREATE INDEX IF NOT EXISTS idx_company_devices_is_active ON public.company_devices(company_id, is_active);

-- 4. أمان مستوى الصف (Row Level Security - RLS)
ALTER TABLE public.company_devices ENABLE ROW LEVEL SECURITY;

-- سياسة القراءة
DROP POLICY IF EXISTS "Users can view devices of their company" ON public.company_devices;
CREATE POLICY "Users can view devices of their company"
  ON public.company_devices
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.current_company_id() 
    OR public.is_company_admin()
  );

-- سياسة التعديل والإدراج (للمسؤول أو النظام)
DROP POLICY IF EXISTS "Admins can manage company devices" ON public.company_devices;
CREATE POLICY "Admins can manage company devices"
  ON public.company_devices
  FOR ALL
  TO authenticated
  USING (
    company_id = public.current_company_id() 
    OR public.is_company_admin()
  )
  WITH CHECK (
    company_id = public.current_company_id() 
    OR public.is_company_admin()
  );

COMMIT;
