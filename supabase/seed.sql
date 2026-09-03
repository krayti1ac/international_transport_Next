-- ============================================================
-- Trans Bodanon - Mock Data Seeding Script
-- Context: Moroccan & European Logistics
-- ============================================================

-- USERS
INSERT INTO users (id, email, role, name, created_at, theme_mode, mfa_enabled) VALUES
('00000000-0000-0000-0000-000000000001', 'admin@transbodanon.ma', 'admin', 'Admin Trans Bodanon', '2025-01-01T08:00:00Z', 'system', false),
('00000000-0000-0000-0000-000000000002', 'secretary@transbodanon.ma', 'secretary', 'Fatima Zahra', '2025-01-01T08:00:00Z', 'light', false),
('00000000-0000-0000-0000-000000000003', 'driver1@transbodanon.ma', 'driver', 'Ahmed Benali', '2025-01-01T08:00:00Z', 'system', false),
('00000000-0000-0000-0000-000000000004', 'driver2@transbodanon.ma', 'driver', 'Mohamed Amrani', '2025-01-01T08:00:00Z', 'system', false),
('00000000-0000-0000-0000-000000000005', 'driver3@transbodanon.ma', 'driver', 'Youssef El Idrissi', '2025-01-01T08:00:00Z', 'system', false);

-- CLIENTS
INSERT INTO clients (
  id, name, phone, address, city, created_at, nom_contact, adresse_facturation,
  default_bank_account_id, default_bank_account, ice, email, currency, is_active,
  invoice_with_tva, tva_rate, last_invoice_number, preferred_notification_method,
  shipping_address_line1, shipping_address_line2, shipping_address_line3,
  shipping_address_line4, shipping_city, shipping_postal_code, shipping_country,
  billing_address_line1, billing_address_line2, billing_address_line3,
  billing_address_line4, billing_city, billing_postal_code, billing_country
) VALUES
(1, 'Renault Tanger', '+212539123456', 'Zone Industrielle Tanger Free Zone', 'Tanger', '2025-01-01T08:00:00Z', 'Jean Dupont', 'Zone Industrielle Tanger Free Zone, Tanger', 1, 'Main Business - MAD', '001512345678912', 'logistique@renault.ma', 'MAD', true, true, '20', '1001', 'whatsapp', 'Usine Renault Tanger', 'BP 470', 'Tanger Free Zone', '', 'Tanger', '90000', 'Morocco', 'Usine Renault Tanger', 'BP 470', 'Tanger Free Zone', '', 'Tanger', '90000', 'Morocco'),
(2, 'Inditex Almeria', '+349500112233', 'Polígono Industrial El Realengo', 'Almería', '2025-01-01T08:00:00Z', 'María García', 'Polígono Industrial El Realengo, Almería', 2, 'Euro Account - EUR', 'B345678901234', 'logistica@inditex.es', 'EUR', true, true, '21', '2001', 'email', 'Calle Industrial 15', 'Polígono El Realengo', '', 'Almería', '04007', 'Spain', 'Calle Industrial 15', 'Polígono El Realengo', '', 'Almería', '04007', 'Spain'),
(3, 'Danone Casablanca', '+212522123456', 'Zone Industrielle Ouled Saleh', 'Casablanca', '2025-01-01T08:00:00Z', 'Amine Bennis', 'Zone Industrielle Ouled Saleh, Casablanca', 1, 'Main Business - MAD', '001598765432198', 'contact@danone.ma', 'MAD', true, true, '20', '3001', 'whatsapp', 'Zone Industrielle Ouled Saleh', 'BP 210', '', '', 'Casablanca', '20250', 'Morocco', 'Zone Industrielle Ouled Saleh', 'BP 210', '', '', 'Casablanca', '20250', 'Morocco');

-- BANK ACCOUNTS
INSERT INTO bank_accounts (id, name, bank_name, account_number, currency, account_type, current_balance, is_active, created_at) VALUES
(1, 'Main Business - MAD', 'Banque Populaire', '0077800000123456789012', 'MAD', 'checking', 450000, true, '2025-01-01T08:00:00Z'),
(2, 'Euro Account - EUR', 'Attijariwafa Bank', '0077800000987654321098', 'EUR', 'checking', 125000, true, '2025-01-01T08:00:00Z');

