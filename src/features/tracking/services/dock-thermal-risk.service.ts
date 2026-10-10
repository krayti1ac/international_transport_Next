/**
 * Trans Bodanon TMS — Dock Thermal Risk & Predictive Vulnerability Service
 * Computes Dock Vulnerability Index (DVI) under strict Decimal.js precision
 * Compliant with: EU GDP (2013/C 343/01) / EN 12830 / ATP Treaty (FRC)
 */

import Decimal from 'decimal.js';
import type {
  CompartmentThermalImpact,
  DockHeatmapSummaryKpi,
  DockRiskCluster,
  DockRiskLevel,
  DockThermalMetrics,
  DockWatchStatus,
} from '../types/dock-heatmap.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
type DecimalInstance = InstanceType<typeof Decimal>;

export interface KnownFacilityMetadata {
  facilityOrPort: string;
  city: string;
  countryCode: string;
  lat: number;
  lng: number;
}

export const KNOWN_STRATEGIC_HUBS: Record<string, KnownFacilityMetadata> = {
  mercamadrid: {
    facilityOrPort: 'Mercamadrid Plataforma Logística Frigorífica',
    city: 'Madrid',
    countryCode: 'ES',
    lat: 40.3642,
    lng: -3.6663,
  },
  rungis: {
    facilityOrPort: "Marché d'Intérêt National de Rungis (Secteur Frais)",
    city: 'Rungis / Paris',
    countryCode: 'FR',
    lat: 48.7561,
    lng: 2.3552,
  },
  tangermed: {
    facilityOrPort: 'Port Tanger Med — Zone Logistique Frigorifique',
    city: 'Tanger',
    countryCode: 'MA',
    lat: 35.8885,
    lng: -5.5032,
  },
  perpignan: {
    facilityOrPort: 'Plateforme Saint-Charles International',
    city: 'Perpignan',
    countryCode: 'FR',
    lat: 42.6841,
    lng: 2.8715,
  },
  algeciras: {
    facilityOrPort: 'Puerto Bahía de Algeciras — Terminal Frío PBF',
    city: 'Algeciras',
    countryCode: 'ES',
    lat: 36.1332,
    lng: -5.4451,
  },
  agadir: {
    facilityOrPort: 'Agadir Agro-Export Terminal Frigo',
    city: 'Agadir',
    countryCode: 'MA',
    lat: 30.4278,
    lng: -9.5981,
  },
  casablanca: {
    facilityOrPort: 'Zenata Logistics Hub — Entrepôt Tempéré',
    city: 'Casablanca',
    countryCode: 'MA',
    lat: 33.6214,
    lng: -7.4988,
  },
  valencia: {
    facilityOrPort: 'Valencia Port Cold Logistics Center',
    city: 'Valencia',
    countryCode: 'ES',
    lat: 39.4456,
    lng: -0.3255,
  },
};

export class DockThermalRiskService {
  /**
   * Calculates the Dock Vulnerability Index (DVI: 0 - 100) using strict Decimal.js operations:
   * DVI = min(100, (excursions / totalArrivals * 40) + (avgUnloadingMins / 60 * 30) + (peakDeviation / 5 * 30))
   */
  public static calculateDviScore(params: {
    excursionCount: number;
    totalArrivals: number;
    avgUnloadingMins: number;
    peakDeviationC: number;
  }): {
    dviScore: number;
    riskLevel: DockRiskLevel;
    intensityWeight: number;
    excursionFrequencyPercent: number;
  } {
    const excursionsDec = new Decimal(params.excursionCount);
    const totalArrDec = new Decimal(Math.max(1, params.totalArrivals));
    const avgMinsDec = new Decimal(Math.max(0, params.avgUnloadingMins));
    const peakDevDec = new Decimal(Math.max(0, params.peakDeviationC));

    // Term 1: Excursion Frequency Component (0 to 40 pts)
    const excRatio = excursionsDec.dividedBy(totalArrDec);
    const excFreqPercent = excRatio.times(100).toDecimalPlaces(2).toNumber();
    const term1 = excRatio.times(40);

    // Term 2: Unloading Duration Exposure Component (0 to 30 pts)
    // 60 minutes baseline cap
    const term2 = avgMinsDec.dividedBy(60).times(30);

    // Term 3: Thermal Shock Peak Deviation Component (0 to 30 pts)
    // 5°C baseline cap
    const term3 = peakDevDec.dividedBy(5).times(30);

    // Sum and clamp to [0, 100]
    const rawSum = term1.plus(term2).plus(term3);
    const clampedDvi = Decimal.min(100, Decimal.max(0, rawSum));
    const dviScore = clampedDvi.toDecimalPlaces(2).toNumber();

    // Risk classification
    let riskLevel: DockRiskLevel = 'safe';
    if (dviScore >= 60) {
      riskLevel = 'critical';
    } else if (dviScore >= 25) {
      riskLevel = 'monitored';
    }

    // Heatmap intensity weight: [0.05, 1.00]
    const intensityDec = clampedDvi.dividedBy(100);
    const intensityWeight = Decimal.max(0.05, Decimal.min(1.0, intensityDec))
      .toDecimalPlaces(3)
      .toNumber();

    return {
      dviScore,
      riskLevel,
      intensityWeight,
      excursionFrequencyPercent: excFreqPercent,
    };
  }

