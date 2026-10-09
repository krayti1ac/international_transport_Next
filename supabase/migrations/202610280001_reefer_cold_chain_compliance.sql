-- 202610280001_reefer_cold_chain_compliance.sql
-- Reefer Telematics & Cold Chain Compliance Engine (GDP / EN 12830 / ATP)

-- 1. تعريف نوع تصنيف التبريد وفق ميثاق ATP
DO $$ BEGIN
    CREATE TYPE atp_reefer_class AS ENUM ('class_a', 'class_b', 'class_c');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. تعريف فئة البضائع الحساسة
DO $$ BEGIN
    CREATE TYPE reefer_cargo_category AS ENUM (
        'fresh_produce',    -- +2°C to +6°C (بواكير وخضار وفواكه)
        'deep_frozen',      -- -18°C to -25°C (أسماك ومجمدات)
        'pharma_cold',      -- +2°C to +8°C (أدوية ومستحضرات صيدلانية GDP)
        'meat_chilled'      -- 0°C to +4°C (لحوم مبردة طازجة)
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. جدول مواصفات مراقبة التبريد للشحنة
CREATE TABLE IF NOT EXISTS public.trip_reefer_monitoring_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id BIGINT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    trip_id BIGINT NOT NULL REFERENCES public.trip_orders(id) ON DELETE CASCADE,
    trailer_id BIGINT REFERENCES public.trailers(id) ON DELETE SET NULL,
    cooling_unit_brand VARCHAR(50) NOT NULL DEFAULT 'Carrier Transicold', -- Carrier / Thermo King
    atp_class atp_reefer_class NOT NULL DEFAULT 'class_c',
    cargo_category reefer_cargo_category NOT NULL DEFAULT 'fresh_produce',
    setpoint_temp NUMERIC(5,2) NOT NULL,
    min_temp_threshold NUMERIC(5,2) NOT NULL,
    max_temp_threshold NUMERIC(5,2) NOT NULL,
    max_allowed_excursion_minutes INT NOT NULL DEFAULT 45,
    mkt_activation_energy_kj NUMERIC(6,3) NOT NULL DEFAULT 83.144, -- Arrhenius ΔH
    is_active BOOLEAN NOT NULL DEFAULT true,
    certificate_hash VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_trip_reefer_profile UNIQUE (trip_id)
);

-- 4. جدول قراءات مسجلات التبريد المعتمدة (EN 12830 Logging)
CREATE TABLE IF NOT EXISTS public.reefer_temperature_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id BIGINT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.trip_reefer_monitoring_profiles(id) ON DELETE CASCADE,
    trip_id BIGINT NOT NULL REFERENCES public.trip_orders(id) ON DELETE CASCADE,
    supply_air_temp NUMERIC(5,2) NOT NULL,
    return_air_temp NUMERIC(5,2) NOT NULL,
    ambient_temp NUMERIC(5,2),
    evaporator_temp NUMERIC(5,2),
    compressor_status VARCHAR(20) NOT NULL DEFAULT 'running', -- running, cycle_sentry, defrost, off
    is_defrost_active BOOLEAN NOT NULL DEFAULT false,
    door_open_sensor BOOLEAN NOT NULL DEFAULT false,
    diesel_fuel_level_liters NUMERIC(6,2),
    diesel_burn_rate_lph NUMERIC(4,2), -- معدل استهلاك الوقود للوحدة L/hr
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    is_geofence_safe BOOLEAN NOT NULL DEFAULT true,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. جدول حوادث وانحرافات سلسلة التبريد (Excursions)
CREATE TABLE IF NOT EXISTS public.reefer_excursion_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id BIGINT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.trip_reefer_monitoring_profiles(id) ON DELETE CASCADE,
    trip_id BIGINT NOT NULL REFERENCES public.trip_orders(id) ON DELETE CASCADE,
    incident_type VARCHAR(50) NOT NULL, -- temp_high, temp_low, door_breach_transit, compressor_failure
    severity VARCHAR(20) NOT NULL DEFAULT 'warning', -- warning, critical
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    peak_deviation_temp NUMERIC(5,2) NOT NULL,
    duration_minutes INT DEFAULT 0,
    mkt_impact_celsius NUMERIC(5,2),
    action_taken TEXT,
    is_cleared BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فهارس الأداء
CREATE INDEX IF NOT EXISTS idx_reefer_logs_profile_time ON public.reefer_temperature_logs(profile_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_reefer_logs_trip ON public.reefer_temperature_logs(trip_id);
CREATE INDEX IF NOT EXISTS idx_reefer_logs_company ON public.reefer_temperature_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_reefer_profiles_company ON public.trip_reefer_monitoring_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_reefer_excursions_trip ON public.reefer_excursion_incidents(trip_id);
CREATE INDEX IF NOT EXISTS idx_reefer_excursions_company ON public.reefer_excursion_incidents(company_id);

-- سياسات RLS
ALTER TABLE public.trip_reefer_monitoring_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reefer_temperature_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reefer_excursion_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their company reefer profiles"
ON public.trip_reefer_monitoring_profiles FOR ALL USING (
    company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
    )
);

CREATE POLICY "Users can access their company reefer logs"
ON public.reefer_temperature_logs FOR ALL USING (
    company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
    )
);

CREATE POLICY "Users can access their company reefer excursions"
ON public.reefer_excursion_incidents FOR ALL USING (
    company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
    )
);

-- إشعار خادم PostgREST بإعادة تحميل مخطط البيانات
NOTIFY pgrst, 'reload schema';

