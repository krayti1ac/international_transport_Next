/**
 * Trans Bodanon TMS — Fleet Fuel & Telematics BI Analytics Engine
 * Advanced Eco-Driving Calculations, Fuel CPK, and African/EU Corridor Telematics Intelligence
 */

import Decimal from 'decimal.js';
import type {
  CorridorFuelBenchmark,
  CorridorStatus,
  DriverEcoScore,
  DrivingBehaviorMetrics,
  EfficiencyTier,
  FleetFuelBiSummary,
  GeoFuelCluster,
  GeoClusterRisk,
} from '../types/fuel-telematics-bi.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface RawDriverTelemetryInput {
  driverId: number;
  driverName: string;
  driverMatricule?: string;
  driverPhotoUrl?: string;
  totalDistanceKm: number;
  totalFuelLiters: number;
  fuelCostMad: number;
  baselineLPer100Km?: number;
  overspeedCount?: number;
  hardAccelerationCount?: number;
  hardBrakingCount?: number;
  excessiveIdleHours?: number;
}

export interface RawCorridorTripInput {
  corridorCode: string;
  corridorName: string;
  distanceKm: number;
  fuelLiters: number;
  fuelCostMad: number;
}

export interface RawTheftIncidentInput {
  id: string | number;
  locationName?: string;
  latitude: number;
  longitude: number;
  lossLiters: number;
  lossMad: number;
  createdAt: string;
}

export interface RawFuelReceiptInput {
  id: string | number;
  stationName: string;
  city?: string;
  latitude: number;
  longitude: number;
  liters: number;
  totalCostMad: number;
  date: string;
}

export const CORRIDOR_DEFAULTS: Record<string, { name: string; baselineLPer100Km: number }> = {
  'MA-ES-FR': {
    name: 'الممر الأوروبي (المغرب - إسبانيا - فرنسا)',
    baselineLPer100Km: 32.5,
  },
  'MA-MR-SN': {
    name: 'ممر غرب إفريقيا (المغرب - موريتانيا - السنغال عبر الكركرات)',
    baselineLPer100Km: 35.8,
  },
  'DOMESTIC-MA': {
    name: 'المسارات الوطنية الداخلية (طنجة المتوسط - الدار البيضاء - أكادير)',
    baselineLPer100Km: 33.0,
  },
};

export class FuelTelematicsBiService {
  /**
   * حساب كفاءة استهلاك الوقود (L/100km) بدقة Decimal.js الصارمة
   */
  public static calculateLPer100Km(fuelLiters: number | string, distanceKm: number | string): number {
    const kmDec = new Decimal(distanceKm || 0);
    if (kmDec.lessThanOrEqualTo(0)) {
      return 0;
    }
    const litersDec = new Decimal(fuelLiters || 0);
    return litersDec.dividedBy(kmDec).times(100).toDecimalPlaces(2).toNumber();
  }

  /**
   * حساب تكلفة الكيلومتر من الوقود (Fuel Cost Per Km - CPK) بدقة Decimal.js
   */
  public static calculateFuelCpk(fuelCostMad: number | string, distanceKm: number | string): number {
    const kmDec = new Decimal(distanceKm || 0);
    if (kmDec.lessThanOrEqualTo(0)) {
      return 0;
    }
    const costDec = new Decimal(fuelCostMad || 0);
    return costDec.dividedBy(kmDec).toDecimalPlaces(3).toNumber();
  }