  /**
   * Generates proactive operational protocols depending on risk profile and compartment thermal state
   */
  public static generateOperationalProtocols(
    riskLevel: DockRiskLevel,
    dviScore: number,
    peakDeviationC: number
  ): string[] {
    const protocols: string[] = [];

    if (riskLevel === 'critical' || dviScore >= 60) {
      protocols.push('dockRisk.protocols.continuousCooling');
      protocols.push('dockRisk.protocols.avoidPeakHours');
      protocols.push('dockRisk.protocols.deployBulkheadCurtain');
      if (peakDeviationC > 4.0) {
        protocols.push('dockRisk.protocols.preCoolInspectionMandatory');
      }
    } else if (riskLevel === 'monitored' || dviScore >= 25) {
      protocols.push('dockRisk.protocols.verifyInflatableSeal');
      protocols.push('dockRisk.protocols.limitDoorOpenIntervals');
      protocols.push('dockRisk.protocols.monitorExcursionTimer');
    } else {
      protocols.push('dockRisk.protocols.standardGdpCrossDock');
      protocols.push('dockRisk.protocols.routineAeroSealCheck');
    }

    return protocols;
  }

  /**
   * Evaluates compartment-level vulnerability (Deep Frozen C1, Chilled C2, Fresh Produce C3)
   */
  public static evaluateCompartmentImpacts(
    peakDeviationC: number,
    avgThermalShockC: number
  ): CompartmentThermalImpact[] {
    const peakDev = new Decimal(peakDeviationC);
    const shock = new Decimal(avgThermalShockC);

    // C1: Deep Frozen (-20°C target) -> very vulnerable to positive spikes
    const c1Spike = peakDev.times(1.2);
    const c1Prob = c1Spike.greaterThan(3.0) ? 'high' : c1Spike.greaterThan(1.5) ? 'moderate' : 'low';

    // C2: Chilled Pharma / Meat (0°C to +4°C target)
    const c2Spike = shock.times(0.9);
    const c2Prob = c2Spike.greaterThan(2.5) ? 'high' : c2Spike.greaterThan(1.0) ? 'moderate' : 'low';

    // C3: Fresh Produce (+12°C target)
    const c3Spike = shock.times(0.7);
    const c3Prob = c3Spike.greaterThan(4.0) ? 'high' : c3Spike.greaterThan(2.0) ? 'moderate' : 'low';

    return [
      {
        compartment: 'C1',
        cargoTypeKey: 'reefer.cargo.deep_frozen',
        setpointTempC: -20.0,
        avgExcursionTempC: new Decimal(-20.0).plus(c1Spike).toDecimalPlaces(1).toNumber(),
        riskProbability: c1Prob,
      },
      {
        compartment: 'C2',
        cargoTypeKey: 'reefer.cargo.pharma_cold',
        setpointTempC: 3.0,
        avgExcursionTempC: new Decimal(3.0).plus(c2Spike).toDecimalPlaces(1).toNumber(),
        riskProbability: c2Prob,
      },
      {
        compartment: 'C3',
        cargoTypeKey: 'reefer.cargo.fresh_produce',
        setpointTempC: 12.0,
        avgExcursionTempC: new Decimal(12.0).plus(c3Spike).toDecimalPlaces(1).toNumber(),
        riskProbability: c3Prob,
      },
    ];
  }

