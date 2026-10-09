/**
 * Trans Bodanon TMS — Reefer Refrigerant Diagnostics & Thermodynamic Analysis Service
 * Standards: EN 12830 / ATP Treaty (FRC) / ISO 14903 Refrigerant Tightness
 * 
 * Strict Financial & Physical Rules:
 * All thermodynamic calculations (Superheat, Subcooling, Compression Ratio, Risk Scores, Loss %)
 * MUST use Decimal.js.
 */

import Decimal from 'decimal.js';
import type {
  CircuitThermodynamicEvaluation,
  ReeferCircuitDiagnosticsLog,
  ReeferPredictiveLeakIncident,
  RefrigerantRadarSummary,
  RefrigerantType,
} from '../types/refrigerant-radar.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export class RefrigerantDiagnosticsService {
  /**
   * 1. Calculate Superheat (°C) = Suction Line Temp - Evaporator Saturation Temp
   * Optimal Range for Carrier DataCOLD / Thermo King: 5.0°C to 12.0°C
   */
  static calculateSuperheat(suctionLineTempC: number, evaporatorTempC: number): number {
    const tSuction = new Decimal(suctionLineTempC);
    const tEvap = new Decimal(evaporatorTempC);
    return Number(tSuction.minus(tEvap).toFixed(2));
  }

  /**
   * 2. Calculate Subcooling (°C) = Condenser Saturation Temp - Liquid Line Temp
   * Optimal Range: 4.0°C to 10.0°C
   */
  static calculateSubcooling(condenserTempC: number, liquidLineTempC: number): number {
    const tCond = new Decimal(condenserTempC);
    const tLiquid = new Decimal(liquidLineTempC);
    return Number(tCond.minus(tLiquid).toFixed(2));
  }

  /**
   * 3. Calculate Compression Ratio = (P_discharge + 1.013) / (P_suction + 1.013) [Absolute bar]
   */
  static calculateCompressionRatio(dischargePressureBar: number, suctionPressureBar: number): number {
    const atm = new Decimal('1.013');
    const pDischargeAbs = new Decimal(dischargePressureBar).plus(atm);
    const pSuctionAbs = new Decimal(suctionPressureBar).plus(atm);

    if (pSuctionAbs.isZero() || pSuctionAbs.isNegative()) {
      return 1.0;
    }

    return Number(pDischargeAbs.dividedBy(pSuctionAbs).toFixed(2));
  }

  /**
   * 4. Comprehensive Thermodynamic Evaluation of Circuit Health
   */
  static evaluateCircuitHealth(reading: {
    refrigerantType: RefrigerantType;
    suctionPressureBar: number;
    dischargePressureBar: number;
    evaporatorTempC: number;
    suctionLineTempC: number;
    condenserTempC: number;
    liquidLineTempC: number;
    ambientTempC?: number | null;
  }): CircuitThermodynamicEvaluation {
    const superheat = this.calculateSuperheat(reading.suctionLineTempC, reading.evaporatorTempC);
    const subcooling = this.calculateSubcooling(reading.condenserTempC, reading.liquidLineTempC);
    const compressionRatio = this.calculateCompressionRatio(
      reading.dischargePressureBar,
      reading.suctionPressureBar
    );

    const dSuction = new Decimal(reading.suctionPressureBar);
    const dDischarge = new Decimal(reading.dischargePressureBar);
    const dSuperheat = new Decimal(superheat);
    const dSubcooling = new Decimal(subcooling);

    // Rule 1: TXV Flooding (Stuck Open / Blown Diaphragm)
    // Superheat < 2.0°C and Suction Pressure high -> liquid slugging danger to compressor
    if (dSuperheat.lessThan(2.0)) {
      const risk = new Decimal(88);
      return {
        incidentType: 'txv_flooding_open',
        severity: 'critical',
        riskScore: risk.toNumber(),
        estimatedRefrigerantLossPct: 0.0,
        superheatC: superheat,
        subcoolingC: subcooling,
        compressionRatio,
        description: `TXV expansion valve flooded/stuck open (Superheat ${superheat}°C < 2.0°C). High risk of liquid slugging into compressor cylinders.`,
        recommendedAction: 'Inspect TXV sensing bulb thermal contact and replace TXV power assembly immediately.',
        isAnomaly: true,
      };
    }

    // Rule 2: TXV Starvation (Stuck Closed / Orifice Clogged)
    // Very low suction (< 0.8 bar) with excessive Superheat (> 22°C) while subcooling is normal/high (refrigerant backed up in condenser)
    if (dSuction.lessThan(0.8) && dSuperheat.greaterThan(22.0) && dSubcooling.greaterThanOrEqualTo(4.0)) {
      const risk = new Decimal(82);
      return {
        incidentType: 'txv_starvation_closed',
        severity: 'high',
        riskScore: risk.toNumber(),
        estimatedRefrigerantLossPct: 0.0,
        superheatC: superheat,
        subcoolingC: subcooling,
        compressionRatio,
        description: `TXV valve starved/restricted (Suction ${reading.suctionPressureBar} bar, Superheat ${superheat}°C). Refrigerant trapped in high side (Subcooling ${subcooling}°C).`,
        recommendedAction: 'Replace TXV filter drier, clean expansion valve orifice screen, check bulb charge.',
        isAnomaly: true,
      };
    }

    // Rule 3: Micro-Leakage (Refrigerant Loss)
    // Low suction (< 1.2 bar for freezer setpoint, or < 1.9 bar for chilled) AND High Superheat (> 18.0°C) AND Low Subcooling (< 3.0°C)
    const isSuctionLow = reading.evaporatorTempC < -10
      ? dSuction.lessThan(1.2)
      : dSuction.lessThan(1.9);

    if ((isSuctionLow && dSuperheat.greaterThan(18.0)) || (dSuperheat.greaterThan(18.0) && dSubcooling.lessThan(3.0))) {
      // Calculate estimated loss percentage using Decimal.js:
      // Base loss from superheat elevation: (Superheat - 10) * 1.8 + (4 - Subcooling) * 2.5
      let lossPct = new Decimal(superheat)
        .minus(10)
        .times('1.8')
        .plus(new Decimal(4).minus(subcooling).times('2.5'));

      if (lossPct.isNegative()) lossPct = new Decimal(10);
      if (lossPct.greaterThan(65)) lossPct = new Decimal(65);
      const estLoss = Number(lossPct.toFixed(1));

      let severity: 'medium' | 'high' | 'critical' = 'medium';
      let riskScore = 65;

      if (estLoss >= 30 || dSuction.lessThan(0.7)) {
        severity = 'critical';
        riskScore = 92;
      } else if (estLoss >= 18 || dSuction.lessThan(1.1)) {
        severity = 'high';
        riskScore = 78;
      }

      return {
        incidentType: 'micro_leakage',
        severity,
        riskScore,
        estimatedRefrigerantLossPct: estLoss,
        superheatC: superheat,
        subcoolingC: subcooling,
        compressionRatio,
        description: `Progressive micro-leakage detected in ${reading.refrigerantType} circuit (Superheat ${superheat}°C, Subcooling ${subcooling}°C, Suction ${reading.suctionPressureBar} bar). Estimated charge deficit ~${estLoss}%.`,
        recommendedAction: 'Perform nitrogen pressure test & ultrasonic leak detection on flare fittings, service valves, and condenser coil.',
        isAnomaly: true,
      };
    }

    // Rule 4: Compressor Inefficiency (Worn Reed Valves / Low Compression)
    // High suction pressure (> 3.5 bar), Low discharge pressure (< 10.0 bar), Low compression ratio (< 2.6)
    if (dSuction.greaterThan(3.5) && dDischarge.lessThan(10.0) && compressionRatio < 2.6) {
      const risk = new Decimal(76);
      return {
        incidentType: 'compressor_inefficiency',
        severity: 'high',
        riskScore: risk.toNumber(),
        estimatedRefrigerantLossPct: 0.0,
        superheatC: superheat,
        subcoolingC: subcooling,
        compressionRatio,
        description: `Reefer compressor volumetric inefficiency detected (Compression ratio ${compressionRatio}, Suction ${reading.suctionPressureBar} bar, Discharge ${reading.dischargePressureBar} bar). Reed valve blow-by suspected.`,
        recommendedAction: 'Conduct compressor cylinder head temperature differential test and inspect internal reed valves.',
        isAnomaly: true,
      };
    }

    // Normal Healthy Circuit
    const normalRisk = new Decimal(10);
    return {
      incidentType: 'normal',
      severity: 'info',
      riskScore: normalRisk.toNumber(),
      estimatedRefrigerantLossPct: 0.0,
      superheatC: superheat,
      subcoolingC: subcooling,
      compressionRatio,
      description: `Refrigerant circuit operating within optimal thermodynamic envelope (Superheat ${superheat}°C, Subcooling ${subcooling}°C, Compression ratio ${compressionRatio}).`,
      recommendedAction: 'Routine telemetry monitoring active. No intervention required.',
      isAnomaly: false,
    };
  }

  /**
   * 5. Calculate Fleet Radar Summary Statistics
   */
  static calculateFleetSummary(
    trailersCount: number,
    recentLogs: ReeferCircuitDiagnosticsLog[],
    activeIncidents: ReeferPredictiveLeakIncident[]
  ): RefrigerantRadarSummary {
    const totalReefers = Math.max(trailersCount, recentLogs.length);
    if (totalReefers === 0) {
      return {
        totalMonitoredReefers: 0,
        healthyCircuitsCount: 0,
        activeLeakIncidentsCount: 0,
        txvAnomaliesCount: 0,
        criticalRiskTrailersCount: 0,
        averageFleetRefrigerantChargePct: 100,
        fleetThermodynamicHealthRate: 100,
      };
    }

    const unresolvedIncidents = activeIncidents.filter((inc) => !inc.isResolved);
    const leakIncidents = unresolvedIncidents.filter((inc) => inc.incidentType === 'micro_leakage');
    const txvIncidents = unresolvedIncidents.filter(
      (inc) => inc.incidentType === 'txv_starvation_closed' || inc.incidentType === 'txv_flooding_open'
    );
    const criticalIncidents = unresolvedIncidents.filter(
      (inc) => inc.severity === 'critical' || inc.riskScore >= 80
    );

    // Calculate unique affected trailers
    const affectedTrailerIds = new Set(unresolvedIncidents.map((i) => i.trailerId));
    const healthyCount = Math.max(0, totalReefers - affectedTrailerIds.size);

    // Calculate average fleet refrigerant charge %
    let totalLossSum = new Decimal(0);
    for (const inc of leakIncidents) {
      totalLossSum = totalLossSum.plus(new Decimal(inc.estimatedRefrigerantLossPct || 0));
    }
    const avgLoss = totalReefers > 0
      ? totalLossSum.dividedBy(new Decimal(totalReefers))
      : new Decimal(0);
    const avgCharge = new Decimal(100).minus(avgLoss);

    // Fleet Health Rate = (Healthy Reefers / Total Reefers) * 100
    const healthRate = new Decimal(healthyCount)
      .dividedBy(new Decimal(totalReefers))
      .times(100);

    return {
      totalMonitoredReefers: totalReefers,
      healthyCircuitsCount: healthyCount,
      activeLeakIncidentsCount: leakIncidents.length,
      txvAnomaliesCount: txvIncidents.length,
      criticalRiskTrailersCount: criticalIncidents.length,
      averageFleetRefrigerantChargePct: Number(avgCharge.toFixed(1)),
      fleetThermodynamicHealthRate: Number(healthRate.toFixed(1)),
    };
  }
}

