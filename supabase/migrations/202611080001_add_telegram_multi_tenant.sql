-- =========================================================================
-- Migration: 202611080001_add_telegram_multi_tenant.sql
-- Purpose : Add Multi-Tenant Telegram Bot & Alert Channels (Phone, Email,
--           Telegram Chat ID) to companies, clients, and drivers.
-- =========================================================================

BEGIN;

-- 1. إضافة قنوات التنبيه الإدارية وجروب تيليجرام لكل شركة مستأجرة (Tenant)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS alert_phone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS alert_email VARCHAR(150),
  ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(50);

-- 2. إضافة معرف محادثة تيليجرام للعملاء والسائقين (إشعارات مباشرة فورية)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(50);

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(50);

-- 3. فهارس تسريع البحث في أوامر البوت التفاعلية (Telegram Webhook Lookup)
CREATE INDEX IF NOT EXISTS idx_companies_telegram_chat_id
  ON public.companies (telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_telegram_chat_id
  ON public.clients (telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_drivers_telegram_chat_id
  ON public.drivers (telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

-- 4. ضبط القيم الافتراضية للشركة الأساسية (Trans Bodanon)
UPDATE public.companies
SET
  alert_phone = COALESCE(alert_phone, '212694585307'),
  alert_email = COALESCE(alert_email, 'direction@transbodanon.ma'),
  telegram_chat_id = COALESCE(telegram_chat_id, '-100192837465')
WHERE id = 1;

COMMIT;
