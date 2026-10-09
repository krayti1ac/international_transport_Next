-- 202610300001_reefer_refrigerant_and_txv_radar.sql
-- Reefer Refrigerant Leak & Expansion Valve (TXV/EXV) Predictive Radar Engine
-- Standards: EN 12830 / ATP Treaty (FRC) / ISO 14903 Refrigerant Tightness

-- 1. جدول سجلات قياسات وضغوط وسلوك دائرة التبريد
CREATE TABLE IF NOT EXISTS public.reefer_circuit_diagnostics_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id BIGINT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    trailer_id BIGINT NOT NULL REFERENCES public.trailers(id) ON DELETE CASCADE,
    trip_id BIGINT REFERENCES public.trip_orders(id) ON DELETE SET NULL,
    refrigerant_type VARCHAR(20) NOT NULL DEFAULT 'R452A', -- R452A (Opteon XL55), R404A, R134a
    suction_pressure_bar NUMERIC(6,2) NOT NULL, -- ضغط الشفط (Low Side Bar)
    discharge_pressure_bar NUMERIC(6,2) NOT NULL, -- ضغط الطرد (High Side Bar)
    evaporator_temp_c NUMERIC(5,2) NOT NULL, -- درجة حرارة المبخر المشبعة (°C)
    suction_line_temp_c NUMERIC(5,2) NOT NULL, -- درجة حرارة خط السحب الفعلية (°C)
    condenser_temp_c NUMERIC(5,2) NOT NULL, -- درجة حرارة التكثيف المشبعة (°C)
    liquid_line_temp_c NUMERIC(5,2) NOT NULL, -- درجة حرارة خط السائل الفعلية (°C)
    superheat_c NUMERIC(5,2) NOT NULL, -- درجة فرط التسخين (Suction Line Temp - Evaporator Temp)
    subcooling_c NUMERIC(5,2) NOT NULL, -- درجة فرط التبريد (Condenser Temp - Liquid Line Temp)
    compressor_rpm INT, -- سرعة دوران كمبروسر التبريد
    compressor_duty_cycle_pct NUMERIC(5,2), -- نسبة تشغيل الضاغط في الساعة
    ambient_temp_c NUMERIC(5,2), -- درجة حرارة الجو الخارجي
    source VARCHAR(30) NOT NULL DEFAULT 'telematics', -- telematics, manifold_gauge, manual_entry
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. جدول إنذارات الكشف الاستباقي عن التسريب وأعطال الصمام التمددي
CREATE TABLE IF NOT EXISTS public.reefer_predictive_leak_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id BIGINT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    trailer_id BIGINT NOT NULL REFERENCES public.trailers(id) ON DELETE CASCADE,
    trip_id BIGINT REFERENCES public.trip_orders(id) ON DELETE SET NULL,
    refrigerant_type VARCHAR(20) NOT NULL DEFAULT 'R452A',
    incident_type VARCHAR(50) NOT NULL, -- micro_leakage, txv_starvation_closed, txv_flooding_open, compressor_inefficiency
    severity VARCHAR(20) NOT NULL DEFAULT 'medium', -- info, low, medium, high, critical
    risk_score INT NOT NULL DEFAULT 50, -- مؤشر خطورة العطل الوشيك (0 - 100)
    estimated_refrigerant_loss_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00, -- نسبة الفقد التقديرية
    suction_pressure_bar NUMERIC(6,2),
    discharge_pressure_bar NUMERIC(6,2),
    superheat_c NUMERIC(5,2),
    subcooling_c NUMERIC(5,2),
    description TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    maintenance_ticket_id BIGINT REFERENCES public.truck_maintenance(id) ON DELETE SET NULL,
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(150),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فهارس الأداء وسرعة التحليل التنبؤي
CREATE INDEX IF NOT EXISTS idx_reefer_diag_company_trailer ON public.reefer_circuit_diagnostics_logs(company_id, trailer_id);
CREATE INDEX IF NOT EXISTS idx_reefer_diag_recorded_at ON public.reefer_circuit_diagnostics_logs(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_reefer_diag_refrigerant ON public.reefer_circuit_diagnostics_logs(refrigerant_type);

CREATE INDEX IF NOT EXISTS idx_reefer_leak_incidents_company_trailer ON public.reefer_predictive_leak_incidents(company_id, trailer_id);
CREATE INDEX IF NOT EXISTS idx_reefer_leak_incidents_status ON public.reefer_predictive_leak_incidents(company_id, is_resolved);
CREATE INDEX IF NOT EXISTS idx_reefer_leak_incidents_severity ON public.reefer_predictive_leak_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_reefer_leak_incidents_risk ON public.reefer_predictive_leak_incidents(risk_score DESC);

-- تفعيل أمان الصفوف (Row Level Security)
ALTER TABLE public.reefer_circuit_diagnostics_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reefer_predictive_leak_incidents ENABLE ROW LEVEL SECURITY;

-- سياسات RLS لعزل المستأجرين (Multi-Tenant Isolation)
CREATE POLICY "Users can access their company reefer circuit diagnostics"
ON public.reefer_circuit_diagnostics_logs FOR ALL USING (
    company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
    )
);

CREATE POLICY "Users can access their company reefer predictive leak incidents"
ON public.reefer_predictive_leak_incidents FOR ALL USING (
    company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
    )
);

-- إشعار خادم PostgREST بإعادة تحميل مخطط البيانات
NOTIFY pgrst, 'reload schema';