-- CASH BOXES
INSERT INTO cash_boxes (id, name, code, currency, created_at) VALUES
(1, 'Main Cash Box MAD', 'CB-MAD-01', 'MAD', '2025-01-01T08:00:00Z'),
(2, 'Euro Cash Box', 'CB-EUR-01', 'EUR', '2025-01-01T08:00:00Z');

-- TRUCKS
INSERT INTO trucks (id, plate_number, model, status, current_location, created_at, default_driver_id, default_driver_name, default_trailer_id, default_trailer_name, purchase_price, weight_capacity, power) VALUES
(1, '12345-A-50', 'Mercedes Actros 1851', 'active', 'Tanger Port', '2025-01-01T08:00:00Z', 1, 'Ahmed Benali', 1, 'T-12345-A', 850000, 26000, 510),
(2, '67890-B-51', 'Scania R450', 'active', 'Casablanca', '2025-01-01T08:00:00Z', 2, 'Mohamed Amrani', 2, 'T-67890-B', 920000, 28000, 450),
(3, '24680-C-52', 'Volvo FH16', 'active', 'Tanger', '2025-01-01T08:00:00Z', 3, 'Youssef El Idrissi', 3, 'T-24680-C', 780000, 25000, 540),
(4, '13579-D-53', 'MAN TGX 18.500', 'maintenance', 'Rabat Workshop', '2025-01-01T08:00:00Z', 4, 'Omar Tazi', 4, 'T-13579-D', 810000, 27000, 490),
(5, '86420-E-54', 'Daf XF 480', 'active', 'Almería', '2025-01-01T08:00:00Z', 5, 'Karim Fassi', 5, 'T-86420-E', 890000, 26000, 480);

-- TRAILERS
INSERT INTO trailers (id, plate_number, model, status, created_at) VALUES
(1, 'T-12345-A', 'Krone Cool Liner', 'active', '2025-01-01T08:00:00Z'),
(2, 'T-67890-B', 'Schmitz Cargobull', 'active', '2025-01-01T08:00:00Z'),
(3, 'T-24680-C', 'Kogel SN24', 'active', '2025-01-01T08:00:00Z'),
(4, 'T-13579-D', 'Krone Profi Liner', 'maintenance', '2025-01-01T08:00:00Z'),
(5, 'T-86420-E', 'Schmitz Mega', 'active', '2025-01-01T08:00:00Z');

-- DRIVERS
INSERT INTO drivers (id, user_id, name, phone, license, status, base_salary, bonus_percentage, default_truck_id, default_truck_name, default_trailer_name, visa_number, visa_expiry_date, has_valid_visa, created_at) VALUES
(1, '00000000-0000-0000-0000-000000000003', 'Ahmed Benali', '+212661234567', 'MA-L-12345678', 'active', 8000, 3.5, 1, 'Mercedes Actros 1851', 'Krone Cool Liner', 'VISA-MA-001', '2026-12-31', true, '2025-01-01T08:00:00Z'),
(2, '00000000-0000-0000-0000-000000000004', 'Mohamed Amrani', '+212662345678', 'MA-L-87654321', 'active', 7500, 3.0, 2, 'Scania R450', 'Schmitz Cargobull', 'VISA-MA-002', '2026-11-30', true, '2025-01-01T08:00:00Z'),
(3, '00000000-0000-0000-0000-000000000005', 'Youssef El Idrissi', '+212663456789', 'MA-L-11223344', 'active', 9000, 4.0, 3, 'Volvo FH16', 'Kogel SN24', 'VISA-MA-003', '2027-01-15', true, '2025-01-01T08:00:00Z'),
(4, '00000000-0000-0000-0000-000000000006', 'Omar Tazi', '+212664567890', 'MA-L-55667788', 'on_leave', 8500, 3.5, 4, 'MAN TGX 18.500', 'Krone Profi Liner', 'VISA-MA-004', '2026-10-20', true, '2025-01-01T08:00:00Z'),
(5, '00000000-0000-0000-0000-000000000007', 'Karim Fassi', '+212665678901', 'MA-L-99887766', 'active', 7000, 2.5, 5, 'Daf XF 480', 'Schmitz Mega', 'VISA-MA-005', '2026-09-30', true, '2025-01-01T08:00:00Z');

