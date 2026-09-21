import Decimal from 'decimal.js';
import type { Truck, Trailer, TruckMaintenance } from '@/types/database';
import type { RawTripOrderWithRelations } from '@/features/analytics/services/corridor-comparison.service';
import type {
  FleetPredictiveSummary,
  TireWearResult,
  ReeferHealthResult,
  EngineOilHealthResult,
  AlertSeverity,
} from '../types/predictive-engine.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// Reference constants
const TIRE_RATING_LIMIT_KM = new Decimal(120000);
const TIRE_WARNING_THRESHOLD_PERCENT = new Decimal(75);
const TIRE_CRITICAL_THRESHOLD_PERCENT = new Decimal(90);

const CORRIDOR_FACTORS = {
  european_maritime: new Decimal(1.0),
  african_overland: new Decimal(1.4),
  domestic: new Decimal(1.1),
};

const REEFER_SERVICE_INTERVAL_HOURS = new Decimal(1500);
const OIL_CHANGE_BASE_INTERVAL_KM = new Decimal(40000);
const BASELINE_FUEL_BURN_RATE = new Decimal(36.0); // 36.0 L/100km

function resolveCorridorType(trip: RawTripOrderWithRelations): 'european_maritime' | 'african_overland' | 'domestic' {
  if (trip.corridor_type) {
    return trip.corridor_type;
  }
  const routeLower = (trip.route || '').toLowerCase();
  if (
    routeLower.includes('dakar') ||
    routeLower.includes('nouadhibou') ||
    routeLower.includes('nouakchott') ||
    routeLower.includes('guerguerat') ||
    routeLower.includes('rosso') ||
    routeLower.includes('senegal') ||
    routeLower.includes('mauritania')
  ) {
    return 'african_overland';
  }
  if (
    routeLower.includes('algeciras') ||
    routeLower.includes('almeria') ||
    routeLower.includes('motril') ||
    routeLower.includes('valencia') ||
    routeLower.includes('barcelona') ||
    routeLower.includes('perpignan') ||
    routeLower.includes('spain') ||
    routeLower.includes('france')
  ) {
    return 'european_maritime';
  }
  return 'african_overland';
}

/**
 * Computes Tire Wear Index (TWI) for a truck across historical trip orders.
 */
export function computeTruckTireWear(
  truck: Truck,
  truckTrips: RawTripOrderWithRelations[]
): TireWearResult {
  let accumulatedKmDec = new Decimal(0);
  let weightedKmDec = new Decimal(0);

  for (const trip of truckTrips) {
    const corridor = resolveCorridorType(trip);
    const roadDist = new Decimal(
      trip.road_distance_km || (corridor === 'european_maritime' ? 1850 : 2800)
    );
    const factor = CORRIDOR_FACTORS[corridor] || CORRIDOR_FACTORS.domestic;

    accumulatedKmDec = accumulatedKmDec.plus(roadDist);
    weightedKmDec = weightedKmDec.plus(roadDist.times(factor));
  }

  // Calculate TWI %
  const twiDec = weightedKmDec
    .dividedBy(TIRE_RATING_LIMIT_KM)
    .times(100);

  const twiPercentage = Number(twiDec.toFixed(1));
  let status: AlertSeverity = 'normal';
  let allowedLongHaul = true;
  let actionAr = 'حالة الإطارات ممتازة وضمن المعايير الآمنة';
  let actionFr = 'État des pneus excellent, conforme aux normes';
  let actionEs = 'Excelente estado de neumáticos, cumple con los estándares';

  if (twiDec.greaterThanOrEqualTo(TIRE_CRITICAL_THRESHOLD_PERCENT)) {
    status = 'critical';
    allowedLongHaul = false;
    actionAr = 'حظر فوري للمسافات الطويلة - تجاوز عتبة التآكل الحرجة (≥90%). يلزم استبدال الإطارات فوراً';
    actionFr = 'Interdiction longs trajets - Usure critique (≥90%). Remplacement immédiat requis';
    actionEs = 'Prohibido viajes largos - Desgaste crítico (≥90%). Reemplazo inmediato requerido';
  } else if (twiDec.greaterThanOrEqualTo(TIRE_WARNING_THRESHOLD_PERCENT)) {
    status = 'warning';
    allowedLongHaul = true;
    actionAr = 'تنبيه استباقي (≥75%) - فحص عمق المداس وضبط التوازي وضغط الهواء في أقرب ورشة';
    actionFr = 'Alerte préventive (≥75%) - Contrôle de la bande de roulement et du parallélisme';
    actionEs = 'Alerta preventiva (≥75%) - Control de la banda de rodadura y alineación';
  }

  return {
    truckId: truck.id,
    plateNumber: truck.plate_number,
    model: truck.model,
    accumulatedKm: Math.round(accumulatedKmDec.toNumber()),
    weightedKm: Math.round(weightedKmDec.toNumber()),
    twiPercentage,
    status,
    allowedLongHaul,
    recommendedActionAr: actionAr,
    recommendedActionFr: actionFr,
    recommendedActionEs: actionEs,
  };
}

