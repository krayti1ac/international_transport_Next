export type UserRole = 'admin' | 'secretary' | 'driver';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  created_at: string;
  theme_mode?: 'light' | 'dark' | 'system';
  mfa_enabled?: boolean;
  preferred_language?: 'ar' | 'fr' | 'en';
}

export interface Client {
  id: number;
  name: string;
  phone: string;
  address: string;
  city: string;
  created_at: string;
  client_type?: 'export' | 'import'; // 'export': رحلات الذهاب, 'import': رحلات العودة (حصرياً)
  nom_contact?: string;
  adresse_facturation?: string;
  default_bank_account_id?: string;
  default_bank_account?: string;
  ice: string;
  email: string;
  currency: string;
  is_active: boolean;
  invoice_with_tva: boolean;
  tva_rate?: string;
  last_invoice_number?: string;
  preferred_notification_method?: string;
  shipping_address_line1: string;
  shipping_address_line2: string;
  shipping_address_line3: string;
  shipping_address_line4: string;
  shipping_city: string;
  shipping_postal_code: string;
  shipping_country: string;
  billing_address_line1: string;
  billing_address_line2: string;
  billing_address_line3: string;
  billing_address_line4: string;
  billing_city: string;
  billing_postal_code: string;
  billing_country: string;
}

export interface Driver {
  id: number;
  user_id?: string;
  name: string;
  phone: string;
  license: string;
  status: string;
  base_salary: number;
  bonus_percentage: number;
  default_truck_id?: number;
  default_truck_name?: string;
  default_trailer_name?: string;
  visa_number?: string;
  visa_expiry_date?: string;
  has_valid_visa: boolean;
  created_at?: string;
}

export interface Truck {
  id: number;
  plate_number: string;
  model: string;
  status: string;
  current_location?: string;
  created_at: string;
  default_driver_id?: number;
  default_driver_name?: string;
  default_trailer_id?: number;
  default_trailer_name?: string;
  purchase_price?: number;
  weight_capacity?: number;
  power?: number;
}

export interface Trailer {
  id: number;
  plate_number: string;
  model: string;
  status: string;
  created_at: string;
}

export interface TransportRoute {
  id: number;
  name: string;
  route_type: 'outbound' | 'return';
  origin: string;
  destination: string;
  origin_latitude?: number;
  origin_longitude?: number;
  destination_latitude?: number;
  destination_longitude?: number;
  distance_km?: number;
  estimated_days?: number;
  is_active: boolean;
  created_at: string;
}

export interface TripOrder {
  id: number;
  client_id?: number;
  client_import_id?: number;
  driver_id?: number;
  truck_id?: number;
  trailer_id?: number;
  route: string;
  route_export?: string;
  route_import?: string;
  price: number;
  price_export?: number;
  price_import?: number;
  departure_date: string;
  unloading_date_export?: string;
  loading_date_import?: string;
  unloading_date_import?: string;
  status: string;
  created_at: string;
  cmr_number?: string;
  cmr_export_number?: string;
  cmr_import_number?: string;
  price_type?: string;
  cmr_export_url?: string;
  facture_url?: string;
  phyto_url?: string;
  mrn_export_url?: string;
  cmr_import_url?: string;
  ferry_company?: string;
  ferry_localizador?: string;
  ferry_company_import?: string;
  ferry_localizador_import?: string;
  goods_description_export?: string;
  goods_description_import?: string;
  weight_export?: number;
  weight_import?: number;
  shipping_latitude?: number;
  shipping_longitude?: number;
  unloading_latitude?: number;
  unloading_longitude?: number;
}

export interface Trip {
  id: number;
  driver_id: number;
  amount_given: number;
  date_out: string;
  status: string;
  amount_spent?: number;
  amount_returned?: number;
  receipts_images: string[];
  date_return?: string;
  created_at: string;
  notes: string;
}

export interface Advance {
  id: number;
  driver_id: number;
  amount: number;
  currency: string;
  reason: string;
  status: string;
  date: string;
  created_at: string;
  source_cash_box?: string;
  is_deleted: boolean;
  extra_advances: number;
  driver_allowance: number;
  receipt_expenses: number;
  cmr_number?: string;
  unloading_date_export?: string;
  unloading_date_import?: string;
}

