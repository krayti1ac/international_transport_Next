import Decimal from 'decimal.js';

export type AtpReeferClass = 'class_a' | 'class_b' | 'class_c';

export type ReeferCargoCategory =
  | 'fresh_produce'
  | 'deep_frozen'
  | 'pharma_cold'
  | 'meat_chilled';

export interface ReeferCargoPreset {
  category: ReeferCargoCategory;
  nameKey: string;
  targetTemp: number;
  minTemp: number;
  maxTemp: number;
  maxAllowedExcursionMinutes: number;
  activationEnergyKj: number; // Arrhenius ΔH (default 83.144 kJ/mol)
}

/**
 * الكتالوج القياسي لدرجات الحرارة وضوابط التبريد
 */
export const REEFER_CARGO_CATALOG: Record<ReeferCargoCategory, ReeferCargoPreset> = {
  fresh_produce: {
    category: 'fresh_produce',
    nameKey: 'reefer.cargo.fresh_produce',
    targetTemp: 4.0,
    minTemp: 2.0,
    maxTemp: 6.0,
    maxAllowedExcursionMinutes: 45,
    activationEnergyKj: 83.144,
  },
  deep_frozen: {
    category: 'deep_frozen',
    nameKey: 'reefer.cargo.deep_frozen',
    targetTemp: -20.0,
    minTemp: -25.0,
    maxTemp: -18.0,
    maxAllowedExcursionMinutes: 30,
    activationEnergyKj: 83.144,
  },
  pharma_cold: {
    category: 'pharma_cold',
    nameKey: 'reefer.cargo.pharma_cold',
    targetTemp: 5.0,
    minTemp: 2.0,
    maxTemp: 8.0,
    maxAllowedExcursionMinutes: 15,
    activationEnergyKj: 83.144,
  },
  meat_chilled: {
    category: 'meat_chilled',
    nameKey: 'reefer.cargo.meat_chilled',
    targetTemp: 2.0,
    minTemp: 0.0,
    maxTemp: 4.0,
    maxAllowedExcursionMinutes: 30,
    activationEnergyKj: 83.144,
  },
};

export interface ReeferTelemetryLog {
  id: string;
  tripId: string | number;
  supplyAirTemp: number;
  returnAirTemp: number;
  ambientTemp?: number;
  evaporatorTemp?: number;
  compressorStatus: 'running' | 'cycle_sentry' | 'defrost' | 'off';
  isDefrostActive: boolean;
  doorOpenSensor: boolean;
  dieselFuelLevelLiters?: number;
  dieselBurnRateLph?: number;
  latitude?: number;
  longitude?: number;
  isGeofenceSafe: boolean;
  recordedAt: string;
}

export interface ColdChainAuditEvaluation {
  tripId: string | number;
  atpClass: AtpReeferClass;
  cargoCategory: ReeferCargoCategory;
  totalLogsCount: number;
  setpointTemp: number;
  avgSupplyTemp: number;
  avgReturnTemp: number;
  mktTemperatureCelsius: number; // Mean Kinetic Temperature
  complianceStatus: 'compliant' | 'warning' | 'breached';
  totalExcursionMinutes: number;
  doorBreachesCount: number;
  totalDieselBurnedLiters: number;
  complianceScorePercent: number;
  certificateHash?: string;
}

export interface TripReeferMonitoringProfile {
  id: string;
  companyId: string | number;
  tripId: string | number;
  trailerId?: string | number | null;
  coolingUnitBrand: string;
  atpClass: AtpReeferClass;
  cargoCategory: ReeferCargoCategory;
  setpointTemp: number;
  minTempThreshold: number;
  maxTempThreshold: number;
  maxAllowedExcursionMinutes: number;
  mktActivationEnergyKj: number;
  isActive: boolean;
  certificateHash?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReeferExcursionIncident {
  id: string;
  companyId: string | number;
  profileId: string;
  tripId: string | number;
  incidentType: 'temp_high' | 'temp_low' | 'door_breach_transit' | 'compressor_failure';
  severity: 'warning' | 'critical';
  startedAt: string;
  resolvedAt?: string | null;
  peakDeviationTemp: number;
  durationMinutes: number;
  mktImpactCelsius?: number | null;
  actionTaken?: string | null;
  isCleared: boolean;
  createdAt?: string;
}

