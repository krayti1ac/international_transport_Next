-- ============================================================================
-- Migration: 202610150001_add_customs_clearance_columns.sql
-- Description: Sovereign Customs & Port Clearance Tracking Columns for trip_orders
-- Integrates BADR DUM MRN, BAE clearance release, and PortNet Gate Pass status
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'trip_orders' AND column_name = 'customs_status'
    ) THEN
        ALTER TABLE public.trip_orders ADD COLUMN customs_status VARCHAR(32) DEFAULT 'pending';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'trip_orders' AND column_name = 'customs_mrn'
    ) THEN
        ALTER TABLE public.trip_orders ADD COLUMN customs_mrn VARCHAR(64);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'trip_orders' AND column_name = 'customs_declaration_number'
    ) THEN
        ALTER TABLE public.trip_orders ADD COLUMN customs_declaration_number VARCHAR(64);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'trip_orders' AND column_name = 'customs_channel'
    ) THEN
        ALTER TABLE public.trip_orders ADD COLUMN customs_channel VARCHAR(16);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'trip_orders' AND column_name = 'customs_bae_number'
    ) THEN
        ALTER TABLE public.trip_orders ADD COLUMN customs_bae_number VARCHAR(64);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'trip_orders' AND column_name = 'customs_bae_date'
    ) THEN
        ALTER TABLE public.trip_orders ADD COLUMN customs_bae_date TIMESTAMPTZ;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_trip_orders_customs_mrn ON public.trip_orders(customs_mrn);
CREATE INDEX IF NOT EXISTS idx_trip_orders_customs_status ON public.trip_orders(customs_status);

