-- ==============================================================================
-- Trans Bodanon TMS — Migration: EU Regulation (EC) 561/2006 Tachograph Compliance
-- Driver Driving Limits, Mandatory Rest Tracking, and Real-Time Radar
-- Migration ID: 202610200001_tachograph_and_driver_compliance.sql
-- ==============================================================================

-- 1. Table for raw driver tachograph activity segments
CREATE TABLE IF NOT EXISTS public.driver_tachograph_logs (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE,
    driver_id BIGINT NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
    trip_id BIGINT REFERENCES public.trip_orders(id) ON DELETE SET NULL,
    truck_id BIGINT REFERENCES public.trucks(id) ON DELETE SET NULL,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('drive', 'rest', 'work', 'available')),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    start_odometer NUMERIC(12, 2),
    end_odometer NUMERIC(12, 2),
    start_location TEXT,
    end_location TEXT,
    country_code TEXT NOT NULL DEFAULT 'MA', -- 'MA', 'ES', 'FR', 'MR', 'SN'
    card_insertion_status TEXT NOT NULL DEFAULT 'inserted' CHECK (card_insertion_status IN ('inserted', 'manual_entry', 'withdrawn')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Table for live driver compliance radar snapshots
CREATE TABLE IF NOT EXISTS public.driver_compliance_snapshots (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE,
    driver_id BIGINT NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
    snapshot_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_activity TEXT NOT NULL CHECK (current_activity IN ('drive', 'rest', 'work', 'available')),
    
    -- Continuous Driving & Break Metrics (Minutes)
    continuous_drive_minutes INTEGER NOT NULL DEFAULT 0, -- max 270 (4.5h)
    remaining_continuous_drive_minutes INTEGER NOT NULL DEFAULT 270,
    accumulated_break_minutes INTEGER NOT NULL DEFAULT 0, -- 45m or 15+30
    
    -- Daily Driving Metrics
    daily_drive_minutes INTEGER NOT NULL DEFAULT 0, -- max 540 (9h) or 600 (10h)
    remaining_daily_drive_minutes INTEGER NOT NULL DEFAULT 540,
    daily_10h_extensions_used_this_week INTEGER NOT NULL DEFAULT 0, -- max 2
    reduced_daily_rests_used_this_week INTEGER NOT NULL DEFAULT 0, -- max 3
    
    -- Weekly & Fortnightly Metrics
    weekly_drive_minutes INTEGER NOT NULL DEFAULT 0, -- max 3360 (56h)
    fortnightly_drive_minutes INTEGER NOT NULL DEFAULT 0, -- max 5400 (90h)
    
    -- Compliance Radar Status & Penalty Risk
    radar_status TEXT NOT NULL DEFAULT 'compliant' CHECK (radar_status IN ('compliant', 'warning', 'critical_urgency', 'violation')),
    infringement_severity TEXT NOT NULL DEFAULT 'none' CHECK (infringement_severity IN ('none', 'minor_MI', 'serious_SI', 'very_serious_VSI', 'most_serious_MSI')),
    infringement_details TEXT,
    estimated_penalty_eur NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    recommended_action TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_driver_compliance_snapshot UNIQUE (driver_id)
);

-- High-performance indexes
CREATE INDEX IF NOT EXISTS idx_tachograph_logs_driver ON public.driver_tachograph_logs(driver_id);
CREATE INDEX IF NOT EXISTS idx_tachograph_logs_company ON public.driver_tachograph_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_tachograph_logs_start ON public.driver_tachograph_logs(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_tachograph_logs_activity ON public.driver_tachograph_logs(activity_type);

CREATE INDEX IF NOT EXISTS idx_compliance_snapshots_driver ON public.driver_compliance_snapshots(driver_id);
CREATE INDEX IF NOT EXISTS idx_compliance_snapshots_company ON public.driver_compliance_snapshots(company_id);
CREATE INDEX IF NOT EXISTS idx_compliance_snapshots_radar ON public.driver_compliance_snapshots(radar_status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.driver_tachograph_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_compliance_snapshots ENABLE ROW LEVEL SECURITY;

-- Multi-Tenant RLS Policies
DROP POLICY IF EXISTS "tachograph_logs_company_isolation" ON public.driver_tachograph_logs;
CREATE POLICY "tachograph_logs_company_isolation" ON public.driver_tachograph_logs
    FOR ALL
    USING (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND (users.company_id = driver_tachograph_logs.company_id OR users.role = 'super_admin')
        )
    )
    WITH CHECK (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND (users.company_id = driver_tachograph_logs.company_id OR users.role = 'super_admin')
        )
    );

DROP POLICY IF EXISTS "compliance_snapshots_company_isolation" ON public.driver_compliance_snapshots;
CREATE POLICY "compliance_snapshots_company_isolation" ON public.driver_compliance_snapshots
    FOR ALL
    USING (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND (users.company_id = driver_compliance_snapshots.company_id OR users.role = 'super_admin')
        )
    )
    WITH CHECK (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND (users.company_id = driver_compliance_snapshots.company_id OR users.role = 'super_admin')
        )
    );

-- Trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION public.update_tachograph_records_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_tachograph_logs_timestamp ON public.driver_tachograph_logs;
CREATE TRIGGER trg_update_tachograph_logs_timestamp
    BEFORE UPDATE ON public.driver_tachograph_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_tachograph_records_timestamp();

DROP TRIGGER IF EXISTS trg_update_compliance_snapshots_timestamp ON public.driver_compliance_snapshots;
CREATE TRIGGER trg_update_compliance_snapshots_timestamp
    BEFORE UPDATE ON public.driver_compliance_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION public.update_tachograph_records_timestamp();

