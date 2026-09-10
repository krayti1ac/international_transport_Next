-- ============================================================
-- Seed additional trip orders to populate all Kanban stages
-- Context: Trips Hub Kanban stages:
--   pendingAssignment | outbound | pendingReturn | returnRoute | settled
--
-- FK alignment: uses IDs from supabase/seed.sql defaults
--   clients 1-3, drivers 1-5, trucks 1-5, trailers 1-5
-- Multi-tenancy: company_id = 1
-- ============================================================

-- TRIP ORDERS covering every Kanban stage
INSERT INTO trip_orders (
  id, company_id, client_id, client_import_id, driver_id, truck_id, trailer_id,
  agreed_price, route, route_export, route_import,
  price, price_export, price_import,
  departure_date, unloading_date_export, loading_date_import, unloading_date_import,
  status, created_at,
  cmr_number, cmr_export_number, cmr_import_number, price_type,
  cmr_export_url, facture_url, phyto_url, mrn_export_url, cmr_import_url,
  ferry_company, ferry_localizador, ferry_company_import, ferry_localizador_import,
  goods_description_export, goods_description_import,
  weight_export, weight_import
) VALUES
-- pendingAssignment: pending
(
  2008, 1, 1, 1, NULL, NULL, NULL,
  18500, 'Tanger → Almería', 'Tanger → Almería', 'Almería → Tanger',
  18500, 9500, 9000,
  '2025-09-20T06:00:00Z', NULL, NULL, NULL,
  'pending', '2025-09-19T08:00:00Z',
  NULL, NULL, NULL, 'fixed',
  NULL, NULL, NULL, NULL, NULL,
  NULL, NULL, NULL, NULL,
  'Auto Parts', 'Auto Parts',
  22000, 24000
),
-- outbound: en_route_outbound
(
  2002, 1, 2, 2, 2, 2, 2,
  22000, 'Tanger → Marseille', 'Tanger → Marseille', 'Marseille → Tanger',
  22000, 12000, 10000,
  '2025-09-10T07:00:00Z', NULL, NULL, '2025-09-13T12:00:00Z',
  'en_route_outbound', '2025-09-09T08:00:00Z',
  'CMR-2025-2002', 'CMRE-2025-2002', NULL, 'fixed',
  'https://storage.supabase.co/cmr/export/2002.pdf', NULL, 'https://storage.supabase.co/phyto/2002.pdf', 'https://storage.supabase.co/mrn/2002.pdf', NULL,
  'Comanav', 'COM-2025-2002', NULL, NULL,
  'Textiles', NULL,
  18000, NULL
),
-- outbound: customs_export
(
  2003, 1, 3, 3, 3, 3, 3,
  19500, 'Casablanca → Barcelona', 'Casablanca → Barcelona', 'Barcelona → Casablanca',
  19500, 10500, 9000,
  '2025-09-11T05:00:00Z', NULL, NULL, '2025-09-14T11:00:00Z',
  'customs_export', '2025-09-10T08:00:00Z',
  'CMR-2025-2003', 'CMRE-2025-2003', 'CMRI-2025-2003', 'fixed',
  'https://storage.supabase.co/cmr/export/2003.pdf', NULL, 'https://storage.supabase.co/phyto/2003.pdf', 'https://storage.supabase.co/mrn/2003.pdf', 'https://storage.supabase.co/cmr/import/2003.pdf',
  'GNV', 'GNV-2025-2003', 'GNV', 'GNV-2025-2003B',
  'Dairy Products', 'Dairy Products',
  24000, 26000
),
-- pendingReturn: at_destination_export
(
  2004, 1, 1, 1, 1, 1, 1,
  17500, 'Tanger → Valencia', 'Tanger → Valencia', 'Valencia → Tanger',
  17500, 9000, 8500,
  '2025-09-06T06:00:00Z', '2025-09-08T13:00:00Z', NULL, NULL,
  'at_destination_export', '2025-09-05T08:00:00Z',
  'CMR-2025-2004', 'CMRE-2025-2004', NULL, 'fixed',
  'https://storage.supabase.co/cmr/export/2004.pdf', NULL, 'https://storage.supabase.co/phyto/2004.pdf', 'https://storage.supabase.co/mrn/2004.pdf', NULL,
  'Balearia', 'BAL-2025-2004', NULL, NULL,
  'Auto Parts', NULL,
  21000, NULL
),
-- pendingReturn: pending_return
(
  2005, 1, 2, 2, 2, 2, 2,
  16000, 'Almería → Tanger', 'Almería → Tanger', 'Tanger → Almería',
  16000, 8500, 7500,
  '2025-09-09T07:00:00Z', '2025-09-11T11:00:00Z', NULL, NULL,
  'pending_return', '2025-09-08T08:00:00Z',
  'CMR-2025-2005', 'CMRE-2025-2005', 'CMRI-2025-2005', 'fixed',
  'https://storage.supabase.co/cmr/export/2005.pdf', 'https://storage.supabase.co/facture/2005.pdf', 'https://storage.supabase.co/phyto/2005.pdf', 'https://storage.supabase.co/mrn/2005.pdf', 'https://storage.supabase.co/cmr/import/2005.pdf',
  'Trasmediterranea', 'TRA-2025-2005', 'Trasmediterranea', 'TRA-2025-2005B',
  'Return Goods', 'Return Goods',
  16000, 17000
),
-- returnRoute: en_route_inbound
(
  2006, 1, 3, 3, 3, 3, 3,
  25000, 'Casablanca → Lyon', 'Casablanca → Lyon', 'Lyon → Casablanca',
  25000, 14000, 11000,
  '2025-08-25T05:00:00Z', NULL, '2025-09-03T07:00:00Z', NULL,
  'en_route_inbound', '2025-08-24T08:00:00Z',
  'CMR-2025-2006', 'CMRE-2025-2006', 'CMRI-2025-2006', 'fixed',
  'https://storage.supabase.co/cmr/export/2006.pdf', NULL, 'https://storage.supabase.co/phyto/2006.pdf', 'https://storage.supabase.co/mrn/2006.pdf', 'https://storage.supabase.co/cmr/import/2006.pdf',
  'Corsica Linea', 'COR-2025-2006', 'Corsica Linea', 'COR-2025-2006B',
  'Dairy Products', 'Dairy Products',
  23000, 25000
),
-- returnRoute: customs_import
(
  2007, 1, 1, 1, 4, 4, 4,
  28000, 'Tanger → Hamburg', 'Tanger → Hamburg', 'Hamburg → Tanger',
  28000, 15000, 13000,
  '2025-09-10T06:00:00Z', NULL, '2025-09-14T07:00:00Z', NULL,
  'customs_import', '2025-09-09T08:00:00Z',
  'CMR-2025-2007', 'CMRE-2025-2007', 'CMRI-2025-2007', 'fixed',
  'https://storage.supabase.co/cmr/export/2007.pdf', NULL, 'https://storage.supabase.co/phyto/2007.pdf', 'https://storage.supabase.co/mrn/2007.pdf', 'https://storage.supabase.co/cmr/import/2007.pdf',
  'Grimaldi', 'GRI-2025-2007', 'Grimaldi', 'GRI-2025-2007B',
  'Auto Parts', 'Auto Parts',
  20000, 22000
),
-- settled: delivered
(
  2001, 1, 1, 1, 1, 1, 1,
  18500, 'Tanger → Almería', 'Tanger → Almería', 'Almería → Tanger',
  18500, 9500, 9000,
  '2025-08-10T06:00:00Z', '2025-08-12T14:00:00Z', '2025-08-14T08:00:00Z', '2025-08-16T16:00:00Z',
  'delivered', '2025-08-09T08:00:00Z',
  'CMR-2025-2001', 'CMRE-2025-2001', 'CMRI-2025-2001', 'fixed',
  'https://storage.supabase.co/cmr/export/2001.pdf', 'https://storage.supabase.co/facture/2001.pdf', 'https://storage.supabase.co/phyto/2001.pdf', 'https://storage.supabase.co/mrn/2001.pdf', 'https://storage.supabase.co/cmr/import/2001.pdf',
  'Balearia', 'BAL-2025-2001', 'Balearia', 'BAL-2025-2001B',
  'Auto Parts', 'Auto Parts',
  22000, 24000
)
ON CONFLICT (id) DO UPDATE SET
  company_id = EXCLUDED.company_id,
  status = EXCLUDED.status,
  unloading_date_export = EXCLUDED.unloading_date_export,
  loading_date_import = EXCLUDED.loading_date_import,
  unloading_date_import = EXCLUDED.unloading_date_import,
  route_export = EXCLUDED.route_export,
  route_import = EXCLUDED.route_import;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