/**
 * Computes Reefer Degradation Score (Frigo SDI) for refrigerated semi-trailers.
 */
export function computeReeferHealth(
  trailer: Trailer,
  trailerTrips: RawTripOrderWithRelations[],
  tempDriftEventsCount: number = 0
): ReeferHealthResult {
  // Compute operating hours based on trip duration (avg 50 km/h) + pre-cooling standby (4h per trip)
  let totalHoursDec = new Decimal(0);

  for (const trip of trailerTrips) {
    const corridor = resolveCorridorType(trip);
    const roadDist = new Decimal(
      trip.road_distance_km || (corridor === 'european_maritime' ? 1850 : 2800)
    );
    const driveHours = roadDist.dividedBy(50); // 50 km/h average transit speed
    const standbyHours = new Decimal(4); // 4 hours standby cooling per trip
    totalHoursDec = totalHoursDec.plus(driveHours).plus(standbyHours);
  }

  // Base degradation from engine hours: (Hours / 1500) * 40
  const hoursUsageRatio = totalHoursDec.dividedBy(REEFER_SERVICE_INTERVAL_HOURS);
  const degradationFromHours = hoursUsageRatio.times(40);

  // Penalty from temperature drift events (>2°C for >45 min): 5 points each
  const driftPenaltyDec = new Decimal(tempDriftEventsCount).times(5);

  const totalPenaltyDec = degradationFromHours.plus(driftPenaltyDec);
  let healthScoreDec = new Decimal(100).minus(totalPenaltyDec);

  if (healthScoreDec.lessThan(0)) healthScoreDec = new Decimal(0);
  if (healthScoreDec.greaterThan(100)) healthScoreDec = new Decimal(100);

  const healthScore = Math.round(healthScoreDec.toNumber());
  let status: 'optimal' | 'service_due' | 'high_risk' = 'optimal';
  let actionAr = 'وحدة التبريد في حالة ممتازة (-19°C / +4°C) وجاهزة لشحنات الأسماك والفواكه';
  let actionFr = 'Unité frigorifique optimale (-19°C / +4°C), prête pour l’export';
  let actionEs = 'Unidad frigorífica óptima (-19°C / +4°C), lista para exportación';

  if (healthScore < 50) {
    status = 'high_risk';
    actionAr = 'خطر تدهور شحنة التبريد - صيانة ضاغط الفريون والمروحة قبل تحميل أي بضائع حساسة';
    actionFr = 'Risque élevé de rupture chaîne du froid - Maintenance compresseur requise d’urgence';
    actionEs = 'Alto riesgo de rotura de cadena de frío - Mantenimiento urgente del compresor';
  } else if (healthScore <= 80) {
    status = 'service_due';
    actionAr = 'موعد الصيانة الدورية وشيك - مراجعة فلاتر الهواء وغاز التبريد وحساسات الحرارة';
    actionFr = 'Entretien périodique recommandé - Vérification du gaz frigorigène et filtres';
    actionEs = 'Mantenimiento periódico recomendado - Verificación de gas refrigerante y filtros';
  }

  return {
    trailerId: trailer.id,
    plateNumber: trailer.plate_number,
    reeferModel: trailer.model || 'Carrier Vector 1550 / Thermo King SLXi',
    engineHours: Math.round(totalHoursDec.toNumber()),
    serviceIntervalHours: REEFER_SERVICE_INTERVAL_HOURS.toNumber(),
    tempDriftCount: tempDriftEventsCount,
    tempDriftPenalty: Math.round(driftPenaltyDec.toNumber()),
    healthScore,
    status,
    recommendedActionAr: actionAr,
    recommendedActionFr: actionFr,
    recommendedActionEs: actionEs,
  };
}

