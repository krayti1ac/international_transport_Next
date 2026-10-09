import Decimal from 'decimal.js';
import type {
  FleetTire,
  TireWearMetrics,
  TireConditionHealth,
  TpmsAlertFlag,
  FleetTireSummary,
  DualTirePairEvaluation,
  TireAxlePosition,
} from '../types/tire-fleet.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export type DecimalInstance = InstanceType<typeof Decimal>;
export type DecimalValue = string | number | DecimalInstance;

// Operational and Safety Limits
export const LEGAL_MIN_TREAD_DEPTH_MM = new Decimal('1.60');
export const SAFETY_THRESHOLD_TREAD_DEPTH_MM = new Decimal('3.00');
export const DUAL_PAIR_MAX_DELTA_MM = new Decimal('2.00');

export const OPTIMAL_PRESSURE_MIN_BAR = new Decimal('8.50');
export const OPTIMAL_PRESSURE_MAX_BAR = new Decimal('9.00');
export const LOW_PRESSURE_WARNING_BAR = new Decimal('7.65'); // 10% under-inflation
export const CRITICAL_LOW_PRESSURE_BAR = new Decimal('6.80'); // 20% under-inflation
export const HIGH_PRESSURE_WARNING_BAR = new Decimal('10.20');
export const MAX_SAFE_TEMP_CELSIUS = new Decimal('85.00');

// Default estimated replacement cost for new premium truck tire (MAD)
export const DEFAULT_NEW_TIRE_COST_MAD = new Decimal('4600.00');

/**
 * Corridor Wear Severity Multipliers
 */
export function getCorridorWearMultiplier(corridor: string = 'DOMESTIC'): DecimalInstance {
  if (corridor === 'MA-MR-SN') {
    return new Decimal('1.40'); // West African Sahara (extreme road heat, sand abrasive wear)
  }
  if (corridor === 'MA-ES-FR') {
    return new Decimal('1.00'); // European motorway standard wear
  }
  return new Decimal('1.10'); // Domestic Intra-Morocco routes
}

/**
 * Evaluates TPMS Sensor Telematics Reading (Pressure, Temp)
 */
export function evaluateTpmsReading(
  pressureBar: DecimalValue,
  temperatureC: DecimalValue
): TpmsAlertFlag[] {
  const pressure = new Decimal(pressureBar);
  const temp = new Decimal(temperatureC);
  const flags: TpmsAlertFlag[] = [];

  if (pressure.lessThanOrEqualTo(CRITICAL_LOW_PRESSURE_BAR)) {
    flags.push('critical_low_pressure');
  } else if (pressure.lessThanOrEqualTo(LOW_PRESSURE_WARNING_BAR)) {
    flags.push('low_pressure');
  } else if (pressure.greaterThan(HIGH_PRESSURE_WARNING_BAR)) {
    flags.push('high_pressure');
  }

  if (temp.greaterThan(MAX_SAFE_TEMP_CELSIUS)) {
    flags.push('overheating');
  }

  if (flags.length === 0) {
    flags.push('normal');
  }

  return flags;
}

/**
 * Calculates Tread Wear Metrics, Lifetime Projection & Tire CPK
 */
