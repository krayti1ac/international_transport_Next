/**
 * Predictive Logistics AI Copilot — Mathematical Risk Evaluator Engine
 * Strictly follows Decimal.js precision rules for all mathematical assessments.
 * Trans Bodanon TMS
 */

import Decimal from 'decimal.js';
import type {
  RiskSeverityLevel,
  RiskCategory,
  TripRiskFactor,
  TripRiskAssessment,
} from '../types/copilot-risk.types';
import type { InternationalCorridor } from '@/features/analytics/types/corridor.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// Standard Composite Weights (Must sum to 1.00)
export const COLD_CHAIN_WEIGHT = new Decimal('0.35');
export const FUEL_ANOMALY_WEIGHT = new Decimal('0.25');
export const BORDER_DELAY_WEIGHT = new Decimal('0.25');
export const DRIVER_FATIGUE_WEIGHT = new Decimal('0.15');

// Operational Baselines
export const BASELINE_FUEL_CONSUMPTION = new Decimal('36.0'); // L/100km
export const MAX_LEGAL_CONTINUOUS_DRIVE_MINS = new Decimal('270.0'); // 4.5 hours
export const MANDATORY_REST_WARNING_MINS = new Decimal('240.0'); // 4.0 hours

export interface ColdChainEvalParams {
  currentTemp: number;
  targetTemp?: number;
  allowedTolerance?: number;
  driftDurationMinutes?: number;
  doorOpen?: boolean;
  cargoType?: 'frozen' | 'fresh' | 'pharma' | 'general';
}

export interface FuelAnomalyEvalParams {
  actualConsumptionRate: number; // L/100km
  expectedNormRate?: number; // baseline L/100km
  idleMinutes?: number;
}

export interface BorderDelayEvalParams {
  corridor?: InternationalCorridor | 'domestic' | string;
  currentWaitMinutes: number;
  customsStatus?: 'cleared' | 'in_progress' | 'delayed' | 'blocked';
}

export interface DriverFatigueEvalParams {
  continuousDriveMinutes: number;
  dailyDriveMinutes?: number;
  hasBreakInLast4Hours?: boolean;
}

export function determineSeverity(score: InstanceType<typeof Decimal> | number): RiskSeverityLevel {
  const s = typeof score === 'number' ? new Decimal(score) : score;
  if (s.greaterThanOrEqualTo(80)) return 'critical';
  if (s.greaterThanOrEqualTo(60)) return 'high';
  if (s.greaterThanOrEqualTo(30)) return 'medium';
  return 'low';
}

/**
 * 1. Evaluates Cold Chain Thermal Stability Risk (0 - 100)
 * Evaluates excursion magnitude, duration, door breach, and cargo sensitivity.
 */
