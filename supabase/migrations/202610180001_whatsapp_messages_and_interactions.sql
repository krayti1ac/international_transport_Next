-- ==============================================================================
-- Trans Bodanon TMS — Migration: WhatsApp Cloud API Interactive Logs & Tracking
-- Migration ID: 202610180001_whatsapp_messages_and_interactions.sql
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_message_logs (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE,
    wamid TEXT,
    phone TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_type TEXT NOT NULL CHECK (message_type IN ('text', 'interactive', 'location', 'status', 'document', 'template')),
    content TEXT,
    interactive_action_id TEXT,
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'queued', 'sent', 'delivered', 'read', 'failed')),
    error_message TEXT,
    related_entity_type TEXT CHECK (related_entity_type IN ('trip_order', 'invoice', 'driver', 'client', 'emergency')),
    related_entity_id BIGINT,
    raw_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for lightning fast lookups & multi-tenant querying
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_logs_phone ON public.whatsapp_message_logs(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_logs_wamid ON public.whatsapp_message_logs(wamid);
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_logs_company ON public.whatsapp_message_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_logs_status ON public.whatsapp_message_logs(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_logs_created_at ON public.whatsapp_message_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_logs_entity ON public.whatsapp_message_logs(related_entity_type, related_entity_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.whatsapp_message_logs ENABLE ROW LEVEL SECURITY;

-- Multi-Tenant RLS Policies
DROP POLICY IF EXISTS "whatsapp_logs_company_isolation" ON public.whatsapp_message_logs;
CREATE POLICY "whatsapp_logs_company_isolation" ON public.whatsapp_message_logs
    FOR ALL
    USING (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND (users.company_id = whatsapp_message_logs.company_id OR users.role = 'super_admin')
        )
    )
    WITH CHECK (
        company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND (users.company_id = whatsapp_message_logs.company_id OR users.role = 'super_admin')
        )
    );

-- Trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION public.update_whatsapp_message_logs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_whatsapp_message_logs_timestamp ON public.whatsapp_message_logs;
CREATE TRIGGER trg_update_whatsapp_message_logs_timestamp
    BEFORE UPDATE ON public.whatsapp_message_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_whatsapp_message_logs_timestamp();

