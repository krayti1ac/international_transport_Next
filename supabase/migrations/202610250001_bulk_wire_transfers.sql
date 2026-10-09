-- ==============================================================================
-- Trans Bodanon TMS — Migration: B2B Bulk Wire Transfer & SEPA / Moroccan LCN
-- ISO 20022 Pain.001.001.03 Credit Transfer & Moroccan Interbank Virement Engine
-- Migration ID: 202610250001_bulk_wire_transfers.sql
-- ==============================================================================

-- 1. Ensure banking columns exist on drivers and bank_accounts
ALTER TABLE IF EXISTS public.drivers
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_rib TEXT,
ADD COLUMN IF NOT EXISTS bank_iban TEXT,
ADD COLUMN IF NOT EXISTS bank_bic TEXT;

ALTER TABLE IF EXISTS public.bank_accounts
ADD COLUMN IF NOT EXISTS rib TEXT,
ADD COLUMN IF NOT EXISTS iban TEXT,
ADD COLUMN IF NOT EXISTS bic_swift TEXT;

-- 2. Table for Bulk Wire Transfer Batches (دفعات التحويلات البنكية المجمعة)
CREATE TABLE IF NOT EXISTS public.bulk_transfer_batches (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE,
    batch_reference TEXT NOT NULL UNIQUE,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('sepa_credit_transfer', 'moroccan_lcn_virement', 'standard_wire')),
    source_bank_account_id BIGINT REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'MAD',
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    transactions_count INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'exported', 'executed', 'cancelled')),
    execution_date DATE NOT NULL DEFAULT CURRENT_DATE,
    format_type TEXT NOT NULL CHECK (format_type IN ('pain_001_001_03', 'moroccan_lcn_virement', 'csv_banking')),
    file_content TEXT,
    file_name TEXT,
    generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    generated_at TIMESTAMPTZ,
    exported_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Table for Bulk Wire Transfer Items (بنود المعاملات الفردية داخل الدفعة)
CREATE TABLE IF NOT EXISTS public.bulk_transfer_items (
    id BIGSERIAL PRIMARY KEY,
    batch_id BIGINT NOT NULL REFERENCES public.bulk_transfer_batches(id) ON DELETE CASCADE,
    company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE,
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('driver', 'supplier', 'carrier', 'partner')),
    recipient_id BIGINT,
    recipient_name TEXT NOT NULL,
    bank_name TEXT,
    bank_account_rib TEXT,
    bank_account_iban TEXT,
    bank_bic_swift TEXT,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'MAD',
    settlement_statement_id BIGINT REFERENCES public.driver_settlement_statements(id) ON DELETE SET NULL,
    end_to_end_id TEXT NOT NULL,
    remittance_information TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'included', 'executed', 'rejected')),
    rejection_reason TEXT,
    validation_status TEXT NOT NULL DEFAULT 'valid' CHECK (validation_status IN ('valid', 'warning', 'invalid')),
    validation_errors TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_bulk_batches_company ON public.bulk_transfer_batches(company_id);
CREATE INDEX IF NOT EXISTS idx_bulk_batches_status ON public.bulk_transfer_batches(status);
CREATE INDEX IF NOT EXISTS idx_bulk_batches_exec_date ON public.bulk_transfer_batches(execution_date DESC);
CREATE INDEX IF NOT EXISTS idx_bulk_batches_ref ON public.bulk_transfer_batches(batch_reference);

CREATE INDEX IF NOT EXISTS idx_bulk_items_batch ON public.bulk_transfer_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_bulk_items_company ON public.bulk_transfer_items(company_id);
CREATE INDEX IF NOT EXISTS idx_bulk_items_status ON public.bulk_transfer_items(status);
CREATE INDEX IF NOT EXISTS idx_bulk_items_settlement ON public.bulk_transfer_items(settlement_statement_id);
CREATE INDEX IF NOT EXISTS idx_bulk_items_recipient ON public.bulk_transfer_items(recipient_type, recipient_id);

-- 5. Row Level Security (RLS) Configuration
ALTER TABLE public.bulk_transfer_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_transfer_items ENABLE ROW LEVEL SECURITY;

-- Multi-Tenant RLS: bulk_transfer_batches
DROP POLICY IF EXISTS "bulk_batches_company_isolation" ON public.bulk_transfer_batches;
CREATE POLICY "bulk_batches_company_isolation" ON public.bulk_transfer_batches
    FOR ALL
    USING (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (role IN ('super_admin', 'admin', 'accountant')
                 AND (company_id = bulk_transfer_batches.company_id OR role = 'super_admin'))
        )
    )
    WITH CHECK (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'admin', 'accountant')
            AND (company_id = bulk_transfer_batches.company_id OR role = 'super_admin')
        )
    );

-- Multi-Tenant RLS: bulk_transfer_items
DROP POLICY IF EXISTS "bulk_items_company_isolation" ON public.bulk_transfer_items;
CREATE POLICY "bulk_items_company_isolation" ON public.bulk_transfer_items
    FOR ALL
    USING (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (role IN ('super_admin', 'admin', 'accountant')
                 AND (company_id = bulk_transfer_items.company_id OR role = 'super_admin'))
        )
    )
    WITH CHECK (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'admin', 'accountant')
            AND (company_id = bulk_transfer_items.company_id OR role = 'super_admin')
        )
    );
