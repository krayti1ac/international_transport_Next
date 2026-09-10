-- Migration: 20260920_add_truck_fuel_and_route_ferry.sql
-- Description:
-- 1. Adds fuel_consumption_rate (default 36.00%) to public.trucks
-- 2. Adds ferry_cost, road_distance_km, and ferry_distance_km to public.transport_routes
-- 3. Adds ferry_cost to public.trip_orders
-- 2. Adds detailed international route expense breakdown to public.transport_routes:
--    - ferry_cost (مصاريف الباخرة / العبارة)
--    - triptik_cost (مصاريف التريبتيك / Triptyque)
--    - transit_almeria_cost (مصاريف ترانزيت ألميريا / Transit Almeria)
--    - marsa_maroc_cost (رسوم الميناء مرسى المغرب / Marsa Maroc)
--    - road_distance_km (المسافة البرية لحساب الوقود)
--    - ferry_distance_km (المسافة البحرية بدون وقود)
-- 3. Adds the corresponding breakdown columns to public.trip_orders

-- 1. Trucks: fuel_consumption_rate
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trucks' AND column_name = 'fuel_consumption_rate'
  ) THEN
    ALTER TABLE public.trucks ADD COLUMN fuel_consumption_rate DECIMAL(5,2) DEFAULT 36.00;
  END IF;
END $$;

UPDATE public.trucks
SET fuel_consumption_rate = 36.00
WHERE fuel_consumption_rate IS NULL;

-- 2. Transport Routes: ferry_cost, road_distance_km, ferry_distance_km
-- 2. Transport Routes: Expenses and Distances
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transport_routes' AND column_name = 'ferry_cost'
  ) THEN
    ALTER TABLE public.transport_routes ADD COLUMN ferry_cost DECIMAL(12,2) DEFAULT 4500.00;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transport_routes' AND column_name = 'triptik_cost'
  ) THEN
    ALTER TABLE public.transport_routes ADD COLUMN triptik_cost DECIMAL(12,2) DEFAULT 500.00;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transport_routes' AND column_name = 'transit_almeria_cost'
  ) THEN
    ALTER TABLE public.transport_routes ADD COLUMN transit_almeria_cost DECIMAL(12,2) DEFAULT 1200.00;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transport_routes' AND column_name = 'marsa_maroc_cost'
  ) THEN
    ALTER TABLE public.transport_routes ADD COLUMN marsa_maroc_cost DECIMAL(12,2) DEFAULT 800.00;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transport_routes' AND column_name = 'road_distance_km'
  ) THEN
    ALTER TABLE public.transport_routes ADD COLUMN road_distance_km DECIMAL(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transport_routes' AND column_name = 'ferry_distance_km'
  ) THEN
    ALTER TABLE public.transport_routes ADD COLUMN ferry_distance_km DECIMAL(10,2);
  END IF;
END $$;

-- 3. Trip Orders: ferry_cost
-- 3. Trip Orders: Expense Breakdown
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trip_orders' AND column_name = 'ferry_cost'
  ) THEN
    ALTER TABLE public.trip_orders ADD COLUMN ferry_cost DECIMAL(12,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trip_orders' AND column_name = 'triptik_cost'
  ) THEN
    ALTER TABLE public.trip_orders ADD COLUMN triptik_cost DECIMAL(12,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trip_orders' AND column_name = 'transit_almeria_cost'
  ) THEN
    ALTER TABLE public.trip_orders ADD COLUMN transit_almeria_cost DECIMAL(12,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trip_orders' AND column_name = 'marsa_maroc_cost'
  ) THEN
    ALTER TABLE public.trip_orders ADD COLUMN marsa_maroc_cost DECIMAL(12,2);
  END IF;
END $$;

COMMENT ON COLUMN public.trucks.fuel_consumption_rate IS 'Configured fuel consumption rate in L/100km or % (default 36.00), modifiable anytime.';
COMMENT ON COLUMN public.transport_routes.ferry_cost IS 'Ferry ticket / maritime crossing cost in MAD between Morocco and Spain.';
COMMENT ON COLUMN public.transport_routes.road_distance_km IS 'Road driving distance where truck consumes fuel.';
COMMENT ON COLUMN public.transport_routes.ferry_distance_km IS 'Maritime distance on ferry where truck engine is off (zero road fuel).';
COMMENT ON COLUMN public.trucks.fuel_consumption_rate IS 'Configured fuel consumption rate in L/100km or % (default 36.00).';
COMMENT ON COLUMN public.transport_routes.ferry_cost IS 'Ferry ticket cost (مصاريف الباخرة).';
COMMENT ON COLUMN public.transport_routes.triptik_cost IS 'Triptyque customs pass fee (مصاريف التريبتيك).';
COMMENT ON COLUMN public.transport_routes.transit_almeria_cost IS 'Almeria / Algeciras port transit fee (مصاريف ترانزيت ألميريا).';
COMMENT ON COLUMN public.transport_routes.marsa_maroc_cost IS 'Marsa Maroc port handling fee (مصاريف مرسى المغرب).';
