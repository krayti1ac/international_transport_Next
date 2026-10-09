-- Migration: 202610240001_fuel_theft_incidents_and_fraud_detection.sql
-- Description: Intelligent Fuel Fraud & Anti-Siphoning Detection Engine
-- Multi-Tenant isolated fuel theft and telematics anomaly tracking table

CREATE TABLE IF NOT EXISTS public.fuel_theft_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    truck_id BIGINT REFERENCES public.trucks(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    trip_id BIGINT REFERENCES public.trip_orders(id) ON DELETE SET NULL,
    incident_type TEXT NOT NULL CHECK (
        incident_type IN (
            'rapid_siphoning',
            'tank_overflow',
            'ghost_refueling',
            'geofence_mismatch',
            'abnormal_burn_rate'
        )
    ),
    severity TEXT NOT NULL DEFAULT 'high' CHECK (
        severity IN ('low', 'medium', 'high', 'critical')
    ),
    detected_loss_liters NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    financial_loss_mad NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    fuel_price_per_liter NUMERIC(10, 2) NOT NULL DEFAULT 14.00,
    confidence_score INT NOT NULL DEFAULT 0 CHECK (
        confidence_score >= 0 AND confidence_score <= 100
    ),
    status TEXT NOT NULL DEFAULT 'detected' CHECK (
        status IN ('detected', 'confirmed_deduction', 'justified', 'dismissed')
    ),
    gps_latitude NUMERIC(10, 6),
    gps_longitude NUMERIC(10, 6),
    location_name TEXT,
    telematics_snapshot JSONB DEFAULT '{}'::jsonb,
    justification_notes TEXT,
    deduction_reference_id TEXT,
    reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_fuel_theft_company_id ON public.fuel_theft_incidents(company_id);
CREATE INDEX IF NOT EXISTS idx_fuel_theft_truck_id ON public.fuel_theft_incidents(truck_id);
CREATE INDEX IF NOT EXISTS idx_fuel_theft_driver_id ON public.fuel_theft_incidents(driver_id);
CREATE INDEX IF NOT EXISTS idx_fuel_theft_trip_id ON public.fuel_theft_incidents(trip_id);
CREATE INDEX IF NOT EXISTS idx_fuel_theft_status ON public.fuel_theft_incidents(status);
CREATE INDEX IF NOT EXISTS idx_fuel_theft_incident_type ON public.fuel_theft_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_fuel_theft_created_at ON public.fuel_theft_incidents(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.fuel_theft_incidents ENABLE ROW LEVEL SECURITY;

-- Multi-Tenant RLS Policies
CREATE POLICY "fuel_theft_select_policy" ON public.fuel_theft_incidents
    FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

CREATE POLICY "fuel_theft_insert_policy" ON public.fuel_theft_incidents
    FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

CREATE POLICY "fuel_theft_update_policy" ON public.fuel_theft_incidents
    FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

CREATE POLICY "fuel_theft_delete_policy" ON public.fuel_theft_incidents
    FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
        )
    );
