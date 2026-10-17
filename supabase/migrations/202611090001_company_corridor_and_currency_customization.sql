-- Migration: 202611090001_company_corridor_and_currency_customization.sql
-- Description:
-- Adds Tenant Corridor Scope Customization ('european_only', 'african_only', 'dual')
-- and Multi-Currency Ledger Configuration (currency, enabled_currencies, multi_currency_enabled)
-- to public.companies and public.system_settings.

DO $$
BEGIN
  -- 1. Add corridor_scope to public.companies
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'corridor_scope'
  ) THEN
    ALTER TABLE public.companies
      ADD COLUMN corridor_scope VARCHAR(30) NOT NULL DEFAULT 'dual'
      CHECK (corridor_scope IN ('european_only', 'african_only', 'dual'));
  END IF;

  -- 2. Add enabled_currencies to public.companies
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'enabled_currencies'
  ) THEN
    ALTER TABLE public.companies
      ADD COLUMN enabled_currencies TEXT[] NOT NULL DEFAULT ARRAY['MAD', 'EUR', 'MRU', 'XOF']::TEXT[];
  END IF;

  -- 3. Add multi_currency_enabled to public.companies
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'multi_currency_enabled'
  ) THEN
    ALTER TABLE public.companies
      ADD COLUMN multi_currency_enabled BOOLEAN NOT NULL DEFAULT true;
  END IF;

  -- 4. Also add to public.system_settings if table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'system_settings'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'system_settings' AND column_name = 'corridor_scope'
    ) THEN
      ALTER TABLE public.system_settings
        ADD COLUMN corridor_scope VARCHAR(30) DEFAULT 'dual';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'system_settings' AND column_name = 'enabled_currencies'
    ) THEN
      ALTER TABLE public.system_settings
        ADD COLUMN enabled_currencies TEXT[] DEFAULT ARRAY['MAD', 'EUR', 'MRU', 'XOF']::TEXT[];
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'system_settings' AND column_name = 'multi_currency_enabled'
    ) THEN
      ALTER TABLE public.system_settings
        ADD COLUMN multi_currency_enabled BOOLEAN DEFAULT true;
    END IF;
  END IF;
END $$;

COMMENT ON COLUMN public.companies.corridor_scope IS 'النطاق الجغرافي والتشغيلي للممرات: european_only (أوروبا بحرياً فقط)، african_only (إفريقيا برياً فقط)، أو dual (الممر المزدوج معاً)';
COMMENT ON COLUMN public.companies.enabled_currencies IS 'قائمة العملات المفعلة للشركة: MAD، EUR، MRU، XOF';
COMMENT ON COLUMN public.companies.multi_currency_enabled IS 'تفعيل دفتر الأستاذ متعدد العملات وفروق أسعار الصرف المحققة (Realized Forex Gain/Loss)';

CREATE INDEX IF NOT EXISTS idx_companies_corridor_scope ON public.companies(corridor_scope);
