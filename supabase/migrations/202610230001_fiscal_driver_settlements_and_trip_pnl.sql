-- ==============================================================================
-- Trans Bodanon TMS — Migration: Fiscal Driver Settlements & Trip P&L Closings
-- Closed-Loop International Freight Expense Reconciliation & Month-End Audits
-- Migration ID: 202610230001_fiscal_driver_settlements_and_trip_pnl.sql
-- ==============================================================================

-- 1. Table for Driver Expense Settlement Statements (Décompte de Frais de Route)
CREATE TABLE IF NOT EXISTS public.driver_settlement_statements (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE,
    statement_number TEXT NOT NULL UNIQUE,
    driver_id BIGINT NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'audited', 'approved', 'settled', 'cancelled')),

    -- Driver Compensation (MAD)
    base_salary_mad NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    mission_bonuses_mad NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    safety_bonus_mad NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    gross_driver_earnings_mad NUMERIC(15, 2) NOT NULL DEFAULT 0.00,

    -- Trip Operational Advances & Documented Expenses (MAD)
    total_advances_mad NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_fuel_expenses_mad NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_toll_expenses_mad NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_ferry_expenses_mad NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_port_customs_mad NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_fines_mad NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_other_expenses_mad NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_driver_expenses_mad NUMERIC(15, 2) NOT NULL DEFAULT 0.00,

    -- Reconciliation Result (MAD)
    -- Positive: Driver spent more than advances (Company owes driver)
    -- Negative: Driver spent less than advances (Driver owes company)
    expenses_advances_balance_mad NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    
    -- Net Payout to Driver (MAD)
    -- net_payout = gross_driver_earnings + expenses_advances_balance - total_fines
    net_payout_mad NUMERIC(15, 2) NOT NULL DEFAULT 0.00,

    -- Trip Operational Metrics
    trips_count INTEGER NOT NULL DEFAULT 0,
    total_distance_km NUMERIC(10, 2) NOT NULL DEFAULT 0.00,

    -- Audit & Operational References
    trip_ids JSONB DEFAULT '[]'::jsonb,
    advance_ids JSONB DEFAULT '[]'::jsonb,
    toll_expense_ids JSONB DEFAULT '[]'::jsonb,
    fine_ids JSONB DEFAULT '[]'::jsonb,
    itemized_expenses JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit Trail & Status Lifecyle
    audited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    audited_at TIMESTAMPTZ,
    approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    treasury_tx_id BIGINT REFERENCES public.treasury_transactions(id) ON DELETE SET NULL,
    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Table for Trip Fiscal Closings & Profitability Audits
CREATE TABLE IF NOT EXISTS public.trip_fiscal_closings (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE,
    trip_id BIGINT NOT NULL UNIQUE REFERENCES public.trip_orders(id) ON DELETE CASCADE,
    fiscal_period TEXT NOT NULL, -- e.g. '2026-10'

    -- Financial Breakdown (MAD)
    revenue_mad NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    fuel_cost_mad NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    tolls_cost_mad NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    ferry_cost_mad NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    customs_ports_cost_mad NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    driver_cost_mad NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    other_costs_mad NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_costs_mad NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    gross_profit_mad NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    profit_margin_pct NUMERIC(6, 2) NOT NULL DEFAULT 0.00,

    is_closed BOOLEAN NOT NULL DEFAULT false,
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comments for Schema Documentation
COMMENT ON TABLE public.driver_settlement_statements IS 'كشوفات تصفية وتسوية مستحقات ومصاريف السائقين الشهرية والدولية (Décompte de frais & إبراء ذمة)';
COMMENT ON TABLE public.trip_fiscal_closings IS 'إغلاق ومصادقة الميزانية التشغيلية وأرباح الرحلات الدولية';

-- High-performance indexes
CREATE INDEX IF NOT EXISTS idx_settlement_stmts_company ON public.driver_settlement_statements(company_id);
CREATE INDEX IF NOT EXISTS idx_settlement_stmts_driver ON public.driver_settlement_statements(driver_id);
CREATE INDEX IF NOT EXISTS idx_settlement_stmts_status ON public.driver_settlement_statements(status);
CREATE INDEX IF NOT EXISTS idx_settlement_stmts_period ON public.driver_settlement_statements(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_settlement_stmts_number ON public.driver_settlement_statements(statement_number);

CREATE INDEX IF NOT EXISTS idx_trip_closings_company ON public.trip_fiscal_closings(company_id);
CREATE INDEX IF NOT EXISTS idx_trip_closings_trip ON public.trip_fiscal_closings(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_closings_period ON public.trip_fiscal_closings(fiscal_period);
CREATE INDEX IF NOT EXISTS idx_trip_closings_closed ON public.trip_fiscal_closings(is_closed);

-- Enable Row Level Security (RLS)
ALTER TABLE public.driver_settlement_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_fiscal_closings ENABLE ROW LEVEL SECURITY;

-- Multi-Tenant RLS Policies: driver_settlement_statements
DROP POLICY IF EXISTS "settlement_stmts_company_isolation" ON public.driver_settlement_statements;
CREATE POLICY "settlement_stmts_company_isolation" ON public.driver_settlement_statements
    FOR ALL
    USING (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (role IN ('super_admin', 'admin', 'accountant', 'fleet_manager')
                 AND (company_id = driver_settlement_statements.company_id OR role = 'super_admin'))
        )
        OR (
            -- Drivers can view their own statements
            driver_id IN (
                SELECT id FROM public.drivers WHERE user_id = auth.uid()
            )
        )
    )
    WITH CHECK (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'admin', 'accountant')
            AND (company_id = driver_settlement_statements.company_id OR role = 'super_admin')
        )
    );

-- Multi-Tenant RLS Policies: trip_fiscal_closings
DROP POLICY IF EXISTS "trip_closings_company_isolation" ON public.trip_fiscal_closings;
CREATE POLICY "trip_closings_company_isolation" ON public.trip_fiscal_closings
    FOR ALL
    USING (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (role IN ('super_admin', 'admin', 'accountant', 'fleet_manager')
                 AND (company_id = trip_fiscal_closings.company_id OR role = 'super_admin'))
        )
    )
    WITH CHECK (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'admin', 'accountant')
            AND (company_id = trip_fiscal_closings.company_id OR role = 'super_admin')
        )
    );