  /**
   * حساب مؤشر القيادة الاقتصادية للسائق (Eco-Driving Score 0-100) وتحديد فئة الكفاءة
   */
  public static calculateDriverEcoScore(input: RawDriverTelemetryInput): DriverEcoScore {
    const distance = new Decimal(input.totalDistanceKm || 0).toNumber();
    const fuelLiters = new Decimal(input.totalFuelLiters || 0).toNumber();
    const fuelCost = new Decimal(input.fuelCostMad || 0).toNumber();

    const actualLPer100Km = this.calculateLPer100Km(fuelLiters, distance);
    const fuelCpkMad = this.calculateFuelCpk(fuelCost, distance);

    const baseline = input.baselineLPer100Km || 33.5;
    const overspeed = input.overspeedCount || 0;
    const hardAccel = input.hardAccelerationCount || 0;
    const hardBrake = input.hardBrakingCount || 0;
    const idleHours = input.excessiveIdleHours || 0;

    // Deductions rules:
    // 1. Overspeed (> 90 km/h): -3 pts per incident
    const overspeedDeduction = overspeed * 3;

    // 2. Hard acceleration (> 2.5 m/s²): -2 pts per incident
    const accelDeduction = hardAccel * 2;

    // 3. Hard braking (> 3.0 m/s²): -2 pts per incident
    const brakeDeduction = hardBrake * 2;

    // 4. Consumption variance above baseline:
    let varianceDeduction = 0;
    if (actualLPer100Km > baseline && baseline > 0) {
      const variancePct = ((actualLPer100Km - baseline) / baseline) * 100;
      if (variancePct > 5) {
        const excess = variancePct - 5;
        varianceDeduction = Math.min(15, Math.round(excess * 1.5));
      }
    }

    const totalDeductions = overspeedDeduction + accelDeduction + brakeDeduction + varianceDeduction;
    const finalScore = Math.max(0, Math.min(100, 100 - totalDeductions));

    let tier: EfficiencyTier = 'under_review';
    if (finalScore >= 90) {
      tier = 'elite';
    } else if (finalScore >= 80) {
      tier = 'optimal';
    } else if (finalScore >= 70) {
      tier = 'standard';
    }

    return {
      driverId: input.driverId,
      driverName: input.driverName,
      driverMatricule: input.driverMatricule,
      driverPhotoUrl: input.driverPhotoUrl,
      score: finalScore,
      tier,
      totalDistanceKm: distance,
      totalFuelLiters: fuelLiters,
      actualLPer100Km,
      fuelCpkMad,
      behaviors: {
        overspeedCount: overspeed,
        hardAccelerationCount: hardAccel,
        hardBrakingCount: hardBrake,
        excessiveIdleHours: idleHours,
      },
      deductions: {
        overspeed: overspeedDeduction,
        acceleration: accelDeduction,
        braking: brakeDeduction,
        variance: varianceDeduction,
      },
      rank: 0, // Assigned during leaderboard sorting
    };
  }

  /**
   * تقييم ومقارنة أداء استهلاك الوقود عبر ممرات النقل الاستراتيجية (Corridors Benchmark)
   */
  public static evaluateCorridors(trips: RawCorridorTripInput[]): CorridorFuelBenchmark[] {
    type DecimalInstance = InstanceType<typeof Decimal>;
    const grouped = new Map<
      string,
      {
        code: string;
        name: string;
        distance: DecimalInstance;
        liters: DecimalInstance;
        cost: DecimalInstance;
        tripsCount: number;
      }
    >();

    for (const trip of trips) {
      const code = trip.corridorCode || 'DOMESTIC-MA';
      const existing = grouped.get(code) || {
        code,
        name: trip.corridorName || CORRIDOR_DEFAULTS[code]?.name || code,
        distance: new Decimal(0),
        liters: new Decimal(0),
        cost: new Decimal(0),
        tripsCount: 0,
      };

      existing.distance = existing.distance.plus(new Decimal(trip.distanceKm || 0));
      existing.liters = existing.liters.plus(new Decimal(trip.fuelLiters || 0));
      existing.cost = existing.cost.plus(new Decimal(trip.fuelCostMad || 0));
      existing.tripsCount += 1;
      grouped.set(code, existing);
    }

    const results: CorridorFuelBenchmark[] = [];

    for (const [code, val] of grouped.entries()) {
      const baseline = CORRIDOR_DEFAULTS[code]?.baselineLPer100Km || 34.0;
      const totalKm = val.distance.toNumber();
      const totalLiters = val.liters.toNumber();
      const totalCost = val.cost.toNumber();

      const actualLPer100Km = this.calculateLPer100Km(totalLiters, totalKm);

      let variancePct = 0;
      if (baseline > 0 && actualLPer100Km > 0) {
        variancePct = new Decimal(actualLPer100Km)
          .minus(new Decimal(baseline))
          .dividedBy(new Decimal(baseline))
          .times(100)
          .toDecimalPlaces(2)
          .toNumber();
      }

      let status: CorridorStatus = 'optimal';
      if (variancePct > 8) {
        status = 'high_burn';
      } else if (variancePct > 2) {
        status = 'acceptable';
      }

      results.push({
        corridorId: code,
        corridorCode: code,
        corridorName: val.name,
        baselineLPer100Km: baseline,
        actualLPer100Km,
        variancePct,
        totalTrips: val.tripsCount,
        averageDistanceKm: val.tripsCount > 0 ? Math.round(totalKm / val.tripsCount) : 0,
        totalFuelLiters: totalLiters,
        totalCostMad: totalCost,
        status,
      });
    }

    return results.sort((a, b) => b.totalTrips - a.totalTrips);
  }

