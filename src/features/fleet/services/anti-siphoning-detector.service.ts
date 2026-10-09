import Decimal from 'decimal.js';
import type {
  AntiSiphoningDetectionInput,
  DetectedFuelAnomaly,
  FuelFraudAuditSummary,
  FuelReceiptData,
  TelematicsFuelDataPoint,
} from '../types/fuel-fraud.types';

type DecimalInstance = InstanceType<typeof Decimal>;

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Calculate Great-Circle Distance (Haversine formula in kilometers)
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number(new Decimal(R).times(c).toFixed(3));
}

export class AntiSiphoningDetectorService {
  /**
   * Main audit pipeline: analyzes telematics time-series and fuel receipts
   */
  public static analyzeFuelFraud(input: AntiSiphoningDetectionInput): FuelFraudAuditSummary {
    const incidents: DetectedFuelAnomaly[] = [];
    const defaultFuelPrice = new Decimal(input.truckConfig.fuelPricePerLiterMad || 14.0);

    // 1. Detect rapid siphoning events in telematics time-series
    const siphoningAnomalies = this.detectRapidSiphoning(input.dataPoints, defaultFuelPrice);
    incidents.push(...siphoningAnomalies);

    // 2. Audit receipts against truck tank capacity & sensor reality
    if (input.receipts && input.receipts.length > 0) {
      for (const receipt of input.receipts) {
        // Rule: Tank Capacity Overflow
        const overflow = this.checkTankOverflow(receipt, input.truckConfig.tankCapacityLiters);
        if (overflow) {
          incidents.push(overflow);
        }

        // Rule: Ghost Refueling & Tank Inflation
        const ghostRefuel = this.checkGhostRefueling(receipt, input.dataPoints, defaultFuelPrice);
        if (ghostRefuel) {
          incidents.push(ghostRefuel);
        }

        // Rule: Geofence Distance Check
        const geofenceAnomaly = this.checkGeofenceMismatch(receipt, input.dataPoints, defaultFuelPrice);
        if (geofenceAnomaly) {
          incidents.push(geofenceAnomaly);
        }
      }
    }

    // 3. Audit overall abnormal burn rate if trip distance is available
    const burnAnomaly = this.checkAbnormalBurnRate(
      input.dataPoints,
      input.truckConfig.standardRateL100km,
      defaultFuelPrice
    );
    if (burnAnomaly) {
      incidents.push(burnAnomaly);
    }

    // 4. Compute Aggregate Metrics with Decimal.js
    let totalLossLitersDec = new Decimal(0);
    let totalLossMadDec = new Decimal(0);
    let scoreDeduction = new Decimal(0);

    for (const incident of incidents) {
      totalLossLitersDec = totalLossLitersDec.plus(incident.detectedLossLiters);
      totalLossMadDec = totalLossMadDec.plus(incident.financialLossMad);

      // Score deduction by severity
      switch (incident.severity) {
        case 'critical':
          scoreDeduction = scoreDeduction.plus(40);
          break;
        case 'high':
          scoreDeduction = scoreDeduction.plus(25);
          break;
        case 'medium':
          scoreDeduction = scoreDeduction.plus(15);
          break;
        case 'low':
          scoreDeduction = scoreDeduction.plus(5);
          break;
      }
    }

    const baseline100 = new Decimal(100);
    const legitimacyScoreDec = Decimal.max(0, baseline100.minus(scoreDeduction));
    const overallRiskScoreDec = baseline100.minus(legitimacyScoreDec);

    return {
      isClean: incidents.length === 0,
      overallRiskScore: overallRiskScoreDec.toNumber(),
      receiptsLegitimacyScore: legitimacyScoreDec.toNumber(),
      totalLossLiters: Number(totalLossLitersDec.toFixed(2)),
      totalLossMad: Number(totalLossMadDec.toFixed(2)),
      incidents,
      auditedAt: new Date().toISOString(),
    };
  }