export interface Invoice {
  id: number;
  client_id: string;
  invoice_number: string;
  total_amount: string;
  paid_amount?: string;
  status: string;
  issue_date?: string;
  due_date?: string;
  bank_account_id?: string;
  bank_account_type?: string;
  bank_info_text?: string;
  currency: string;
  input_mode: string;
  ht_amount?: string;
  tva_rate?: string;
  tva_amount?: string;
  ttc_amount?: string;
  route?: string;
  trip_order_id?: number;
  payment_request_ref?: string;
  created_at?: string;
}

export interface Payment {
  id: number;
  amount: number;
  method: string;
  status: string;
  created_at: string;
  bank_account_id?: string;
  reference?: string;
  notes?: string;
  notify_client: boolean;
  preferred_notification_method?: string;
  currency: string;
}

export interface PaymentInvoiceAllocation {
  id: number;
  payment_id: number;
  invoice_id: number;
  allocated_amount: number;
  created_at: string;
}

export interface TreasuryTransaction {
  id: number;
  type: string;
  amount: number;
  currency: string;
  cash_box_id?: number;
  bank_account_id?: number;
  description: string;
  reference?: string;
  created_at: string;
  created_by?: string;
  reconciliation_status: string;
  bank_statement_ref?: string;
  attachment_url?: string;
}

export interface BankAccount {
  id: number;
  name: string;
  bank_name: string;
  account_number: string;
  currency: string;
  account_type: string;
  current_balance: number;
  is_active: boolean;
  created_at: string;
}

export interface CashBox {
  id: number;
  name: string;
  code: string;
  currency: string;
  created_at: string;
}

export interface CashBoxOperation {
  id: number;
  cash_box_id: number;
  type: string;
  amount: number;
  currency: string;
  description: string;
  reference?: string;
  created_at: string;
  created_by?: string;
}


export interface TruckDocument {
  id: number;
  truck_id: number;
  document_type: string;
  file_url: string;
  expiry_date?: string;
  created_at: string;
}

export interface DriverDocument {
  id: number;
  driver_id: number;
  document_type: string;
  file_url: string;
  expiry_date?: string;
  created_at: string;
}

export interface FleetDocument {
  id: number;
  entity_type: 'truck' | 'trailer' | 'driver' | string;
  entity_id: number;
  document_type: string;
  document_number?: string;
  file_url?: string;
  issue_date?: string;
  expiry_date?: string;
  previous_expiry_date?: string;
  cost?: number;
  currency?: string;
  notes?: string;
  is_archived: boolean;
  created_at?: string;
  updated_at?: string;
  // Joined virtual props
  truck?: { plate_number: string; model?: string; status?: string };
  trailer?: { plate_number: string; model?: string; status?: string };
  driver?: { name: string; phone?: string; status?: string };
  days_until_expiry?: number;
  status_computed?: 'safe' | 'warning' | 'expired' | 'missing';
}

