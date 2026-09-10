-- Phase 1: Security Hardening - Strict RLS for Financial Tables & Audit Enhancements

-- 1. Add reason column to audit_logs
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS reason text;

-- 2. Enable RLS on financial tables that may not have it yet
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_invoice_allocations ENABLE ROW LEVEL SECURITY;

-- 3. Helper function: is_management
CREATE OR REPLACE FUNCTION public.is_management()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
      AND role IN ('admin', 'secretary')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Bank accounts: management only
DROP POLICY IF EXISTS "Management manage bank_accounts" ON public.bank_accounts;
CREATE POLICY "Management manage bank_accounts" 
  ON public.bank_accounts FOR ALL 
  TO authenticated 
  USING (public.is_management()) 
  WITH CHECK (public.is_management());

-- 5. Cash boxes: management only
DROP POLICY IF EXISTS "Management manage cash_boxes" ON public.cash_boxes;
CREATE POLICY "Management manage cash_boxes" 
  ON public.cash_boxes FOR ALL 
  TO authenticated 
  USING (public.is_management()) 
  WITH CHECK (public.is_management());

-- 6. Treasury transactions: management only
DROP POLICY IF EXISTS "Management manage treasury" ON public.treasury_transactions;
CREATE POLICY "Management manage treasury" 
  ON public.treasury_transactions FOR ALL 
  TO authenticated 
  USING (public.is_management()) 
  WITH CHECK (public.is_management());

-- 7. Invoices: management only
DROP POLICY IF EXISTS "Management manage invoices" ON public.invoices;
CREATE POLICY "Management manage invoices" 
  ON public.invoices FOR ALL 
  TO authenticated 
  USING (public.is_management()) 
  WITH CHECK (public.is_management());

-- 8. Payments: management only
DROP POLICY IF EXISTS "Management manage payments" ON public.payments;
CREATE POLICY "Management manage payments" 
  ON public.payments FOR ALL 
  TO authenticated 
  USING (public.is_management()) 
  WITH CHECK (public.is_management());

-- 9. Payment invoice allocations: management only
DROP POLICY IF EXISTS "Management manage payment_invoice_allocations" ON public.payment_invoice_allocations;
CREATE POLICY "Management manage payment_invoice_allocations" 
  ON public.payment_invoice_allocations FOR ALL 
  TO authenticated 
  USING (public.is_management()) 
  WITH CHECK (public.is_management());

-- 10. Audit logs: admin reads, system/authenticated inserts
DROP POLICY IF EXISTS "Admin view audit logs" ON public.audit_logs;
CREATE POLICY "Admin view audit logs" 
  ON public.audit_logs FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "System insert audit logs" ON public.audit_logs;
CREATE POLICY "System insert audit logs" 
  ON public.audit_logs FOR INSERT 
  TO authenticated 
  WITH CHECK (true);
