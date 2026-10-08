import type { InternationalCorridor } from '@/types/database';

export interface CpkBreakdown {
  fuelCpk: number;             // MAD per km
  maintenanceCpk: number;      // MAD per km
  ferryTransitCpk: number;     // MAD per km
  customsCpk: number;          // MAD per km
  driverAllowanceCpk: number;  // MAD per km
  otherCpk: number;            // MAD per km
  totalCpk: number;            // MAD per km
}

export interface CorridorPnlMetrics {
  corridor: InternationalCorridor | 'all';
  corridorNameAr: string;
  corridorNameFr: string;
  corridorNameEs: string;
  totalTrips: number;
  totalRevenueMad: number;
  totalOperatingCostsMad: number;
  netProfitMad: number;
  grossMarginPercent: number;  // ((Revenue - DirectTripCosts) / Revenue) * 100
  netMarginPercent: number;    // (NetProfit / Revenue) * 100
  totalKm: number;
  totalRoadKm: number;
  totalFerryKm: number;
  revenuePerKmMad: number;     // RPK: TotalRevenue / TotalKm
  costPerKmMad: number;        // CPK: TotalOperatingCosts / TotalKm
  netProfitPerKmMad: number;   // PPK: NetProfit / TotalKm
  cpkBreakdown: CpkBreakdown;
  totalCargoTons: number;
  totalTonKm: number;          // CargoTons * RoadKm
  costPerTonKmMad: number;     // TotalCosts / TotalTonKm
  revenuePerTonKmMad: number;  // TotalRevenue / TotalTonKm
}

export interface CurrencyRateMatrix {
  MAD: number;   // 1.0 (Base Moroccan Dirham)
  EUR: number;   // 1 EUR = ~10.85 MAD
  MRU: number;   // 1 MRU = ~0.25 MAD (Mauritanian Ouguiya)
  XOF: number;   // 1 XOF = ~0.0165 MAD (West African CFA franc)
}

export interface CpkAnomaly {
  tripId: number;
  cmrNumber: string;
  truckPlate: string;
  driverName: string;
  corridor: InternationalCorridor;
  tripCpkMad: number;
  baselineCpkMad: number;
  variancePercent: number;     // ((tripCpk - baselineCpk) / baselineCpk) * 100
  primaryCostDriver: 'fuel' | 'maintenance' | 'customs' | 'ferry' | 'allowances' | 'other';
  primaryCostDriverLabelAr: string;
  primaryCostDriverLabelFr: string;
  primaryCostDriverLabelEs: string;
  severity: 'normal' | 'warning' | 'critical';
}

export interface CorridorTripPnlDetail {
  id: number;
  cmrNumber: string;
  departureDate: string;
  corridor: InternationalCorridor;
  route: string;
  truckPlate: string;
  driverName: string;
  cargoWeightTons: number;
  roadDistanceKm: number;
  ferryDistanceKm: number;
  totalDistanceKm: number;
  tonKm: number;
  revenueMad: number;
  totalCostMad: number;
  netProfitMad: number;
  netMarginPercent: number;
  cpkMad: number;
  rpkMad: number;
  costBreakdown: {
    fuelMad: number;
    maintenanceMad: number;
    ferryMad: number;
    customsMad: number;
    allowancesMad: number;
    otherMad: number;
  };
  currency: string;
  isBenchmarkTrip?: boolean;
}

export interface CorridorPnlAnalyticsResult {
  overall: CorridorPnlMetrics;
  africanOverland: CorridorPnlMetrics;
  europeanMaritime: CorridorPnlMetrics;
  anomalies: CpkAnomaly[];
  trips: CorridorTripPnlDetail[];
  currencyRates: CurrencyRateMatrix;
  benchmarkTrip272?: CorridorTripPnlDetail;
}

export interface CorridorPnlFilter {
  startDate?: string;
  endDate?: string;
  corridor?: 'all' | 'european_maritime' | 'african_overland';
  truckId?: number;
  minCpkVariance?: number;
}

