import type { InternationalCorridor } from '@/types/database';
export type { InternationalCorridor };

export type FuelEfficiencyStatus = 'efficient' | 'normal' | 'high_risk';

export interface CorridorFinancialSummary {
  corridor: InternationalCorridor;
  totalTrips: number;
  totalRevenue: number;
  totalDirectExpenses: number;
  netProfit: number;
  profitMarginPercent: number;
  totalRoadDistanceKm: number;
  totalFerryDistanceKm: number;
  totalDistanceKm: number;
  totalFuelLiters: number;
  totalFuelCost: number;
  averageConsumptionL100km: number;
  revenuePerKm: number;
  expensesPerKm: number;
  netProfitPerKm: number;
  // Specific expense items
  ferryOrTransitCost: number;
  customsCost: number;
  driverAllowances: number;
  otherExpenses: number;
}

export interface TruckFuelAnomaly {
  truckId: number;
  plateNumber: string;
  model: string;
  driverName: string;
  totalTrips: number;
  totalRoadKm: number;
  totalFuelLiters: number;
  actualConsumptionRate: number; // L/100km
  targetConsumptionRate: number; // L/100km configured on truck
  differenceL100km: number;
  status: FuelEfficiencyStatus;
  isAnomaly: boolean; // Flagged when rate > 38 L/100km
  corridor: InternationalCorridor;
}

export interface CorridorTripDetail {
  id: number;
  cmrNumber: string;
  departureDate: string;
  corridor: InternationalCorridor;
  route: string;
  truckPlate: string;
  driverName: string;
  revenue: number;
  directExpenses: number;
  netProfit: number;
  profitMarginPercent: number;
  roadDistanceKm: number;
  fuelLiters: number;
  fuelConsumptionRate: number;
  currency: string;
  status: string;
}

export interface CorridorAnalyticsResult {
  overall: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    profitMarginPercent: number;
    totalTrips: number;
    totalDistanceKm: number;
    totalFuelLiters: number;
    averageConsumptionL100km: number;
    currency: string;
  };
  europeanMaritime: CorridorFinancialSummary;
  africanOverland: CorridorFinancialSummary;
  fuelAnomalies: TruckFuelAnomaly[];
  trips: CorridorTripDetail[];
}