export function calculateColdChainRisk(params: ColdChainEvalParams): {
  score: number;
  severity: RiskSeverityLevel;
  varianceCelsius: number;
  factor: TripRiskFactor;
} {
  const current = new Decimal(params.currentTemp);
  const target = new Decimal(params.targetTemp ?? -18.0);
  const tolerance = new Decimal(params.allowedTolerance ?? 2.0);
  const duration = new Decimal(params.driftDurationMinutes ?? 0);
  const doorOpen = Boolean(params.doorOpen);
  const cargoType = params.cargoType ?? 'frozen';

  // Absolute temperature deviation
  const deviation = current.minus(target).abs();
  const excess = deviation.minus(tolerance);

  let rawScore = new Decimal(0);

  if (excess.greaterThan(0)) {
    // Base temperature deviation component (max 60 pts)
    const baseDev = Decimal.min(
      new Decimal(60),
      excess.dividedBy(new Decimal(5)).times(new Decimal(60))
    );

    // Duration component (starts after 30 mins, max 30 pts)
    let durationPenalty = new Decimal(0);
    if (duration.greaterThan(30)) {
      durationPenalty = Decimal.min(
        new Decimal(30),
        duration.minus(30).times(new Decimal(0.75))
      );
    }

    // Door open violation (10 pts)
    const doorPenalty = doorOpen ? new Decimal(10) : new Decimal(0);

    // Cargo vulnerability multiplier
    let cargoMultiplier = new Decimal('1.0');
    if (cargoType === 'pharma') cargoMultiplier = new Decimal('1.3');
    else if (cargoType === 'frozen') cargoMultiplier = new Decimal('1.15');
    else if (cargoType === 'fresh') cargoMultiplier = new Decimal('1.05');

    rawScore = Decimal.min(
      new Decimal(100),
      baseDev.plus(durationPenalty).plus(doorPenalty).times(cargoMultiplier)
    );
  } else if (doorOpen) {
    // Door open even if temp hasn't drifted yet
    rawScore = new Decimal(15);
  }

  const finalScore = Number(rawScore.toFixed(2));
  const severity = determineSeverity(rawScore);
  const varianceCelsius = Number(deviation.toFixed(2));
  const weightedScore = Number(
    rawScore.times(COLD_CHAIN_WEIGHT).toFixed(2)
  );

  return {
    score: finalScore,
    severity,
    varianceCelsius,
    factor: {
      category: 'cold_chain',
      score: finalScore,
      weight: Number(COLD_CHAIN_WEIGHT.toFixed(2)),
      weightedScore,
      severity,
      titleAr: 'استقرار سلسلة التبريد Frigo',
      titleFr: 'Stabilité de la Chaîne du Froid',
      titleEs: 'Estabilidad de la Cadena de Frío',
      descriptionAr:
        excess.greaterThan(0)
          ? `انحراف حراري بمقدار ${varianceCelsius}°C عن المستهدف (${target.toFixed(1)}°C) لمدة ${duration.toFixed(0)} دقيقة`
          : 'درجة حرارة حجرة التبريد ضمن النطاق المسموح به',
      descriptionFr:
        excess.greaterThan(0)
          ? `Écart thermique de ${varianceCelsius}°C par rapport à la consigne (${target.toFixed(1)}°C) pendant ${duration.toFixed(0)} min`
          : 'Température du compartiment sous contrôle',
      descriptionEs:
        excess.greaterThan(0)
          ? `Desviación térmica de ${varianceCelsius}°C respecto a la consigna (${target.toFixed(1)}°C) durante ${duration.toFixed(0)} min`
          : 'Temperatura del compartimento bajo control',
      metrics: {
        value: Number(current.toFixed(2)),
        target: Number(target.toFixed(2)),
        unit: '°C',
        variancePercentage: Number(
          deviation.dividedBy(Decimal.max(1, target.abs())).times(100).toFixed(1)
        ),
        details: {
          driftDurationMinutes: Number(duration.toFixed(0)),
          doorOpen,
          cargoType,
        },
      },
    },
  };
}

/**
 * 2. Evaluates Fuel Anomaly & Burn Rate Spikes (0 - 100)
 * Compares current burn rate against 36.0 L/100km norm and idle times.
 */
