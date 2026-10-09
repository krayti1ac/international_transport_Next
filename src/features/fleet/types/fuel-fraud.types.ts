/**
 * Types & Data Contracts for Intelligent Fuel Fraud & Anti-Siphoning Detection Engine
 */

export type FuelIncidentType =
  | 'rapid_siphoning'
  | 'tank_overflow'
  | 'ghost_refueling'
  | 'geofence_mismatch'
  | 'abnormal_burn_rate';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export type IncidentStatus = 'detected' | 'confirmed_deduction' | 'justified' | 'dismissed';

export interface TelematicsFuelDataPoint {
  timestamp: string; // ISO 8601
  fuelLevelLiters: number;
  fuelLevelPercent?: number;
  speedKmh: number;
  engineStatus: 'ON' | 'OFF';
  latitude?: number;
  longitude?: number;
  odometerKm?: number;
}

export interface FuelReceiptData {
  receiptId?: string | number;
  liters: number;
  unitPrice: number;
  totalAmount: number;
  currency: string;
  stationName: string;
  stationLatitude?: number;
  stationLongitude?: number;
  timestamp: string; // ISO 8601 or YYYY-MM-DD HH:mm
}

export interface TruckFuelConfig {
  truckId: number | string;
  plateNumber: string;
  tankCapacityLiters: number;
  standardRateL100km: number;
  fuelPricePerLiterMad?: number;
  fuelType?: string;
}

export interface AntiSiphoningDetectionInput {
  truckConfig: TruckFuelConfig;
  dataPoints: TelematicsFuelDataPoint[];
  receipts?: FuelReceiptData[];
  tripId?: number;
  driverId?: string;
  companyId?: string;
}

export interface DetectedFuelAnomaly {
  incidentType: FuelIncidentType;
  severity: IncidentSeverity;
  detectedLossLiters: number;
  financialLossMad: number;
  confidenceScore: number; // 0 - 100
  titleAr: string;
  titleFr: string;
  titleEs: string;
  descriptionAr: string;
  descriptionFr: string;
  descriptionEs: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  locationName?: string;
  snapshot: Record<string, unknown>;
}

export interface FuelFraudAuditSummary {
  isClean: boolean;
  overallRiskScore: number; // 0 (safest) - 100 (critical fraud)
  receiptsLegitimacyScore: number; // 0 (fraudulent) - 100 (completely legitimate)
  totalLossLiters: number;
  totalLossMad: number;
  incidents: DetectedFuelAnomaly[];
  auditedAt: string;
}

export interface FuelTheftIncidentRecord {
  id: string;
  company_id: string;
  truck_id: number | null;
  driver_id: string | null;
  trip_id: number | null;
  incident_type: FuelIncidentType;
  severity: IncidentSeverity;
  detected_loss_liters: number;
  financial_loss_mad: number;
  fuel_price_per_liter: number;
  confidence_score: number;
  status: IncidentStatus;
  gps_latitude: number | null;
  gps_longitude: number | null;
  location_name: string | null;
  telematics_snapshot: Record<string, unknown>;
  justification_notes: string | null;
  deduction_reference_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;

  // Joined metadata for UI
  truck?: {
    id: number;
    plate_number: string;
    model?: string;
    fuel_consumption_rate?: number;
  } | null;
  driver?: {
    id: string;
    full_name?: string;
    name?: string;
    phone?: string;
  } | null;
  trip?: {
    id: number;
    trip_number?: string;
    origin?: string;
    destination?: string;
  } | null;
}

export interface FuelFraudFilterOptions {
  status?: IncidentStatus | 'all';
  severity?: IncidentSeverity | 'all';
  incidentType?: FuelIncidentType | 'all';
  truckId?: number;
  driverId?: string;
  searchQuery?: string;
  startDate?: string;
  endDate?: string;
}

export interface FuelFraudKpiStats {
  activeIncidentsCount: number;
  confirmedDeductionsCount: number;
  totalLossLiters: number;
  totalFinancialLossMad: number;
  siphoningCount: number;
  overflowCount: number;
  ghostRefuelingCount: number;
}

