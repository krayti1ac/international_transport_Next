-- 202610290001_reefer_calibration_and_atp_scheduler.sql
-- Reefer Sensor Calibration & ATP Recertification Scheduler Engine (EN 12830 / ATP Treaty)

-- 1. جدول شهادات اعتماد وتجديد ميثاق ATP للمقطورات المبردة
CREATE TABLE IF NOT EXISTS public.reefer_atp_certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id BIGINT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    trailer_id BIGINT NOT NULL REFERENCES public.trailers(id) ON DELETE CASCADE,
    certificate_number VARCHAR(100) NOT NULL,
    atp_type VARCHAR(20) NOT NULL DEFAULT 'FRC', -- FRC (Heavy Class C), FRA, FNA, IR
    issue_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    k_value NUMERIC(4,3) NOT NULL DEFAULT 0.380, -- معامل العزل الحراري K-Value (W/m²·K)
    testing_station VARCHAR(150) NOT NULL DEFAULT 'Cematrans / CEMAFROID',
    status VARCHAR(20) NOT NULL DEFAULT 'valid', -- valid, expiring_soon, expired, suspended
    renewal_cycle_years INT NOT NULL DEFAULT 3, -- 6 سنوات للشهادة الأولى ثم كل 3 سنوات
    document_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_trailer_atp_cert UNIQUE (company_id, trailer_id, certificate_number)
);

-- 2. جدول سجلات معايرة الحساسات ومسجلات درجات الحرارة EN 12830
CREATE TABLE IF NOT EXISTS public.reefer_sensor_calibration_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id BIGINT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    trailer_id BIGINT NOT NULL REFERENCES public.trailers(id) ON DELETE CASCADE,
    sensor_type VARCHAR(50) NOT NULL, -- supply_air_probe, return_air_probe, cargo_probe_1, cargo_probe_2, data_logger
    device_serial_number VARCHAR(100),
    calibrated_at DATE NOT NULL,
    next_due_date DATE NOT NULL, -- معايرة سنوية إلزامية (365 يوماً)
    reference_temp NUMERIC(5,2) NOT NULL, -- درجة الحرارة المرجعية المعتمدة (°C)
    measured_temp NUMERIC(5,2) NOT NULL, -- قراءة الحساس المفحوص (°C)
    drift_delta NUMERIC(4,2) NOT NULL, -- فارق الانحراف (الانحراف الأقصى المسموح ±0.5°C)
    is_passed BOOLEAN NOT NULL DEFAULT true,
    calibrated_by VARCHAR(150) NOT NULL, -- المختبر أو التقني المعتمد
    certificate_reference VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فهارس الأداء وسرعة الاستعلام
CREATE INDEX IF NOT EXISTS idx_atp_certs_company_trailer ON public.reefer_atp_certifications(company_id, trailer_id);
CREATE INDEX IF NOT EXISTS idx_atp_certs_expiry ON public.reefer_atp_certifications(expiry_date);
CREATE INDEX IF NOT EXISTS idx_atp_certs_status ON public.reefer_atp_certifications(status);

CREATE INDEX IF NOT EXISTS idx_sensor_calib_company_trailer ON public.reefer_sensor_calibration_logs(company_id, trailer_id);
CREATE INDEX IF NOT EXISTS idx_sensor_calib_due_date ON public.reefer_sensor_calibration_logs(next_due_date);
CREATE INDEX IF NOT EXISTS idx_sensor_calib_type ON public.reefer_sensor_calibration_logs(sensor_type);

-- تفعيل أمان الصفوف (Row Level Security)
ALTER TABLE public.reefer_atp_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reefer_sensor_calibration_logs ENABLE ROW LEVEL SECURITY;

-- سياسات RLS لعزل المستأجرين (Multi-Tenant Isolation)
CREATE POLICY "Users can access their company atp certs"
ON public.reefer_atp_certifications FOR ALL USING (
    company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
    )
);

CREATE POLICY "Users can access their company sensor calibrations"
ON public.reefer_sensor_calibration_logs FOR ALL USING (
    company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
    )
);

-- إشعار خادم PostgREST بإعادة تحميل مخطط البيانات
NOTIFY pgrst, 'reload schema';

