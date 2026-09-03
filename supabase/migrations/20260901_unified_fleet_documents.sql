-- Migration: Unified Fleet Documents and Renewal System
-- Database Engine: PostgreSQL 14+ / Supabase

-- 1. Create or update fleet_documents table
CREATE TABLE IF NOT EXISTS public.fleet_documents (
    id BIGSERIAL PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id BIGINT NOT NULL,
    document_type TEXT NOT NULL,
    document_number TEXT,
    file_url TEXT,
    issue_date DATE,
    expiry_date DATE,
    previous_expiry_date DATE,
    cost NUMERIC(15, 2) DEFAULT 0,
    currency TEXT DEFAULT 'MAD',
    notes TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all required columns exist idempotently
ALTER TABLE public.fleet_documents ADD COLUMN IF NOT EXISTS document_number TEXT;
ALTER TABLE public.fleet_documents ADD COLUMN IF NOT EXISTS issue_date DATE;
ALTER TABLE public.fleet_documents ADD COLUMN IF NOT EXISTS previous_expiry_date DATE;
ALTER TABLE public.fleet_documents ADD COLUMN IF NOT EXISTS cost NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.fleet_documents ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'MAD';
ALTER TABLE public.fleet_documents ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.fleet_documents ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.fleet_documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Create or update fleet_document_renewals audit trail table
CREATE TABLE IF NOT EXISTS public.fleet_document_renewals (
    id BIGSERIAL PRIMARY KEY,
    fleet_document_id BIGINT REFERENCES public.fleet_documents(id) ON DELETE CASCADE,
    document_id BIGINT,
    previous_expiry_date DATE,
    new_expiry_date DATE NOT NULL,
    renewal_cost NUMERIC(15, 2) DEFAULT 0,
    cost NUMERIC(15, 2) DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'MAD',
    document_type TEXT,
    notes TEXT,
    created_by UUID,
    treasury_transaction_id BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure renewal columns exist idempotently
ALTER TABLE public.fleet_document_renewals ADD COLUMN IF NOT EXISTS document_id BIGINT;
ALTER TABLE public.fleet_document_renewals ADD COLUMN IF NOT EXISTS previous_expiry_date DATE;
ALTER TABLE public.fleet_document_renewals ADD COLUMN IF NOT EXISTS renewal_cost NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.fleet_document_renewals ADD COLUMN IF NOT EXISTS cost NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.fleet_document_renewals ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'MAD';
ALTER TABLE public.fleet_document_renewals ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_fleet_docs_entity ON public.fleet_documents(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_fleet_docs_expiry ON public.fleet_documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_fleet_docs_archived ON public.fleet_documents(is_archived);
CREATE INDEX IF NOT EXISTS idx_fleet_renewals_doc_id ON public.fleet_document_renewals(fleet_document_id);
