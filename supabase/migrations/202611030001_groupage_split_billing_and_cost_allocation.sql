-- ==============================================================================
-- Trans Bodanon TMS — Migration: Groupage Split-Billing & Cost Allocation Engine
-- Framework: Multi-Tenant LTL / Decimal.js Cost Allocation / Consignment Invoices
-- ==============================================================================

-- 1. Extend trip_consignments with billing & financial margin columns
ALTER TABLE public.trip_consignments
    ADD COLUMN IF NOT EXISTS invoice_id BIGINT REFERENCES public.invoices(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(60),
    ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS allocated_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS net_margin NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS profit_margin_pct NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS cost_allocation_mode VARCHAR(30) NOT NULL DEFAULT 'chargeable_weight'; -- 'chargeable_weight' | 'ldm'

-- 2. Extend invoices table with consignment link
ALTER TABLE public.invoices
    ADD COLUMN IF NOT EXISTS consignment_id UUID REFERENCES public.trip_consignments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS consignment_reference VARCHAR(60);

-- 3. Create Groupage Trip Cost Allocations Summary Table
CREATE TABLE IF NOT EXISTS public.groupage_trip_cost_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE,
    trip_id BIGINT NOT NULL REFERENCES public.trip_orders(id) ON DELETE CASCADE,
    allocation_mode VARCHAR(30) NOT NULL DEFAULT 'chargeable_weight', -- 'chargeable_weight' | 'ldm'
    total_fuel_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_ferry_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_tolls_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_customs_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_driver_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_shared_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_revenue NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_net_profit NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    overall_profit_margin_pct NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(5) NOT NULL DEFAULT 'MAD',
    consignments_count INTEGER NOT NULL DEFAULT 0,
    allocated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_groupage_alloc_trip_id ON public.groupage_trip_cost_allocations(trip_id);
CREATE INDEX IF NOT EXISTS idx_groupage_alloc_company_id ON public.groupage_trip_cost_allocations(company_id);
CREATE INDEX IF NOT EXISTS idx_trip_consignments_invoice_id ON public.trip_consignments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_consignment_id ON public.invoices(consignment_id);

-- Enable RLS
ALTER TABLE public.groupage_trip_cost_allocations ENABLE ROW LEVEL SECURITY;

-- Multi-Tenant RLS Policies
DROP POLICY IF EXISTS "Tenant isolation: groupage cost allocations access" ON public.groupage_trip_cost_allocations;
CREATE POLICY "Tenant isolation: groupage cost allocations access"
    ON public.groupage_trip_cost_allocations
    FOR ALL
    USING (
        company_id IS NULL OR
        company_id = (SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1) OR
        (SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1) = 'super_admin'
    );

