-- ==============================================================================
-- Migration: 202610160001_create_driver_bound_devices.sql
-- Description: Driver Hardware Binding, WebAuthn Biometrics & FIDO2 Security Engine
-- ==============================================================================

BEGIN;

-- 1. Create table public.driver_bound_devices
CREATE TABLE IF NOT EXISTS public.driver_bound_devices (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id BIGINT NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  algorithm INTEGER NOT NULL DEFAULT -7, -- -7 = ES256 (ECDSA P-256), -257 = RS256 (RSA)
  counter BIGINT NOT NULL DEFAULT 0,
  device_fingerprint TEXT NOT NULL,
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL DEFAULT 'android_biometric',
  aaguid TEXT,
  authenticator_attachment TEXT NOT NULL DEFAULT 'platform', -- 'platform' (biometric) or 'cross-platform' (YubiKey)
  status TEXT NOT NULL DEFAULT 'bound_active', -- 'pending_verification', 'bound_active', 'revoked', 'lost_stolen'
  attestation_format TEXT DEFAULT 'none',
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create table public.driver_auth_challenges
CREATE TABLE IF NOT EXISTS public.driver_auth_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id BIGINT NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  challenge TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'authentication', -- 'registration', 'authentication', 'epod_signature', 'fuel_receipt', 'trip_stage'
  payload JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create performance and security indexes
CREATE INDEX IF NOT EXISTS idx_driver_bound_devices_driver_id 
  ON public.driver_bound_devices(driver_id);

CREATE INDEX IF NOT EXISTS idx_driver_bound_devices_company_id 
  ON public.driver_bound_devices(company_id);

CREATE INDEX IF NOT EXISTS idx_driver_bound_devices_credential_id 
  ON public.driver_bound_devices(credential_id);

CREATE INDEX IF NOT EXISTS idx_driver_bound_devices_fingerprint 
  ON public.driver_bound_devices(device_fingerprint);

CREATE INDEX IF NOT EXISTS idx_driver_bound_devices_status 
  ON public.driver_bound_devices(driver_id, status);

CREATE INDEX IF NOT EXISTS idx_driver_auth_challenges_driver 
  ON public.driver_auth_challenges(driver_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_driver_auth_challenges_challenge 
  ON public.driver_auth_challenges(challenge);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.driver_bound_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_auth_challenges ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for driver_bound_devices
DROP POLICY IF EXISTS "Management can manage driver devices" ON public.driver_bound_devices;
CREATE POLICY "Management can manage driver devices"
  ON public.driver_bound_devices
  FOR ALL
  TO authenticated
  USING (
    public.is_management() 
    OR company_id = public.current_company_id()
  )
  WITH CHECK (
    public.is_management() 
    OR company_id = public.current_company_id()
  );

DROP POLICY IF EXISTS "Drivers can view their own bound devices" ON public.driver_bound_devices;
CREATE POLICY "Drivers can view their own bound devices"
  ON public.driver_bound_devices
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() 
    OR driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  );

-- 6. RLS Policies for driver_auth_challenges
DROP POLICY IF EXISTS "Management can manage driver challenges" ON public.driver_auth_challenges;
CREATE POLICY "Management can manage driver challenges"
  ON public.driver_auth_challenges
  FOR ALL
  TO authenticated
  USING (
    public.is_management() 
    OR company_id = public.current_company_id()
  )
  WITH CHECK (
    public.is_management() 
    OR company_id = public.current_company_id()
  );

DROP POLICY IF EXISTS "Drivers can read and use their own challenges" ON public.driver_auth_challenges;
CREATE POLICY "Drivers can read and use their own challenges"
  ON public.driver_auth_challenges
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid() 
    OR driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid() 
    OR driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  );

COMMIT;