-- TRIP ORDERS (10 trips - mix of outbound to Europe and return to Morocco)
INSERT INTO trip_orders (
  id, client_id, client_import_id, driver_id, truck_id, trailer_id,
  route, route_export, route_import,
  price, price_export, price_import,
  departure_date, unloading_date_export, loading_date_import, unloading_date_import,
  status, created_at,
  cmr_number, cmr_export_number, cmr_import_number, price_type,
  cmr_export_url, facture_url, phyto_url, mrn_export_url, cmr_import_url,
  ferry_company, ferry_localizador, ferry_company_import, ferry_localizador_import,
  goods_description_export, goods_description_import,
  weight_export, weight_import
) VALUES
(1, 1, NULL, 1, 1, 1, 'Tanger → Almería', 'Tanger → Almería', 'Almería → Tanger', 18500, 9500, 9000, '2025-08-15T06:00:00Z', '2025-08-17T14:00:00Z', '2025-08-19T08:00:00Z', '2025-08-21T16:00:00Z', 'delivered', '2025-08-14T08:00:00Z', 'CMR-2025-001', 'CMRE-2025-001', 'CMRI-2025-001', 'fixed', 'https://storage.supabase.co/cmr/export/001.pdf', 'https://storage.supabase.co/facture/001.pdf', 'https://storage.supabase.co/phyto/001.pdf', 'https://storage.supabase.co/mrn/001.pdf', 'https://storage.supabase.co/cmr/import/001.pdf', 'Balearia', 'BAL-2025-88432', 'Balearia', 'BAL-2025-88433', 'Auto Parts', 'Auto Parts', 22000, 24000),
(2, 2, 2, 2, 2, 2, 'Tanger → Marseille', 'Tanger → Marseille', 'Marseille → Tanger', 22000, 12000, 10000, '2025-08-20T07:00:00Z', '2025-08-22T10:00:00Z', '2025-08-25T06:00:00Z', '2025-08-27T12:00:00Z', 'delivered', '2025-08-19T08:00:00Z', 'CMR-2025-002', 'CMRE-2025-002', 'CMRI-2025-002', 'fixed', 'https://storage.supabase.co/cmr/export/002.pdf', 'https://storage.supabase.co/facture/002.pdf', 'https://storage.supabase.co/phyto/002.pdf', 'https://storage.supabase.co/mrn/002.pdf', 'https://storage.supabase.co/cmr/import/002.pdf', 'Comanav', 'COM-2025-55123', 'Comanav', 'COM-2025-55124', 'Textiles', 'Textiles', 18000, 19500),
(3, 3, 3, 3, 3, 3, 'Casablanca → Barcelona', 'Casablanca → Barcelona', 'Barcelona → Casablanca', 19500, 10500, 9000, '2025-09-01T05:00:00Z', '2025-09-03T09:00:00Z', '2025-09-05T07:00:00Z', '2025-09-07T11:00:00Z', 'in_transit', '2025-08-31T08:00:00Z', 'CMR-2025-003', 'CMRE-2025-003', 'CMRI-2025-003', 'fixed', 'https://storage.supabase.co/cmr/export/003.pdf', 'https://storage.supabase.co/facture/003.pdf', 'https://storage.supabase.co/phyto/003.pdf', 'https://storage.supabase.co/mrn/003.pdf', 'https://storage.supabase.co/cmr/import/003.pdf', 'GNV', 'GNV-2025-99876', 'GNV', 'GNV-2025-99877', 'Dairy Products', 'Dairy Products', 24000, 26000),
(4, 1, NULL, 1, 1, 1, 'Tanger → Valencia', 'Tanger → Valencia', 'Valencia → Tanger', 17500, 9000, 8500, '2025-09-05T06:00:00Z', '2025-09-07T13:00:00Z', '2025-09-09T08:00:00Z', '2025-09-11T15:00:00Z', 'pending', '2025-09-04T08:00:00Z', 'CMR-2025-004', 'CMRE-2025-004', NULL, 'fixed', 'https://storage.supabase.co/cmr/export/004.pdf', NULL, 'https://storage.supabase.co/phyto/004.pdf', 'https://storage.supabase.co/mrn/004.pdf', NULL, 'Balearia', 'BAL-2025-88434', NULL, NULL, 'Auto Parts', NULL, 21000, NULL),
(5, 2, 2, 2, 2, 2, 'Almería → Tanger', 'Almería → Tanger', 'Tanger → Almería', 16000, 8500, 7500, '2025-09-08T07:00:00Z', '2025-09-10T11:00:00Z', '2025-09-12T07:00:00Z', '2025-09-14T12:00:00Z', 'pending', '2025-09-07T08:00:00Z', 'CMR-2025-005', 'CMRE-2025-005', 'CMRI-2025-005', 'fixed', 'https://storage.supabase.co/cmr/export/005.pdf', 'https://storage.supabase.co/facture/005.pdf', 'https://storage.supabase.co/phyto/005.pdf', 'https://storage.supabase.co/mrn/005.pdf', 'https://storage.supabase.co/cmr/import/005.pdf', 'Trasmediterranea', 'TRA-2025-33210', 'Trasmediterranea', 'TRA-2025-33211', 'Return Goods', 'Return Goods', 16000, 17000),
(6, 3, NULL, 3, 3, 3, 'Casablanca → Lyon', 'Casablanca → Lyon', 'Lyon → Casablanca', 25000, 14000, 11000, '2025-08-25T05:00:00Z', NULL, NULL, '2025-09-02T14:00:00Z', 'cancelled', '2025-08-24T08:00:00Z', 'CMR-2025-006', 'CMRE-2025-006', 'CMRI-2025-006', 'fixed', 'https://storage.supabase.co/cmr/export/006.pdf', 'https://storage.supabase.co/facture/006.pdf', 'https://storage.supabase.co/phyto/006.pdf', 'https://storage.supabase.co/mrn/006.pdf', 'https://storage.supabase.co/cmr/import/006.pdf', 'Corsica Linea', 'COR-2025-77123', 'Corsica Linea', 'COR-2025-77124', 'Dairy Products', 'Dairy Products', 23000, 25000),
(7, 1, 1, 4, 4, 4, 'Tanger → Hamburg', 'Tanger → Hamburg', 'Hamburg → Tanger', 28000, 15000, 13000, '2025-09-10T06:00:00Z', '2025-09-12T09:00:00Z', '2025-09-15T06:00:00Z', '2025-09-17T13:00:00Z', 'loading', '2025-09-09T08:00:00Z', 'CMR-2025-007', 'CMRE-2025-007', 'CMRI-2025-007', 'fixed', 'https://storage.supabase.co/cmr/export/007.pdf', 'https://storage.supabase.co/facture/007.pdf', 'https://storage.supabase.co/phyto/007.pdf', 'https://storage.supabase.co/mrn/007.pdf', 'https://storage.supabase.co/cmr/import/007.pdf', 'Grimaldi', 'GRI-2025-44556', 'Grimaldi', 'GRI-2025-44557', 'Auto Parts', 'Auto Parts', 20000, 22000),
(8, 2, NULL, 5, 5, 5, 'Almería → Casablanca', 'Almería → Casablanca', 'Casablanca → Almería', 15000, 8000, 7000, '2025-09-12T07:00:00Z', '2025-09-14T10:00:00Z', '2025-09-16T07:00:00Z', '2025-09-18T11:00:00Z', 'in_transit', '2025-09-11T08:00:00Z', 'CMR-2025-008', 'CMRE-2025-008', 'CMRI-2025-008', 'fixed', 'https://storage.supabase.co/cmr/export/008.pdf', 'https://storage.supabase.co/facture/008.pdf', 'https://storage.supabase.co/phyto/008.pdf', 'https://storage.supabase.co/mrn/008.pdf', 'https://storage.supabase.co/cmr/import/008.pdf', 'Trasmediterranea', 'TRA-2025-33212', 'Trasmediterranea', 'TRA-2025-33213', 'Textiles', 'Textiles', 17000, 18000),
(9, 3, 3, 1, 1, 2, 'Casablanca → Rotterdam', 'Casablanca → Rotterdam', 'Rotterdam → Casablanca', 30000, 16000, 14000, '2025-08-28T05:00:00Z', '2025-08-30T08:00:00Z', '2025-09-02T05:00:00Z', '2025-09-04T10:00:00Z', 'delivered', '2025-08-27T08:00:00Z', 'CMR-2025-009', 'CMRE-2025-009', 'CMRI-2025-009', 'fixed', 'https://storage.supabase.co/cmr/export/009.pdf', 'https://storage.supabase.co/facture/009.pdf', 'https://storage.supabase.co/phyto/009.pdf', 'https://storage.supabase.co/mrn/009.pdf', 'https://storage.supabase.co/cmr/import/009.pdf', 'Grimaldi', 'GRI-2025-44558', 'Grimaldi', 'GRI-2025-44559', 'Dairy Products', 'Dairy Products', 25000, 27000),
(10, 1, NULL, 2, 2, 1, 'Tanger → Barcelona', 'Tanger → Barcelona', 'Barcelona → Tanger', 17000, 9000, 8000, '2025-09-15T06:00:00Z', NULL, NULL, NULL, 'scheduled', '2025-09-14T08:00:00Z', 'CMR-2025-010', 'CMRE-2025-010', NULL, 'fixed', 'https://storage.supabase.co/cmr/export/010.pdf', NULL, 'https://storage.supabase.co/phyto/010.pdf', 'https://storage.supabase.co/mrn/010.pdf', NULL, 'Balearia', 'BAL-2025-88435', NULL, NULL, 'Auto Parts', NULL, 19000, NULL);

