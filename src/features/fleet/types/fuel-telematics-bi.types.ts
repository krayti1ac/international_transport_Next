/**
 * Trans Bodanon TMS — Fleet Fuel & Telematics BI Analytics Types
 * Advanced Eco-Driving, Fuel CPK, and African/EU Corridor Telematics Intelligence
 */

export type EfficiencyTier = 'elite' | 'optimal' | 'standard' | 'under_review';

export type CorridorStatus = 'optimal' | 'acceptable' | 'high_burn';

export type GeoClusterType = 'refuel_station' | 'theft_hotspot';

export type GeoClusterRisk = 'low' | 'medium' | 'high' | 'critical';

export interface DrivingBehaviorMetrics {
  overspeedCount: number;         // تجاوز السرعة > 90 كم/س للشاحنات الثقيلة
  hardAccelerationCount: number; // تسارع عنيف > 2.5 م/ث²
  hardBrakingCount: number;      // فرملة حادة مفاجئة > 3.0 م/ث²
  excessiveIdleHours: number;    // ساعات التوقف مع تشغيل المحرك (Idling > 15min)
}

export interface EcoScoreDeductions {
  overspeed: number;
  acceleration: number;
  braking: number;
  variance: number;
}

export interface DriverEcoScore {
  driverId: number;
  driverName: string;
  driverMatricule?: string;
  driverPhotoUrl?: string;
  score: number; // 0 to 100
  tier: EfficiencyTier;
  totalDistanceKm: number;
  totalFuelLiters: number;
  actualLPer100Km: number;
  fuelCpkMad: number; // تكلفة الكيلومتر من الوقود بالدرهم (Fuel Cost Per Km)
  behaviors: DrivingBehaviorMetrics;
  deductions: EcoScoreDeductions;
  rank: number;
}

export interface CorridorFuelBenchmark {
  corridorId: string;
  corridorName: string;
  corridorCode: string; // e.g. 'MA-ES-FR', 'MA-MR-SN'
  baselineLPer100Km: number;
  actualLPer100Km: number;
  variancePct: number; // نسبة الانحراف (+ أو -)
  totalTrips: number;
  averageDistanceKm: number;
  totalFuelLiters: number;
  totalCostMad: number;
  status: CorridorStatus;
}

export interface GeoFuelCluster {
  id: string;
  type: GeoClusterType;
  name: string;
  city?: string;
  country?: string;
  latitude: number;
  longitude: number;
  eventCount: number;
  totalVolumeLiters: number;
  financialImpactMad: number;
  riskLevel: GeoClusterRisk;
  lastEventAt: string;
}

export interface FleetFuelBiSummary {
  periodStart: string;
  periodEnd: string;
  totalDistanceKm: number;
  totalFuelConsumedLiters: number;
  totalFuelCostMad: number;
  averageFleetLPer100Km: number;
  averageFleetCpkMad: number;
  preventedTheftLossMad: number;
  averageEcoScore: number;
  activeVehiclesCount: number;
  driverRankings: DriverEcoScore[];
  corridorBenchmarks: CorridorFuelBenchmark[];
  geoClusters: GeoFuelCluster[];
}

export interface FilterFuelBiParams {
  periodStart?: string;
  periodEnd?: string;
  truckId?: number;
  driverId?: number;
  corridorCode?: string;
}

