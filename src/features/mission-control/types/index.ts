import type { InternationalCorridor } from '@/features/analytics/types/corridor.types';

export type CargoThermalProfile =
  | 'frozen_fish'
  | 'frozen_meat'
  | 'fresh_produce'
  | 'pharmaceuticals'
  | 'ambient';

export interface CargoThermalConfig {
  profile: CargoThermalProfile;
  nameAr: string;
  nameFr: string;
  nameEs: string;
  defaultSetpoint: number; // in Celsius
  allowedTolerance: number; // in Celsius
}

export const CARGO_THERMAL_PROFILES: Record<CargoThermalProfile, CargoThermalConfig> = {
  frozen_fish: {
    profile: 'frozen_fish',
    nameAr: 'أسماك مجمدة تجميداً عميقاً (-25°C)',
    nameFr: 'Poissons surgelés en froid négatif (-25°C)',
    nameEs: 'Pescado ultracongelado (-25°C)',
    defaultSetpoint: -25.0,
    allowedTolerance: 2.0,
  },
  frozen_meat: {
    profile: 'frozen_meat',
    nameAr: 'لحوم ومجمدات قياسية (-18°C)',
    nameFr: 'Viandes et surgelés standards (-18°C)',
    nameEs: 'Carne y congelados estándar (-18°C)',
    defaultSetpoint: -18.0,
    allowedTolerance: 2.0,
  },
  fresh_produce: {
    profile: 'fresh_produce',
    nameAr: 'بواكير وفواكه وخضروات طازجة (+4°C)',
    nameFr: 'Fruits, légumes et primeurs frais (+4°C)',
    nameEs: 'Frutas y hortalizas frescas (+4°C)',
    defaultSetpoint: 4.0,
    allowedTolerance: 1.5,
  },
  pharmaceuticals: {
    profile: 'pharmaceuticals',
    nameAr: 'أدوية ومستحضرات طبية (+2°C إلى +8°C)',
    nameFr: 'Produits pharmaceutiques (+2°C à +8°C)',
    nameEs: 'Productos farmacéuticos (+2°C a +8°C)',
    defaultSetpoint: 5.0,
    allowedTolerance: 1.0,
  },
  ambient: {
    profile: 'ambient',
    nameAr: 'بضائع عامة وجافة (حرارة الغرفة)',
    nameFr: 'Marchandises générales et sèches',
    nameEs: 'Mercancía general y seca',
    defaultSetpoint: 20.0,
    allowedTolerance: 5.0,
  },
};

export type ThermalDriftSeverity = 'optimal' | 'warning' | 'critical_drift';

export interface TelematicsTelemetry {
  truckId: number;
  truckPlate: string;
  truckModel: string;
  trailerId?: number;
  trailerPlate?: string;
  reeferModel?: string;
  driverId?: number;
  driverName?: string;
  driverPhone?: string;
  tripId?: number;
  tripRoute?: string;
  corridorType?: InternationalCorridor | 'domestic';
  tripStage?: string;
  // GPS & Engine
  latitude: number;
  longitude: number;
  speed: number;
  heading?: number;
  ignition: boolean;
  fuelLevel?: number; // %
  batteryLevel?: number; // V
  recordedAt: string;
  // Cold Chain & Reefer
  cargoProfile: CargoThermalProfile;
  currentTemp: number; // °C
  targetTemp: number; // °C
  tempDeviation: number; // |current - target|
  tempStatus: ThermalDriftSeverity;
  doorOpen: boolean;
  doorBreachRisk: boolean; // True if door is open while moving (speed > 10 km/h)
  reeferEngineHours: number;
  reeferSdiScore: number; // 0 - 100
  reeferStatus: 'optimal' | 'service_due' | 'high_risk';
  // Geofence
  currentZoneId?: string;
  currentZoneName?: string;
}

export type IncidentAlertType =
  | 'temp_drift'
  | 'door_open_moving'
  | 'power_loss'
  | 'geofence_entry'
  | 'geofence_exit';

export interface IncidentAlert {
  id: string;
  truckId: number;
  truckPlate: string;
  tripId?: number;
  alertType: IncidentAlertType;
  severity: 'info' | 'warning' | 'critical';
  titleAr: string;
  titleFr: string;
  titleEs: string;
  messageAr: string;
  messageFr: string;
  messageEs: string;
  currentTemp?: number;
  targetTemp?: number;
  deviationCelsius?: number;
  speed?: number;
  timestamp: string;
  driverPhone?: string;
  driverName?: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface MissionControlSummary {
  activeFleetCount: number;
  inTransitCount: number;
  portCustomsCount: number;
  deliveredCount: number;
  totalReefersAudited: number;
  criticalDriftCount: number;
  doorBreachCount: number;
  highRiskReefersCount: number;
  overallColdChainIntegrity: number; // 0 - 100%
  lastUpdated: string;
}

export interface MissionControlDashboardData {
  summary: MissionControlSummary;
  telemetryList: TelematicsTelemetry[];
  activeAlerts: IncidentAlert[];
}

