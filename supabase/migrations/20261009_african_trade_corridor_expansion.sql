-- Migration: 20261009_african_trade_corridor_expansion.sql
-- Description:
-- 1. Expands driver visa tracking for the African Overland Corridor (Mauritania, Senegal, West Africa)
-- 2. Inserts El Guerguerat Strategic Border Crossing into geofence_zones
-- 3. Adds corridor_type to transport_routes and trip_orders

-- 1. Drivers: African Visa & Corridor Qualification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'visa_type'
  ) THEN
    ALTER TABLE public.drivers ADD COLUMN visa_type VARCHAR(50) DEFAULT 'schengen';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'african_visa_number'
  ) THEN
    ALTER TABLE public.drivers ADD COLUMN african_visa_number VARCHAR(100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'african_visa_expiry_date'
  ) THEN
    ALTER TABLE public.drivers ADD COLUMN african_visa_expiry_date DATE;
  END IF;
END $$;

COMMENT ON COLUMN public.drivers.visa_type IS 'نوع التأشيرة الدولية: شنغن (schengen)، إفريقيا البرية (african_transit)، أو كلاهما (both)';
COMMENT ON COLUMN public.drivers.african_visa_number IS 'رقم تأشيرة موريتانيا / غرب إفريقيا أو بطاقة العبور';
COMMENT ON COLUMN public.drivers.african_visa_expiry_date IS 'تاريخ انتهاء تأشيرة الممر الإفريقي';

-- 2. Transport Routes & Trip Orders: corridor_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transport_routes' AND column_name = 'corridor_type'
  ) THEN
    ALTER TABLE public.transport_routes ADD COLUMN corridor_type VARCHAR(50) DEFAULT 'european_maritime';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trip_orders' AND column_name = 'corridor_type'
  ) THEN
    ALTER TABLE public.trip_orders ADD COLUMN corridor_type VARCHAR(50) DEFAULT 'european_maritime';
  END IF;
END $$;

COMMENT ON COLUMN public.transport_routes.corridor_type IS 'تصنيف الممر الدولي: european_maritime (أوروبا بحراً) أو african_overland (إفريقيا براً عبر الكركارات)';
COMMENT ON COLUMN public.trip_orders.corridor_type IS 'تصنيف الممر الدولي للرحلة: european_maritime أو african_overland';

-- 3. Strategic Geofence Zone for El Guerguerat Border Crossing
INSERT INTO public.geofence_zones (name, latitude, longitude, radius_km, zone_type, is_active, created_at)
SELECT 'معبر الكركارات الحدودي (المغرب / موريتانيا)', 21.3656, -16.9583, 5.0, 'border_crossing', true, NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.geofence_zones WHERE name ILIKE '%الكركارات%' OR name ILIKE '%guerguerat%'
);

