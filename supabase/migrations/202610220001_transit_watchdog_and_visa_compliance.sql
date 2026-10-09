-- ==============================================================================
-- Trans Bodanon TMS — Migration: Automated Transit Watchdog & Visa Expiry Engine
-- Comprehensive cross-border compliance for European Maritime & African Overland Corridors
-- Migration ID: 202610220001_transit_watchdog_and_visa_compliance.sql
-- ==============================================================================

-- 1. Ensure driver table has all international passport and credential columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'passport_number'
  ) THEN
    ALTER TABLE public.drivers ADD COLUMN passport_number VARCHAR(100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'passport_expiry_date'
  ) THEN
    ALTER TABLE public.drivers ADD COLUMN passport_expiry_date DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'driver_license_expiry_date'
  ) THEN
    ALTER TABLE public.drivers ADD COLUMN driver_license_expiry_date DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'adr_license_expiry_date'
  ) THEN
    ALTER TABLE public.drivers ADD COLUMN adr_license_expiry_date DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'driver_card_qualification_expiry'
  ) THEN
    ALTER TABLE public.drivers ADD COLUMN driver_card_qualification_expiry DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'yellow_fever_vaccine_date'
  ) THEN
    ALTER TABLE public.drivers ADD COLUMN yellow_fever_vaccine_date DATE;
  END IF;
END $$;

COMMENT ON COLUMN public.drivers.passport_number IS 'رقم جواز السفر الدولي للسائق';
COMMENT ON COLUMN public.drivers.passport_expiry_date IS 'تاريخ انتهاء صلاحية جواز السفر (يجب ألا يقل عن 6 أشهر للعبور الدولي)';
COMMENT ON COLUMN public.drivers.driver_license_expiry_date IS 'تاريخ انتهاء صلاحية رخصة السياقة المهنية الدولية';
COMMENT ON COLUMN public.drivers.adr_license_expiry_date IS 'تاريخ انتهاء شهادة نقل المواد الخطرة ADR';
COMMENT ON COLUMN public.drivers.driver_card_qualification_expiry IS 'تاريخ انتهاء بطاقة السائق المهني FIMO / CAP';
COMMENT ON COLUMN public.drivers.yellow_fever_vaccine_date IS 'تاريخ أخذ لقاح الحمى الصفراء للممر الإفريقي';

-- 2. Table for Pre-Dispatch Transit Compliance Audits
CREATE TABLE IF NOT EXISTS public.transit_compliance_audits (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE,
    trip_id BIGINT REFERENCES public.trip_orders(id) ON DELETE SET NULL,
    driver_id BIGINT NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
    truck_id BIGINT REFERENCES public.trucks(id) ON DELETE SET NULL,
    trailer_id BIGINT REFERENCES public.trailers(id) ON DELETE SET NULL,
    corridor_type TEXT NOT NULL CHECK (corridor_type IN ('european_maritime', 'african_overland', 'domestic_morocco')),
    compliance_status TEXT NOT NULL CHECK (compliance_status IN ('compliant', 'warning', 'critical_block', 'expired')),
    is_dispatch_allowed BOOLEAN NOT NULL DEFAULT true,
    block_reasons JSONB DEFAULT '[]'::jsonb,
    warnings JSONB DEFAULT '[]'::jsonb,
    evaluated_documents JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Table for Proactive Expiry Alerts Log
CREATE TABLE IF NOT EXISTS public.transit_expiry_alerts (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE,
    driver_id BIGINT REFERENCES public.drivers(id) ON DELETE CASCADE,
    truck_id BIGINT REFERENCES public.trucks(id) ON DELETE SET NULL,
    document_name TEXT NOT NULL,
    document_category TEXT NOT NULL 
        CHECK (document_category IN ('driver_visa', 'driver_passport', 'driver_license', 'truck_insurance', 'truck_inspection', 'customs_carnet', 'driver_qualification')),
    corridor_type TEXT NOT NULL DEFAULT 'all',
    expiry_date DATE NOT NULL,
    days_remaining INTEGER NOT NULL,
    alert_severity TEXT NOT NULL CHECK (alert_severity IN ('info', 'warning', 'critical', 'expired')),
    notification_sent_whatsapp BOOLEAN NOT NULL DEFAULT false,
    notification_sent_in_app BOOLEAN NOT NULL DEFAULT false,
    last_alerted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- High-performance indexes
CREATE INDEX IF NOT EXISTS idx_transit_audits_company ON public.transit_compliance_audits(company_id);
CREATE INDEX IF NOT EXISTS idx_transit_audits_trip ON public.transit_compliance_audits(trip_id);
CREATE INDEX IF NOT EXISTS idx_transit_audits_driver ON public.transit_compliance_audits(driver_id);
CREATE INDEX IF NOT EXISTS idx_transit_audits_status ON public.transit_compliance_audits(compliance_status);
CREATE INDEX IF NOT EXISTS idx_transit_audits_corridor ON public.transit_compliance_audits(corridor_type);

CREATE INDEX IF NOT EXISTS idx_transit_alerts_company ON public.transit_expiry_alerts(company_id);
CREATE INDEX IF NOT EXISTS idx_transit_alerts_driver ON public.transit_expiry_alerts(driver_id);
CREATE INDEX IF NOT EXISTS idx_transit_alerts_severity ON public.transit_expiry_alerts(alert_severity);
CREATE INDEX IF NOT EXISTS idx_transit_alerts_expiry ON public.transit_expiry_alerts(expiry_date ASC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.transit_compliance_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transit_expiry_alerts ENABLE ROW LEVEL SECURITY;

-- Multi-Tenant RLS Policies: transit_compliance_audits
DROP POLICY IF EXISTS "transit_audits_company_isolation" ON public.transit_compliance_audits;
CREATE POLICY "transit_audits_company_isolation" ON public.transit_compliance_audits
    FOR ALL
    USING (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND (users.company_id = transit_compliance_audits.company_id OR users.role = 'super_admin')
        )
    )
    WITH CHECK (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND (users.company_id = transit_compliance_audits.company_id OR users.role = 'super_admin')
        )
    );

-- Multi-Tenant RLS Policies: transit_expiry_alerts
DROP POLICY IF EXISTS "transit_alerts_company_isolation" ON public.transit_expiry_alerts;
CREATE POLICY "transit_alerts_company_isolation" ON public.transit_expiry_alerts
    FOR ALL
    USING (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND (users.company_id = transit_expiry_alerts.company_id OR users.role = 'super_admin')
        )
    )
    WITH CHECK (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND (users.company_id = transit_expiry_alerts.company_id OR users.role = 'super_admin')
        )
    );

