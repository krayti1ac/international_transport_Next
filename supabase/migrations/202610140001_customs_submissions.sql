-- ============================================================================
-- Migration: 202610140001_customs_submissions.sql
-- Description: Phase 5 / Epic 5: International Customs & Port Gateways (PortNet & IRU TIR-EPD)
-- Multi-Tenant RLS isolation, Idempotent customs submissions tracker, MRN & Barcode
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customs_submissions (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE,
    trip_id BIGINT NOT NULL REFERENCES public.trip_orders(id) ON DELETE CASCADE,
    gateway VARCHAR(32) NOT NULL CHECK (gateway IN ('portnet', 'tir_epd', 'badr')),
    idempotency_key VARCHAR(128) NOT NULL,
    reference_number VARCHAR(128) NOT NULL,
    mrn_number VARCHAR(64),
    barcode_url TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitting', 'submitted', 'accepted', 'rejected', 'pending', 'failed')),
    payload_xml TEXT,
    response_payload JSONB,
    error_message TEXT,
    mode VARCHAR(16) NOT NULL DEFAULT 'sandbox' CHECK (mode IN ('sandbox', 'production')),
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_customs_submissions_idempotency UNIQUE (company_id, idempotency_key)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_customs_submissions_trip_id ON public.customs_submissions(trip_id);
CREATE INDEX IF NOT EXISTS idx_customs_submissions_company_id ON public.customs_submissions(company_id);
CREATE INDEX IF NOT EXISTS idx_customs_submissions_idempotency ON public.customs_submissions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_customs_submissions_mrn ON public.customs_submissions(mrn_number);
CREATE INDEX IF NOT EXISTS idx_customs_submissions_status ON public.customs_submissions(status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.customs_submissions ENABLE ROW LEVEL SECURITY;

-- Multi-Tenant RLS Policy for Operations Staff & Admins
DROP POLICY IF EXISTS "staff_manage_customs_submissions" ON public.customs_submissions;
CREATE POLICY "staff_manage_customs_submissions" ON public.customs_submissions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND (
                users.role = 'super_admin'
                OR (
                    users.role IN ('admin', 'secretary', 'fleet_manager', 'accountant')
                    AND (users.company_id = customs_submissions.company_id OR customs_submissions.company_id IS NULL)
                )
            )
        )
    );
