-- ============================================================================
-- Migration: 202610120001_create_driver_push_subscriptions.sql
-- Description: Driver Web Push Subscriptions Table & RLS Isolation
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.driver_push_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    driver_id BIGINT REFERENCES public.drivers(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    device_id TEXT,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    user_agent TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_push_subs_driver_id ON public.driver_push_subscriptions(driver_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_company_id ON public.driver_push_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_active ON public.driver_push_subscriptions(is_active) WHERE is_active = true;

-- Enable Row Level Security (RLS)
ALTER TABLE public.driver_push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'driver_push_subscriptions' AND policyname = 'driver_push_isolation_policy'
    ) THEN
        CREATE POLICY "driver_push_isolation_policy"
        ON public.driver_push_subscriptions
        FOR ALL
        USING (
            company_id IN (
                SELECT company_id FROM public.users WHERE id = auth.uid()
            ) OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin'
        );
    END IF;
END $$;