/**
 * Computes Engine Oil & Service Degradation factoring in fuel burn intensity.
 */
export function computeEngineOilHealth(
  truck: Truck,
  truckTrips: RawTripOrderWithRelations[],
  lastOilMaintenance?: TruckMaintenance
): EngineOilHealthResult {
  // Sum distance since last maintenance date or all trips
  let kmSinceLastDec = new Decimal(0);
  const lastDate = lastOilMaintenance?.date || lastOilMaintenance?.maintenance_date;

  for (const trip of truckTrips) {
    if (lastDate && trip.departure_date && new Date(trip.departure_date) <= new Date(lastDate)) {
      continue;
    }
    const corridor = resolveCorridorType(trip);
    const roadDist = new Decimal(
      trip.road_distance_km || (corridor === 'european_maritime' ? 1850 : 2800)
    );
    kmSinceLastDec = kmSinceLastDec.plus(roadDist);
  }

  // Fuel burn factor: if truck burns more fuel, engine oil degrades faster
  const truckRateDec = truck.fuel_consumption_rate
    ? new Decimal(truck.fuel_consumption_rate)
    : BASELINE_FUEL_BURN_RATE;

  // Factor: actual / 36.0 (e.g. 39.6 / 36 = 1.1)
  const fuelFactorDec = truckRateDec.dividedBy(BASELINE_FUEL_BURN_RATE);
  const effectiveIntervalDec = OIL_CHANGE_BASE_INTERVAL_KM.dividedBy(fuelFactorDec);

  const degradationDec = kmSinceLastDec
    .dividedBy(effectiveIntervalDec)
    .times(100);

  const degradationPercentage = Number(degradationDec.toFixed(1));
  let status: 'optimal' | 'due_soon' | 'overdue' = 'optimal';
  let actionAr = 'الزيت وفلاتر المحرك في حالة تشغيلية آمنة ومستقرة';
  let actionFr = 'Huile moteur et filtres en état optimal';
  let actionEs = 'Aceite del motor y filtros en estado óptimo';

  if (degradationDec.greaterThanOrEqualTo(90)) {
    status = 'overdue';
    actionAr = 'تجاوز فترة تغيير الزيت الحرجة - يلزم إدخال الشاحنة للورشة لتغيير الزيت وفلتر الديزل فوراً';
    actionFr = 'Vidange moteur en retard - Remplacement immédiat huile et filtres requis';
    actionEs = 'Cambio de aceite vencido - Reemplazo urgente de aceite y filtros necesario';
  } else if (degradationDec.greaterThanOrEqualTo(70)) {
    status = 'due_soon';
    actionAr = 'موعد تغيير الزيت قريب - جدولة الصيانة خلال الأسبوع القادم أو قبل الرحلة القادمة';
    actionFr = 'Vidange moteur imminente - Planifier l’entretien sous 7 jours';
    actionEs = 'Cambio de aceite próximo - Programar mantenimiento en los próximos 7 días';
  }

  return {
    truckId: truck.id,
    plateNumber: truck.plate_number,
    kmSinceLastService: Math.round(kmSinceLastDec.toNumber()),
    effectiveIntervalKm: Math.round(effectiveIntervalDec.toNumber()),
    fuelBurnFactor: Number(fuelFactorDec.toFixed(2)),
    degradationPercentage,
    status,
    recommendedActionAr: actionAr,
    recommendedActionFr: actionFr,
    recommendedActionEs: actionEs,
  };
}

