-- ============================================================
-- Migration: Add missing trip_orders columns
-- Context: Remote database schema is missing columns expected
-- by the TripOrder interface and seed script
-- ============================================================

BEGIN;

-- Multi-tenancy
ALTER TABLE public.trip_orders ADD COLUMN IF NOT EXISTS company_id BIGINT;

-- Import tracking
ALTER TABLE public.trip_orders ADD COLUMN IF NOT EXISTS client_import_id BIGINT;
ALTER TABLE public.trip_orders ADD COLUMN IF NOT EXISTS trailer_id INTEGER;

-- Route split
ALTER TABLE public.trip_orders ADD COLUMN IF NOT EXISTS route_export TEXT;
ALTER TABLE public.trip_orders ADD COLUMN IF NOT EXISTS route_import TEXT;

-- Price split
ALTER TABLE public.trip_orders ADD COLUMN IF NOT EXISTS price_export NUMERIC;
ALTER TABLE public.trip_orders ADD COLUMN IF NOT EXISTS price_import NUMERIC;

-- Dates split
ALTER TABLE public.trip_orders ADD COLUMN IF NOT EXISTS unloading_date_export TEXT;
ALTER TABLE public.trip_orders ADD COLUMN IF NOT EXISTS loading_date_import TEXT;
ALTER TABLE public.trip_orders ADD COLUMN IF NOT EXISTS unloading_date_import TEXT;

-- CMR documents
ALTER TABLE public.trip_orders ADD COLUMN IF NOT EXISTS cmr_export_number TEXT;
ALTER TABLE public.trip_orders ADD COLUMN IF NOT EXISTS cmr_import_number TEXT;
ALTER TABLE public.trip_orders ADD COLUMN IF NOT EXISTS cmr_export_url TEXT;
ALTER TABLE public.trip_orders ADD COLUMN IF NOT EXISTS facture_url TEXT;
ALTER TABLE public.trip_orders ADD COLUMN IF NOT EXISTS phyto_url TEXT;
ALTER TABLE public.trip_orders ADD COLUMN IF NOT EXISTS mrn_export_url TEXT;
ALTER TABLE public.trip_orders ADD COLUMN IF NOT EXISTS cmr_import_url TEXT;

-- Ferry split
ALTER TABLE public.trip_orders ADD COLUMN IF NOT EXISTS ferry_company TEXT;
ALTER TABLE public.trip_orders ADD COLUMN IF NOT EXISTS ferry_localizador TEXT;
ALTER TABLE public.trip_orders ADD COLUMN IF NOT EXISTS ferry_company_import TEXT;
ALTER TABLE public.trip_orders ADD COLUMN IF NOT EXISTS ferry_localizador_import TEXT;

-- Goods split
ALTER TABLE public.trip_orders ADD COLUMN IF NOT EXISTS goods_description_export TEXT;
ALTER TABLE public.trip_orders ADD COLUMN IF NOT EXISTS goods_description_import TEXT;
ALTER TABLE public.trip_orders ADD COLUMN IF NOT EXISTS weight_export NUMERIC;
ALTER TABLE public.trip_orders ADD COLUMN IF NOT EXISTS weight_import NUMERIC;

COMMIT;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
