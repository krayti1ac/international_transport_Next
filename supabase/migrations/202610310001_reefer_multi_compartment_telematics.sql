-- 202610310001_reefer_multi_compartment_telematics.sql
-- Multi-Temp & Multi-Compartment Reefer Telematics Engine (EN 12830 / ATP Treaty)
-- Independent Bulkhead Insulation, Evaporator Management, and MKT Isolation

-- 1. جدول مواصفات الحجرات المجزأة للمقطورات المبردة
CREATE TABLE IF NOT EXISTS public.reefer_compartment_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id BIGINT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    trailer_id BIGINT NOT NULL REFERENCES public.trailers(id) ON DELETE CASCADE,
    trip_id BIGINT REFERENCES public.trip_orders(id) ON DELETE SET NULL,
    configuration_type VARCHAR(20) NOT NULL DEFAULT 'bi_temp', -- bi_temp, tri_temp, single_temp
    compartment_code VARCHAR(10) NOT NULL, -- C1 (Front), C2 (Middle), C3 (Rear)
    compartment_name VARCHAR(100) NOT NULL, -- e.g. "Front Deep-Freeze", "Rear Fresh Produce"
    cargo_category VARCHAR(50) NOT NULL DEFAULT 'deep_frozen', -- deep_frozen, fresh_produce, pharma_cold, meat_chilled
    setpoint_temp_c NUMERIC(5,2) NOT NULL, -- درجة الحرارة المستهدفة e.g. -20.0 أو +4.0
    min_temp_limit_c NUMERIC(5,2) NOT NULL, -- الحد الأدنى المسموح
    max_temp_limit_c NUMERIC(5,2) NOT NULL, -- الحد الأقصى المسموح
    evaporator_model VARCHAR(100), -- موديل المبخر المستقل (e.g. Carrier MVS / Thermo King S-3)
    has_side_door BOOLEAN NOT NULL DEFAULT FALSE, -- وجود باب جانبي لتفريغ الحجرة
    has_rear_door BOOLEAN NOT NULL DEFAULT TRUE, -- وجود وصول من الباب الخلفي
    bulkhead_position_pct INT NOT NULL DEFAULT 50, -- موقع الحاجز المتحرك كنسبة من طول المقطورة
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. جدول سجلات التليماتيكس المستقلة لكل حجرة تبريد
CREATE TABLE IF NOT EXISTS public.reefer_compartment_telemetry_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id BIGINT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    compartment_id UUID NOT NULL REFERENCES public.reefer_compartment_profiles(id) ON DELETE CASCADE,
    trailer_id BIGINT NOT NULL REFERENCES public.trailers(id) ON DELETE CASCADE,
    trip_id BIGINT REFERENCES public.trip_orders(id) ON DELETE SET NULL,
    supply_air_temp_c NUMERIC(5,2) NOT NULL, -- حرارة هواء الضخ من مبخر الحجرة
    return_air_temp_c NUMERIC(5,2) NOT NULL, -- حرارة هواء الإرجاع لمبخر الحجرة
    cargo_probe_temp_c NUMERIC(5,2) NOT NULL, -- حرارة حساس البضاعة في الحجرة
    evaporator_mode VARCHAR(30) NOT NULL DEFAULT 'cooling', -- cooling, heating, defrost, null
    door_open BOOLEAN NOT NULL DEFAULT FALSE, -- حالة فتح باب الحجرة
    door_type VARCHAR(20) DEFAULT 'none', -- rear, side, none
    is_excursion BOOLEAN NOT NULL DEFAULT FALSE, -- هل يوجد انحراف حراري خارج النطاق المسموح
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. جدول إنذارات التسريب الحراري عبر الحواجز العازلة المتحركة
CREATE TABLE IF NOT EXISTS public.reefer_cross_bulkhead_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id BIGINT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    trailer_id BIGINT NOT NULL REFERENCES public.trailers(id) ON DELETE CASCADE,
    trip_id BIGINT REFERENCES public.trip_orders(id) ON DELETE SET NULL,
    source_compartment_code VARCHAR(10) NOT NULL, -- e.g. C1
    adjacent_compartment_code VARCHAR(10) NOT NULL, -- e.g. C2
    delta_t_c NUMERIC(5,2) NOT NULL, -- فارق درجات الحرارة بين الحجرتين
    leakage_rate_c_per_hr NUMERIC(5,2) NOT NULL, -- معدل التسريب الحراري (°C/hr)
    severity VARCHAR(20) NOT NULL DEFAULT 'medium', -- low, medium, high, critical
    description TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(150),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فهارس الأداء وسرعة الاستعلام
CREATE INDEX IF NOT EXISTS idx_reefer_comp_trailer ON public.reefer_compartment_profiles(company_id, trailer_id);
CREATE INDEX IF NOT EXISTS idx_reefer_comp_trip ON public.reefer_compartment_profiles(trip_id);
CREATE INDEX IF NOT EXISTS idx_reefer_comp_code ON public.reefer_compartment_profiles(compartment_code);

CREATE INDEX IF NOT EXISTS idx_reefer_comp_telem_comp ON public.reefer_compartment_telemetry_logs(compartment_id);
CREATE INDEX IF NOT EXISTS idx_reefer_comp_telem_trailer ON public.reefer_compartment_telemetry_logs(company_id, trailer_id);
CREATE INDEX IF NOT EXISTS idx_reefer_comp_telem_recorded ON public.reefer_compartment_telemetry_logs(recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_reefer_bulkhead_trailer ON public.reefer_cross_bulkhead_alerts(company_id, trailer_id);
CREATE INDEX IF NOT EXISTS idx_reefer_bulkhead_status ON public.reefer_cross_bulkhead_alerts(company_id, is_resolved);

-- تفعيل أمان الصفوف (Row Level Security)
ALTER TABLE public.reefer_compartment_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reefer_compartment_telemetry_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reefer_cross_bulkhead_alerts ENABLE ROW LEVEL SECURITY;

-- سياسات RLS لعزل المستأجرين (Multi-Tenant Isolation)
CREATE POLICY "Users can access their company reefer compartments"
ON public.reefer_compartment_profiles FOR ALL USING (
    company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
    )
);

CREATE POLICY "Users can access their company compartment telemetry"
ON public.reefer_compartment_telemetry_logs FOR ALL USING (
    company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
    )
);

CREATE POLICY "Users can access their company bulkhead alerts"
ON public.reefer_cross_bulkhead_alerts FOR ALL USING (
    company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
    )
);

-- إشعار خادم PostgREST بإعادة تحميل مخطط البيانات
NOTIFY pgrst, 'reload schema';

