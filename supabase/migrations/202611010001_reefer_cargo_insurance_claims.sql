-- 202611010001_reefer_cargo_insurance_claims.sql
-- Reefer Cargo Loss & Insurance Claim Settlement Engine (ATP / INCOTERMS / GDP)
-- Automated Indemnity Calculation, Deductible Slicing, and e-POD Cold Chain Incident Reconciliation

-- 1. جدول ملفات مطالبات التأمين على تلف الشحنات المبردة
CREATE TABLE IF NOT EXISTS public.reefer_cargo_insurance_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id BIGINT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    claim_reference VARCHAR(100) NOT NULL UNIQUE, -- e.g. "CLM-2026-8840-A1"
    annex_id VARCHAR(100), -- رابط ملحق الحادثة e-POD Cold Chain Incident Annex
    trip_id BIGINT NOT NULL REFERENCES public.trip_orders(id) ON DELETE CASCADE,
    cargo_category VARCHAR(50) NOT NULL DEFAULT 'fresh_produce', -- deep_frozen, fresh_produce, pharma_cold, meat_chilled
    insured_cargo_value NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'MAD',
    depreciation_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00, -- نسبة التلف المحتسبة
    gross_loss_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00, -- إجمالي الخسارة
    deductible_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00, -- مبلغ التحمل التأميني (Franchise)
    net_indemnity_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00, -- صافي مبلغ التعويض المستحق
    insurer_name VARCHAR(150) NOT NULL DEFAULT 'Allianz Maroc / RMA Watanya',
    policy_number VARCHAR(100) NOT NULL DEFAULT 'POL-FRIGO-2026-TANGIER',
    claim_status VARCHAR(30) NOT NULL DEFAULT 'draft', -- draft, under_review, approved_by_insurer, settled, rejected
    settlement_type VARCHAR(30) NOT NULL DEFAULT 'credit_note', -- credit_note, cash_payout, insurance_wire
    credit_note_number VARCHAR(100), -- رقم الإشعار الدائن في حال تسوية الفاتورة
    claim_dossier_hash VARCHAR(128) NOT NULL, -- ختم التشفير HMAC-SHA256
    settled_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. جدول بنود تفاصيل تلف البضائع في المطالبة التأمينية
CREATE TABLE IF NOT EXISTS public.reefer_claim_settlement_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES public.reefer_cargo_insurance_claims(id) ON DELETE CASCADE,
    item_description VARCHAR(255) NOT NULL,
    affected_quantity NUMERIC(12, 2) NOT NULL DEFAULT 1.00,
    unit_of_measure VARCHAR(30) NOT NULL DEFAULT 'kg', -- kg, pallet, box, ton
    unit_value NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    depreciation_pct NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    line_loss_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. تفعيل الأمان وسياسات عزل المستأجرين (RLS)
ALTER TABLE public.reefer_cargo_insurance_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reefer_claim_settlement_lines ENABLE ROW LEVEL SECURITY;

-- سياسات جدول المطالبات الرئيسي
DROP POLICY IF EXISTS "reefer_claims_company_isolation_policy" ON public.reefer_cargo_insurance_claims;
CREATE POLICY "reefer_claims_company_isolation_policy" ON public.reefer_cargo_insurance_claims
    FOR ALL
    USING (
        company_id IN (
            SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()
        )
    )
    WITH CHECK (
        company_id IN (
            SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()
        )
    );

-- سياسات جدول بنود المطالبات التابعة
DROP POLICY IF EXISTS "reefer_claim_lines_company_isolation_policy" ON public.reefer_claim_settlement_lines;
CREATE POLICY "reefer_claim_lines_company_isolation_policy" ON public.reefer_claim_settlement_lines
    FOR ALL
    USING (
        claim_id IN (
            SELECT c.id FROM public.reefer_cargo_insurance_claims c
            WHERE c.company_id IN (
                SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()
            )
        )
    )
    WITH CHECK (
        claim_id IN (
            SELECT c.id FROM public.reefer_cargo_insurance_claims c
            WHERE c.company_id IN (
                SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()
            )
        )
    );

-- 4. الفهارس لتسريع الاستعلام
CREATE INDEX IF NOT EXISTS idx_reefer_claims_company_trip ON public.reefer_cargo_insurance_claims(company_id, trip_id);
CREATE INDEX IF NOT EXISTS idx_reefer_claims_status ON public.reefer_cargo_insurance_claims(claim_status);
CREATE INDEX IF NOT EXISTS idx_reefer_claims_annex ON public.reefer_cargo_insurance_claims(annex_id);
CREATE INDEX IF NOT EXISTS idx_reefer_claim_lines_claim ON public.reefer_claim_settlement_lines(claim_id);

