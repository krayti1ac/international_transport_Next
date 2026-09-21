-- ============================================================================
-- Migration: 202610130001_fifo_overpayment_and_credit_balances.sql
-- Description: Add unallocated amount to payments and create client_credit_balances table
-- ============================================================================

-- 1. Add unallocated amount and client_id to payments table
ALTER TABLE IF EXISTS public.payments 
ADD COLUMN IF NOT EXISTS unallocated_amount NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS client_id BIGINT;

-- 2. Create client_credit_balances table
CREATE TABLE IF NOT EXISTS public.client_credit_balances (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT,
  client_id BIGINT NOT NULL,
  payment_id BIGINT REFERENCES public.payments(id) ON DELETE SET NULL,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  remaining_amount NUMERIC(15, 2) NOT NULL CHECK (remaining_amount >= 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'MAD',
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'partially_used', 'exhausted')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_credit_balances_client ON public.client_credit_balances(client_id, status);
CREATE INDEX IF NOT EXISTS idx_client_credit_balances_company ON public.client_credit_balances(company_id);

-- Enable RLS
ALTER TABLE public.client_credit_balances ENABLE ROW LEVEL SECURITY;

-- RLS Policy
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'client_credit_balances' AND policyname = 'allow_authenticated_all_client_credits'
  ) THEN
    CREATE POLICY allow_authenticated_all_client_credits ON public.client_credit_balances
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

