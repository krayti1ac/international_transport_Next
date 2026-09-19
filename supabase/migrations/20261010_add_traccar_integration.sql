-- ============================================================
-- Migration: Add Traccar integration tables
-- Context: Traccar GPS device management and synchronization
-- ============================================================

-- Traccar configuration per company
CREATE TABLE IF NOT EXISTS public.traccar_configs (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES public.companies(id) ON DELETE CASCADE,
  traccar_server_url TEXT NOT NULL,
  traccar_api_key TEXT,
  traccar_username TEXT,
  traccar_password TEXT,
  is_active BOOLEAN DEFAULT true,
  sync_interval_minutes INTEGER DEFAULT 5,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

COMMENT ON TABLE public.traccar_configs IS 'إعدادات خادم Traccar لكل شركة';
COMMENT ON COLUMN public.traccar_configs.traccar_server_url IS 'عنوان URL لخادم Traccar (مثال: http://traccar.example.com:8082)';
COMMENT ON COLUMN public.traccar_configs.traccar_api_key IS 'مفتاح API لخادم Traccar (يُستخدم إذا كان مُفعَّلاً)';
COMMENT ON COLUMN public.traccar_configs.traccar_username IS 'اسم المستخدم لخادم Traccar';
COMMENT ON COLUMN public.traccar_configs.traccar_password IS 'كلمة المرور لخادم Traccar';
COMMENT ON COLUMN public.traccar_configs.sync_interval_minutes IS 'فترة المزامنة بالدقائق';

-- Device mappings: link Traccar devices to trucks
CREATE TABLE IF NOT EXISTS public.traccar_device_mappings (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES public.companies(id) ON DELETE CASCADE,
  traccar_device_id INTEGER NOT NULL,
  traccar_unique_id TEXT NOT NULL,
  truck_id INTEGER REFERENCES public.trucks(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

COMMENT ON TABLE public.traccar_device_mappings IS 'ربط أجهزة Traccar بالشاحنات';
COMMENT ON COLUMN public.traccar_device_mappings.traccar_device_id IS 'معرف الجهاز في Traccar';
COMMENT ON COLUMN public.traccar_device_mappings.traccar_unique_id IS 'المعرّف الفريد للجهاز في Traccar (IMEI أو معرف m Espíritu)';
COMMENT ON COLUMN public.traccar_device_mappings.truck_id IS 'معرف الشاحنة في النظام';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_traccar_configs_company
  ON public.traccar_configs(company_id);

CREATE INDEX IF NOT EXISTS idx_traccar_device_mappings_company
  ON public.traccar_device_mappings(company_id);

CREATE INDEX IF NOT EXISTS idx_traccar_device_mappings_truck
  ON public.traccar_device_mappings(truck_id);

CREATE INDEX IF NOT EXISTS idx_traccar_device_mappings_traccar_id
  ON public.traccar_device_mappings(traccar_device_id);

-- Enable RLS
ALTER TABLE IF EXISTS public.traccar_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.traccar_device_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for traccar_configs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage traccar_configs') THEN
    CREATE POLICY "Admins manage traccar_configs"
      ON public.traccar_configs FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.role IN ('admin', 'fleet_manager')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users read own traccar_configs') THEN
    CREATE POLICY "Users read own traccar_configs"
      ON public.traccar_configs FOR SELECT
      USING (
        company_id IN (
          SELECT company_id FROM users WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- RLS Policies for traccar_device_mappings
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage traccar_device_mappings') THEN
    CREATE POLICY "Admins manage traccar_device_mappings"
      ON public.traccar_device_mappings FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.role IN ('admin', 'fleet_manager')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users read own traccar_device_mappings') THEN
    CREATE POLICY "Users read own traccar_device_mappings"
      ON public.traccar_device_mappings FOR SELECT
      USING (
        company_id IN (
          SELECT company_id FROM users WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
