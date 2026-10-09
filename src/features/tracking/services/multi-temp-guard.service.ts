/**
 * Trans Bodanon TMS — Multi-Temp & Multi-Compartment Reefer Guard Service
 * Standards: EN 12830 / ATP Treaty (FRC / FRA) / USP <1151> MKT
 * 
 * Strict Financial & Physical Rules:
 * All thermal calculations (MKT, Delta T, Leakage Rate, Integrity Scores)
 * MUST use Decimal.js.
 */

import Decimal from 'decimal.js';
import type {
  CompartmentCode,
  CompartmentMktAudit,
  MultiTempTrailerMatrixSummary,
  ReeferCompartmentProfile,
  ReeferCompartmentTelemetryLog,
  ReeferCrossBulkheadAlert,
} from '../types/multi-temp.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export class MultiTempGuardService {
  /**
   * Activation energy / Gas constant ratio: Delta H / R = 10,000 K
   */
  private static readonly DH_R = new Decimal(10000);

  /**
   * 1. Calculate Mean Kinetic Temperature (MKT) in Celsius for a specific compartment
   */
  static calculateCompartmentMkt(tempsC: number[]): number {
    if (!tempsC || tempsC.length === 0) return 0;
    if (tempsC.length === 1) return Number(new Decimal(tempsC[0]).toFixed(2));

    let sumExp = new Decimal(0);
    const n = new Decimal(tempsC.length);

    for (const t of tempsC) {
      const kelvin = new Decimal(t).plus('273.15');
      if (kelvin.lessThanOrEqualTo(0)) continue;
      // exponent = - (Delta H / R) / T_kelvin
      const expVal = this.DH_R.dividedBy(kelvin).negated();
      sumExp = sumExp.plus(new Decimal(Math.exp(expVal.toNumber())));
    }

    if (sumExp.isZero()) {
      return Number(new Decimal(tempsC[0]).toFixed(2));
    }

    const avgExp = sumExp.dividedBy(n);
    const lnAvg = Math.log(avgExp.toNumber());
    const mktKelvin = this.DH_R.dividedBy(new Decimal(lnAvg).negated());
    const mktCelsius = mktKelvin.minus('273.15');

    return Number(mktCelsius.toFixed(2));
  }

  /**
   * 2. Detect Cross-Bulkhead Thermal Leakage between adjacent compartments
   */
  static evaluateCrossBulkheadIntegrity(params: {
    sourceProfile: ReeferCompartmentProfile;
    adjacentProfile: ReeferCompartmentProfile;
    sourceLogs: ReeferCompartmentTelemetryLog[];
    adjacentLogs: ReeferCompartmentTelemetryLog[];
  }): ReeferCrossBulkheadAlert | null {
    if (params.sourceLogs.length < 2) return null;

    const latestSource = params.sourceLogs[0];
    const latestAdjacent = params.adjacentLogs[0];
    if (!latestSource || !latestAdjacent) return null;

    // Calculate Delta T between compartments
    const dSource = new Decimal(latestSource.returnAirTempC);
    const dAdjacent = new Decimal(latestAdjacent.returnAirTempC);
    const deltaT = Number(dSource.minus(dAdjacent).abs().toFixed(2));

    // We only care about cross-leakage when there is a significant temperature difference (e.g. >= 15°C)
    // between frozen and fresh compartments
    if (deltaT < 15.0) return null;

    // Identify which one is the cold compartment (e.g. frozen)
    const isSourceColder = latestSource.returnAirTempC < latestAdjacent.returnAirTempC;
    const colderLogs = isSourceColder ? params.sourceLogs : params.adjacentLogs;
    const colderProfile = isSourceColder ? params.sourceProfile : params.adjacentProfile;
    const warmerProfile = isSourceColder ? params.adjacentProfile : params.sourceProfile;

    // Calculate temperature rise rate over the last 1-2 hours in the colder compartment
    const newestCold = colderLogs[0];
    const olderCold = colderLogs[colderLogs.length - 1];

    const timeDiffMs = new Date(newestCold.recordedAt).getTime() - new Date(olderCold.recordedAt).getTime();
    const hours = Math.max(0.25, timeDiffMs / (1000 * 3600));

    const tempDiff = new Decimal(newestCold.returnAirTempC).minus(new Decimal(olderCold.returnAirTempC));
    const riseRate = Number(tempDiff.dividedBy(new Decimal(hours)).toFixed(2));

    // If colder compartment temperature is rising while doors are closed and deltaT is high:
    const doorsClosed = !newestCold.doorOpen;

    if (doorsClosed && riseRate >= 1.2) {
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
      if (riseRate >= 2.5) {
        severity = 'critical';
      } else if (riseRate >= 1.8) {
        severity = 'high';
      }

      return {
        id: Math.random().toString(),
        companyId: colderProfile.companyId,
        trailerId: colderProfile.trailerId,
        tripId: colderProfile.tripId,
        sourceCompartmentCode: colderProfile.compartmentCode,
        adjacentCompartmentCode: warmerProfile.compartmentCode,
        deltaTC: deltaT,
        leakageRateCPerHr: riseRate,
        severity,
        description: `Cross-bulkhead thermal breach detected between ${colderProfile.compartmentCode} (${newestCold.returnAirTempC}°C) and ${warmerProfile.compartmentCode} (${latestAdjacent.returnAirTempC}°C). Delta T: ${deltaT}°C, Rise rate: +${riseRate}°C/hr with partition doors closed.`,
        recommendedAction: `Inspect pneumatic perimeter seals of moveable bulkhead between ${colderProfile.compartmentCode} and ${warmerProfile.compartmentCode}. Verify gasket contact with trailer floor and ceiling tracks.`,
        isResolved: false,
        createdAt: new Date().toISOString(),
      };
    }

    return null;
  }

  /**
   * 3. Audit MKT and Excursions for a specific compartment
   */
  static auditCompartment(
    profile: ReeferCompartmentProfile,
    logs: ReeferCompartmentTelemetryLog[]
  ): CompartmentMktAudit {
    if (!logs || logs.length === 0) {
      return {
        compartmentCode: profile.compartmentCode,
        compartmentName: profile.compartmentName,
        cargoCategory: profile.cargoCategory,
        setpointTempC: profile.setpointTempC,
        mktTempC: profile.setpointTempC,
        avgSupplyAirTempC: profile.setpointTempC,
        avgReturnAirTempC: profile.setpointTempC,
        excursionMinutes: 0,
        doorOpenCount: 0,
        isCompliant: true,
        status: 'compliant',
      };
    }

    const returnTemps = logs.map((l) => l.returnAirTempC);
    const supplyTemps = logs.map((l) => l.supplyAirTempC);
    const mkt = this.calculateCompartmentMkt(returnTemps);

    let sumSupply = new Decimal(0);
    let sumReturn = new Decimal(0);
    let doorCount = 0;
    let excursionLogsCount = 0;

    for (const log of logs) {
      sumSupply = sumSupply.plus(new Decimal(log.supplyAirTempC));
      sumReturn = sumReturn.plus(new Decimal(log.returnAirTempC));
      if (log.doorOpen) doorCount++;
      if (
        log.returnAirTempC < profile.minTempLimitC ||
        log.returnAirTempC > profile.maxTempLimitC
      ) {
        excursionLogsCount++;
      }
    }

    const n = new Decimal(logs.length);
    const avgSupply = Number(sumSupply.dividedBy(n).toFixed(2));
    const avgReturn = Number(sumReturn.dividedBy(n).toFixed(2));
    const excursionMins = excursionLogsCount * 10; // Assuming 10-minute telemetry cadence

    let isCompliant = true;
    let status: 'compliant' | 'warning' | 'breached' = 'compliant';

    if (excursionMins >= 60 || mkt > profile.maxTempLimitC + 1.5) {
      isCompliant = false;
      status = 'breached';
    } else if (excursionMins > 0 || mkt > profile.maxTempLimitC) {
      status = 'warning';
    }

    return {
      compartmentCode: profile.compartmentCode,
      compartmentName: profile.compartmentName,
      cargoCategory: profile.cargoCategory,
      setpointTempC: profile.setpointTempC,
      mktTempC: mkt,
      avgSupplyAirTempC: avgSupply,
      avgReturnAirTempC: avgReturn,
      excursionMinutes: excursionMins,
      doorOpenCount: doorCount,
      isCompliant,
      status,
    };
  }

  /**
   * 4. Aggregate Trailer Multi-Temp Matrix Summary
   */
  static aggregateTrailerMatrix(params: {
    trailerId: number;
    trailerPlate: string;
    profiles: ReeferCompartmentProfile[];
    logsByCompartment: Record<string, ReeferCompartmentTelemetryLog[]>;
    alerts: ReeferCrossBulkheadAlert[];
  }): MultiTempTrailerMatrixSummary {
    const compartmentsData = params.profiles.map((profile) => {
      const compLogs = params.logsByCompartment[profile.id] || [];
      const latestLog = compLogs[0];
      const mktAudit = this.auditCompartment(profile, compLogs);
      return {
        profile,
        latestLog,
        mktAudit,
      };
    });

    // Calculate Bulkhead Integrity Score
    const activeAlerts = params.alerts.filter((a) => !a.isResolved);
    let penalty = new Decimal(0);
    for (const a of activeAlerts) {
      if (a.severity === 'critical') penalty = penalty.plus(35);
      else if (a.severity === 'high') penalty = penalty.plus(25);
      else if (a.severity === 'medium') penalty = penalty.plus(15);
      else penalty = penalty.plus(5);
    }

    let integrityScore = new Decimal(100).minus(penalty);
    if (integrityScore.isNegative()) integrityScore = new Decimal(0);

    let overallStatus: 'optimal' | 'warning' | 'critical' = 'optimal';
    if (activeAlerts.some((a) => a.severity === 'critical') || compartmentsData.some((c) => c.mktAudit?.status === 'breached')) {
      overallStatus = 'critical';
    } else if (activeAlerts.length > 0 || compartmentsData.some((c) => c.mktAudit?.status === 'warning')) {
      overallStatus = 'warning';
    }

    const configType = params.profiles.length > 2
      ? 'tri_temp'
      : params.profiles.length === 2
      ? 'bi_temp'
      : 'single_temp';

    return {
      trailerId: params.trailerId,
      trailerPlate: params.trailerPlate,
      configurationType: configType,
      totalCompartments: params.profiles.length,
      compartments: compartmentsData,
      bulkheadIntegrityScore: Number(integrityScore.toFixed(1)),
      activeBulkheadAlertsCount: activeAlerts.length,
      overallStatus,
    };
  }
}

