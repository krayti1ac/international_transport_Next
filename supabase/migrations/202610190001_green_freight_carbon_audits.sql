-- ==============================================================================
-- Trans Bodanon TMS — Migration: Green Freight & ESG Carbon Footprint Audits
-- Standard: GLEC Framework v3.0 / ISO 14083 / EU CBAM Compatible
-- Migration ID: 202610190001_green_freight_carbon_audits.sql
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.trip_carbon_audits (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE,
    trip_id BIGINT NOT NULL REFERENCES public.trip_orders(id) ON DELETE CASCADE,
    client_id BIGINT REFERENCES public.clients(id) ON DELETE SET NULL,
    invoice_id BIGINT REFERENCES public.invoices(id) ON DELETE SET NULL,
    
    -- Cargo & Distance Parameters
    cargo_weight_tons NUMERIC(10, 3) NOT NULL,
    road_distance_km NUMERIC(10, 2) NOT NULL,
    ferry_distance_km NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    truck_euro_class TEXT NOT NULL DEFAULT 'euro_6' CHECK (truck_euro_class IN ('euro_5', 'euro_6', 'electric_hybrid')),
    is_reefer BOOLEAN NOT NULL DEFAULT true,
    reefer_hours NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    
    -- Calculated Emissions (in kg CO2e) - GLEC Framework v3.0
    road_wtw_emissions_kg NUMERIC(12, 3) NOT NULL,
    ferry_wtw_emissions_kg NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    reefer_wtw_emissions_kg NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    total_wtw_emissions_kg NUMERIC(12, 3) NOT NULL,
    total_ttw_emissions_kg NUMERIC(12, 3) NOT NULL,
    
    -- Intensity & Baseline Benchmark
    emissions_intensity_g_per_tkm NUMERIC(10, 2) NOT NULL, -- gCO2e / t-km
    baseline_all_road_emissions_kg NUMERIC(12, 3) NOT NULL, -- Counterfactual All-Road route without ferry
    emissions_saved_kg NUMERIC(12, 3) NOT NULL, -- Savings achieved by multimodal ferry routing
    emissions_savings_percentage NUMERIC(5, 2) NOT NULL, -- Percentage saved vs all-road
    efficiency_rating TEXT NOT NULL CHECK (efficiency_rating IN ('A+', 'A', 'B', 'C', 'D', 'E')),
    
    -- Standards & Forensic Verification Seal
    glec_framework_version TEXT NOT NULL DEFAULT 'v3.0',
    certificate_hash TEXT,
    certificate_issued_at TIMESTAMPTZ,
    
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_trip_carbon_audits_trip UNIQUE (trip_id)
);

-- High-performance indexes
CREATE INDEX IF NOT EXISTS idx_trip_carbon_audits_company ON public.trip_carbon_audits(company_id);
CREATE INDEX IF NOT EXISTS idx_trip_carbon_audits_trip ON public.trip_carbon_audits(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_carbon_audits_client ON public.trip_carbon_audits(client_id);
CREATE INDEX IF NOT EXISTS idx_trip_carbon_audits_rating ON public.trip_carbon_audits(efficiency_rating);
CREATE INDEX IF NOT EXISTS idx_trip_carbon_audits_created ON public.trip_carbon_audits(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.trip_carbon_audits ENABLE ROW LEVEL SECURITY;

-- Multi-Tenant RLS Policy
DROP POLICY IF EXISTS "trip_carbon_audits_company_isolation" ON public.trip_carbon_audits;
CREATE POLICY "trip_carbon_audits_company_isolation" ON public.trip_carbon_audits
    FOR ALL
    USING (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND (users.company_id = trip_carbon_audits.company_id OR users.role = 'super_admin')
        )
    )
    WITH CHECK (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND (users.company_id = trip_carbon_audits.company_id OR users.role = 'super_admin')
        )
    );

-- Trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION public.update_trip_carbon_audits_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_trip_carbon_audits_timestamp ON public.trip_carbon_audits;
CREATE TRIGGER trg_update_trip_carbon_audits_timestamp
    BEFORE UPDATE ON public.trip_carbon_audits
    FOR EACH ROW
    EXECUTE FUNCTION public.update_trip_carbon_audits_timestamp();