  /**
   * Rule 1: Rapid Fuel Drop (Siphoning Trigger)
   * Detects fuel level drops > 15.0 L in <= 10 minutes when speed = 0 or engine = OFF
   */
  private static detectRapidSiphoning(
    dataPoints: TelematicsFuelDataPoint[],
    defaultFuelPrice: DecimalInstance
  ): DetectedFuelAnomaly[] {
    const anomalies: DetectedFuelAnomaly[] = [];
    if (!dataPoints || dataPoints.length < 2) return anomalies;

    // Sort chronologically
    const sorted = [...dataPoints].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const SIPHON_THRESHOLD_LITERS = new Decimal(15.0);
    const MAX_DURATION_MS = 10 * 60 * 1000; // 10 minutes

    for (let i = 0; i < sorted.length - 1; i++) {
      const startPoint = sorted[i];
      const startTime = new Date(startPoint.timestamp).getTime();
      const startFuel = new Decimal(startPoint.fuelLevelLiters);

      for (let j = i + 1; j < sorted.length; j++) {
        const currentPoint = sorted[j];
        const currentTime = new Date(currentPoint.timestamp).getTime();
        const durationMs = currentTime - startTime;

        if (durationMs > MAX_DURATION_MS) {
          // Exceeded 10-minute window, move start pointer
          break;
        }

        const currentFuel = new Decimal(currentPoint.fuelLevelLiters);
        const fuelDrop = startFuel.minus(currentFuel);

        // Check conditions: fuel drop > 15L and vehicle stationary/engine off
        if (fuelDrop.greaterThan(SIPHON_THRESHOLD_LITERS)) {
          // Verify that during this window the truck was stationary or engine OFF
          const intermediatePoints = sorted.slice(i, j + 1);
          const isStationaryOrEngineOff = intermediatePoints.every(
            (p) => p.speedKmh === 0 || p.engineStatus === 'OFF'
          );

          if (isStationaryOrEngineOff) {
            const isCritical = fuelDrop.greaterThan(50);
            const financialLoss = fuelDrop.times(defaultFuelPrice);
            const dropDurationMinutes = new Decimal(durationMs).dividedBy(60000).toFixed(1);

            anomalies.push({
              incidentType: 'rapid_siphoning',
              severity: isCritical ? 'critical' : 'high',
              detectedLossLiters: Number(fuelDrop.toFixed(2)),
              financialLossMad: Number(financialLoss.toFixed(2)),
              confidenceScore: startPoint.engineStatus === 'OFF' ? 95 : 88,
              titleAr: 'رصد عملية شفط وسرقة وقود مفاجئة',
              titleFr: 'Détection de siphonage et vol rapide de carburant',
              titleEs: 'Detección de sifonaje y robo rápido de combustible',
              descriptionAr: `تم تسجيل هبوط مفاجئ في مستوى الوقود قدره ${fuelDrop.toFixed(1)} لتر خلال ${dropDurationMinutes} دقيقة أثناء توقف الشاحنة أو إطفاء المحرك.`,
              descriptionFr: `Chute brutale de carburant de ${fuelDrop.toFixed(1)} L en ${dropDurationMinutes} min alors que le camion est à l'arrêt ou moteur éteint.`,
              descriptionEs: `Caída brusca de combustible de ${fuelDrop.toFixed(1)} L en ${dropDurationMinutes} min con camión parado o motor apagado.`,
              gpsLatitude: currentPoint.latitude ?? startPoint.latitude,
              gpsLongitude: currentPoint.longitude ?? startPoint.longitude,
              locationName: currentPoint.latitude
                ? `GPS: ${currentPoint.latitude.toFixed(4)}, ${currentPoint.longitude?.toFixed(4)}`
                : undefined,
              snapshot: {
                startFuelLiters: startPoint.fuelLevelLiters,
                endFuelLiters: currentPoint.fuelLevelLiters,
                dropLiters: fuelDrop.toNumber(),
                durationMinutes: Number(dropDurationMinutes),
                startTimestamp: startPoint.timestamp,
                endTimestamp: currentPoint.timestamp,
                engineStatus: currentPoint.engineStatus,
              },
            });

            // Fast forward outer loop to avoid duplicate reporting of same window
            i = j;
            break;
          }
        }
      }
    }

    return anomalies;
  }