export function calculateFuelBurnAnomalyRisk(params: FuelAnomalyEvalParams): {
  score: number;
  severity: RiskSeverityLevel;
  variancePercentage: number;
  factor: TripRiskFactor;
} {
  const actual = new Decimal(params.actualConsumptionRate);
  const norm = new Decimal(params.expectedNormRate ?? BASELINE_FUEL_CONSUMPTION);
  const idleMins = new Decimal(params.idleMinutes ?? 0);

  // Rate ratio (actual / norm)
  const ratio = actual.dividedBy(norm);
  const variancePct = ratio.minus(1).times(100);

  let rawScore = new Decimal(0);

  // Allow up to 5% normal tolerance
  if (ratio.greaterThan(new Decimal('1.05'))) {
    // Overconsumption penalty: max 75 pts
    const overconsumptionPenalty = Decimal.min(
      new Decimal(75),
      variancePct.times(new Decimal('2.5'))
    );

    // Idle penalty: max 25 pts after 45 mins idle
    let idlePenalty = new Decimal(0);
    if (idleMins.greaterThan(45)) {
      idlePenalty = Decimal.min(
        new Decimal(25),
        idleMins.minus(45).dividedBy(15).times(5)
      );
    }

    rawScore = Decimal.min(
      new Decimal(100),
      overconsumptionPenalty.plus(idlePenalty)
    );
  }

  const finalScore = Number(rawScore.toFixed(2));
  const severity = determineSeverity(rawScore);
  const variancePercentage = Number(variancePct.toFixed(1));
  const weightedScore = Number(
    rawScore.times(FUEL_ANOMALY_WEIGHT).toFixed(2)
  );

  return {
    score: finalScore,
    severity,
    variancePercentage,
    factor: {
      category: 'fuel_anomaly',
      score: finalScore,
      weight: Number(FUEL_ANOMALY_WEIGHT.toFixed(2)),
      weightedScore,
      severity,
      titleAr: 'معدل استهلاك الوقود والشذوذ الميداني',
      titleFr: 'Consommation et Anomalie Carburant',
      titleEs: 'Consumo y Anomalía de Combustible',
      descriptionAr:
        variancePct.greaterThan(5)
          ? `ارتفاع استهلاك الوقود بمعدل ${actual.toFixed(1)} لتر/100كم (+${variancePercentage}% عن المعدل القياسي 36 لتر)`
          : 'معدل استهلاك الوقود متوازن وضمن الحدود التشغيلية',
      descriptionFr:
        variancePct.greaterThan(5)
          ? `Surconsommation de ${actual.toFixed(1)} L/100km (+${variancePercentage}% par rapport à la norme)`
          : 'Consommation de carburant conforme aux normes',
      descriptionEs:
        variancePct.greaterThan(5)
          ? `Sobrecoste de combustible de ${actual.toFixed(1)} L/100km (+${variancePercentage}% sobre la norma)`
          : 'Consumo de combustible dentro de los límites',
      metrics: {
        value: Number(actual.toFixed(1)),
        target: Number(norm.toFixed(1)),
        unit: 'L/100km',
        variancePercentage,
        details: {
          idleMinutes: Number(idleMins.toFixed(0)),
        },
      },
    },
  };
}

/**
 * 3. Evaluates Border Delay & Corridor Bottleneck Risk (0 - 100)
 * Calibrated for Guerguerat, Rosso, Tanger Med, and standard border ports.
 */
