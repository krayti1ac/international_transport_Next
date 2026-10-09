/**
 * Trans Bodanon TMS — Reefer Sensor Calibration & ATP Recertification Service
 * Standards: EN 12830 / ATP Agreement (FRC / FRA / FNA)
 * Strict Decimal.js calculations for drift tolerances and compliance health
 */

import Decimal from 'decimal.js';
import type {
  AtpClassType,
  AtpCertificationStatus,
  ExpiryWarningLevel,
  PreTripReeferComplianceCheck,
  ReeferAtpCertification,
  ReeferCalibrationRadarSummary,
  ReeferSensorCalibrationLog,
} from '../types/reefer-calibration.types';

// Strict decimal precision configuration
Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export class ReeferCalibrationService {
  /**
   * Maximum allowed drift tolerance in °C under EN 12830 standard
   */
  public static readonly MAX_ALLOWED_DRIFT_CELSIUS = new Decimal('0.50');

  /**
   * Maximum allowed K-Value (W/m²·K) for FRC reinforced insulation
   */
  public static readonly MAX_K_VALUE_FRC = new Decimal('0.400');

  /**
   * Maximum allowed K-Value (W/m²·K) for standard insulation FNA
   */
  public static readonly MAX_K_VALUE_FNA = new Decimal('0.700');

  /**
   * Calculate drift delta between sensor reading and certified reference standard
   * Formula: measuredTemp - referenceTemp
   */
  public static calculateDriftDelta(
    measuredTemp: number | string,
    referenceTemp: number | string
  ): { driftDelta: number; isPassed: boolean } {
    const measured = new Decimal(measuredTemp);
    const reference = new Decimal(referenceTemp);
    const delta = measured.minus(reference).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const isPassed = delta.abs().lessThanOrEqualTo(this.MAX_ALLOWED_DRIFT_CELSIUS);

    return {
      driftDelta: delta.toNumber(),
      isPassed,
    };
  }

  /**
   * Evaluate thermal insulation K-Value compliance per ATP classification
   */
  public static evaluateKValueCompliance(
    atpType: AtpClassType,
    kValue: number | string
  ): { isCompliant: boolean; maxThreshold: number; message: string } {
    const val = new Decimal(kValue);
    const threshold = atpType === 'FRC' || atpType === 'FRA' ? this.MAX_K_VALUE_FRC : this.MAX_K_VALUE_FNA;
    const isCompliant = val.lessThanOrEqualTo(threshold);

    return {
      isCompliant,
      maxThreshold: threshold.toNumber(),
      message: isCompliant
        ? `معامل العزل ممتاز (${val.toFixed(3)} W/m²·K ≤ ${threshold.toFixed(2)})`
        : `معامل العزل غير مطابق لمواصفات ${atpType} (${val.toFixed(3)} > ${threshold.toFixed(2)} W/m²·K)`,
    };
  }

  /**
   * Compute days remaining and warning level for an expiry date
   */
  public static evaluateExpiry(
    targetDateIso: string,
    now: Date = new Date()
  ): { daysRemaining: number; warningLevel: ExpiryWarningLevel; status: AtpCertificationStatus } {
    const target = new Date(targetDateIso);
    const diffMs = target.getTime() - now.getTime();
    const daysRemaining = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
      return { daysRemaining, warningLevel: 'expired', status: 'expired' };
    }
    if (daysRemaining <= 7) {
      return { daysRemaining, warningLevel: 'critical_7d', status: 'expiring_soon' };
    }
    if (daysRemaining <= 30) {
      return { daysRemaining, warningLevel: 'urgent_30d', status: 'expiring_soon' };
    }
    if (daysRemaining <= 60) {
      return { daysRemaining, warningLevel: 'notice_60d', status: 'valid' };
    }
    return { daysRemaining, warningLevel: 'safe', status: 'valid' };
  }

  /**
   * Pre-Trip Gatekeeper: Rigorous multi-point compliance check for trailer before loading
   */
  public static evaluatePreTripCompliance(
    trailerId: number,
    trailerPlate: string,
    atpCert: ReeferAtpCertification | null,
    calibrationLogs: ReeferSensorCalibrationLog[]
  ): PreTripReeferComplianceCheck {
    const blockingReasons: string[] = [];
    const warnings: string[] = [];

    // 1. Check ATP Certification
    if (!atpCert) {
      blockingReasons.push('المقطورة لا تملك شهادة اعتماد ميثاق ATP مسجلة في النظام');
    } else {
      const atpEval = this.evaluateExpiry(atpCert.expiryDate);
      if (atpEval.status === 'expired' || atpCert.status === 'expired' || atpCert.status === 'suspended') {
        blockingReasons.push(
          `شهادة ميثاق ATP منتهية الصلاحية (${atpCert.certificateNumber}) - يمنع الشحن المبرد الدولي منعاً باتاً`
        );
      } else if (atpEval.warningLevel === 'critical_7d') {
        warnings.push(`شهادة ATP قاربت على الانتهاء خلال ${atpEval.daysRemaining} أيام (${atpCert.certificateNumber})`);
      }

      // K-Value validation
      const kEval = this.evaluateKValueCompliance(atpCert.atpType, atpCert.kValue);
      if (!kEval.isCompliant) {
        warnings.push(`تنبيه: نفاذية العزل الحراري K-Value متدهورة (${atpCert.kValue} W/m²·K)`);
      }
    }

    // 2. Check Sensor Calibration Logs (EN 12830)
    let sensorCalibrationStatus: 'passed' | 'due' | 'overdue' | 'drift_fail' = 'passed';

    if (calibrationLogs.length === 0) {
      sensorCalibrationStatus = 'due';
      blockingReasons.push('لم يتم العثور على أي سجل معايرة معتمد لحساسات التبريد (EN 12830)');
    } else {
      // Must check both supply and return probes if present
      for (const log of calibrationLogs) {
        if (!log.isPassed || Math.abs(log.driftDelta) > this.MAX_ALLOWED_DRIFT_CELSIUS.toNumber()) {
          sensorCalibrationStatus = 'drift_fail';
          blockingReasons.push(
            `فشل معايرة الحساس (${log.sensorType}): انحراف القراءة (${log.driftDelta > 0 ? `+${log.driftDelta}` : log.driftDelta}°C) يتجاوز الحد المسموح (±0.5°C)`
          );
        }

        const logExpiry = this.evaluateExpiry(log.nextDueDate);
        if (logExpiry.status === 'expired') {
          sensorCalibrationStatus = 'overdue';
          blockingReasons.push(
            `انتهت صلاحية المعايرة السنوية للحساس (${log.sensorType}) منذ ${Math.abs(logExpiry.daysRemaining)} يوماً`
          );
        } else if (logExpiry.warningLevel === 'critical_7d') {
          warnings.push(`المعايرة السنوية للحساس (${log.sensorType}) تستحق التجديد خلال ${logExpiry.daysRemaining} أيام`);
        }
      }
    }

    const isClearedForDispatch = blockingReasons.length === 0;

    return {
      trailerId,
      trailerPlate,
      isClearedForDispatch,
      atpStatus: atpCert?.status || 'expired',
      atpType: atpCert?.atpType,
      atpCertificateNumber: atpCert?.certificateNumber,
      atpDaysRemaining: atpCert ? this.evaluateExpiry(atpCert.expiryDate).daysRemaining : undefined,
      sensorCalibrationStatus,
      activeSensorsCount: calibrationLogs.length,
      blockingReasons,
      warnings,
    };
  }

  /**
   * Aggregate radar KPI metrics across fleet with Decimal precision
   */
  public static calculateRadarSummary(
    trailers: { id: number; plateNumber: string }[],
    atpCerts: ReeferAtpCertification[],
    calibrations: ReeferSensorCalibrationLog[]
  ): ReeferCalibrationRadarSummary {
    const totalReeferTrailers = trailers.length;
    let validAtpCount = 0;
    let expiring60dCount = 0;
    let expiring30dCount = 0;
    let expiredAtpCount = 0;
    let groundedCount = 0;

    const certMap = new Map<number, ReeferAtpCertification>();
    for (const cert of atpCerts) {
      certMap.set(cert.trailerId, cert);
      const evalRes = this.evaluateExpiry(cert.expiryDate);

      if (evalRes.status === 'expired') {
        expiredAtpCount++;
      } else if (evalRes.warningLevel === 'critical_7d' || evalRes.warningLevel === 'urgent_30d') {
        expiring30dCount++;
      } else if (evalRes.warningLevel === 'notice_60d') {
        expiring60dCount++;
      } else {
        validAtpCount++;
      }
    }

    // Group calibrations by trailer
    const calibMap = new Map<number, ReeferSensorCalibrationLog[]>();
    for (const cal of calibrations) {
      const existing = calibMap.get(cal.trailerId) || [];
      existing.push(cal);
      calibMap.set(cal.trailerId, existing);
    }

    let validCalibCount = 0;
    let dueCalibCount = 0;

    for (const cal of calibrations) {
      const evalRes = this.evaluateExpiry(cal.nextDueDate);
      if (evalRes.status === 'valid' && cal.isPassed) {
        validCalibCount++;
      } else {
        dueCalibCount++;
      }
    }

    // Evaluate gatekeeper for each trailer to identify grounded vehicles
    for (const tr of trailers) {
      const cert = certMap.get(tr.id) || null;
      const logs = calibMap.get(tr.id) || [];
      const gate = this.evaluatePreTripCompliance(tr.id, tr.plateNumber, cert, logs);
      if (!gate.isClearedForDispatch) {
        groundedCount++;
      }
    }

    // Health rate calculation with Decimal.js
    let healthRate = new Decimal(100);
    if (totalReeferTrailers > 0) {
      const compliantTrailers = new Decimal(totalReeferTrailers).minus(new Decimal(groundedCount));
      healthRate = compliantTrailers
        .dividedBy(new Decimal(totalReeferTrailers))
        .times(100)
        .toDecimalPlaces(1, Decimal.ROUND_HALF_UP);
    }

    return {
      totalReeferTrailers,
      validAtpCount,
      expiring60dCount,
      expiring30dCount,
      expiredAtpCount,
      validSensorCalibrationsCount: validCalibCount,
      dueSensorCalibrationsCount: dueCalibCount,
      groundedTrailersCount: groundedCount,
      fleetComplianceHealthRate: healthRate.toNumber(),
    };
  }
}

