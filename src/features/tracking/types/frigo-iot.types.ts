export type ReeferUnitBrand = 'carrier' | 'thermo_king' | 'generic';

export type ReeferOperatingMode =
  | 'continuous'
  | 'cycle_sentry'
  | 'electric_standby'
  | 'off';

export type ReeferAlarmSeverity = 'info' | 'warning' | 'critical';

export interface ReeferAlarmCode {
  code: string;
  brand: ReeferUnitBrand;
  severity: ReeferAlarmSeverity;
  descriptionAr: string;
  descriptionFr: string;
  descriptionEs: string;
  remedyAr?: string;
  remedyFr?: string;
  remedyEs?: string;
}

export type ReeferAnomalyType =
  | 'refrigerant_leak'
  | 'defrost_overrun'
  | 'low_battery'
  | 'compression_ratio_fault'
  | 'thermal_excursion'
  | 'setpoint_tampering';

export interface ReeferAnomaly {
  type: ReeferAnomalyType;
  severity: 'warning' | 'critical';
  titleAr: string;
  titleFr: string;
  titleEs: string;
  messageAr: string;
  messageFr: string;
  messageEs: string;
  detectedValue: number | string;
  thresholdValue: number | string;
}

export interface RawFrigoIoTInput {
  truckId?: number;
  truckPlate?: string;
  trailerPlate?: string;
  unitBrand?: ReeferUnitBrand | string;
  model?: string;
  currentTemp?: number;
  targetTemp?: number;
  ambientTemp?: number;
  suctionPressureBar?: number;
  dischargePressureBar?: number;
  defrostActive?: boolean;
  defrostDurationMin?: number;
  defrostCoilTemp?: number;
  defrostCyclesCount?: number;
  backupBatteryVdc?: number;
  operatingMode?: ReeferOperatingMode | string;
  engineHours?: number;
  electricHours?: number;
  compressorRpm?: number;
  fuelLevelReefer?: number;
  doorOpen?: boolean;
  alarmCodes?: string[] | string;
  timestamp?: string | number;
}

export interface ParsedFrigoIoTData {
  truckId: number;
  truckPlate: string;
  trailerPlate?: string;
  unitBrand: ReeferUnitBrand;
  model: string;
  currentTemp: number;
  targetTemp: number;
  tempDeviation: number;
  ambientTemp: number;
  // Pressure & Refrigerant circuit
  suctionPressureBar: number;
  dischargePressureBar: number;
  compressionRatio: number;
  pressureStatus: 'optimal' | 'warning' | 'critical';
  // Defrost cycle
  defrostActive: boolean;
  defrostDurationMin: number;
  defrostCoilTemp: number;
  defrostStatus: 'idle' | 'active_normal' | 'overrun_warning' | 'overrun_critical';
  // Electrical & Engine
  backupBatteryVdc: number;
  batteryStatus: 'good' | 'low' | 'critical';
  operatingMode: ReeferOperatingMode;
  engineHours: number;
  compressorRpm: number;
  fuelLevelReefer: number;
  doorOpen: boolean;
  // Diagnostics & Intelligence
  sdiScore: number; // 0 - 100 (Stability Degradation Index)
  sdiStatus: 'optimal' | 'degraded' | 'critical';
  alarms: ReeferAlarmCode[];
  anomalies: ReeferAnomaly[];
  recordedAt: string;
}