/**
 * Aggregates complete Fleet Health summary.
 */
export function computeFleetPredictiveHealth(
  trucks: Truck[],
  trailers: Trailer[],
  trips: RawTripOrderWithRelations[],
  maintenanceList: TruckMaintenance[]
): FleetPredictiveSummary {
  const tripsByTruck = new Map<number, RawTripOrderWithRelations[]>();
  const tripsByTrailer = new Map<number, RawTripOrderWithRelations[]>();

  trips.forEach((tr) => {
    if (tr.truck_id) {
      const arr = tripsByTruck.get(tr.truck_id) || [];
      arr.push(tr);
      tripsByTruck.set(tr.truck_id, arr);
    }
    if (tr.trailer_id) {
      const arr = tripsByTrailer.get(tr.trailer_id) || [];
      arr.push(tr);
      tripsByTrailer.set(tr.trailer_id, arr);
    }
  });

  const lastOilMaintenanceByTruck = new Map<number, TruckMaintenance>();
  maintenanceList.forEach((m) => {
    const mType = (m.type || m.expense_type || '').toLowerCase();
    if (mType.includes('oil') || mType.includes('vidange') || mType.includes('service') || mType.includes('revision')) {
      const prev = lastOilMaintenanceByTruck.get(m.truck_id);
      const mDate = m.date || m.maintenance_date;
      const prevDate = prev?.date || prev?.maintenance_date;
      if (!prev || (mDate && prevDate && new Date(mDate) > new Date(prevDate))) {
        lastOilMaintenanceByTruck.set(m.truck_id, m);
      }
    }
  });

  const tireResults: TireWearResult[] = [];
  const engineResults: EngineOilHealthResult[] = [];

  for (const truck of trucks) {
    const truckTrips = tripsByTruck.get(truck.id) || [];
    tireResults.push(computeTruckTireWear(truck, truckTrips));
    engineResults.push(
      computeEngineOilHealth(truck, truckTrips, lastOilMaintenanceByTruck.get(truck.id))
    );
  }

  const reeferResults: ReeferHealthResult[] = [];
  for (const trailer of trailers) {
    const trailerTrips = tripsByTrailer.get(trailer.id) || [];
    reeferResults.push(computeReeferHealth(trailer, trailerTrips));
  }

  const criticalTires = tireResults.filter((t) => t.status === 'critical').length;
  const warningTires = tireResults.filter((t) => t.status === 'warning').length;
  const criticalReefers = reeferResults.filter((r) => r.status === 'high_risk').length;
  const overdueEngines = engineResults.filter((e) => e.status === 'overdue').length;

  // Overall Health Score: 100 minus penalties
  let overallScoreDec = new Decimal(100);
  overallScoreDec = overallScoreDec
    .minus(new Decimal(criticalTires).times(15))
    .minus(new Decimal(warningTires).times(5))
    .minus(new Decimal(criticalReefers).times(15))
    .minus(new Decimal(overdueEngines).times(10));

  if (overallScoreDec.lessThan(20)) overallScoreDec = new Decimal(20);
  if (overallScoreDec.greaterThan(100)) overallScoreDec = new Decimal(100);

  return {
    overallFleetHealthScore: Math.round(overallScoreDec.toNumber()),
    totalTrucksAudited: trucks.length,
    criticalTireCount: criticalTires,
    warningTireCount: warningTires,
    criticalReeferCount: criticalReefers,
    oilServiceDueCount: overdueEngines,
    tires: tireResults,
    reefers: reeferResults,
    engines: engineResults,
  };
}