-- ADVANCES (linked to drivers and trip_orders)
INSERT INTO advances (id, driver_id, amount, currency, reason, status, date, created_at, source_cash_box, is_deleted, extra_advances, driver_allowance, receipt_expenses, cmr_number, unloading_date_export, unloading_date_import) VALUES
(1, 1, 5000, 'MAD', 'Advance pour trajet Tanger-Almeria', 'approved', '2025-08-15T06:00:00Z', '2025-08-15T06:00:00Z', 'CB-MAD-01', false, 500, 800, 1200, 'CMR-2025-001', '2025-08-17T14:00:00Z', '2025-08-21T16:00:00Z'),
(2, 2, 6000, 'EUR', 'Advance pour trajet Tanger-Marseille', 'approved', '2025-08-20T07:00:00Z', '2025-08-20T07:00:00Z', 'CB-EUR-01', false, 300, 600, 900, 'CMR-2025-002', '2025-08-22T10:00:00Z', '2025-08-27T12:00:00Z'),
(3, 3, 4500, 'MAD', 'Advance pour trajet Casablanca-Barcelona', 'pending', '2025-09-01T05:00:00Z', '2025-09-01T05:00:00Z', 'CB-MAD-01', false, 200, 700, 800, 'CMR-2025-003', NULL, '2025-09-07T11:00:00Z'),
(4, 1, 3000, 'MAD', 'Frais de carburant supplementaire', 'approved', '2025-08-18T08:00:00Z', '2025-08-18T08:00:00Z', 'CB-MAD-01', false, 0, 0, 1500, NULL, NULL, NULL),
(5, 5, 4000, 'EUR', 'Advance pour trajet Almeria-Casablanca', 'pending', '2025-09-12T07:00:00Z', '2025-09-12T07:00:00Z', 'CB-EUR-01', false, 250, 500, 750, 'CMR-2025-008', '2025-09-14T10:00:00Z', '2025-09-18T11:00:00Z');

