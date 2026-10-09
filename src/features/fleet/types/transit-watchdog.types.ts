/**
 * Trans Bodanon TMS — Automated Transit Watchdog & Cross-Border Visa Expiry Types
 * Standard compliance engine for European Maritime and African Overland Corridors.
 */

export type TransitCorridorType =
  | 'european_maritime' // Morocco -> Spain -> France -> Europe
  | 'african_overland'   // Morocco -> Mauritania -> Senegal -> West Africa
  | 'domestic_morocco';  // National Domestic Freight

export type TransitComplianceStatus =
  | 'compliant'       // All documents valid, >= 30 days buffer
  | 'warning'         // Documents expiring soon (15 - 30 days), transit permitted with caution
  | 'critical_block'  // Critical expiry (< 15 days) or missing mandatory document, dispatch blocked
  | 'expired';        // Document past expiration date, strict illegal transit blocker

export type DocumentAlertSeverity = 'info' | 'warning' | 'critical' | 'expired';

export type TransitDocumentCategory =
  | 'driver_visa'
  | 'driver_passport'
  | 'driver_license'
  | 'truck_insurance'
  | 'truck_inspection'
  | 'customs_carnet'
  | 'driver_qualification';

export interface DocumentCheckResult {
  documentType: string;
  documentNameAr: string;
  documentNameFr: string;
  documentNameEs: string;
  documentNumber?: string;
  expiryDate?: string | null;
  daysRemaining: number;
  status: TransitComplianceStatus;
  isRequiredForCorridor: boolean;
  isBlockingIfMissingOrExpired: boolean;
  messageAr: string;
  messageFr: string;
  messageEs: string;
}

export interface TransitAuditResult {
  id?: number;
  company_id?: number | null;
  trip_id?: number | null;
  trip_code?: string;
  driver_id: number;
  driver_name: string;
  driver_phone?: string;
  truck_id?: number | null;
  truck_plate?: string;
  trailer_id?: number | null;
  trailer_plate?: string;
  corridor_type: TransitCorridorType;
  overall_status: TransitComplianceStatus;
  is_dispatch_allowed: boolean;
  block_reasons: string[];
  warnings: string[];
  evaluated_documents: DocumentCheckResult[];
  created_at: string;
}

export interface TransitExpiryAlertItem {
  id: number;
  company_id?: number | null;
  entity_type: 'driver' | 'truck' | 'trailer';
  entity_id: number;
  entity_name: string;
  document_name: string;
  document_category: TransitDocumentCategory;
  corridor_type: TransitCorridorType | 'all';
  expiry_date: string;
  days_remaining: number;
  alert_severity: DocumentAlertSeverity;
  driver_phone?: string;
  notification_sent_whatsapp: boolean;
  notification_sent_in_app: boolean;
  last_alerted_at?: string;
}

export interface TransitWatchdogSummary {
  totalMonitoredDrivers: number;
  totalMonitoredVehicles: number;
  compliantCount: number;
  upcomingExpiringCount: number; // <= 30 days
  criticalExpiringCount: number; // <= 15 days
  expiredOrBlockedCount: number;
  europeanCorridorReadyCount: number;
  africanCorridorReadyCount: number;
  complianceRatePercentage: string; // e.g. "93.4%"
}

export interface CorridorRequirementsMatrix {
  corridor: TransitCorridorType;
  nameAr: string;
  nameFr: string;
  nameEs: string;
  driverRequirements: string[];
  vehicleRequirements: string[];
  minimumVisaBufferDays: number;
  minimumPassportBufferDays: number;
}

