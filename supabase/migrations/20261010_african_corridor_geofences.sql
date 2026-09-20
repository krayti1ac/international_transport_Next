-- Migration: 20261010_african_corridor_geofences.sql
-- Description: Inserts Strategic African Overland Trade Corridor Waypoints and Border Crossings into geofence_zones

-- 1. Nouadhibou Free Zone (Mauritania)
INSERT INTO public.geofence_zones (name, latitude, longitude, radius_km, zone_type, is_active, created_at)
SELECT 'منطقة نواديبو الحرة اللوجستية (موريتانيا)', 20.9412, -17.0347, 4.0, 'customs_hub', true, NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.geofence_zones WHERE name ILIKE '%نواديبو%' OR name ILIKE '%nouadhibou%'
);

-- 2. Nouakchott Logistics Platform (Mauritania)
INSERT INTO public.geofence_zones (name, latitude, longitude, radius_km, zone_type, is_active, created_at)
SELECT 'مركز نواكشوط اللوجستي وتفريغ الشاحنات (موريتانيا)', 18.0735, -15.9582, 5.0, 'logistics_platform', true, NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.geofence_zones WHERE name ILIKE '%نواكشوط%' OR name ILIKE '%nouakchott%'
);

-- 3. Rosso River Border & Ferry Crossing (Mauritania / Senegal)
INSERT INTO public.geofence_zones (name, latitude, longitude, radius_km, zone_type, is_active, created_at)
SELECT 'معبر روصو الحدودي والعبارة النهرية (موريتانيا / السنغال)', 16.5133, -15.8083, 3.0, 'border_crossing', true, NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.geofence_zones WHERE name ILIKE '%روصو%' OR name ILIKE '%rosso%'
);

-- 4. Dakar Port & Logistics Warehouses (Senegal)
INSERT INTO public.geofence_zones (name, latitude, longitude, radius_km, zone_type, is_active, created_at)
SELECT 'ميناء ومستودعات توزيع دكار (السنغال)', 14.7167, -17.4677, 6.0, 'seaport', true, NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.geofence_zones WHERE name ILIKE '%دكار%' OR name ILIKE '%dakar%'
);