-- INVOICES
INSERT INTO invoices (
  id, client_id, invoice_number, total_amount, paid_amount, status, issue_date, due_date,
  bank_account_id, bank_account_type, bank_info_text, currency, input_mode,
  ht_amount, tva_rate, tva_amount, ttc_amount, route, trip_order_id, payment_request_ref, created_at
) VALUES
(1, 1, 'FAC-2025-1001', '18500.00', '18500.00', 'paid', '2025-08-18T00:00:00Z', '2025-09-17T00:00:00Z', 1, 'checking', 'Banque Populaire - MAD', 'MAD', 'manual', '15416.67', '20', '3083.33', '18500.00', 'Tanger → Almería', 1, NULL, '2025-08-18T08:00:00Z'),
(2, 2, 'FAC-2025-2001', '22000.00', '11000.00', 'partial', '2025-08-23T00:00:00Z', '2025-09-22T00:00:00Z', 2, 'checking', 'Attijariwafa Bank - EUR', 'EUR', 'manual', '18181.82', '21', '3818.18', '22000.00', 'Tanger → Marseille', 2, NULL, '2025-08-23T08:00:00Z'),
(3, 3, 'FAC-2025-3001', '19500.00', '0.00', 'pending', '2025-09-04T00:00:00Z', '2025-10-04T00:00:00Z', 1, 'checking', 'Banque Populaire - MAD', 'MAD', 'manual', '16250.00', '20', '3250.00', '19500.00', 'Casablanca → Barcelona', 3, NULL, '2025-09-04T08:00:00Z'),
(4, 1, 'FAC-2025-1002', '17500.00', '0.00', 'pending', '2025-09-08T00:00:00Z', '2025-10-08T00:00:00Z', 1, 'checking', 'Banque Populaire - MAD', 'MAD', 'manual', '14583.33', '20', '2916.67', '17500.00', 'Tanger → Valencia', 4, NULL, '2025-09-08T08:00:00Z'),
(5, 2, 'FAC-2025-2002', '16000.00', '0.00', 'pending', '2025-09-11T00:00:00Z', '2025-10-11T00:00:00Z', 2, 'checking', 'Attijariwafa Bank - EUR', 'EUR', 'manual', '13223.14', '21', '2776.86', '16000.00', 'Almería → Tanger', 5, NULL, '2025-09-11T08:00:00Z');

