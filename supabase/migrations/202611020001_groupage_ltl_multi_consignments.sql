-- ==============================================================================
-- Trans Bodanon TMS — Migration: Groupage & LTL Multi-Consignment Engine
-- Framework: Multi-Tenant LTL / Euro-Pallet / LDM Loading Meter Optimization
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.trip_consignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE,
    trip_id BIGINT NOT NULL REFERENCES public.trip_orders(id) ON DELETE CASCADE,
    consignment_reference VARCHAR(60) NOT NULL UNIQUE,
    client_id BIGINT REFERENCES public.clients(id) ON DELETE SET NULL,
    client_name VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255),
    sender_address TEXT,
    receiver_name VARCHAR(255),
    receiver_address TEXT,
    loading_city VARCHAR(100) NOT NULL,
    loading_country VARCHAR(10) NOT NULL DEFAULT 'MA',
    delivery_city VARCHAR(100) NOT NULL,
    delivery_country VARCHAR(10) NOT NULL DEFAULT 'ES',
    cargo_description TEXT NOT NULL,
    is_temperature_controlled BOOLEAN NOT NULL DEFAULT false,
    target_temperature_c NUMERIC(4, 1),
    pallet_count INTEGER NOT NULL DEFAULT 1,
    pallet_type VARCHAR(20) NOT NULL DEFAULT 'euro', -- 'euro' (0.4 LDM), 'industrial' (0.5 LDM), 'custom'
    is_stackable BOOLEAN NOT NULL DEFAULT false,
    length_cm NUMERIC(10, 2),
    width_cm NUMERIC(10, 2),
    height_cm NUMERIC(10, 2),
    ldm_meters NUMERIC(6, 2) NOT NULL DEFAULT 0.40,
    volume_m3 NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    gross_weight_kg NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    chargeable_weight_kg NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    freight_price NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(5) NOT NULL DEFAULT 'MAD',
    cmr_number VARCHAR(60),
    customs_mrn VARCHAR(60),
    status VARCHAR(40) NOT NULL DEFAULT 'manifested', -- 'manifested', 'loaded', 'in_transit', 'customs_cleared', 'delivered', 'signed_epod'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for high-throughput operational queries
CREATE INDEX IF NOT EXISTS idx_trip_consignments_trip_id ON public.trip_consignments(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_consignments_company_id ON public.trip_consignments(company_id);
CREATE INDEX IF NOT EXISTS idx_trip_consignments_client_id ON public.trip_consignments(client_id);
CREATE INDEX IF NOT EXISTS idx_trip_consignments_status ON public.trip_consignments(status);
CREATE INDEX IF NOT EXISTS idx_trip_consignments_ref ON public.trip_consignments(consignment_reference);

-- Enable RLS
ALTER TABLE public.trip_consignments ENABLE ROW LEVEL SECURITY;

-- Multi-Tenant RLS Policies
DROP POLICY IF EXISTS "Tenant isolation: trip consignments access" ON public.trip_consignments;
CREATE POLICY "Tenant isolation: trip consignments access"
    ON public.trip_consignments
    FOR ALL
    USING (
        company_id IS NULL OR
        company_id = (SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1) OR
        (SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1) = 'super_admin'
    );

