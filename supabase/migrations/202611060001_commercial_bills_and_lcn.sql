-- ==============================================================================
-- Trans Bodanon TMS — Migration: Commercial Bills, Promissory Notes & LCN Management
-- Framework: Multi-Tenant LCN & Checks Lifecycle / Treasury Integration / FIFO Settlement
-- ==============================================================================

-- 1. Create commercial_bills table
CREATE TABLE IF NOT EXISTS public.commercial_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE,
    bill_type VARCHAR(30) NOT NULL DEFAULT 'lcn_promissory_note', -- 'lcn_promissory_note' (LCN), 'cheque', 'traite'
    bill_number VARCHAR(80) NOT NULL,
    client_id BIGINT REFERENCES public.clients(id) ON DELETE SET NULL,
    client_name VARCHAR(255) NOT NULL,
    issuer_name VARCHAR(255), -- Tireur / Émetteur
    drawer_bank_name VARCHAR(100), -- Banque tirée (Attijariwafa, BCP, BMCE, CIH, SGMB, etc.)
    drawer_bank_rib VARCHAR(34), -- RIB bancaire 24 chiffres
    face_value NUMERIC(14, 2) NOT NULL, -- Valeur nominale
    currency VARCHAR(5) NOT NULL DEFAULT 'MAD',
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL, -- Date d'échéance
    status VARCHAR(40) NOT NULL DEFAULT 'in_portfolio', -- 'in_portfolio', 'remitted_for_collection', 'discounted', 'cleared', 'bounced_unpaid', 'cancelled'
    remittance_date DATE, -- Date de remise en banque
    remittance_bank_account_id BIGINT REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
    remittance_reference VARCHAR(100), -- N° Bordereau de remise
    cleared_date DATE, -- Date réelle de valeur / encaissement
    cleared_amount NUMERIC(14, 2), -- Montant net encaissé
    discount_fee NUMERIC(14, 2) NOT NULL DEFAULT 0.00, -- Agios / Frais d'escompte
    bounce_reason TEXT, -- Motif de rejet (défaut de provision, signature, etc.)
    bounce_date DATE,
    bounce_fee NUMERIC(14, 2) NOT NULL DEFAULT 0.00, -- Frais d'impayé / rejet
    treasury_transaction_id BIGINT REFERENCES public.treasury_transactions(id) ON DELETE SET NULL,
    allocated_invoice_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    image_url TEXT, -- Scan ou photo du titre
    notes TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_commercial_bills_company_id ON public.commercial_bills(company_id);
CREATE INDEX IF NOT EXISTS idx_commercial_bills_client_id ON public.commercial_bills(client_id);
CREATE INDEX IF NOT EXISTS idx_commercial_bills_status ON public.commercial_bills(status);
CREATE INDEX IF NOT EXISTS idx_commercial_bills_due_date ON public.commercial_bills(due_date);
CREATE INDEX IF NOT EXISTS idx_commercial_bills_bill_number ON public.commercial_bills(bill_number);
CREATE INDEX IF NOT EXISTS idx_commercial_bills_created_at ON public.commercial_bills(created_at DESC);

-- Enable RLS
ALTER TABLE public.commercial_bills ENABLE ROW LEVEL SECURITY;

-- Multi-Tenant RLS Policy
DROP POLICY IF EXISTS "Tenant isolation: commercial bills access" ON public.commercial_bills;
CREATE POLICY "Tenant isolation: commercial bills access"
    ON public.commercial_bills
    FOR ALL
    USING (
        company_id IS NULL OR
        company_id = (SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1) OR
        (SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1) = 'super_admin'
    );

-- 2. Storage Bucket for Scanned Commercial Bills & Checks
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'commercial-bills',
    'commercial-bills',
    true,
    15728640, -- 15MB
    ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
DROP POLICY IF EXISTS "Allow authenticated users to read commercial bills" ON storage.objects;
CREATE POLICY "Allow authenticated users to read commercial bills"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'commercial-bills');

DROP POLICY IF EXISTS "Allow authenticated users to upload commercial bills" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload commercial bills"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'commercial-bills');