-- PAYMENTS
INSERT INTO payments (id, amount, method, status, created_at, bank_account_id, reference, notes, notify_client, preferred_notification_method, currency) VALUES
(1, 18500.00, 'bank_transfer', 'completed', '2025-08-19T10:00:00Z', 1, 'VIR-2025-88432', 'Paiement facture FAC-2025-1001', true, 'email', 'MAD'),
(2, 11000.00, 'bank_transfer', 'completed', '2025-08-24T10:00:00Z', 2, 'VIR-2025-99123', 'Premier acompte facture FAC-2025-2001', true, 'email', 'EUR');

-- PAYMENT INVOICE ALLOCATIONS
INSERT INTO payment_invoice_allocations (id, payment_id, invoice_id, allocated_amount, created_at) VALUES
(1, 1, 1, 18500.00, '2025-08-19T10:00:00Z'),
(2, 2, 2, 11000.00, '2025-08-24T10:00:00Z');

-- TREASURY TRANSACTIONS
INSERT INTO treasury_transactions (
  id, type, amount, currency, cash_box_id, bank_account_id, description, reference,
  created_at, created_by, reconciliation_status, bank_statement_ref, attachment_url
) VALUES
(1, 'income', 18500.00, 'MAD', NULL, 1, 'Encaissement facture FAC-2025-1001 - Renault Tanger', 'VIR-2025-88432', '2025-08-19T10:00:00Z', '00000000-0000-0000-0000-000000000002', 'reconciled', 'STMT-2025-001', 'https://storage.supabase.co/treasury/vir001.pdf'),
(2, 'expense', 5000.00, 'MAD', 1, NULL, 'Avance conducteur Ahmed Benali - Trajet Tanger-Almeria', 'ADV-2025-001', '2025-08-15T06:00:00Z', '00000000-0000-0000-0000-000000000002', 'pending', NULL, NULL),
(3, 'expense', 1500.00, 'MAD', 1, NULL, 'Frais carburant supplementaire Ahmed Benali', 'FUEL-2025-001', '2025-08-18T08:00:00Z', '00000000-0000-0000-0000-000000000002', 'pending', NULL, NULL),
(4, 'income', 11000.00, 'EUR', NULL, 2, 'Premier acompte facture FAC-2025-2001 - Inditex Almeria', 'VIR-2025-99123', '2025-08-24T10:00:00Z', '00000000-0000-0000-0000-000000000002', 'pending', 'STMT-2025-002', 'https://storage.supabase.co/treasury/vir002.pdf'),
(5, 'expense', 6000.00, 'EUR', 2, NULL, 'Avance conducteur Mohamed Amrani - Trajet Tanger-Marseille', 'ADV-2025-002', '2025-08-20T07:00:00Z', '00000000-0000-0000-0000-000000000002', 'pending', NULL, NULL),
(6, 'expense', 900.00, 'EUR', 2, NULL, 'Frais peage et ferry Mohamed Amrani', 'FUEL-2025-002', '2025-08-22T08:00:00Z', '00000000-0000-0000-0000-000000000002', 'pending', NULL, NULL),
(7, 'expense', 2500.00, 'MAD', NULL, 1, 'Virement maintenance camion Mercedes Actros', 'MAINT-2025-001', '2025-08-10T08:00:00Z', '00000000-0000-0000-0000-000000000001', 'pending', 'STMT-2025-003', 'https://storage.supabase.co/treasury/maint001.pdf'),
(8, 'income', 25000.00, 'MAD', NULL, 1, 'Encaissement facture FAC-2025-3001 - Danone Casablanca', 'VIR-2025-99124', '2025-09-05T10:00:00Z', '00000000-0000-0000-0000-000000000002', 'pending', NULL, NULL);

