-- ============================================================================
-- Trans Bodanon TMS — Payment Links & Automated Recurring Invoices Migration
-- Phase: Multi-Gateway Online Settlement (Stripe / CMI) & Recurring Billing
-- ============================================================================

-- 1. Table: payment_links
CREATE TABLE IF NOT EXISTS public.payment_links (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE DEFAULT 1,
    invoice_id BIGINT REFERENCES public.invoices(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    client_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    gateway TEXT NOT NULL CHECK (gateway IN ('stripe', 'cmi', 'multi', 'bank_transfer')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid', 'expired', 'cancelled')),
    currency TEXT NOT NULL DEFAULT 'MAD' CHECK (currency IN ('MAD', 'EUR', 'USD', 'GBP', 'MRU', 'XOF')),
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    paid_amount NUMERIC(15, 2) DEFAULT 0.00 CHECK (paid_amount >= 0),
    gateway_fee_amount NUMERIC(15, 2) DEFAULT 0.00 CHECK (gateway_fee_amount >= 0),
    net_settled_amount NUMERIC(15, 2) DEFAULT 0.00 CHECK (net_settled_amount >= 0),
    stripe_payment_link_url TEXT,
    stripe_session_id TEXT,
    cmi_order_id TEXT,
    cmi_hash TEXT,
    pay_url TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for payment_links
CREATE INDEX IF NOT EXISTS idx_payment_links_token ON public.payment_links(token);
CREATE INDEX IF NOT EXISTS idx_payment_links_invoice_id ON public.payment_links(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_company_id ON public.payment_links(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_status ON public.payment_links(status);

-- 2. Table: recurring_invoice_schedules
CREATE TABLE IF NOT EXISTS public.recurring_invoice_schedules (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE DEFAULT 1,
    client_id TEXT NOT NULL,
    title TEXT NOT NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'annually')),
    currency TEXT NOT NULL DEFAULT 'MAD' CHECK (currency IN ('MAD', 'EUR', 'USD', 'GBP', 'MRU', 'XOF')),
    amount_ht NUMERIC(15, 2) NOT NULL CHECK (amount_ht > 0),
    tva_rate NUMERIC(5, 2) DEFAULT 0.00,
    tva_amount NUMERIC(15, 2) DEFAULT 0.00,
    total_amount_ttc NUMERIC(15, 2) NOT NULL CHECK (total_amount_ttc > 0),
    is_article92_exempt BOOLEAN DEFAULT true,
    start_date DATE NOT NULL,
    end_date DATE,
    next_issue_date DATE NOT NULL,
    last_issued_date DATE,
    billing_day_of_month INTEGER DEFAULT 1 CHECK (billing_day_of_month BETWEEN 1 AND 31),
    auto_send_email BOOLEAN DEFAULT true,
    auto_send_whatsapp BOOLEAN DEFAULT true,
    auto_generate_payment_link BOOLEAN DEFAULT true,
    preferred_gateway TEXT DEFAULT 'multi' CHECK (preferred_gateway IN ('stripe', 'cmi', 'multi', 'bank_transfer')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
    total_cycles_completed INTEGER DEFAULT 0 CHECK (total_cycles_completed >= 0),
    max_cycles INTEGER,
    items_breakdown JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for recurring_invoice_schedules
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_company_id ON public.recurring_invoice_schedules(company_id);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_client_id ON public.recurring_invoice_schedules(client_id);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_status ON public.recurring_invoice_schedules(status);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_next_issue ON public.recurring_invoice_schedules(next_issue_date);

-- Enable RLS
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_invoice_schedules ENABLE ROW LEVEL SECURITY;

-- Policies for payment_links
DROP POLICY IF EXISTS "payment_links_tenant_isolation" ON public.payment_links;
CREATE POLICY "payment_links_tenant_isolation" ON public.payment_links
    FOR ALL
    USING (
        auth.role() = 'service_role' OR
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint OR
        company_id = 1
    );

-- Allow public read of payment link by token (for pay/[token] landing page)
DROP POLICY IF EXISTS "payment_links_public_token_read" ON public.payment_links;
CREATE POLICY "payment_links_public_token_read" ON public.payment_links
    FOR SELECT
    USING (status = 'active' OR status = 'paid');

-- Policies for recurring_invoice_schedules
DROP POLICY IF EXISTS "recurring_schedules_tenant_isolation" ON public.recurring_invoice_schedules;
CREATE POLICY "recurring_schedules_tenant_isolation" ON public.recurring_invoice_schedules
    FOR ALL
    USING (
        auth.role() = 'service_role' OR
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint OR
        company_id = 1
    );
