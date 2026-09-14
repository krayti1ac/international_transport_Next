-- Audit Logs: performance indexes for multi-tenant queries
-- Run after verifying `audit_logs` table exists

CREATE INDEX IF NOT EXISTS idx_audit_logs_user
  ON public.audit_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON public.audit_logs (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created
  ON public.audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
  ON public.audit_logs (user_id, created_at DESC);