export function calculateTireWearMetrics(
  initialDepthMm: DecimalValue,
  currentDepthMm: DecimalValue,
  installedKm: number,
  currentKm: number,
  purchaseCostMad: DecimalValue,
  corridor: string = 'DOMESTIC'
): TireWearMetrics {
  const initial = new Decimal(initialDepthMm);
  const current = new Decimal(currentDepthMm);
  const cost = new Decimal(purchaseCostMad);

  const accumulatedKm = Math.max(0, currentKm - installedKm);
  let wornDepth = initial.minus(current);
  if (wornDepth.isNegative()) wornDepth = new Decimal('0.00');

  // Baseline standard wear rate: 1.00 mm per 10,000 km
  let wearRatePer10k: DecimalInstance;
  if (accumulatedKm >= 2000 && wornDepth.greaterThan(0)) {
    wearRatePer10k = wornDepth.dividedBy(new Decimal(accumulatedKm)).times(10000);
  } else {
    wearRatePer10k = new Decimal('1.00');
  }

  // Corridor severity adjustment
  const corridorFactor = getCorridorWearMultiplier(corridor);
  const effectiveWearRatePer10k = wearRatePer10k.times(corridorFactor);

  // Usable depth remaining until legal minimum (1.60 mm)
  let remainingUsable = current.minus(LEGAL_MIN_TREAD_DEPTH_MM);
  if (remainingUsable.isNegative()) remainingUsable = new Decimal('0.00');

  // Projected remaining kilometers
  let projectedRemainingKm = 0;
  if (effectiveWearRatePer10k.greaterThan(0) && remainingUsable.greaterThan(0)) {
    projectedRemainingKm = Math.round(
      remainingUsable.dividedBy(effectiveWearRatePer10k).times(10000).toNumber()
    );
  }

  // Total projected lifetime kilometers
  const totalLifetimeKm = accumulatedKm + projectedRemainingKm;

  // Tire CPK (MAD / km) = Purchase Cost / Total Lifetime Km
  const cpk = totalLifetimeKm > 0
    ? cost.dividedBy(new Decimal(totalLifetimeKm)).toFixed(4)
    : '0.0000';

  // Condition health
  let health: TireConditionHealth = 'optimal';
  if (current.lessThanOrEqualTo(LEGAL_MIN_TREAD_DEPTH_MM)) {
    health = 'legal_limit';
  } else if (current.lessThanOrEqualTo(SAFETY_THRESHOLD_TREAD_DEPTH_MM)) {
    health = 'critical';
  } else if (current.lessThanOrEqualTo(new Decimal('5.00'))) {
    health = 'warning';
  } else if (current.lessThanOrEqualTo(new Decimal('10.00'))) {
    health = 'good';
  }

  // Rotation recommendation: if tire has worn more than 50% or reached 60,000 km without rotation
  const totalWornPct = initial.greaterThan(0)
    ? wornDepth.dividedBy(initial).times(100).toNumber()
    : 0;

  const rotationRecommended = totalWornPct >= 45 && current.greaterThan(SAFETY_THRESHOLD_TREAD_DEPTH_MM);
  let rotationReason: string | undefined;
  if (rotationRecommended) {
    rotationReason = `تآكل المداس بنسبة ${totalWornPct.toFixed(0)}%، يُوصى بتدوير موضع الإطار لموازنة التآكل`;
  }

  return {
    accumulated_km: accumulatedKm,
    worn_depth_mm: wornDepth.toFixed(2),
    wear_rate_mm_per_10k_km: wearRatePer10k.toFixed(2),
    remaining_usable_depth_mm: remainingUsable.toFixed(2),
    projected_remaining_km: projectedRemainingKm,
    tire_cpk_mad: cpk,
    health_condition: health,
    rotation_recommended: rotationRecommended,
    rotation_reason: rotationReason,
  };
}

/**
 * Evaluates Dual Tire Pairs (e.g. 2LO vs 2LI) to detect dangerous depth mismatches
 */
