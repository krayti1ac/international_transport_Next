-- ============================================================
-- Trans Bodanon - Clear Mock Data Script
-- Truncates all tables and resets ID sequences
-- Safe to run before seeding or going live
-- ============================================================

BEGIN;

-- Disable triggers temporarily to allow truncation of parent tables
SET session_replication_role = replica;

-- Truncate child tables first (respecting FK relationships)
TRUNCATE TABLE
  payment_invoice_allocations,
  delivery_signatures,
  trip_order_documents,
  repair_invoice_items,
  fleet_document_renewals,
  geofence_alerts,
  truck_locations,
  driver_salaries,
  fine_penalties,
  truck_maintenance,
  fleet_documents,
  advances,
  invoices,
  payments,
  treasury_transactions,
  trip_orders,
  drivers,
  trailers,
  trucks,
  clients,
  bank_accounts,
  cash_boxes,
  users,
  system_settings,
  audit_logs,
  chat_messages,
  repair_invoices,
  emergency_advance_requests,
  forex_rates,
  forex_gain_loss_entries,
  document_categories,
  expense_categories,
  providers,
  app_settings,
  pending_updates
  RESTART IDENTITY CASCADE;

-- Re-enable triggers
SET session_replication_role = DEFAULT;

COMMIT;