export interface FleetDocumentRenewal {
  id: number;
  fleet_document_id?: number;
  document_id?: number;
  previous_expiry_date?: string;
  new_expiry_date?: string;
  renewal_cost?: number;
  cost?: number;
  currency: string;
  document_type?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface UserDocument {
  id: number;
  user_id: string;
  document_type: string;
  file_url: string;
  expiry_date?: string;
  created_at: string;
}

export interface DriverSalary {
  id: number;
  driver_id: number;
  amount: number;
  currency: string;
  period_start: string;
  period_end: string;
  status: string;
  created_at: string;
  advance_id?: number;
}

export interface TruckMaintenance {
  id: number;
  truck_id: number;
  type?: string;
  expense_type?: string;
  amount: number;
  currency?: string;
  date?: string;
  maintenance_date?: string;
  notes?: string;
  description?: string;
  provider_name?: string;
  payment_method?: string;
  created_at: string;
  updated_at?: string;
}

export interface TrailerMaintenance {
  id: number;
  trailer_id: number;
  type: string;
  amount: number;
  currency: string;
  date: string;
  notes?: string;
  payment_method?: string;
  created_at: string;
}

export interface MaintenanceRecord {
  id: number;
  vehicle_type: string;
  vehicle_id: number;
  type: string;
  amount: number;
  currency: string;
  date: string;
  notes?: string;
  payment_method?: string;
  created_at: string;
}

export interface MaintenanceSchedule {
  id: number;
  vehicle_type: string;
  vehicle_id: number;
  maintenance_type: string;
  scheduled_date: string;
  amount_estimate?: number;
  currency: string;
  notes?: string;
  is_active: boolean;
  parent_record_id?: number;
  created_at: string;
}

export interface RepairInvoice {
  id: number;
  workshop_id?: number;
  workshop_name?: string;
  amount: number;
  currency: string;
  date: string;
  notes?: string;
  repair_path: string;
  payment_method?: string;
  payment_details?: string;
  created_at: string;
}

export interface RepairInvoiceItem {
  id: number;
  repair_invoice_id: number;
  description: string;
  qty: number;
  unit_amount: number;
  vehicle_id?: string;
  vehicle_type?: 'truck' | 'trailer';
  created_at: string;
}

export interface Provider {
  id: number;
  name: string;
  type: string;
  phone?: string;
  email?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
}

export interface FinePenalty {
  id: number;
  driver_id?: number;
  driver_name: string;
  advance_id?: number;
  trip_order_id?: number;
  amount: number;
  currency: string;
  fine_type: string;
  description?: string;
  status: string;
  deducted_from_settlement: boolean;
  deducted_at?: string;
  created_at: string;
}

export interface FerryExpense {
  id: number;
  trip_order_id?: number;
  advance_id?: number;
  amount: number;
  currency: string;
  description: string;
  date: string;
  created_at: string;
}

export interface EmergencyAdvanceRequest {
  id: number;
  driver_id?: number;
  driver_name: string;
  amount: number;
  currency: string;
  reason: string;
  notes?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  sender_id: string;
  message: string;
  created_at: string;
}

export interface AuditLog {
  id: number;
  entity_type: string;
  entity_id: number;
  action_type: 'soft_delete' | 'update' | 'duplicate';
  employee_id: string;
  old_data?: string;
  new_data?: string;
  reason: string;
  created_at: string;
}

export interface AppSettings {
  id: number;
  key: string;
  value: string;
  updated_at: string;
}

export interface SystemSettings {
  id: number;
  company_name?: string;
  logo_url?: string | null;
  default_tva_rate?: number;
  owner_profit_share: number;
  default_bank_account_id?: number;
  updated_at: string;
}

export interface DocumentCategory {
  id: number;
  name: string;
  name_fr?: string | null;
  applicable_to: 'both' | 'truck' | 'trailer';
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  usage_count?: number;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  created_at: string;
}

export interface TruckLocation {
  id: number;
  truck_id: number;
  latitude: number;
  longitude: number;
  recorded_at?: string;
  timestamp?: string;
  speed?: number;
  heading?: number;
  accuracy?: number;
  trip_id?: number;
}

export interface DeliverySignature {
  id: number;
  trip_order_id: number;
  signature_url: string;
  signed_by: string;
  signed_at: string;
  latitude?: number;
  longitude?: number;
  cmr_image_url?: string;
}

export interface PendingUpdate {
  id: number;
  table_name: string;
  record_id: number;
  operation: string;
  data: string;
  created_at: string;
}

export interface TripOrderDocument {
  id: number;
  trip_order_id: number;
  document_type: string;
  file_url: string;
  created_at: string;
}

export interface InvoicePayment {
  id: number;
  invoice_id: number;
  payment_id: number;
  amount: number;
  created_at: string;
}

export interface PaymentRequest {
  id: number;
  client_id: number;
  amount: number;
  currency: string;
  status: string;
  due_date: string;
  notes?: string;
  created_at: string;
}

export interface TruckLocationHistory {
  id: number;
  truck_id: number;
  latitude: number;
  longitude: number;
  recorded_at?: string;
  timestamp?: string;
  speed?: number;
  heading?: number;
}

export interface GeofenceZone {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  radius_km: number;
  zone_type: 'port' | 'border' | 'customs' | 'logistics_hub' | 'client_warehouse' | 'other';
  is_active: boolean;
  created_at: string;
  created_by?: string;
}

export interface GeofenceAlert {
  id: number;
  zone_id: number;
  truck_id: number;
  event_type: 'enter' | 'exit';
  latitude: number;
  longitude: number;
  timestamp: string;
  notified: boolean;
}

export interface ForexRate {
  id?: number;
  rate_date: string;
  eur_to_mad: number;
  mad_to_eur: number;
  source?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ForexGainLossEntry {
  id: number;
  trip_id?: number | null;
  invoice_id?: number | null;
  original_amount: number;
  original_currency: string;
  original_rate: number;
  settlement_rate: number;
  realized_gain_loss: number;
  entry_type: 'gain' | 'loss';
  notes?: string;
  created_at?: string;
}