  /**
   * Rule 2: Tank Capacity Overflow Guard
   * Receipt volume exceeds truck's total fuel tank capacity
   */
  private static checkTankOverflow(
    receipt: FuelReceiptData,
    tankCapacityLiters: number
  ): DetectedFuelAnomaly | null {
    const receiptLiters = new Decimal(receipt.liters);
    const capacity = new Decimal(tankCapacityLiters);

    if (receiptLiters.greaterThan(capacity)) {
      const excessLiters = receiptLiters.minus(capacity);
      const unitPrice = new Decimal(receipt.unitPrice || 14.0);
      const financialLoss = excessLiters.times(unitPrice);

      return {
        incidentType: 'tank_overflow',
        severity: 'critical',
        detectedLossLiters: Number(excessLiters.toFixed(2)),
        financialLossMad: Number(financialLoss.toFixed(2)),
        confidenceScore: 98,
        titleAr: 'تجاوز السعة القصوى لخزان الوقود (فاتورة وهمية أو تعبئة خارجية)',
        titleFr: 'Dépassement de la capacité maximale du réservoir (Plein fictif)',
        titleEs: 'Exceso de capacidad máxima del depósito (Factura ficticia)',
        descriptionAr: `الكمية المفوترة في المحطة (${receiptLiters.toFixed(1)} لتر) تتجاوز سعة خزان الشاحنة القصوى (${capacity.toFixed(0)} لتر) بفارق ${excessLiters.toFixed(1)} لتر.`,
        descriptionFr: `Le volume facturé (${receiptLiters.toFixed(1)} L) dépasse la capacité maximale (${capacity.toFixed(0)} L) de ${excessLiters.toFixed(1)} L.`,
        descriptionEs: `El volumen facturado (${receiptLiters.toFixed(1)} L) supera la capacidad máxima (${capacity.toFixed(0)} L) en ${excessLiters.toFixed(1)} L.`,
        gpsLatitude: receipt.stationLatitude,
        gpsLongitude: receipt.stationLongitude,
        locationName: receipt.stationName,
        snapshot: {
          receiptId: receipt.receiptId,
          receiptLiters: receipt.liters,
          tankCapacityLiters,
          excessLiters: excessLiters.toNumber(),
          stationName: receipt.stationName,
          timestamp: receipt.timestamp,
        },
      };
    }

    return null;
  }

