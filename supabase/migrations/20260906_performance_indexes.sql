-- ============================================================
-- Migration: Production Performance Indexes
-- Context: Optimizes high-throughput tables (GPS tracking,
-- fleet documents, trip orders, invoices & FIFO allocations)
-- Database Engine: PostgreSQL 14+ / Supabase
-- ============================================================

-- 1. Real-time GPS & Telematics Optimization (truck_locations)
-- Query 1: Fetching latest truck position & recent path history
CREATE INDEX IF NOT EXISTS idx_truck_locations_truck_recorded
  ON public.truck_locations(truck_id, recorded_at DESC);

-- Query 2: Reconstructing complete GPS path for a specific trip
CREATE INDEX IF NOT EXISTS idx_truck_locations_trip_recorded
  ON public.truck_locations(trip_id, recorded_at ASC)
  WHERE trip_id IS NOT NULL;

-- Query 3: Live fleet tracking map (most recent pings fleet-wide)
CREATE INDEX IF NOT EXISTS idx_truck_locations_recorded_at
  ON public.truck_locations(recorded_at DESC);

-- 2. Fleet Documents Matrix & Expiry Tracking (fleet_documents)
-- Query 1: Filtering documents by entity (truck, trailer, driver) excluding archived
CREATE INDEX IF NOT EXISTS idx_fleet_docs_entity_archived
  ON public.fleet_documents(entity_type, entity_id, is_archived);

-- Query 2: Document category lookups & relational usage checks
CREATE INDEX IF NOT EXISTS idx_fleet_docs_type_archived
  ON public.fleet_documents(document_type, is_archived);

-- Query 3: Critical expiry alerts (upcoming expirations on active documents only)
CREATE INDEX IF NOT EXISTS idx_fleet_docs_expiry_active
  ON public.fleet_documents(expiry_date)
  WHERE is_archived = FALSE;

-- Query 4: Renewals audit trail lookups
CREATE INDEX IF NOT EXISTS idx_fleet_renewals_doc_type
  ON public.fleet_document_renewals(document_type);

CREATE INDEX IF NOT EXISTS idx_fleet_renewals_date
  ON public.fleet_document_renewals(new_expiry_date DESC);

-- 3. Trip Orders & Operations (trip_orders)
-- Query 1: Status filtering for dashboard & active trips
CREATE INDEX IF NOT EXISTS idx_trip_orders_status
  ON public.trip_orders(status);

-- Query 2: Driver & Truck assignment lookups
CREATE INDEX IF NOT EXISTS idx_trip_orders_truck_id
  ON public.trip_orders(truck_id);

CREATE INDEX IF NOT EXISTS idx_trip_orders_driver_id
  ON public.trip_orders(driver_id);

-- Query 3: Client trip history lookups (export & import)
CREATE INDEX IF NOT EXISTS idx_trip_orders_client_id
  ON public.trip_orders(client_id);

CREATE INDEX IF NOT EXISTS idx_trip_orders_client_import_id
  ON public.trip_orders(client_import_id)
  WHERE client_import_id IS NOT NULL;

-- Query 4: Chronological ordering by departure date
CREATE INDEX IF NOT EXISTS idx_trip_orders_departure
  ON public.trip_orders(departure_date DESC);

-- 4. Billing, Treasury & FIFO Allocation (invoices, payments, allocations)
-- Query 1: Invoices filtered by client and status (unpaid/partial/paid)
CREATE INDEX IF NOT EXISTS idx_invoices_client_status
  ON public.invoices(client_id, status);

-- Query 2: Due date monitoring for aging balance & payment reminders
CREATE INDEX IF NOT EXISTS idx_invoices_due_date
  ON public.invoices(due_date);

-- Query 3: Invoice link to trip orders
CREATE INDEX IF NOT EXISTS idx_invoices_trip_order
  ON public.invoices(trip_order_id)
  WHERE trip_order_id IS NOT NULL;

-- Query 4: Payment allocations linking payments to invoices
CREATE INDEX IF NOT EXISTS idx_allocations_payment_id
  ON public.payment_invoice_allocations(payment_id);

CREATE INDEX IF NOT EXISTS idx_allocations_invoice_id
  ON public.payment_invoice_allocations(invoice_id);

-- Query 5: Treasury transactions ordering & audit trail
CREATE INDEX IF NOT EXISTS idx_treasury_date_created
  ON public.treasury_transactions(created_at DESC);

-- 5. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