-- DRIVER SALARIES
INSERT INTO driver_salaries (id, driver_id, amount, currency, period_start, period_end, status, created_at, advance_id, created_by) VALUES
(1, 1, 8000.00, 'MAD', '2025-08-01', '2025-08-31', 'paid', '2025-09-01T08:00:00Z', 1, '00000000-0000-0000-0000-000000000001'),
(2, 2, 7500.00, 'EUR', '2025-08-01', '2025-08-31', 'paid', '2025-09-01T08:00:00Z', 2, '00000000-0000-0000-0000-000000000001'),
(3, 3, 9000.00, 'MAD', '2025-08-01', '2025-08-31', 'pending', '2025-09-01T08:00:00Z', 3, '00000000-0000-0000-0000-000000000001'),
(4, 4, 8500.00, 'MAD', '2025-08-01', '2025-08-31', 'pending', '2025-09-01T08:00:00Z', NULL, '00000000-0000-0000-0000-000000000001'),
(5, 5, 7000.00, 'EUR', '2025-08-01', '2025-08-31', 'pending', '2025-09-01T08:00:00Z', 5, '00000000-0000-0000-0000-000000000001');

-- FINE PENALTIES
INSERT INTO fine_penalties (id, driver_id, driver_name, advance_id, trip_order_id, amount, currency, fine_type, description, status, deducted_from_settlement, deducted_at, created_at) VALUES
(1, 1, 'Ahmed Benali', 1, 1, 500.00, 'MAD', 'delayed_delivery', 'Retard de 4h sur la livraison Almeria', 'pending', false, NULL, '2025-08-20T08:00:00Z'),
(2, 2, 'Mohamed Amrani', 2, 2, 300.00, 'EUR', 'speeding', 'Exces de vitesse autoroute Espagne', 'pending', false, NULL, '2025-08-22T08:00:00Z'),
(3, 3, 'Youssef El Idrissi', NULL, 3, 200.00, 'MAD', 'documentation', 'CMR incomplet a la frontiere', 'pending', false, NULL, '2025-09-03T08:00:00Z');

-- TRUCK MAINTENANCE (Fuel Expenses)
INSERT INTO truck_maintenance (id, truck_id, type, amount, currency, date, notes, payment_method, created_at) VALUES
(1, 1, 'fuel', 4500.00, 'MAD', '2025-08-15T08:00:00Z', 'Plein carburant Tanger-Almeria', 'cash', '2025-08-15T08:00:00Z'),
(2, 2, 'fuel', 5200.00, 'EUR', '2025-08-20T08:00:00Z', 'Plein carburant Tanger-Marseille', 'card', '2025-08-20T08:00:00Z'),
(3, 3, 'fuel', 3800.00, 'MAD', '2025-09-01T08:00:00Z', 'Plein carburant Casablanca-Barcelona', 'cash', '2025-09-01T08:00:00Z'),
(4, 1, 'maintenance', 2500.00, 'MAD', '2025-08-25T08:00:00Z', 'Vidange et filtres Mercedes Actros', 'bank_transfer', '2025-08-25T08:00:00Z'),
(5, 2, 'maintenance', 1800.00, 'EUR', '2025-08-28T08:00:00Z', 'Changement freins Scania R450', 'bank_transfer', '2025-08-28T08:00:00Z');

-- FLEET DOCUMENTS
INSERT INTO fleet_documents (id, entity_type, entity_id, document_type, file_url, expiry_date, created_at, is_archived) VALUES
(1, 'truck', 1, 'insurance', 'https://storage.supabase.co/fleet/docs/truck1_insurance.pdf', '2026-01-15', '2025-01-01T08:00:00Z', false),
(2, 'truck', 2, 'insurance', 'https://storage.supabase.co/fleet/docs/truck2_insurance.pdf', '2026-02-20', '2025-01-01T08:00:00Z', false),
(3, 'trailer', 1, 'registration', 'https://storage.supabase.co/fleet/docs/trailer1_reg.pdf', '2026-03-10', '2025-01-01T08:00:00Z', false),
(4, 'driver', 1, 'license', 'https://storage.supabase.co/fleet/docs/driver1_license.pdf', '2027-05-20', '2025-01-01T08:00:00Z', false),
(5, 'driver', 2, 'visa', 'https://storage.supabase.co/fleet/docs/driver2_visa.pdf', '2026-11-30', '2025-01-01T08:00:00Z', false);