export function evaluateDualTirePair(
  axle: string,
  outerPos: TireAxlePosition,
  innerPos: TireAxlePosition,
  outerTire?: FleetTire,
  innerTire?: FleetTire
): DualTirePairEvaluation {
  if (!outerTire || !innerTire) {
    return {
      axle,
      outer_position: outerPos,
      inner_position: innerPos,
      outer_tire: outerTire,
      inner_tire: innerTire,
      depth_delta_mm: '0.00',
      is_mismatched: false,
    };
  }

  const outerDepth = new Decimal(outerTire.current_tread_depth_mm || '0');
  const innerDepth = new Decimal(innerTire.current_tread_depth_mm || '0');
  const delta = outerDepth.minus(innerDepth).abs();

  const isMismatched = delta.greaterThanOrEqualTo(DUAL_PAIR_MAX_DELTA_MM);

  let msgAr: string | undefined;
  let msgFr: string | undefined;
  let msgEs: string | undefined;

  if (isMismatched) {
    msgAr = `فارق عمق المداس بين العجلتين المزدوجتين (${delta.toFixed(1)} مم) يتجاوز الحد المسموح (2.0 مم)، مما يُحمّل الإطار الأكبر وزناً زائداً ويهدد بانفجاره.`;
    msgFr = `Écart d'usure de ${delta.toFixed(1)} mm entre pneus jumelés supérieur à la tolérance (2.0 mm). Risque de surcharge du plus grand pneu.`;
    msgEs = `Diferencia de profundidad de ${delta.toFixed(1)} mm entre gemelos supera el límite de 2.0 mm. Riesgo de sobrecarga.`;
  }

  return {
    axle,
    outer_position: outerPos,
    inner_position: innerPos,
    outer_tire: outerTire,
    inner_tire: innerTire,
    depth_delta_mm: delta.toFixed(2),
    is_mismatched: isMismatched,
    warning_message_ar: msgAr,
    warning_message_fr: msgFr,
    warning_message_es: msgEs,
  };
}

/**
 * Builds Fleet-Wide Tire Intelligence Summary
 */
export function buildFleetTireSummary(tires: FleetTire[]): FleetTireSummary {
  const activeTires = tires.filter((t) => t.status === 'mounted');
  const count = activeTires.length;

  if (count === 0) {
    return {
      total_tires_active: 0,
      average_tread_depth_mm: '0.00',
      tires_below_safety_threshold: 0,
      tires_at_legal_limit: 0,
      active_tpms_alerts_count: 0,
      fleet_average_tire_cpk_mad: '0.0000',
      total_projected_tire_replacement_budget_mad: '0.00',
    };
  }

  let totalDepth = new Decimal('0.00');
  let belowSafetyCount = 0;
  let legalLimitCount = 0;
  let activeAlerts = 0;
  let totalCpk = new Decimal('0.00');
  let replacementBudget = new Decimal('0.00');

  for (const tire of activeTires) {
    const depth = new Decimal(tire.current_tread_depth_mm || '0');
    totalDepth = totalDepth.plus(depth);

    if (depth.lessThanOrEqualTo(LEGAL_MIN_TREAD_DEPTH_MM)) {
      legalLimitCount++;
      replacementBudget = replacementBudget.plus(DEFAULT_NEW_TIRE_COST_MAD);
    } else if (depth.lessThanOrEqualTo(SAFETY_THRESHOLD_TREAD_DEPTH_MM)) {
      belowSafetyCount++;
      replacementBudget = replacementBudget.plus(DEFAULT_NEW_TIRE_COST_MAD);
    }

    if (tire.latest_telematics?.alert_flags && tire.latest_telematics.alert_flags.length > 0) {
      const hasWarning = tire.latest_telematics.alert_flags.some((f) => f !== 'normal');
      if (hasWarning) activeAlerts++;
    }

    if (tire.metrics?.tire_cpk_mad) {
      totalCpk = totalCpk.plus(new Decimal(tire.metrics.tire_cpk_mad));
    }
  }

  const avgDepth = totalDepth.dividedBy(new Decimal(count)).toFixed(2);
  const avgCpk = totalCpk.dividedBy(new Decimal(count)).toFixed(4);

  return {
    total_tires_active: count,
    average_tread_depth_mm: avgDepth,
    tires_below_safety_threshold: belowSafetyCount,
    tires_at_legal_limit: legalLimitCount,
    active_tpms_alerts_count: activeAlerts,
    fleet_average_tire_cpk_mad: avgCpk,
    total_projected_tire_replacement_budget_mad: replacementBudget.toFixed(2),
  };
}