  /**
   * Transforms raw arrivals and excursion audit rows into clustered Dock Risk records
   */
  public static clusterDockArrivals(
    rawArrivals: Array<{
      dockId: string;
      dockName?: string;
      zoneName?: string;
      coordinates?: { lat: number; lng: number };
      status?: string; // 'compliant' | 'warning' | 'breached'
      unloadingDurationMins?: number;
      actualTempC?: number;
      setpointTempC?: number;
      timestamp?: string;
    }>,
    overrideWatches: Record<string, { status: DockWatchStatus; reason?: string }> = {}
  ): {
    clusters: DockRiskCluster[];
    summary: DockHeatmapSummaryKpi;
  } {
    const dockGroup = new Map<
      string,
      {
        dockId: string;
        dockName: string;
        coords: { lat: number; lng: number };
        facilityMeta: KnownFacilityMetadata;
        arrivalsCount: number;
        excursionsCount: number;
        totalMins: DecimalInstance;
        peakDeviation: DecimalInstance;
        thermalShockSum: DecimalInstance;
        lastTimestamp: string;
      }
    >();

    for (const arr of rawArrivals) {
      const id = (arr.dockId || 'DOCK-UNKNOWN').trim().toUpperCase();
      const name = arr.dockName || arr.zoneName || id;

      // Match known facility or derive fallback
      const lowerKey = id.toLowerCase();
      let matchedMeta: KnownFacilityMetadata = KNOWN_STRATEGIC_HUBS.tangermed;
      for (const [key, meta] of Object.entries(KNOWN_STRATEGIC_HUBS)) {
        if (lowerKey.includes(key) || name.toLowerCase().includes(key)) {
          matchedMeta = meta;
          break;
        }
      }

      const coords = arr.coordinates || { lat: matchedMeta.lat, lng: matchedMeta.lng };
      const isExcursion = arr.status === 'breached' || arr.status === 'warning';
      const durationMins = new Decimal(arr.unloadingDurationMins || 25);
      const setpoint = new Decimal(arr.setpointTempC ?? 3.0);
      const actual = new Decimal(arr.actualTempC ?? 3.5);
      const deviation = Decimal.max(0, actual.minus(setpoint));
      const thermalShock = actual.minus(setpoint);

      if (!dockGroup.has(id)) {
        dockGroup.set(id, {
          dockId: id,
          dockName: name,
          coords,
          facilityMeta: matchedMeta,
          arrivalsCount: 0,
          excursionsCount: 0,
          totalMins: new Decimal(0),
          peakDeviation: new Decimal(0),
          thermalShockSum: new Decimal(0),
          lastTimestamp: arr.timestamp || new Date().toISOString(),
        });
      }

      const entry = dockGroup.get(id)!;
      entry.arrivalsCount += 1;
      if (isExcursion) entry.excursionsCount += 1;
      entry.totalMins = entry.totalMins.plus(durationMins);
      entry.peakDeviation = Decimal.max(entry.peakDeviation, deviation);
      entry.thermalShockSum = entry.thermalShockSum.plus(thermalShock);
      if (arr.timestamp && arr.timestamp > entry.lastTimestamp) {
        entry.lastTimestamp = arr.timestamp;
      }
    }

    // Default hubs if empty to ensure initial operational radar visibility
    if (dockGroup.size === 0) {
      const seedHubs = [
        { id: 'DOCK-TMED-01', name: 'Tanger Med Frigo Dock 1', key: 'tangermed', arr: 24, exc: 1, mins: 28, dev: 0.8 },
        { id: 'DOCK-MAD-04', name: 'Mercamadrid Hall 4 Frigo', key: 'mercamadrid', arr: 32, exc: 7, mins: 65, dev: 4.2 },
        { id: 'DOCK-RUNGIS-02', name: 'Rungis Quai Marée 2', key: 'rungis', arr: 19, exc: 2, mins: 35, dev: 1.4 },
        { id: 'DOCK-PERP-01', name: 'Perpignan St-Charles Quai 1', key: 'perpignan', arr: 28, exc: 3, mins: 42, dev: 2.1 },
        { id: 'DOCK-ALG-03', name: 'Algeciras Terminal Frío 3', key: 'algeciras', arr: 15, exc: 6, mins: 72, dev: 4.8 },
        { id: 'DOCK-AGADIR-02', name: 'Agadir Primeurs Dock 2', key: 'agadir', arr: 22, exc: 1, mins: 30, dev: 0.9 },
      ];

      for (const h of seedHubs) {
        const meta = KNOWN_STRATEGIC_HUBS[h.key] || KNOWN_STRATEGIC_HUBS.tangermed;
        dockGroup.set(h.id, {
          dockId: h.id,
          dockName: h.name,
          coords: { lat: meta.lat, lng: meta.lng },
          facilityMeta: meta,
          arrivalsCount: h.arr,
          excursionsCount: h.exc,
          totalMins: new Decimal(h.mins * h.arr),
          peakDeviation: new Decimal(h.dev),
          thermalShockSum: new Decimal(h.dev * h.arr * 0.7),
          lastTimestamp: new Date().toISOString(),
        });
      }
    }

    const clusters: DockRiskCluster[] = [];
    let criticalCount = 0;
    let monitoredCount = 0;
    let safeCount = 0;
    let totalDviSum = new Decimal(0);
    let worstDock: { dockId: string; dockName: string; dviScore: number } | null = null;

    for (const [id, entry] of dockGroup.entries()) {
      const avgMins = entry.totalMins
        .dividedBy(Math.max(1, entry.arrivalsCount))
        .toDecimalPlaces(1)
        .toNumber();
      const peakDev = entry.peakDeviation.toDecimalPlaces(2).toNumber();
      const avgThermalShock = entry.thermalShockSum
        .dividedBy(Math.max(1, entry.arrivalsCount))
        .toDecimalPlaces(2)
        .toNumber();

      const calc = this.calculateDviScore({
        excursionCount: entry.excursionsCount,
        totalArrivals: entry.arrivalsCount,
        avgUnloadingMins: avgMins,
        peakDeviationC: peakDev,
      });

      const metrics: DockThermalMetrics = {
        totalArrivals: entry.arrivalsCount,
        excursionCount: entry.excursionsCount,
        excursionFrequencyPercent: calc.excursionFrequencyPercent,
        avgUnloadingMins: avgMins,
        peakDeviationC: peakDev,
        avgThermalShockDeltaC: avgThermalShock,
        dviScore: calc.dviScore,
      };

      const watchOverride = overrideWatches[id];
      const watchStatus: DockWatchStatus = watchOverride ? watchOverride.status : 'normal';

      if (calc.riskLevel === 'critical') criticalCount++;
      else if (calc.riskLevel === 'monitored') monitoredCount++;
      else safeCount++;

      totalDviSum = totalDviSum.plus(calc.dviScore);

      if (!worstDock || calc.dviScore > worstDock.dviScore) {
        worstDock = { dockId: id, dockName: entry.dockName, dviScore: calc.dviScore };
      }

      clusters.push({
        dockId: id,
        dockName: entry.dockName,
        facilityOrPort: entry.facilityMeta.facilityOrPort,
        city: entry.facilityMeta.city,
        countryCode: entry.facilityMeta.countryCode,
        coordinates: entry.coords,
        riskLevel: calc.riskLevel,
        watchStatus,
        metrics,
        intensityWeight: calc.intensityWeight,
        compartmentImpacts: this.evaluateCompartmentImpacts(peakDev, avgThermalShock),
        recommendedProtocols: this.generateOperationalProtocols(calc.riskLevel, calc.dviScore, peakDev),
        lastArrivalTimestamp: entry.lastTimestamp,
        flaggedReason: watchOverride?.reason || null,
      });
    }

    // Sort clusters by DVI score descending (most dangerous first)
    clusters.sort((a, b) => b.metrics.dviScore - a.metrics.dviScore);

    const totalDocks = Math.max(1, clusters.length);
    const overallAvgDvi = totalDviSum.dividedBy(totalDocks).toDecimalPlaces(1).toNumber();

    // Cold chain preservation percent: 100 - (critical / total * 30 + monitored / total * 10)
    const preservationPenalty = new Decimal(criticalCount)
      .dividedBy(totalDocks)
      .times(30)
      .plus(new Decimal(monitoredCount).dividedBy(totalDocks).times(10));
    const preservationDec = Decimal.max(0, new Decimal(100).minus(preservationPenalty));
    const coldChainPreservationPercent = preservationDec.toDecimalPlaces(1).toNumber();

    const summary: DockHeatmapSummaryKpi = {
      totalDocksAnalyzed: clusters.length,
      criticalHotspotsCount: criticalCount,
      monitoredDocksCount: monitoredCount,
      safeDocksCount: safeCount,
      overallAverageDvi: overallAvgDvi,
      worstDviDock: worstDock,
      coldChainPreservationPercent,
    };

    return { clusters, summary };
  }
}

