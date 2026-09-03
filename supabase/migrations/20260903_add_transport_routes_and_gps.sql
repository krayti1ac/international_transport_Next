-- ============================================================
-- Migration: Add transport_routes table and GPS fields
-- Context: Routes with types (outbound/return) and per-trip/client GPS
-- ============================================================

-- Transport routes table (named routes with origin/destination and GPS)
CREATE TABLE IF NOT EXISTS public.transport_routes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  route_type TEXT NOT NULL CHECK (route_type IN ('outbound', 'return')),
  origin TEXT,
  destination TEXT,
  origin_latitude NUMERIC,
  origin_longitude NUMERIC,
  destination_latitude NUMERIC,
  destination_longitude NUMERIC,
  distance_km NUMERIC,
  estimated_days INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

COMMENT ON TABLE public.transport_routes IS 'قائمة المسارات النظامية: ذهاب (outbound) أو عودة (return)';
COMMENT ON COLUMN public.transport_routes.route_type IS 'نوع المسار: outbound (رحلات الذهاب/تصدير) أو return (رحلات العودة/استيراد)';

-- Add unloading GPS to clients
ALTER TABLE IF EXISTS public.clients 
ADD COLUMN IF NOT EXISTS unloading_latitude NUMERIC;

ALTER TABLE IF EXISTS public.clients 
ADD COLUMN IF NOT EXISTS unloading_longitude NUMERIC;

COMMENT ON COLUMN public.clients.unloading_latitude IS 'إحداثيات منطقة التفريغ الافتراضية للعميل (رحلات العودة)';
COMMENT ON COLUMN public.clients.unloading_longitude IS 'إحداثيات منطقة التفريغ الافتراضية للعميل (رحلات العودة)';

-- Add per-trip GPS override fields to trip_orders
ALTER TABLE IF EXISTS public.trip_orders 
ADD COLUMN IF NOT EXISTS shipping_latitude NUMERIC;

ALTER TABLE IF EXISTS public.trip_orders 
ADD COLUMN IF NOT EXISTS shipping_longitude NUMERIC;

ALTER TABLE IF EXISTS public.trip_orders 
ADD COLUMN IF NOT EXISTS unloading_latitude NUMERIC;

ALTER TABLE IF EXISTS public.trip_orders 
ADD COLUMN IF NOT EXISTS unloading_longitude NUMERIC;

COMMENT ON COLUMN public.trip_orders.shipping_latitude IS 'إحداثيات منطقة الشحن لهذه الرحلة (تجاوز افتراضي العميل)';
COMMENT ON COLUMN public.trip_orders.shipping_longitude IS 'إحداثيات منطقة الشحن لهذه الرحلة (تجاوز افتراضي العميل)';
COMMENT ON COLUMN public.trip_orders.unloading_latitude IS 'إحداثيات منطقة التفريغ لهذه الرحلة (تجاوز افتراضي العميل)';
COMMENT ON COLUMN public.trip_orders.unloading_longitude IS 'إحداثيات منطقة التفريغ لهذه الرحلة (تجاوز افتراضي العميل)';

-- Seed some transport routes
INSERT INTO public.transport_routes (name, route_type, origin, destination, origin_latitude, origin_longitude, destination_latitude, destination_longitude, distance_km, estimated_days, is_active, created_at) VALUES
('طنجة → ألميريا', 'outbound', 'طنجة', 'ألميريا', 35.7595, -5.8340, 36.8423, -2.4623, 180, 2, true, '2025-01-01T08:00:00Z'),
('طنجة → مرسيليا', 'outbound', 'طنجة', 'مرسيليا', 35.7595, -5.8340, 43.2965, 5.3698, 1200, 3, true, '2025-01-01T08:00:00Z'),
('الدار البيضاء → برشلونة', 'outbound', 'الدار البيضاء', 'برشلونة', 33.5731, -7.5898, 41.3851, 2.1734, 1100, 3, true, '2025-01-01T08:00:00Z'),
('طنجة → فالنسيا', 'outbound', 'طنجة', 'فالنسيا', 35.7595, -5.8340, 39.4699, -0.3763, 950, 2, true, '2025-01-01T08:00:00Z'),
('ألميريا → طنجة', 'return', 'ألميريا', 'طنجة', 36.8423, -2.4623, 35.7595, -5.8340, 180, 2, true, '2025-01-01T08:00:00Z'),
('مرسيليا → طنجة', 'return', 'مرسيليا', 'طنجة', 43.2965, 5.3698, 35.7595, -5.8340, 1200, 3, true, '2025-01-01T08:00:00Z'),
('برشلونة → الدار البيضاء', 'return', 'برشلونة', 'الدار البيضاء', 41.3851, 2.1734, 33.5731, -7.5898, 1100, 3, true, '2025-01-01T08:00:00Z'),
('فالنسيا → طنجة', 'return', 'فالنسيا', 'طنجة', 39.4699, -0.3763, 35.7595, -5.8340, 950, 2, true, '2025-01-01T08:00:00Z'),
('طنجة → هامبورغ', 'outbound', 'طنجة', 'هامبورغ', 35.7595, -5.8340, 53.5511, 9.9937, 2200, 4, true, '2025-01-01T08:00:00Z'),
('ألميريا → الدار البيضاء', 'return', 'ألميريا', 'الدار البيضاء', 36.8423, -2.4623, 33.5731, -7.5898, 400, 1, true, '2025-01-01T08:00:00Z')
ON CONFLICT DO NOTHING;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