  /**
   * Rule 3: Ghost Refueling & Tank Inflow Inflation
   * Receipt volume vs. Actual sensor level delta (>= 12% discrepancy or no inflow)
   */
  private static checkGhostRefueling(
    receipt: FuelReceiptData,
    dataPoints: TelematicsFuelDataPoint[],
    defaultFuelPrice: DecimalInstance
  ): DetectedFuelAnomaly | null {
    if (!dataPoints || dataPoints.length === 0) return null;

    const receiptTime = new Date(receipt.timestamp).getTime();
    if (isNaN(receiptTime)) return null;

    const WINDOW_MS = 45 * 60 * 1000; // ± 45 minutes around receipt timestamp
    const relevantPoints = dataPoints.filter((p) => {
      const t = new Date(p.timestamp).getTime();
      return Math.abs(t - receiptTime) <= WINDOW_MS;
    });

    const receiptLiters = new Decimal(receipt.liters);
    const unitPrice = new Decimal(receipt.unitPrice || defaultFuelPrice);

    if (relevantPoints.length === 0) {
      // No sensor telemetry in window, can't verify refuel
      return null;
    }

    // Determine max fuel level jump within window
    let minFuel = new Decimal(relevantPoints[0].fuelLevelLiters);
    let maxFuel = new Decimal(relevantPoints[0].fuelLevelLiters);

    for (const p of relevantPoints) {
      const fl = new Decimal(p.fuelLevelLiters);
      if (fl.lessThan(minFuel)) minFuel = fl;
      if (fl.greaterThan(maxFuel)) maxFuel = fl;
    }

    const actualInflow = maxFuel.minus(minFuel);

    // Case A: No fuel inflow at all was detected by sensor
    if (actualInflow.lessThan(5)) {
      const financialLoss = receiptLiters.times(unitPrice);
      return {
        incidentType: 'ghost_refueling',
        severity: 'critical',
        detectedLossLiters: Number(receiptLiters.toFixed(2)),
        financialLossMad: Number(financialLoss.toFixed(2)),
        confidenceScore: 94,
        titleAr: 'تزود وهمي بالوقود (Ghost Refueling) - عدم استشعار أي دخول للوقود',
        titleFr: 'Plein fictif (Ghost Refueling) - Aucun afflux de carburant détecté',
        titleEs: 'Repostaje ficticio (Ghost Refueling) - Sin entrada de combustible detectada',
        descriptionAr: `تمت فوترة ${receiptLiters.toFixed(1)} لتر في محطة (${receipt.stationName}) دون رصد أي زيادة في خزان الشاحنة بواسطة الحساسات.`,
        descriptionFr: `Facturation de ${receiptLiters.toFixed(1)} L à la station (${receipt.stationName}) sans aucune hausse de niveau détectée par la télématique.`,
        descriptionEs: `Facturación de ${receiptLiters.toFixed(1)} L en la estación (${receipt.stationName}) sin aumento de nivel detectado por sensores.`,
        gpsLatitude: receipt.stationLatitude,
        gpsLongitude: receipt.stationLongitude,
        locationName: receipt.stationName,
        snapshot: {
          receiptId: receipt.receiptId,
          receiptLiters: receipt.liters,
          actualInflowLiters: actualInflow.toNumber(),
          windowDataPointsCount: relevantPoints.length,
          timestamp: receipt.timestamp,
        },
      };
    }

    // Case B: Inflow inflation >= 12%
    // If actualInflow / receiptLiters < 0.88, e.g. billed 400L, only 300L reached tank
    const inflowRatio = actualInflow.dividedBy(receiptLiters);
    if (inflowRatio.lessThan(0.88)) {
      const missingLiters = receiptLiters.minus(actualInflow);
      const financialLoss = missingLiters.times(unitPrice);
      const discrepancyPercent = new Decimal(1).minus(inflowRatio).times(100).toFixed(1);

      return {
        incidentType: 'ghost_refueling',
        severity: 'high',
        detectedLossLiters: Number(missingLiters.toFixed(2)),
        financialLossMad: Number(financialLoss.toFixed(2)),
        confidenceScore: 89,
        titleAr: 'تضخيم كمية الوقود المفوترة (فارق استشعار الخزان > 12%)',
        titleFr: 'Surfacturation de carburant (Écart capteur > 12%)',
        titleEs: 'Sobrefacturación de combustible (Discrepancia sensor > 12%)',
        descriptionAr: `الكمية المفوترة (${receiptLiters.toFixed(1)} لتر) تزيد بنسبة ${discrepancyPercent}% عن الكمية الحقيقية التي دخلت الخزان (${actualInflow.toFixed(1)} لتر) بفارق ${missingLiters.toFixed(1)} لتر.`,
        descriptionFr: `Volume facturé (${receiptLiters.toFixed(1)} L) supérieur de ${discrepancyPercent}% au carburant réel injecté (${actualInflow.toFixed(1)} L).`,
        descriptionEs: `Volumen facturado (${receiptLiters.toFixed(1)} L) superior en un ${discrepancyPercent}% al combustible real inyectado (${actualInflow.toFixed(1)} L).`,
        gpsLatitude: receipt.stationLatitude,
        gpsLongitude: receipt.stationLongitude,
        locationName: receipt.stationName,
        snapshot: {
          receiptId: receipt.receiptId,
          receiptLiters: receipt.liters,
          actualInflowLiters: actualInflow.toNumber(),
          missingLiters: missingLiters.toNumber(),
          discrepancyPercent: Number(discrepancyPercent),
          timestamp: receipt.timestamp,
        },
      };
    }

    return null;
  }

