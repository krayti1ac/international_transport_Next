-- ============================================================
-- Migration: 20260906_maintenance_schedules.sql
-- Description: Creates maintenance_schedules table for
--              preventive maintenance scheduling and alerts.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.maintenance_schedules (
  id BIGSERIAL PRIMARY KEY,
  vehicle_type VARCHAR(20) NOT NULL CHECK (vehicle_type IN ('truck', 'trailer')),
  vehicle_id BIGINT NOT NULL,
  maintenance_type VARCHAR(120) NOT NULL,
  scheduled_date DATE NOT NULL,
  amount_estimate NUMERIC DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'MAD',
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  parent_record_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_vehicle
  ON public.maintenance_schedules(vehicle_type, vehicle_id);

CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_scheduled_date
  ON public.maintenance_schedules(scheduled_date);

CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_is_active
  ON public.maintenance_schedules(is_active);

ALTER TABLE public.maintenance_schedules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins full access on maintenance_schedules') THEN
    CREATE POLICY "Admins full access on maintenance_schedules"
      ON public.maintenance_schedules FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.role = 'admin'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Secretaries manage maintenance_schedules') THEN
    CREATE POLICY "Secretaries manage maintenance_schedules"
      ON public.maintenance_schedules FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.role IN ('admin', 'secretary')
        )
      );
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_schedules TO anon;

NOTIFY pgrst, 'reload schema';
