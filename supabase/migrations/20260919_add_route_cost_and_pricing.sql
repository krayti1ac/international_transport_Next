-- ============================================================
-- Migration: Add Route Cost and Dynamic Pricing Fields
-- Context: Route freight pricing based on distance, fuel cost,
-- customs clearance (التعشير) and other fixed expenses.
-- ============================================================

ALTER TABLE IF EXISTS public.transport_routes 
ADD COLUMN IF NOT EXISTS cost NUMERIC DEFAULT 0;

ALTER TABLE IF EXISTS public.transport_routes 
ADD COLUMN IF NOT EXISTS fuel_cost NUMERIC DEFAULT 0;

ALTER TABLE IF EXISTS public.transport_routes 
ADD COLUMN IF NOT EXISTS fuel_price_per_liter NUMERIC DEFAULT 13.00;

ALTER TABLE IF EXISTS public.transport_routes 
ADD COLUMN IF NOT EXISTS fuel_consumption_rate NUMERIC DEFAULT 32;

ALTER TABLE IF EXISTS public.transport_routes 
ADD COLUMN IF NOT EXISTS customs_cost NUMERIC DEFAULT 0;

ALTER TABLE IF EXISTS public.transport_routes 
ADD COLUMN IF NOT EXISTS other_expenses NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.transport_routes.cost IS 'سعر الشحن الإجمالي أو التكلفة المعتمدة للمسار';
COMMENT ON COLUMN public.transport_routes.fuel_cost IS 'تكلفة المحروقات المحسوبة للمسار';
COMMENT ON COLUMN public.transport_routes.fuel_price_per_liter IS 'سعر لتر الوقود المعتمد في الحساب (MAD/EUR)';
COMMENT ON COLUMN public.transport_routes.fuel_consumption_rate IS 'معدل استهلاك الشاحنة (لتر / 100 كم)';
COMMENT ON COLUMN public.transport_routes.customs_cost IS 'مصاريف التعشير الجمركي الثابتة (Dédouanement)';
COMMENT ON COLUMN public.transport_routes.other_expenses IS 'مصاريف أخرى ثابتة (رسوم الموانئ، الباخرة، الطرق السيارة)';

-- Update seed transport routes with realistic costs and fuel expenses
UPDATE public.transport_routes
SET 
  fuel_price_per_liter = 13.00,
  fuel_consumption_rate = 32,
  fuel_cost = ROUND((distance_km / 100.0) * 32 * 13.00, 2),
  customs_cost = CASE 
    WHEN route_type = 'outbound' THEN 1500.00
    ELSE 2000.00
  END,
  other_expenses = CASE
    WHEN distance_km > 500 THEN 2500.00
    ELSE 1200.00
  END,
  cost = ROUND((distance_km / 100.0) * 32 * 13.00, 2) + 
         CASE WHEN route_type = 'outbound' THEN 1500.00 ELSE 2000.00 END + 
         CASE WHEN distance_km > 500 THEN 2500.00 ELSE 1200.00 END
WHERE cost IS NULL OR cost = 0;

