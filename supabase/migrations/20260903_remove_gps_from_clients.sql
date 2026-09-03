-- ============================================================
-- Migration: Remove GPS fields from clients table
-- Context: GPS coordinates (shipping/unloading) belong to trip_orders only,
-- not to clients. The client form no longer accepts these fields.
-- ============================================================

ALTER TABLE IF EXISTS public.clients
DROP COLUMN IF EXISTS shipping_latitude;

ALTER TABLE IF EXISTS public.clients
DROP COLUMN IF EXISTS shipping_longitude;

ALTER TABLE IF EXISTS public.clients
DROP COLUMN IF EXISTS unloading_latitude;

ALTER TABLE IF EXISTS public.clients
DROP COLUMN IF EXISTS unloading_longitude;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';