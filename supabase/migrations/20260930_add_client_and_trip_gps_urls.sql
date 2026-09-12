-- ============================================================
-- Migration: Add WhatsApp Google Maps GPS URL columns to clients and trip_orders
-- Context: Replaces impractical numeric latitude/longitude with direct
-- Google Maps links sent by clients via WhatsApp (e.g. https://maps.app.goo.gl/...)
-- ============================================================

BEGIN;

-- Add GPS URLs to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS loading_gps_url TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS unloading_gps_url TEXT;

COMMENT ON COLUMN public.clients.loading_gps_url IS 'رابط موقع خرائط جوجل لمنطقة التحميل والشحن (Google Maps Link via WhatsApp)';
COMMENT ON COLUMN public.clients.unloading_gps_url IS 'رابط موقع خرائط جوجل لمنطقة التفريغ والتسليم (Google Maps Link via WhatsApp)';

-- Add GPS URLs to trip_orders table
ALTER TABLE public.trip_orders ADD COLUMN IF NOT EXISTS shipping_gps_url TEXT;
ALTER TABLE public.trip_orders ADD COLUMN IF NOT EXISTS unloading_gps_url TEXT;

COMMENT ON COLUMN public.trip_orders.shipping_gps_url IS 'رابط موقع خرائط جوجل لمنطقة الشحن والتحميل للرحلة (Google Maps Link)';
COMMENT ON COLUMN public.trip_orders.unloading_gps_url IS 'رابط موقع خرائط جوجل لمنطقة التفريغ والتسليم للرحلة (Google Maps Link)';

COMMIT;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

