-- Migration: 202610270001_fleet_tire_lifecycle_and_telematics.sql
-- Description: Tire Fleet Management, Tread Wear Telematics & Axle Lifecycle Engine
-- Multi-Tenant isolated tire assets and TPMS sensor telematics

-- 1. Table: fleet_tires (أصول الإطارات وتاريخ دورة الحياة)
CREATE TABLE IF NOT EXISTS public.fleet_tires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE,
    serial_number VARCHAR(100) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(100),
    size VARCHAR(50) NOT NULL,
    dot_code VARCHAR(30),
    vehicle_type VARCHAR(20) DEFAULT 'truck' CHECK (vehicle_type IN ('truck', 'trailer')),
    truck_id BIGINT REFERENCES public.trucks(id) ON DELETE SET NULL,
    trailer_id BIGINT REFERENCES public.trailers(id) ON DELETE SET NULL,
    axle_position VARCHAR(20) NOT NULL,
    initial_tread_depth_mm NUMERIC(4, 2) NOT NULL DEFAULT 16.00,
    current_tread_depth_mm NUMERIC(4, 2) NOT NULL DEFAULT 16.00,
    purchase_cost_mad NUMERIC(10, 2) NOT NULL DEFAULT 4500.00,
    installed_km BIGINT DEFAULT 0,
    current_km BIGINT DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'mounted' CHECK (
        status IN ('mounted', 'in_stock', 'scrapped', 'retreaded')
    ),
    installed_at DATE DEFAULT CURRENT_DATE,
    last_inspected_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fleet_tires
CREATE INDEX IF NOT EXISTS idx_fleet_tires_company_id ON public.fleet_tires(company_id);
CREATE INDEX IF NOT EXISTS idx_fleet_tires_truck_id ON public.fleet_tires(truck_id);
CREATE INDEX IF NOT EXISTS idx_fleet_tires_trailer_id ON public.fleet_tires(trailer_id);
CREATE INDEX IF NOT EXISTS idx_fleet_tires_status ON public.fleet_tires(status);
CREATE INDEX IF NOT EXISTS idx_fleet_tires_serial_number ON public.fleet_tires(serial_number);
CREATE INDEX IF NOT EXISTS idx_fleet_tires_axle_position ON public.fleet_tires(axle_position);

-- Enable RLS for fleet_tires
ALTER TABLE public.fleet_tires ENABLE ROW LEVEL SECURITY;

-- Multi-Tenant RLS Policies for fleet_tires
CREATE POLICY "fleet_tires_select_policy" ON public.fleet_tires
    FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

CREATE POLICY "fleet_tires_insert_policy" ON public.fleet_tires
    FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

CREATE POLICY "fleet_tires_update_policy" ON public.fleet_tires
    FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

CREATE POLICY "fleet_tires_delete_policy" ON public.fleet_tires
    FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- 2. Table: tire_sensor_telematics_logs (قراءات حساسات ضغط وحرارة الإطارات TPMS)
CREATE TABLE IF NOT EXISTS public.tire_sensor_telematics_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE,
    tire_id UUID NOT NULL REFERENCES public.fleet_tires(id) ON DELETE CASCADE,
    truck_id BIGINT REFERENCES public.trucks(id) ON DELETE SET NULL,
    trailer_id BIGINT REFERENCES public.trailers(id) ON DELETE SET NULL,
    pressure_bar NUMERIC(4, 2) NOT NULL,
    temperature_c NUMERIC(5, 2) NOT NULL,
    tread_depth_mm NUMERIC(4, 2),
    battery_level_pct INT DEFAULT 100,
    alert_flags JSONB DEFAULT '[]'::jsonb,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for tire_sensor_telematics_logs
CREATE INDEX IF NOT EXISTS idx_tire_logs_company_id ON public.tire_sensor_telematics_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_tire_logs_tire_id ON public.tire_sensor_telematics_logs(tire_id);
CREATE INDEX IF NOT EXISTS idx_tire_logs_truck_id ON public.tire_sensor_telematics_logs(truck_id);
CREATE INDEX IF NOT EXISTS idx_tire_logs_recorded_at ON public.tire_sensor_telematics_logs(recorded_at DESC);

-- Enable RLS for tire_sensor_telematics_logs
ALTER TABLE public.tire_sensor_telematics_logs ENABLE ROW LEVEL SECURITY;

-- Multi-Tenant RLS Policies for tire_sensor_telematics_logs
CREATE POLICY "tire_logs_select_policy" ON public.tire_sensor_telematics_logs
    FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

CREATE POLICY "tire_logs_insert_policy" ON public.tire_sensor_telematics_logs
    FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

CREATE POLICY "tire_logs_update_policy" ON public.tire_sensor_telematics_logs
    FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

CREATE POLICY "tire_logs_delete_policy" ON public.tire_sensor_telematics_logs
    FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
