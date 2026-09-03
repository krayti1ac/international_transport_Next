BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins full access on users') THEN
    CREATE POLICY "Admins full access on users"
      ON users FOR ALL
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins full access on drivers') THEN
    CREATE POLICY "Admins full access on drivers"
      ON drivers FOR ALL
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers read own driver profile') THEN
    CREATE POLICY "Drivers read own driver profile"
      ON drivers FOR SELECT
      USING (
        user_id = auth.uid() AND
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.role = 'driver'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Secretaries manage drivers') THEN
    CREATE POLICY "Secretaries manage drivers"
      ON drivers FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.role IN ('admin', 'secretary')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins full access on trips') THEN
    CREATE POLICY "Admins full access on trips"
      ON trips FOR ALL
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Secretaries manage trips') THEN
    CREATE POLICY "Secretaries manage trips"
      ON trips FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.role IN ('admin', 'secretary')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers read own trips') THEN
    CREATE POLICY "Drivers read own trips"
      ON trips FOR SELECT
      USING (
        driver_id IN (
          SELECT id FROM drivers WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers update own trips') THEN
    CREATE POLICY "Drivers update own trips"
      ON trips FOR UPDATE
      USING (
        driver_id IN (
          SELECT id FROM drivers WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins full access on trip_orders') THEN
    CREATE POLICY "Admins full access on trip_orders"
      ON trip_orders FOR ALL
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Secretaries manage trip_orders') THEN
    CREATE POLICY "Secretaries manage trip_orders"
      ON trip_orders FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.role IN ('admin', 'secretary')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers read assigned trip_orders') THEN
    CREATE POLICY "Drivers read assigned trip_orders"
      ON trip_orders FOR SELECT
      USING (
        driver_id IN (
          SELECT id FROM drivers WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins full access on advances') THEN
    CREATE POLICY "Admins full access on advances"
      ON advances FOR ALL
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Secretaries manage advances') THEN
    CREATE POLICY "Secretaries manage advances"
      ON advances FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.role IN ('admin', 'secretary')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers read own advances') THEN
    CREATE POLICY "Drivers read own advances"
      ON advances FOR SELECT
      USING (
        driver_id IN (
          SELECT id FROM drivers WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers update own advances') THEN
    CREATE POLICY "Drivers update own advances"
      ON advances FOR UPDATE
      USING (
        driver_id IN (
          SELECT id FROM drivers WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins full access on driver_salaries') THEN
    CREATE POLICY "Admins full access on driver_salaries"
      ON driver_salaries FOR ALL
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Secretaries manage driver_salaries') THEN
    CREATE POLICY "Secretaries manage driver_salaries"
      ON driver_salaries FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.role IN ('admin', 'secretary')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers read own driver_salaries') THEN
    CREATE POLICY "Drivers read own driver_salaries"
      ON driver_salaries FOR SELECT
      USING (
        driver_id IN (
          SELECT id FROM drivers WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins full access on clients') THEN
    CREATE POLICY "Admins full access on clients"
      ON clients FOR ALL
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Secretaries manage clients') THEN
    CREATE POLICY "Secretaries manage clients"
      ON clients FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.role IN ('admin', 'secretary')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins full access on secretary_cash') THEN
    CREATE POLICY "Admins full access on secretary_cash"
      ON secretary_cash FOR ALL
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Secretaries manage secretary_cash') THEN
    CREATE POLICY "Secretaries manage secretary_cash"
      ON secretary_cash FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.role IN ('admin', 'secretary')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers read own emergency_advance_requests') THEN
    CREATE POLICY "Drivers read own emergency_advance_requests"
      ON emergency_advance_requests FOR SELECT
      USING (
        driver_id IN (
          SELECT id FROM drivers WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Drivers insert own emergency_advance_requests') THEN
    CREATE POLICY "Drivers insert own emergency_advance_requests"
      ON emergency_advance_requests FOR INSERT
      WITH CHECK (
        driver_id IN (
          SELECT id FROM drivers WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins full access on emergency_advance_requests') THEN
    CREATE POLICY "Admins full access on emergency_advance_requests"
      ON emergency_advance_requests FOR ALL
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Secretaries manage emergency_advance_requests') THEN
    CREATE POLICY "Secretaries manage emergency_advance_requests"
      ON emergency_advance_requests FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.role IN ('admin', 'secretary')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins full access on invoices') THEN
    CREATE POLICY "Admins full access on invoices"
      ON invoices FOR ALL
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Secretaries manage invoices') THEN
    CREATE POLICY "Secretaries manage invoices"
      ON invoices FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.role IN ('admin', 'secretary')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins full access on treasury_transactions') THEN
    CREATE POLICY "Admins full access on treasury_transactions"
      ON treasury_transactions FOR ALL
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Secretaries manage treasury_transactions') THEN
    CREATE POLICY "Secretaries manage treasury_transactions"
      ON treasury_transactions FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.role IN ('admin', 'secretary')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins full access on system_settings') THEN
    CREATE POLICY "Admins full access on system_settings"
      ON system_settings FOR ALL
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins full access on audit_logs') THEN
    CREATE POLICY "Admins full access on audit_logs"
      ON audit_logs FOR ALL
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Secretaries read audit_logs') THEN
    CREATE POLICY "Secretaries read audit_logs"
      ON audit_logs FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid() AND users.role IN ('admin', 'secretary')
        )
      );
  END IF;
END $$;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE secretary_cash ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_advance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

COMMIT;
