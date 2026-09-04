-- ============================================================
-- Migration: 20260904_create_forex_tables.sql
-- Description:
--   1. Creates forex_rates table for tracking daily exchange rates (EUR/MAD)
--   2. Creates forex_gain_loss_entries table for tracking realized FX gains/losses
--   3. Configures Row Level Security (RLS) policies
--   4. Reloads PostgREST schema cache
-- ============================================================

-- 1. Create forex_rates table
CREATE TABLE IF NOT EXISTS public.forex_rates (
  id BIGSERIAL PRIMARY KEY,
  rate_date DATE NOT NULL UNIQUE,
  eur_to_mad NUMERIC(12, 4) NOT NULL,
  mad_to_eur NUMERIC(12, 6) NOT NULL,
  source VARCHAR(50) DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by date
CREATE INDEX IF NOT EXISTS idx_forex_rates_date ON public.forex_rates(rate_date DESC);

-- 2. Create forex_gain_loss_entries table
CREATE TABLE IF NOT EXISTS public.forex_gain_loss_entries (
  id BIGSERIAL PRIMARY KEY,
  trip_id BIGINT,
  invoice_id BIGINT,
  original_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  original_currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
  original_rate NUMERIC(12, 4) NOT NULL DEFAULT 0,
  settlement_rate NUMERIC(12, 4) NOT NULL DEFAULT 0,
  realized_gain_loss NUMERIC(14, 2) NOT NULL DEFAULT 0,
  entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('gain', 'loss')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for gain/loss queries
CREATE INDEX IF NOT EXISTS idx_forex_gain_loss_trip ON public.forex_gain_loss_entries(trip_id);
CREATE INDEX IF NOT EXISTS idx_forex_gain_loss_invoice ON public.forex_gain_loss_entries(invoice_id);
CREATE INDEX IF NOT EXISTS idx_forex_gain_loss_created ON public.forex_gain_loss_entries(created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.forex_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forex_gain_loss_entries ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for forex_rates
DO $$
BEGIN
  -- Read access for all authenticated users
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'forex_rates' AND policyname = 'Authenticated users can view forex_rates'
  ) THEN
    CREATE POLICY "Authenticated users can view forex_rates"
      ON public.forex_rates FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  -- Admin and secretary full access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'forex_rates' AND policyname = 'Admins and secretaries can manage forex_rates'
  ) THEN
    CREATE POLICY "Admins and secretaries can manage forex_rates"
      ON public.forex_rates FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'secretary')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'secretary')
        )
      );
  END IF;

  -- Service role full access fallback
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'forex_rates' AND policyname = 'Service role full access on forex_rates'
  ) THEN
    CREATE POLICY "Service role full access on forex_rates"
      ON public.forex_rates FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 5. RLS Policies for forex_gain_loss_entries
DO $$
BEGIN
  -- Read access for authenticated users
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'forex_gain_loss_entries' AND policyname = 'Authenticated users can view forex_gain_loss'
  ) THEN
    CREATE POLICY "Authenticated users can view forex_gain_loss"
      ON public.forex_gain_loss_entries FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  -- Admin and secretary full access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'forex_gain_loss_entries' AND policyname = 'Admins and secretaries can manage forex_gain_loss'
  ) THEN
    CREATE POLICY "Admins and secretaries can manage forex_gain_loss"
      ON public.forex_gain_loss_entries FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'secretary')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'secretary')
        )
      );
  END IF;

  -- Service role full access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'forex_gain_loss_entries' AND policyname = 'Service role full access on forex_gain_loss'
  ) THEN
    CREATE POLICY "Service role full access on forex_gain_loss"
      ON public.forex_gain_loss_entries FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 6. Seed initial rate for today if empty
INSERT INTO public.forex_rates (rate_date, eur_to_mad, mad_to_eur, source)
VALUES (CURRENT_DATE, 10.8542, 0.092130, 'api_live')
ON CONFLICT (rate_date) DO NOTHING;

-- 7. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';

