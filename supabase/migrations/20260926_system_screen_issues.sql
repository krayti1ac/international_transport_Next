-- ==============================================================================
-- Migration: 20260926_system_screen_issues.sql
-- Description: System Screen Issues and Data Entry Anomaly Tracker for Super Admin
-- ==============================================================================

BEGIN;

-- 1. Create table public.system_screen_issues
-- 1. إنشاء جدول مشاكل الشاشات وإدخال البيانات
CREATE TABLE IF NOT EXISTS public.system_screen_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id BIGINT REFERENCES public.companies(id) ON DELETE SET NULL,
  company_name TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT,
  user_email TEXT,
  user_role TEXT,
  device_id TEXT NOT NULL,
  license_number TEXT,
  device_type TEXT DEFAULT 'desktop',
  device_type TEXT NOT NULL DEFAULT 'desktop',
  device_info JSONB DEFAULT '{}'::jsonb,
  screen_route TEXT NOT NULL,
  screen_name TEXT NOT NULL,
  component_name TEXT,
  issue_type TEXT NOT NULL DEFAULT 'validation_error',
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  error_message TEXT NOT NULL,
  error_stack TEXT,
  field_name TEXT,
  validation_errors JSONB DEFAULT '{}'::jsonb,
  input_payload JSONB DEFAULT '{}'::jsonb,
  user_description TEXT,
  ai_diagnostic_prompt TEXT,
  ai_solution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes for fast querying, filtering, and reporting
CREATE INDEX IF NOT EXISTS idx_system_screen_issues_created_at 
  ON public.system_screen_issues (created_at DESC);
-- 2. الفهارس لتسريع الاستعلامات والفلترة
CREATE INDEX IF NOT EXISTS idx_system_screen_issues_created_at ON public.system_screen_issues(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_screen_issues_company_id ON public.system_screen_issues(company_id);
CREATE INDEX IF NOT EXISTS idx_system_screen_issues_device_id ON public.system_screen_issues(device_id);
CREATE INDEX IF NOT EXISTS idx_system_screen_issues_status ON public.system_screen_issues(status);
CREATE INDEX IF NOT EXISTS idx_system_screen_issues_screen_route ON public.system_screen_issues(screen_route);

CREATE INDEX IF NOT EXISTS idx_system_screen_issues_company_id 
  ON public.system_screen_issues (company_id);

CREATE INDEX IF NOT EXISTS idx_system_screen_issues_device_id 
  ON public.system_screen_issues (device_id);

CREATE INDEX IF NOT EXISTS idx_system_screen_issues_status 
  ON public.system_screen_issues (status);

CREATE INDEX IF NOT EXISTS idx_system_screen_issues_severity 
  ON public.system_screen_issues (severity);

CREATE INDEX IF NOT EXISTS idx_system_screen_issues_screen_route 
  ON public.system_screen_issues (screen_route);

CREATE INDEX IF NOT EXISTS idx_system_screen_issues_issue_type 
  ON public.system_screen_issues (issue_type);

-- 3. Enable Row Level Security (RLS)
-- 3. تفعيل أمان مستوى الصفوف (RLS)
ALTER TABLE public.system_screen_issues ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Allow any authenticated user or anonymous device client to log data entry issues
DROP POLICY IF EXISTS Anyone can insert screen issues ON public.system_screen_issues;
CREATE POLICY Anyone can insert screen issues
  ON public.system_screen_issues FOR INSERT
-- سياسة التسجيل: متاحة لجميع المستخدمين المسجلين لرفع تقرير الخطأ تلقائياً من أجهزتهم
DROP POLICY IF EXISTS "Authenticated users can report screen issues" ON public.system_screen_issues;
CREATE POLICY "Authenticated users can report screen issues"
  ON public.system_screen_issues
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Allow super admins full access to view, update, and delete all screen issues
DROP POLICY IF EXISTS Super admins have full access to screen issues ON public.system_screen_issues;
CREATE POLICY Super admins have full access to screen issues
  ON public.system_screen_issues FOR ALL
-- سياسة الإدارة المركزية: حصرية لـ Super Admin للرؤية والتحكم الكامل
DROP POLICY IF EXISTS "Super admins have full access to screen issues" ON public.system_screen_issues;
CREATE POLICY "Super admins have full access to screen issues"
  ON public.system_screen_issues
  FOR ALL
  TO authenticated
  USING (
    public.is_super_admin()
  )
  WITH CHECK (
    public.is_super_admin()
  );
  USING (public.is_super_admin() = true)
  WITH CHECK (public.is_super_admin() = true);

-- Allow tenant users to view their own company's reported issues
DROP POLICY IF EXISTS Users can view their own company screen issues ON public.system_screen_issues;
CREATE POLICY Users can view their own company screen issues
  ON public.system_screen_issues FOR SELECT
  TO authenticated
  USING (
    company_id IS NOT NULL AND company_id = public.current_company_id()
  );

COMMIT;
