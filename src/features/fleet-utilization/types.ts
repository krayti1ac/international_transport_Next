export interface TruckUtilization {
  truckId: number;
  plateNumber: string;
  model?: string;
  status: string;
  totalTrips: number;
  completedTrips: number;
  totalDistanceKm: number;
  totalRevenue: number;
  utilizationRate: number; // 0 - 100%
  uptimePercentage: number; // 0 - 100%
  emptyTripsCount: number;
  idlingHours: number;
  idleDays: number;
  recommendation: 'optimal' | 'underused' | 'overused';
}

export interface TrailerUtilization {
  trailerId: number;
  plateNumber: string;
  type?: string;
  totalTrips: number;
  completedTrips: number;
  utilizationRate: number;
  recommendation: 'optimal' | 'underused' | 'overused';
}

export interface DriverUtilization {
  driverId: number;
  driverName: string;
  totalTrips: number;
  completedTrips: number;
  totalRevenue: number;
  utilizationRate: number;
  recommendation: 'optimal' | 'underused' | 'overused';
}

export interface FleetUtilizationReport {
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  trucks: TruckUtilization[];
  trailers: TrailerUtilization[];
  drivers: DriverUtilization[];
  summary: {
    totalTrucks: number;
    totalTrailers: number;
    totalDrivers: number;
    avgTruckUtilization: number;
    avgTrailerUtilization: number;
    avgDriverUtilization: number;
    fleetUptimePercentage: number;
    emptyMileageRatio: number; // نسبة الكيلومترات أو الرحلات الفارغة %
    totalIdlingHours: number;
    estimatedIdlingFuelWasteLiters: number;
    estimatedIdlingFuelWasteMAD: number;
    underutilizedCount: number;
    overutilizedCount: number;
  };
}
