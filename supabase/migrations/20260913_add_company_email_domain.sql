-- ==============================================================================
-- Migration: 20260913_add_company_email_domain.sql
-- Description: Add email_domain to companies table for tenant email domain enforcement
-- ==============================================================================

BEGIN;

-- 1. إضافة عمود نطاق البريد الإلكتروني إلى جدول الشركات
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS email_domain TEXT;

-- 2. تعيين نطاق transbodanon.com للشركة الرئيسية القائمة (ترانس بودانون)
UPDATE public.companies
SET email_domain = 'transbodanon.com'
WHERE email_domain IS NULL
  AND (id = 1 OR name ILIKE '%بودانون%' OR name ILIKE '%transbodanon%');

COMMIT;
