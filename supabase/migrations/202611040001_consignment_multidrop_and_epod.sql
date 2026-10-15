-- ==============================================================================
-- Trans Bodanon TMS — Migration: Multi-Drop Sequencing & Consignment-Level e-POD
-- Framework: Multi-Drop Routing, HMAC-SHA256 Forensic e-POD & Isolated Client Tracking
-- ==============================================================================

-- 1. Extend trip_consignments with multi-drop sequencing and e-POD verification fields
ALTER TABLE public.trip_consignments
    ADD COLUMN IF NOT EXISTS drop_sequence INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS delivery_contact_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS delivery_contact_phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS delivery_dock_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS epod_signer_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS epod_signer_role VARCHAR(100),
    ADD COLUMN IF NOT EXISTS epod_signature_url TEXT,
    ADD COLUMN IF NOT EXISTS epod_photo_url TEXT,
    ADD COLUMN IF NOT EXISTS epod_gps_lat NUMERIC(10, 7),
    ADD COLUMN IF NOT EXISTS epod_gps_lng NUMERIC(10, 7),
    ADD COLUMN IF NOT EXISTS epod_signed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS epod_hmac_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS tracking_token VARCHAR(64) UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex');

-- 2. Indexes for multi-drop sequence and isolated public tracking
CREATE INDEX IF NOT EXISTS idx_trip_consignments_drop_seq ON public.trip_consignments(trip_id, drop_sequence);
CREATE INDEX IF NOT EXISTS idx_trip_consignments_token ON public.trip_consignments(tracking_token);
CREATE INDEX IF NOT EXISTS idx_trip_consignments_epod_hash ON public.trip_consignments(epod_hmac_hash);

-- 3. Storage bucket for consignment e-POD signatures and photos (if not already exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('consignment-epods', 'consignment-epods', true)
ON CONFLICT (id) DO NOTHING;

-- Multi-Tenant RLS on storage objects for consignment-epods
DROP POLICY IF EXISTS "Public access to consignment epod artifacts" ON storage.objects;
CREATE POLICY "Public access to consignment epod artifacts"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'consignment-epods');

DROP POLICY IF EXISTS "Authenticated drivers can upload consignment epods" ON storage.objects;
CREATE POLICY "Authenticated drivers can upload consignment epods"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'consignment-epods');

