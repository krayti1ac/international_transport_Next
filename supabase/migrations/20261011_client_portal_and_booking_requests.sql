-- ============================================================================
-- Migration: 20261011_client_portal_and_booking_requests.sql
-- Description: Client Portal & Self-Service Booking System for Exporters
-- Multi-Tenant RLS isolation, client_id user association, and booking_requests table
-- ============================================================================

-- 1. Ensure client_id column exists on public.users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'client_id'
    ) THEN
        ALTER TABLE public.users
        ADD COLUMN client_id BIGINT REFERENCES public.clients(id) ON DELETE SET NULL;
        
        COMMENT ON COLUMN public.users.client_id IS 'Associates client role users with their specific client profile';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_client_id ON public.users(client_id);

-- 2. Create booking_requests table
CREATE TABLE IF NOT EXISTS public.booking_requests (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    booking_number VARCHAR(50) NOT NULL UNIQUE,
    route_from VARCHAR(100) NOT NULL,
    route_to VARCHAR(100) NOT NULL,
    corridor_type VARCHAR(50) DEFAULT 'european_maritime',
    cargo_type VARCHAR(50) NOT NULL, -- 'fresh_produce', 'frozen_fish', 'general_cargo', 'pharmaceuticals'
    trailer_type VARCHAR(50) NOT NULL, -- 'frigo', 'bache', 'box', 'container'
    target_temperature NUMERIC(5,2),
    weight_tons NUMERIC(6,2),
    pickup_date TIMESTAMPTZ NOT NULL,
    delivery_deadline TIMESTAMPTZ,
    pickup_address TEXT,
    pickup_gps_url TEXT,
    delivery_address TEXT,
    delivery_gps_url TEXT,
    special_instructions TEXT,
    status VARCHAR(30) DEFAULT 'pending' NOT NULL, -- 'pending', 'confirmed', 'assigned', 'rejected', 'cancelled'
    assigned_trip_id BIGINT REFERENCES public.trip_orders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create indexes for high-speed queries
CREATE INDEX IF NOT EXISTS idx_booking_requests_client_id ON public.booking_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests_company_id ON public.booking_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests_status ON public.booking_requests(status);
CREATE INDEX IF NOT EXISTS idx_booking_requests_pickup_date ON public.booking_requests(pickup_date);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

-- 5. Policies for Staff (Admin, Secretary, Fleet Manager, Super Admin)
DROP POLICY IF EXISTS "staff_manage_company_bookings" ON public.booking_requests;
CREATE POLICY "staff_manage_company_bookings" ON public.booking_requests
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND (
                users.role = 'super_admin'
                OR (
                    users.role IN ('admin', 'secretary', 'fleet_manager')
                    AND (users.company_id = booking_requests.company_id OR booking_requests.company_id IS NULL)
                )
            )
        )
    );

-- 6. Policies for Client Users (Strict Self-Service Isolation)
DROP POLICY IF EXISTS "client_view_own_bookings" ON public.booking_requests;
CREATE POLICY "client_view_own_bookings" ON public.booking_requests
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'client'
            AND users.client_id = booking_requests.client_id
        )
    );

DROP POLICY IF EXISTS "client_insert_own_bookings" ON public.booking_requests;
CREATE POLICY "client_insert_own_bookings" ON public.booking_requests
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'client'
            AND users.client_id = booking_requests.client_id
        )
    );