  /**
   * Rule 4: Geofence Distance Check (500m threshold)
   * Distance between fuel station coordinates and truck's actual GPS position > 500m
   */
  private static checkGeofenceMismatch(
    receipt: FuelReceiptData,
    dataPoints: TelematicsFuelDataPoint[],
    defaultFuelPrice: DecimalInstance
  ): DetectedFuelAnomaly | null {
    if (
      receipt.stationLatitude === undefined ||
      receipt.stationLongitude === undefined ||
      !dataPoints ||
      dataPoints.length === 0
    ) {
      return null;
    }

    const receiptTime = new Date(receipt.timestamp).getTime();
    if (isNaN(receiptTime)) return null;

    // Find truck position closest to receipt timestamp
    let closestPoint: TelematicsFuelDataPoint | null = null;
    let minTimeDiff = Infinity;

    for (const p of dataPoints) {
      if (p.latitude !== undefined && p.longitude !== undefined) {
        const diff = Math.abs(new Date(p.timestamp).getTime() - receiptTime);
        if (diff < minTimeDiff) {
          minTimeDiff = diff;
          closestPoint = p;
        }
      }
    }

    // Must be within 45 minutes of receipt
    if (!closestPoint || minTimeDiff > 45 * 60 * 1000) return null;

    const distanceKm = calculateHaversineDistanceKm(
      receipt.stationLatitude,
      receipt.stationLongitude,
      closestPoint.latitude!,
      closestPoint.longitude!
    );

    // Threshold: 500 meters (0.500 km)
    if (distanceKm > 0.5) {
      const receiptLiters = new Decimal(receipt.liters);
      const unitPrice = new Decimal(receipt.unitPrice || defaultFuelPrice);
      const financialLoss = receiptLiters.times(unitPrice);
      const isCritical = distanceKm > 5.0;

      return {
        incidentType: 'geofence_mismatch',
        severity: isCritical ? 'critical' : 'high',
        detectedLossLiters: Number(receiptLiters.toFixed(2)),
        financialLossMad: Number(financialLoss.toFixed(2)),
        confidenceScore: isCritical ? 95 : 88,
        titleAr: 'تضارب الموقع الجغرافي لمحطة التزود (Geofence Mismatch > 500m)',
        titleFr: 'Incohérence géographique de la station (Écart > 500m)',
        titleEs: 'Discrepancia geográfica de la estación (Desviación > 500m)',
        descriptionAr: `المسافة بين موقع المحطة المذكورة في الوصل وإحداثيات الشاحنة الفعلية هي ${distanceKm.toFixed(2)} كم، وهو ما يتجاوز الحد المسموح به (500 متر).`,
        descriptionFr: `La distance entre la station et la position réelle du camion est de ${distanceKm.toFixed(2)} km (seuil maximal : 500 m).`,
        descriptionEs: `La distancia entre la estación y la posición real del camión es de ${distanceKm.toFixed(2)} km (umbral máximo: 500 m).`,
        gpsLatitude: closestPoint.latitude,
        gpsLongitude: closestPoint.longitude,
        locationName: `${receipt.stationName} (Farthest: ${distanceKm.toFixed(2)}km)`,
        snapshot: {
          receiptId: receipt.receiptId,
          stationLatitude: receipt.stationLatitude,
          stationLongitude: receipt.stationLongitude,
          truckLatitude: closestPoint.latitude,
          truckLongitude: closestPoint.longitude,
          distanceKm,
          stationName: receipt.stationName,
          timestamp: receipt.timestamp,
        },
      };
    }

    return null;
  }