export function calculateBorderCongestionRisk(params: BorderDelayEvalParams): {
  score: number;
  severity: RiskSeverityLevel;
  waitMinutes: number;
  factor: TripRiskFactor;
} {
  const waitMins = new Decimal(params.currentWaitMinutes);
  const status = params.customsStatus ?? 'in_progress';
  const corridor = params.corridor;

  // Set corridor specific baseline wait time (in minutes)
  let baselineMins = new Decimal(120); // Tanger Med default: 2 hours
  let corridorNameAr = 'المعبر الحدودي';
  let corridorNameFr = 'Poste frontière';
  let corridorNameEs = 'Paso fronterizo';

  if (corridor === 'african_overland') {
    baselineMins = new Decimal(180); // Guerguerat / Rosso: 3 hours
    corridorNameAr = 'ممر العبور الإفريقي (الكركارات / روصو)';
    corridorNameFr = 'Corridor Africain (Guerguerat / Rosso)';
    corridorNameEs = 'Corredor Africano (Guerguerat / Rosso)';
  } else if (corridor === 'european_maritime') {
    baselineMins = new Decimal(120); // Tanger Med: 2 hours
    corridorNameAr = 'الممر الأوروبي البحري (ميناء طنجة المتوسط)';
    corridorNameFr = 'Corridor Maritime (Port Tanger Med)';
    corridorNameEs = 'Corredor Marítimo (Puerto Tánger Med)';
  }

  let rawScore = new Decimal(0);

  if (status === 'cleared') {
    rawScore = new Decimal(0);
  } else if (status === 'blocked') {
    rawScore = new Decimal(95);
  } else {
    if (waitMins.lessThanOrEqualTo(baselineMins)) {
      // Normal wait up to baseline (0 - 20 pts)
      rawScore = waitMins.dividedBy(baselineMins).times(20);
    } else {
      // Excess wait time penalty (20 to 85 pts)
      const excess = waitMins.minus(baselineMins);
      const excessScore = excess.dividedBy(baselineMins).times(60);
      rawScore = Decimal.min(new Decimal(85), new Decimal(20).plus(excessScore));
    }

    if (status === 'delayed') {
      rawScore = Decimal.min(new Decimal(100), rawScore.plus(15));
    }
  }

  const finalScore = Number(rawScore.toFixed(2));
  const severity = determineSeverity(rawScore);
  const waitMinutes = Number(waitMins.toFixed(0));
  const weightedScore = Number(
    rawScore.times(BORDER_DELAY_WEIGHT).toFixed(2)
  );

  return {
    score: finalScore,
    severity,
    waitMinutes,
    factor: {
      category: 'border_delay',
      score: finalScore,
      weight: Number(BORDER_DELAY_WEIGHT.toFixed(2)),
      weightedScore,
      severity,
      titleAr: 'عنق زجاجة المعابر الجمركية والموانئ',
      titleFr: 'Goulot Douanier et Ports de Transit',
      titleEs: 'Cuello de Botella Aduanero y Puertos',
      descriptionAr:
        waitMins.greaterThan(baselineMins)
          ? `فترة انتظار غير معتادة (${waitMinutes} دقيقة) في ${corridorNameAr}`
          : `الإجراءات الجمركية تسير بشكل اعتيادي (${waitMinutes} دقيقة)`,
      descriptionFr:
        waitMins.greaterThan(baselineMins)
          ? `Attente anormale (${waitMinutes} min) sur ${corridorNameFr}`
          : `Procédures douanières normales (${waitMinutes} min)`,
      descriptionEs:
        waitMins.greaterThan(baselineMins)
          ? `Espera inusual (${waitMinutes} min) en ${corridorNameEs}`
          : `Trámites aduaneros normales (${waitMinutes} min)`,
      metrics: {
        value: waitMinutes,
        target: Number(baselineMins.toFixed(0)),
        unit: 'min',
        variancePercentage: Number(
          waitMins.minus(baselineMins).dividedBy(baselineMins).times(100).toFixed(1)
        ),
        details: {
          status,
          corridor: String(corridor || 'standard'),
        },
      },
    },
  };
}

/**
 * 4. Evaluates Driver Fatigue & Hours of Service Compliance (0 - 100)
 * Strictly enforces 4.5 hours (270 min) continuous drive threshold.
 */