-- TRUCK LOCATIONS (GPS tracking data)
INSERT INTO truck_locations (id, truck_id, latitude, longitude, timestamp) VALUES
(1, 1, 35.7595, -5.8340, '2025-09-01T08:00:00Z'),
(2, 1, 36.8423, -2.4623, '2025-09-01T12:00:00Z'),
(3, 2, 33.5731, -7.5898, '2025-09-01T08:00:00Z'),
(4, 3, 41.3851, 2.1734, '2025-09-01T08:00:00Z'),
(5, 5, 36.1680, -5.3473, '2025-09-01T08:00:00Z');

-- GEOFENCE ZONES
INSERT INTO geofence_zones (id, name, latitude, longitude, radius_km, zone_type, is_active, created_at, created_by) VALUES
(1, 'Tanger Port', 35.8067, -5.8103, 2.5, 'port', true, '2025-01-01T08:00:00Z', '00000000-0000-0000-0000-000000000001'),
(2, 'Almeria Port', 36.8423, -2.4623, 2.0, 'port', true, '2025-01-01T08:00:00Z', '00000000-0000-0000-0000-000000000001'),
(3, 'Tanger Free Zone Customs', 35.7595, -5.8340, 1.5, 'customs', true, '2025-01-01T08:00:00Z', '00000000-0000-0000-0000-000000000001'),
(4, 'Rabat Depot', 34.0209, -6.8416, 1.0, 'logistics_hub', true, '2025-01-01T08:00:00Z', '00000000-0000-0000-0000-000000000001');

-- GEOFENCE ALERTS
INSERT INTO geofence_alerts (id, zone_id, truck_id, event_type, latitude, longitude, timestamp, notified) VALUES
(1, 1, 1, 'enter', 35.8067, -5.8103, '2025-09-01T08:15:00Z', true),
(2, 2, 2, 'enter', 36.8423, -2.4623, '2025-09-01T11:30:00Z', true),
(3, 3, 1, 'exit', 35.7595, -5.8340, '2025-09-01T14:00:00Z', false);

-- TRANSPORT ROUTES
INSERT INTO public.transport_routes (name, route_type, origin, destination, origin_latitude, origin_longitude, destination_latitude, destination_longitude, distance_km, estimated_days, is_active, created_at) VALUES
('طنجة → ألميريا', 'outbound', 'طنجة', 'ألميريا', 35.7595, -5.8340, 36.8423, -2.4623, 180, 2, true, '2025-01-01T08:00:00Z'),
('طنجة → مرسيليا', 'outbound', 'طنجة', 'مرسيليا', 35.7595, -5.8340, 43.2965, 5.3698, 1200, 3, true, '2025-01-01T08:00:00Z'),
('الدار البيضاء → برشلونة', 'outbound', 'الدار البيضاء', 'برشلونة', 33.5731, -7.5898, 41.3851, 2.1734, 1100, 3, true, '2025-01-01T08:00:00Z'),
('طنجة → فالنسيا', 'outbound', 'طنجة', 'فالنسيا', 35.7595, -5.8340, 39.4699, -0.3763, 950, 2, true, '2025-01-01T08:00:00Z'),
('ألميريا → طنجة', 'return', 'ألميريا', 'طنجة', 36.8423, -2.4623, 35.7595, -5.8340, 180, 2, true, '2025-01-01T08:00:00Z'),
('مرسيليا → طنجة', 'return', 'مرسيليا', 'طنجة', 43.2965, 5.3698, 35.7595, -5.8340, 1200, 3, true, '2025-01-01T08:00:00Z'),
('برشلونة → الدار البيضاء', 'return', 'برشلونة', 'الدار البيضاء', 41.3851, 2.1734, 33.5731, -7.5898, 1100, 3, true, '2025-01-01T08:00:00Z'),
('فالنسيا → طنجة', 'return', 'فالنسيا', 'طنجة', 39.4699, -0.3763, 35.7595, -5.8340, 950, 2, true, '2025-01-01T08:00:00Z')
ON CONFLICT DO NOTHING;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
