-- ==============================================================================
-- Trans Bodanon TMS — Migration: AI Transport Order & Packing List Parser Engine
-- Enhancements: hs_code & source_document on trip_consignments, parsing audit log table
-- ==============================================================================

-- 1. Extend trip_consignments with HS Code and Source Document metadata
ALTER TABLE public.trip_consignments 
ADD COLUMN IF NOT EXISTS hs_code VARCHAR(30),
ADD COLUMN IF NOT EXISTS source_document_name VARCHAR(255);

-- 2. Create packing_list_parsing_logs for AI document ingestion tracking
CREATE TABLE IF NOT EXISTS public.packing_list_parsing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE,
    trip_id BIGINT REFERENCES public.trip_orders(id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT,
    file_mime_type VARCHAR(100),
    document_type VARCHAR(50) DEFAULT 'packing_list',
    extracted_consignments_count INTEGER DEFAULT 0,
    confidence_score NUMERIC(5, 2) DEFAULT 0.00,
    ai_model_used VARCHAR(50),
    extracted_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'pending', -- 'pending', 'parsed', 'converted', 'failed'
    error_message TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for audit query optimization
CREATE INDEX IF NOT EXISTS idx_parsing_logs_company_id ON public.packing_list_parsing_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_parsing_logs_trip_id ON public.packing_list_parsing_logs(trip_id);
CREATE INDEX IF NOT EXISTS idx_parsing_logs_created_at ON public.packing_list_parsing_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parsing_logs_status ON public.packing_list_parsing_logs(status);

-- Enable RLS
ALTER TABLE public.packing_list_parsing_logs ENABLE ROW LEVEL SECURITY;

-- Multi-Tenant RLS Policy
DROP POLICY IF EXISTS "Tenant isolation: packing list parsing logs access" ON public.packing_list_parsing_logs;
CREATE POLICY "Tenant isolation: packing list parsing logs access"
    ON public.packing_list_parsing_logs
    FOR ALL
    USING (
        company_id IS NULL OR
        company_id = (SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1) OR
        (SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1) = 'super_admin'
    );

-- 3. Storage Bucket for Shipping Documents & Packing Lists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'shipping-documents',
    'shipping-documents',
    true,
    20971520, -- 20MB
    ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
DROP POLICY IF EXISTS "Allow authenticated users to read shipping documents" ON storage.objects;
CREATE POLICY "Allow authenticated users to read shipping documents"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'shipping-documents');

DROP POLICY IF EXISTS "Allow authenticated users to upload shipping documents" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload shipping documents"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'shipping-documents');

