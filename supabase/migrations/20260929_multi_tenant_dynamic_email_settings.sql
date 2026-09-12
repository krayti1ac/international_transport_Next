-- ==============================================================================
-- Migration: 20260929_multi_tenant_dynamic_email_settings.sql
-- Description: Multi-Tenant Dynamic Email System (SMTP/IMAP Auto & Manual Settings)
-- ==============================================================================

BEGIN;

-- 1. إضافة حقول إعدادات البريد لخوادم الشركات (companies)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS email_domain TEXT,
  ADD COLUMN IF NOT EXISTS mail_provider TEXT DEFAULT 'cpanel',
  ADD COLUMN IF NOT EXISTS smtp_host TEXT,
  ADD COLUMN IF NOT EXISTS smtp_port INTEGER DEFAULT 465,
  ADD COLUMN IF NOT EXISTS imap_host TEXT,
  ADD COLUMN IF NOT EXISTS imap_port INTEGER DEFAULT 993,
  ADD COLUMN IF NOT EXISTS email_user TEXT,
  ADD COLUMN IF NOT EXISTS email_password TEXT;

-- إضافة قيد التحقق على مزود البريد
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'companies_mail_provider_check'
  ) THEN
    ALTER TABLE public.companies
      ADD CONSTRAINT companies_mail_provider_check
      CHECK (mail_provider IN ('cpanel', 'hostinger', 'ovh', 'custom'));
  END IF;
END $$;

-- 2. دالة الضبط والتوليد التلقائي لإعدادات البريد (Auto-Configuration Function)
CREATE OR REPLACE FUNCTION public.auto_configure_company_mail()
RETURNS TRIGGER AS $$
DECLARE
  v_domain TEXT;
BEGIN
  -- تنظيف النطاق وإزالة أي علامة @ زائدة
  IF NEW.email_domain IS NOT NULL THEN
    v_domain := LOWER(TRIM(REGEXP_REPLACE(NEW.email_domain, '^@+', '')));
    NEW.email_domain := v_domain;
  ELSE
    v_domain := 'transbodanon.com';
  END IF;

  -- التأكد من وجود قيمة افتراضية لمزود الخدمة
  IF NEW.mail_provider IS NULL OR TRIM(NEW.mail_provider) = '' THEN
    NEW.mail_provider := 'cpanel';
  END IF;

  -- ضبط الخوادم والمنافذ تلقائياً بحسب المزود المختار
  IF NEW.mail_provider = 'cpanel' THEN
    -- cPanel: mail.[domain]
    IF NEW.smtp_host IS NULL OR NEW.smtp_host = '' OR NEW.smtp_host LIKE 'mail.%' THEN
      NEW.smtp_host := 'mail.' || v_domain;
    END IF;
    IF NEW.imap_host IS NULL OR NEW.imap_host = '' OR NEW.imap_host LIKE 'mail.%' THEN
      NEW.imap_host := 'mail.' || v_domain;
    END IF;
    IF NEW.smtp_port IS NULL OR NEW.smtp_port = 0 THEN
      NEW.smtp_port := 465;
    END IF;
    IF NEW.imap_port IS NULL OR NEW.imap_port = 0 THEN
      NEW.imap_port := 993;
    END IF;

  ELSIF NEW.mail_provider = 'hostinger' THEN
    -- Hostinger: smtp.hostinger.com & imap.hostinger.com
    IF NEW.smtp_host IS NULL OR NEW.smtp_host = '' OR NEW.smtp_host LIKE '%hostinger.com' THEN
      NEW.smtp_host := 'smtp.hostinger.com';
    END IF;
    IF NEW.imap_host IS NULL OR NEW.imap_host = '' OR NEW.imap_host LIKE '%hostinger.com' THEN
      NEW.imap_host := 'imap.hostinger.com';
    END IF;
    IF NEW.smtp_port IS NULL OR NEW.smtp_port = 0 THEN
      NEW.smtp_port := 465;
    END IF;
    IF NEW.imap_port IS NULL OR NEW.imap_port = 0 THEN
      NEW.imap_port := 993;
    END IF;

  ELSIF NEW.mail_provider = 'ovh' THEN
    -- OVH: ssl0.ovh.net
    IF NEW.smtp_host IS NULL OR NEW.smtp_host = '' OR NEW.smtp_host LIKE '%ovh.net' THEN
      NEW.smtp_host := 'ssl0.ovh.net';
    END IF;
    IF NEW.imap_host IS NULL OR NEW.imap_host = '' OR NEW.imap_host LIKE '%ovh.net' THEN
      NEW.imap_host := 'ssl0.ovh.net';
    END IF;
    IF NEW.smtp_port IS NULL OR NEW.smtp_port = 0 THEN
      NEW.smtp_port := 465;
    END IF;
    IF NEW.imap_port IS NULL OR NEW.imap_port = 0 THEN
      NEW.imap_port := 993;
    END IF;

  ELSIF NEW.mail_provider = 'custom' THEN
    -- المخصص: تعيين المنافذ الافتراضية الآمنة إذا تُركت فارغة
    IF NEW.smtp_port IS NULL OR NEW.smtp_port = 0 THEN
      NEW.smtp_port := 465;
    END IF;
    IF NEW.imap_port IS NULL OR NEW.imap_port = 0 THEN
      NEW.imap_port := 993;
    END IF;
  END IF;

  -- تعيين البريد التشغيلي الافتراضي إذا تُرك فارغاً: operations@[domain]
  IF NEW.email_user IS NULL OR TRIM(NEW.email_user) = '' THEN
    NEW.email_user := 'operations@' || v_domain;
  ELSE
    NEW.email_user := TRIM(NEW.email_user);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. إنشاء مُشغّل قاعدة البيانات (Trigger)
DROP TRIGGER IF EXISTS trg_auto_configure_company_mail ON public.companies;
CREATE TRIGGER trg_auto_configure_company_mail
  BEFORE INSERT OR UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_configure_company_mail();

-- 4. تهيئة الشركات القائمة تلقائياً بالقيم الافتراضية
UPDATE public.companies
SET 
  mail_provider = COALESCE(mail_provider, 'cpanel'),
  email_domain = COALESCE(email_domain, 'transbodanon.com')
WHERE mail_provider IS NULL OR email_domain IS NULL;

-- 5. توثيق الأمان
COMMENT ON COLUMN public.companies.email_password IS 'كلمة مرور خادم البريد للشركة (محمية ومقنعة للعميل)';

COMMIT;

