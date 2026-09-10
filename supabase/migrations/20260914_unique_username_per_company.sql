-- ==============================================================================
-- Migration: 20260914_unique_username_per_company.sql
-- Description: Enforce unique username per company domain across all user roles
-- ==============================================================================

BEGIN;

-- 1. فهرس فريد عالمي للبريد الإلكتروني بحروف صغيرة (غير حساس لحالة الأحرف)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique_lower 
ON public.users (LOWER(TRIM(email))) 
WHERE email IS NOT NULL;

-- 2. فهرس فريد يمنع تكرار اسم المستخدم (البادئة قبل @) لنفس الشركة حتى وإن اختلفت الصلاحية
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_company_username_unique 
ON public.users (company_id, LOWER(TRIM(SPLIT_PART(email, '@', 1)))) 
WHERE company_id IS NOT NULL AND email IS NOT NULL;

COMMIT;

