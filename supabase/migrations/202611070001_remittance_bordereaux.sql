-- ==============================================================================
-- Trans Bodanon TMS — Migration: Bank Remittance Bordereau & LCN Export Gateway
-- Framework: Multi-Tenant Moroccan Bank Remittance Slips (Bordereaux de Remise)
-- Encaissement (Collection) & Escompte (Discounting) with HMAC Security
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.remittance_bordereaux (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE,
    bordereau_number VARCHAR(100) NOT NULL,
    bordereau_type VARCHAR(40) NOT NULL, -- 'encaissement' | 'escompte'
    bank_account_id BIGINT REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
    bank_name VARCHAR(150),
    bank_rib VARCHAR(50),
    total_face_value NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    bills_count INT NOT NULL DEFAULT 0,
    estimated_agios NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    estimated_vat NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    estimated_net_proceeds NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    discount_rate NUMERIC(6, 3),
    bank_commission NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    remittance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    security_hash VARCHAR(64) NOT NULL,
    bill_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for querying
CREATE INDEX IF NOT EXISTS idx_remittance_bordereaux_company_id ON public.remittance_bordereaux(company_id);
CREATE INDEX IF NOT EXISTS idx_remittance_bordereaux_number ON public.remittance_bordereaux(bordereau_number);
CREATE INDEX IF NOT EXISTS idx_remittance_bordereaux_type ON public.remittance_bordereaux(bordereau_type);
CREATE INDEX IF NOT EXISTS idx_remittance_bordereaux_remittance_date ON public.remittance_bordereaux(remittance_date DESC);
CREATE INDEX IF NOT EXISTS idx_remittance_bordereaux_bank_account ON public.remittance_bordereaux(bank_account_id);

-- Enable RLS
ALTER TABLE public.remittance_bordereaux ENABLE ROW LEVEL SECURITY;

-- Multi-Tenant RLS Policy
DROP POLICY IF EXISTS "Tenant isolation: remittance bordereaux access" ON public.remittance_bordereaux;
CREATE POLICY "Tenant isolation: remittance bordereaux access"
    ON public.remittance_bordereaux
    FOR ALL
    USING (
        company_id IS NULL OR
        company_id = (SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1) OR
        (SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1) = 'super_admin'
    );

