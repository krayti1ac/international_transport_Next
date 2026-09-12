-- ==============================================================================
-- Migration: 20260928_independent_email_inbox.sql
-- Description: Independent Email System (SMTP/IMAP) & Secretary Smart Inbox
-- ==============================================================================

BEGIN;

-- 1. Create table public.email_messages
CREATE TABLE IF NOT EXISTS public.email_messages (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES public.companies(id) ON DELETE CASCADE,
  trip_id BIGINT REFERENCES public.trip_orders(id) ON DELETE SET NULL,
  message_id TEXT UNIQUE,
  sender_email TEXT NOT NULL,
  sender_name TEXT,
  recipient_email TEXT NOT NULL,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  is_read BOOLEAN DEFAULT FALSE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes for fast filtering and retrieval
CREATE INDEX IF NOT EXISTS idx_email_messages_company ON public.email_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_trip ON public.email_messages(trip_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_direction ON public.email_messages(direction);
CREATE INDEX IF NOT EXISTS idx_email_messages_is_read ON public.email_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_email_messages_created_at ON public.email_messages(created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

-- 4. Multi-Tenant SaaS RLS Policies
DROP POLICY IF EXISTS email_messages_tenant_isolation ON public.email_messages;

CREATE POLICY email_messages_tenant_isolation ON public.email_messages
  FOR ALL
  TO authenticated
  USING (
    company_id = public.current_company_id()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'super_admin'
    )
  )
  WITH CHECK (
    company_id = public.current_company_id()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'super_admin'
    )
  );

-- 5. Enable Supabase Realtime Replication for Instant Inbox Updates
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'email_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.email_messages;
    END IF;
  END IF;
END $$;

COMMIT;

