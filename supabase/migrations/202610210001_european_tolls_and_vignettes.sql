-- ==============================================================================
-- Trans Bodanon TMS — Migration: European Electronic Tolls & Eurovignette Engine
-- Integration with DKV, Telepass EU, AS 24 Pass, Via-T (ES), Télépéage (FR),
-- LKW-Maut (DE), and Northern Eurovignettes (NL/BE/LU/DK/SE)
-- Migration ID: 202610210001_european_tolls_and_vignettes.sql
-- ==============================================================================

-- 1. Table for Provider Toll Invoice Batches (DKV, Telepass, AS 24, etc.)
CREATE TABLE IF NOT EXISTS public.toll_card_invoices (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('dkv', 'telepass', 'as24', 'eurotoll', 'totalenergies_pass', 'generic')),
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    billing_period_start DATE,
    billing_period_end DATE,
    total_net_eur NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_vat_eur NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_gross_eur NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'EUR',
    total_transactions_count INTEGER NOT NULL DEFAULT 0,
    matched_transactions_count INTEGER NOT NULL DEFAULT 0,
    total_vat_recoverable_eur NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    reconciliation_status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (reconciliation_status IN ('pending', 'partially_reconciled', 'reconciled', 'discrepancies_found')),
    source_file_name TEXT,
    source_file_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_company_provider_invoice UNIQUE (company_id, provider, invoice_number)
);

-- 2. Table for Individual Highway Toll Expenses & Vignettes linked to Trips
CREATE TABLE IF NOT EXISTS public.trip_toll_expenses (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE,
    trip_id BIGINT REFERENCES public.trip_orders(id) ON DELETE SET NULL,
    truck_id BIGINT REFERENCES public.trucks(id) ON DELETE SET NULL,
    invoice_batch_id BIGINT REFERENCES public.toll_card_invoices(id) ON DELETE SET NULL,
    
    toll_system TEXT NOT NULL CHECK (toll_system IN ('via_t', 'telepeage', 'lkw_maut', 'eurovignette', 'viapass', 'cemavat', 'generic_toll')),
    country_code TEXT NOT NULL CHECK (country_code IN ('ES', 'FR', 'DE', 'NL', 'BE', 'LU', 'DK', 'SE', 'PT', 'IT', 'MA', 'MR', 'SN')),
    provider TEXT NOT NULL CHECK (provider IN ('dkv', 'telepass', 'as24', 'eurotoll', 'totalenergies_pass', 'manual', 'generic')),
    
    card_or_obu_id TEXT, -- On-Board Unit ID / OBU PAN / Card number
    entry_gate TEXT,
    exit_gate TEXT NOT NULL,
    highway_code TEXT, -- e.g. 'AP-7', 'A9', 'A10', 'A-4', 'E15'
    entry_time TIMESTAMPTZ,
    exit_time TIMESTAMPTZ NOT NULL,
    distance_km NUMERIC(10, 2),
    
    -- Vehicle Specs
    vehicle_class TEXT NOT NULL DEFAULT 'class_4' CHECK (vehicle_class IN ('class_2', 'class_3', 'class_4', 'euro_vi_heavy')),
    axles_count INTEGER DEFAULT 5,
    gvw_tonnes NUMERIC(6, 2) DEFAULT 40.00,
    
    -- Financial Precision (EUR and MAD)
    net_amount_eur NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    vat_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.2000, -- 0.21 (ES), 0.20 (FR), 0.19 (DE), 0.00 (Eurovignette)
    vat_amount_eur NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    gross_amount_eur NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    exchange_rate_to_mad NUMERIC(12, 4) NOT NULL DEFAULT 10.8500,
    gross_amount_mad NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    
    -- EU 8th Directive VAT Recovery Eligibility
    vat_recoverable BOOLEAN NOT NULL DEFAULT true,
    vat_recovery_status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (vat_recovery_status IN ('pending', 'submitted', 'refunded', 'rejected', 'exempt')),
    
    -- Automated Matching and Fraud/Leakage Detection
    reconciliation_status TEXT NOT NULL DEFAULT 'unmatched' 
        CHECK (reconciliation_status IN ('matched', 'discrepancy', 'unmatched', 'flagged_leakage')),
    reconciliation_notes TEXT,
    gps_verified BOOLEAN NOT NULL DEFAULT false,
    
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- High-performance indexes
CREATE INDEX IF NOT EXISTS idx_toll_invoices_company ON public.toll_card_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_toll_invoices_provider ON public.toll_card_invoices(provider);
CREATE INDEX IF NOT EXISTS idx_toll_invoices_date ON public.toll_card_invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_toll_invoices_status ON public.toll_card_invoices(reconciliation_status);

CREATE INDEX IF NOT EXISTS idx_trip_tolls_company ON public.trip_toll_expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_trip_tolls_trip ON public.trip_toll_expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_tolls_truck ON public.trip_toll_expenses(truck_id);
CREATE INDEX IF NOT EXISTS idx_trip_tolls_batch ON public.trip_toll_expenses(invoice_batch_id);
CREATE INDEX IF NOT EXISTS idx_trip_tolls_system ON public.trip_toll_expenses(toll_system);
CREATE INDEX IF NOT EXISTS idx_trip_tolls_country ON public.trip_toll_expenses(country_code);
CREATE INDEX IF NOT EXISTS idx_trip_tolls_exit_time ON public.trip_toll_expenses(exit_time DESC);
CREATE INDEX IF NOT EXISTS idx_trip_tolls_reconcile ON public.trip_toll_expenses(reconciliation_status);
CREATE INDEX IF NOT EXISTS idx_trip_tolls_vat_rec ON public.trip_toll_expenses(vat_recovery_status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.toll_card_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_toll_expenses ENABLE ROW LEVEL SECURITY;

-- Multi-Tenant RLS Policies: toll_card_invoices
DROP POLICY IF EXISTS "toll_card_invoices_company_isolation" ON public.toll_card_invoices;
CREATE POLICY "toll_card_invoices_company_isolation" ON public.toll_card_invoices
    FOR ALL
    USING (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND (users.company_id = toll_card_invoices.company_id OR users.role = 'super_admin')
        )
    )
    WITH CHECK (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND (users.company_id = toll_card_invoices.company_id OR users.role = 'super_admin')
        )
    );

-- Multi-Tenant RLS Policies: trip_toll_expenses
DROP POLICY IF EXISTS "trip_toll_expenses_company_isolation" ON public.trip_toll_expenses;
CREATE POLICY "trip_toll_expenses_company_isolation" ON public.trip_toll_expenses
    FOR ALL
    USING (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND (users.company_id = trip_toll_expenses.company_id OR users.role = 'super_admin')
        )
    )
    WITH CHECK (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND (users.company_id = trip_toll_expenses.company_id OR users.role = 'super_admin')
        )
    );

