-- Migration: 202610260001_fleet_obd_diagnostic_radar.sql
-- Description: Predictive Fleet Maintenance & OBD-II/DTC Diagnostic Radar Engine
-- Multi-Tenant isolated telemetry fault codes (DTC) and predictive maintenance recommendations

-- 1. Table: fleet_obd_diagnostic_events
CREATE TABLE IF NOT EXISTS public.fleet_obd_diagnostic_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE,
    truck_id BIGINT NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    trip_id BIGINT REFERENCES public.trip_orders(id) ON DELETE SET NULL,
    dtc_code VARCHAR(20) NOT NULL,
    dtc_standard VARCHAR(30) NOT NULL DEFAULT 'SAE_J1939' CHECK (
        dtc_standard IN ('SAE_J1939', 'SAE_J2012', 'OBD_II')
    ),
    category VARCHAR(30) NOT NULL CHECK (
        category IN ('powertrain', 'chassis', 'body', 'network')
    ),
    severity VARCHAR(30) NOT NULL DEFAULT 'moderate' CHECK (
        severity IN ('critical', 'moderate', 'minor', 'informational')
    ),
    description TEXT NOT NULL,
    mil_status BOOLEAN NOT NULL DEFAULT FALSE,
    freeze_frame_data JSONB DEFAULT '{}'::jsonb,
    gps_latitude NUMERIC(10, 6),
    gps_longitude NUMERIC(10, 6),
    location_name TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (
        status IN ('active', 'investigating', 'resolved', 'ignored')
    ),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes for fleet_obd_diagnostic_events
CREATE INDEX IF NOT EXISTS idx_obd_events_company_id ON public.fleet_obd_diagnostic_events(company_id);
CREATE INDEX IF NOT EXISTS idx_obd_events_truck_id ON public.fleet_obd_diagnostic_events(truck_id);
CREATE INDEX IF NOT EXISTS idx_obd_events_driver_id ON public.fleet_obd_diagnostic_events(driver_id);
CREATE INDEX IF NOT EXISTS idx_obd_events_trip_id ON public.fleet_obd_diagnostic_events(trip_id);
CREATE INDEX IF NOT EXISTS idx_obd_events_dtc_code ON public.fleet_obd_diagnostic_events(dtc_code);
CREATE INDEX IF NOT EXISTS idx_obd_events_severity ON public.fleet_obd_diagnostic_events(severity);
CREATE INDEX IF NOT EXISTS idx_obd_events_status ON public.fleet_obd_diagnostic_events(status);
CREATE INDEX IF NOT EXISTS idx_obd_events_created_at ON public.fleet_obd_diagnostic_events(created_at DESC);

-- Enable RLS for fleet_obd_diagnostic_events
ALTER TABLE public.fleet_obd_diagnostic_events ENABLE ROW LEVEL SECURITY;

-- Multi-Tenant RLS Policies for fleet_obd_diagnostic_events
CREATE POLICY "obd_events_select_policy" ON public.fleet_obd_diagnostic_events
    FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

CREATE POLICY "obd_events_insert_policy" ON public.fleet_obd_diagnostic_events
    FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

CREATE POLICY "obd_events_update_policy" ON public.fleet_obd_diagnostic_events
    FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

CREATE POLICY "obd_events_delete_policy" ON public.fleet_obd_diagnostic_events
    FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- 2. Table: predictive_maintenance_recommendations
CREATE TABLE IF NOT EXISTS public.predictive_maintenance_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE,
    truck_id BIGINT NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
    diagnostic_event_id UUID REFERENCES public.fleet_obd_diagnostic_events(id) ON DELETE SET NULL,
    urgency VARCHAR(30) NOT NULL DEFAULT 'next_scheduled_service' CHECK (
        urgency IN ('immediate_stop', 'within_24h', 'next_scheduled_service', 'low_priority')
    ),
    health_index_score NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    breakdown_risk_probability NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    recommended_action TEXT NOT NULL,
    required_spare_parts JSONB DEFAULT '[]'::jsonb,
    estimated_labor_hours NUMERIC(5, 2) NOT NULL DEFAULT 1.00,
    estimated_cost_mad NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    estimated_breakdown_cost_mad NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    estimated_savings_mad NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    target_corridor VARCHAR(50) DEFAULT 'ALL',
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'scheduled', 'completed', 'dismissed')
    ),
    maintenance_schedule_id BIGINT REFERENCES public.maintenance_schedules(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes for predictive_maintenance_recommendations
CREATE INDEX IF NOT EXISTS idx_pred_rec_company_id ON public.predictive_maintenance_recommendations(company_id);
CREATE INDEX IF NOT EXISTS idx_pred_rec_truck_id ON public.predictive_maintenance_recommendations(truck_id);
CREATE INDEX IF NOT EXISTS idx_pred_rec_event_id ON public.predictive_maintenance_recommendations(diagnostic_event_id);
CREATE INDEX IF NOT EXISTS idx_pred_rec_urgency ON public.predictive_maintenance_recommendations(urgency);
CREATE INDEX IF NOT EXISTS idx_pred_rec_status ON public.predictive_maintenance_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_pred_rec_created_at ON public.predictive_maintenance_recommendations(created_at DESC);

-- Enable RLS for predictive_maintenance_recommendations
ALTER TABLE public.predictive_maintenance_recommendations ENABLE ROW LEVEL SECURITY;

-- Multi-Tenant RLS Policies for predictive_maintenance_recommendations
CREATE POLICY "pred_rec_select_policy" ON public.predictive_maintenance_recommendations
    FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

CREATE POLICY "pred_rec_insert_policy" ON public.predictive_maintenance_recommendations
    FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

CREATE POLICY "pred_rec_update_policy" ON public.predictive_maintenance_recommendations
    FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

CREATE POLICY "pred_rec_delete_policy" ON public.predictive_maintenance_recommendations
    FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