export function calculateDriverFatigueRisk(params: DriverFatigueEvalParams): {
  score: number;
  severity: RiskSeverityLevel;
  continuousMins: number;
  factor: TripRiskFactor;
} {
  const continuous = new Decimal(params.continuousDriveMinutes);
  const daily = new Decimal(params.dailyDriveMinutes ?? params.continuousDriveMinutes);

  let rawScore = new Decimal(0);

  if (continuous.lessThanOrEqualTo(180)) {
    // Normal 0 - 3 hours (0 - 20 pts)
    rawScore = continuous.dividedBy(270).times(20);
  } else if (continuous.lessThanOrEqualTo(MANDATORY_REST_WARNING_MINS)) {
    // 3 - 4 hours (20 - 45 pts)
    const excess = continuous.minus(180);
    rawScore = new Decimal(20).plus(excess.dividedBy(60).times(25));
  } else if (continuous.lessThanOrEqualTo(MAX_LEGAL_CONTINUOUS_DRIVE_MINS)) {
    // 4 - 4.5 hours (45 - 75 pts)
    const excess = continuous.minus(MANDATORY_REST_WARNING_MINS);
    rawScore = new Decimal(45).plus(excess.dividedBy(30).times(30));
  } else {
    // Illegal over-drive > 4.5 hours (75 - 100 pts)
    const excess = continuous.minus(MAX_LEGAL_CONTINUOUS_DRIVE_MINS);
    const overtimeScore = excess.times(new Decimal('0.5'));
    rawScore = Decimal.min(new Decimal(100), new Decimal(75).plus(overtimeScore));
  }

  // Daily driving exceedance (> 9 hours / 540 min)
  if (daily.greaterThan(540)) {
    rawScore = Decimal.min(new Decimal(100), rawScore.plus(15));
  }

  const finalScore = Number(rawScore.toFixed(2));
  const severity = determineSeverity(rawScore);
  const continuousMins = Number(continuous.toFixed(0));
  const weightedScore = Number(
    rawScore.times(DRIVER_FATIGUE_WEIGHT).toFixed(2)
  );

  return {
    score: finalScore,
    severity,
    continuousMins,
    factor: {
      category: 'driver_fatigue',
      score: finalScore,
      weight: Number(DRIVER_FATIGUE_WEIGHT.toFixed(2)),
      weightedScore,
      severity,
      titleAr: 'إجهاد السائق وساعات القيادة المتواصلة',
      titleFr: 'Fatigue du Chauffeur et Temps de Conduite',
      titleEs: 'Fatiga del Conductor y Horas de Conducción',
      descriptionAr:
        continuous.greaterThan(MANDATORY_REST_WARNING_MINS)
          ? `قيادة متواصلة لمدة ${continuousMins} دقيقة تقترب أو تتجاوز الحد القانوني (270 دقيقة)`
          : `ساعات القيادة المتواصلة (${continuousMins} دقيقة) ضمن الحدود القانونية`,
      descriptionFr:
        continuous.greaterThan(MANDATORY_REST_WARNING_MINS)
          ? `Conduite continue de ${continuousMins} min proche ou dépassant le seuil légal (270 min)`
          : `Temps de conduite continue (${continuousMins} min) conforme aux règles`,
      descriptionEs:
        continuous.greaterThan(MANDATORY_REST_WARNING_MINS)
          ? `Conducción continua de ${continuousMins} min cercana o superior al límite legal (270 min)`
          : `Horas de conducción continua (${continuousMins} min) dentro de la ley`,
      metrics: {
        value: continuousMins,
        target: 270,
        unit: 'min',
        variancePercentage: Number(
          continuous.minus(270).dividedBy(270).times(100).toFixed(1)
        ),
        details: {
          dailyDriveMinutes: Number(daily.toFixed(0)),
        },
      },
    },
  };
}

/**
 * 5. Master Composite Trip Risk Assessment Calculator
 * Evaluates all 4 risk dimensions and calculates the composite risk score using Decimal.js.
 */
export function computeTripCompositeRisk(params: {
  tripId: number;
  truckId: number;
  truckPlate: string;
  trailerPlate?: string;
  driverId?: number;
  driverName: string;
  driverPhone?: string;
  corridor: InternationalCorridor | 'domestic';
  coldChain: ColdChainEvalParams;
  fuel: FuelAnomalyEvalParams;
  border: BorderDelayEvalParams;
  fatigue: DriverFatigueEvalParams;
}): {
  compositeScore: number;
  overallSeverity: RiskSeverityLevel;
  factors: TripRiskFactor[];
} {
  const coldRes = calculateColdChainRisk(params.coldChain);
  const fuelRes = calculateFuelBurnAnomalyRisk(params.fuel);
  const borderRes = calculateBorderCongestionRisk(params.border);
  const fatigueRes = calculateDriverFatigueRisk(params.fatigue);

  const factors = [
    coldRes.factor,
    fuelRes.factor,
    borderRes.factor,
    fatigueRes.factor,
  ];

  // Mathematical composite score: Sum(weight_i * score_i)
  const weightedSum = new Decimal(coldRes.factor.weightedScore)
    .plus(new Decimal(fuelRes.factor.weightedScore))
    .plus(new Decimal(borderRes.factor.weightedScore))
    .plus(new Decimal(fatigueRes.factor.weightedScore));

  const compositeScore = Number(Decimal.min(new Decimal(100), weightedSum).toFixed(2));
  const overallSeverity = determineSeverity(compositeScore);

  return {
    compositeScore,
    overallSeverity,
    factors,
  };
}