  /**
   * Rule 5: Abnormal Burn Rate
   * Compares consumption rate L/100km to truck's configured standard rate
   */
  private static checkAbnormalBurnRate(
    dataPoints: TelematicsFuelDataPoint[],
    standardRateL100km: number,
    defaultFuelPrice: DecimalInstance
  ): DetectedFuelAnomaly | null {
    if (!dataPoints || dataPoints.length < 5) return null;

    const sorted = [...dataPoints].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    if (first.odometerKm === undefined || last.odometerKm === undefined) return null;

    const distanceTraveled = new Decimal(last.odometerKm).minus(first.odometerKm);
    if (distanceTraveled.lessThan(50)) return null; // Minimum 50 km for statistical significance

    // Sum fuel drops while moving
    let totalConsumedLiters = new Decimal(0);
    for (let i = 0; i < sorted.length - 1; i++) {
      const p1 = sorted[i];
      const p2 = sorted[i + 1];
      if (p1.speedKmh > 0 && p1.fuelLevelLiters > p2.fuelLevelLiters) {
        totalConsumedLiters = totalConsumedLiters.plus(
          new Decimal(p1.fuelLevelLiters).minus(p2.fuelLevelLiters)
        );
      }
    }

    if (totalConsumedLiters.isZero()) return null;

    // Actual rate = (consumed / distance) * 100
    const actualRate = totalConsumedLiters.dividedBy(distanceTraveled).times(100);
    const standardRate = new Decimal(standardRateL100km || 36.0);
    const burnThreshold = standardRate.times(1.3); // 30% above normal

    if (actualRate.greaterThan(burnThreshold)) {
      const excessRate = actualRate.minus(standardRate);
      const excessLiters = excessRate.times(distanceTraveled).dividedBy(100);
      const financialLoss = excessLiters.times(defaultFuelPrice);

      return {
        incidentType: 'abnormal_burn_rate',
        severity: 'medium',
        detectedLossLiters: Number(excessLiters.toFixed(2)),
        financialLossMad: Number(financialLoss.toFixed(2)),
        confidenceScore: 78,
        titleAr: 'معدل استهلاك وقود مرتفع بشكل غير طبيعي أثناء السير (> 30%)',
        titleFr: 'Taux de consommation anormalement élevé en circulation (> 30%)',
        titleEs: 'Tasa de consumo anormalmente alta en ruta (> 30%)',
        descriptionAr: `معدل الاستهلاك الفعلي هو ${actualRate.toFixed(1)} لتر/100كم وهو أعلى بنسبة ${actualRate.minus(standardRate).dividedBy(standardRate).times(100).toFixed(0)}% من المعدل القياسي للشاحنة (${standardRate.toFixed(1)} لتر/100كم).`,
        descriptionFr: `Consommation réelle de ${actualRate.toFixed(1)} L/100km, supérieure de plus de 30% à la norme (${standardRate.toFixed(1)} L/100km).`,
        descriptionEs: `Consumo real de ${actualRate.toFixed(1)} L/100km, superior en más del 30% a la norma (${standardRate.toFixed(1)} L/100km).`,
        gpsLatitude: last.latitude,
        gpsLongitude: last.longitude,
        snapshot: {
          distanceTraveledKm: distanceTraveled.toNumber(),
          totalConsumedLiters: totalConsumedLiters.toNumber(),
          actualRateL100km: Number(actualRate.toFixed(2)),
          standardRateL100km: Number(standardRate.toFixed(2)),
        },
      };
    }

    return null;
  }
}