  /**
   * تجميع البيانات الجغرافية لنقاط التزود الشرعية وبؤر الشفط (Geo Clusters & Heatmap)
   */
  public static clusterGeoLocations(
    stations: RawFuelReceiptInput[],
    thefts: RawTheftIncidentInput[]
  ): GeoFuelCluster[] {
    const clusters: GeoFuelCluster[] = [];

    // 1. Process legitimate gas stations
    for (const s of stations) {
      clusters.push({
        id: `station_${s.id}`,
        type: 'refuel_station',
        name: s.stationName || 'محطة تزود بالوقود',
        city: s.city,
        latitude: s.latitude,
        longitude: s.longitude,
        eventCount: 1,
        totalVolumeLiters: new Decimal(s.liters || 0).toNumber(),
        financialImpactMad: new Decimal(s.totalCostMad || 0).toNumber(),
        riskLevel: 'low',
        lastEventAt: s.date,
      });
    }

    // 2. Process theft incidents
    for (const t of thefts) {
      const lossLiters = new Decimal(t.lossLiters || 0).toNumber();
      const lossMad = new Decimal(t.lossMad || 0).toNumber();

      let risk: GeoClusterRisk = 'high';
      if (lossLiters >= 80) {
        risk = 'critical';
      } else if (lossLiters < 30) {
        risk = 'medium';
      }

      clusters.push({
        id: `theft_${t.id}`,
        type: 'theft_hotspot',
        name: t.locationName || 'بؤرة شفط محروقات مرصودة',
        latitude: t.latitude,
        longitude: t.longitude,
        eventCount: 1,
        totalVolumeLiters: lossLiters,
        financialImpactMad: lossMad,
        riskLevel: risk,
        lastEventAt: t.createdAt,
      });
    }

    return clusters;
  }

  /**
   * توليد الملخص الشامل لذكاء الأعمال والمحروقات للأسطول بأكمله (Fleet BI Summary)
   */
  public static generateFleetBiSummary(params: {
    periodStart: string;
    periodEnd: string;
    driversTelemetry: RawDriverTelemetryInput[];
    corridorsTrips: RawCorridorTripInput[];
    fuelStations: RawFuelReceiptInput[];
    theftIncidents: RawTheftIncidentInput[];
    activeVehiclesCount: number;
  }): FleetFuelBiSummary {
    let totalKmDec = new Decimal(0);
    let totalLitersDec = new Decimal(0);
    let totalCostDec = new Decimal(0);

    // Calculate Driver Eco Scores and sort Leaderboard
    const scores: DriverEcoScore[] = [];
    for (const driverInput of params.driversTelemetry) {
      totalKmDec = totalKmDec.plus(new Decimal(driverInput.totalDistanceKm || 0));
      totalLitersDec = totalLitersDec.plus(new Decimal(driverInput.totalFuelLiters || 0));
      totalCostDec = totalCostDec.plus(new Decimal(driverInput.fuelCostMad || 0));

      const ecoScore = this.calculateDriverEcoScore(driverInput);
      scores.push(ecoScore);
    }

    // Sort leaderboard by score descending (then by fuel CPK ascending)
    scores.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.fuelCpkMad - b.fuelCpkMad;
    });

    // Assign ranking positions
    scores.forEach((driver, index) => {
      driver.rank = index + 1;
    });

    const totalKm = totalKmDec.toNumber();
    const totalLiters = totalLitersDec.toNumber();
    const totalCost = totalCostDec.toNumber();

    const avgLPer100Km = this.calculateLPer100Km(totalLiters, totalKm);
    const avgCpkMad = this.calculateFuelCpk(totalCost, totalKm);

    // Prevented theft loss calculation via Decimal.js
    let theftLossDec = new Decimal(0);
    for (const theft of params.theftIncidents) {
      theftLossDec = theftLossDec.plus(new Decimal(theft.lossMad || 0));
    }

    const avgEcoScore =
      scores.length > 0
        ? Math.round(scores.reduce((acc, curr) => acc + curr.score, 0) / scores.length)
        : 100;

    const corridorBenchmarks = this.evaluateCorridors(params.corridorsTrips);
    const geoClusters = this.clusterGeoLocations(params.fuelStations, params.theftIncidents);

    return {
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      totalDistanceKm: totalKm,
      totalFuelConsumedLiters: totalLiters,
      totalFuelCostMad: totalCost,
      averageFleetLPer100Km: avgLPer100Km,
      averageFleetCpkMad: avgCpkMad,
      preventedTheftLossMad: theftLossDec.toNumber(),
      averageEcoScore: avgEcoScore,
      activeVehiclesCount: params.activeVehiclesCount,
      driverRankings: scores,
      corridorBenchmarks,
      geoClusters,
    };
  }
}
