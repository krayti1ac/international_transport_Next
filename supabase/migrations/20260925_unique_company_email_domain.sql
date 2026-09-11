-- ==============================================================================
-- Migration: 20260925_unique_company_email_domain.sql
-- Description: Enforce unique email_domain across all companies (case-insensitive)
-- ==============================================================================

BEGIN;

-- 1. فهرس فريد يمنع تكرار نطاق البريد الإلكتروني بين الشركات
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_email_domain_unique 
ON public.companies (LOWER(TRIM(email_domain))) 
WHERE email_domain IS NOT NULL AND TRIM(email_domain) != '';

COMMIT;
