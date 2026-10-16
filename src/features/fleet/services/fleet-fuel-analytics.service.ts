/**
 * Trans Bodanon TMS — Forensic Fleet Fuel & Telematics BI Analytics Service
 * Track B: Strict Decimal.js Engine for Tractor vs. Reefer Split (Carrier Transicold / Thermo King),
 * CAN-Bus Odometer & Fuel Level Verification, OCR Receipt vs. GPS Haversine Matching, and Multi-Currency CPK
 */

import Decimal from 'decimal.js';
import type {
  CorridorConsumptionChartPoint,
  CurrencyFuelCostBreakdown,
  FleetFuelBiDashboardData,
  FuelAnomalySeverity,
  FuelAnomalyType,
  FuelBiAnomalyAlert,
  FuelEfficiencyGrade,
  OcrFuelReceiptAuditInput,
  ReeferUnitBrand,
  TractorReeferFuelSplit,
  TruckDriverEfficiencyRow,
} from '../types/fleet-fuel-bi.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface RawTruckTripFuelInput {
  truckId: number;
  plateNumber: string;
  truckModel: string;
  driverId: number;
  driverName: string;
  driverPhotoUrl?: string;
  corridorCode: 'MA-ES-FR' | 'MA-MR-SN' | 'DOMESTIC-MA';
  corridorName: string;
  isReeferTrip: boolean;
  reeferBrand?: ReeferUnitBrand;
  odometerDistanceKm: number | string;
  canBusTotalFuelLiters: number | string;
  ocrReceiptsTotalLiters: number | string;
  reeferOperatingHours?: number | string;
  reeferBurnRateLPerHour?: number | string;
  reeferBaselineLPerHour?: number | string;
  baselineLPer100Km: number | string;
  fuelCostMad: number | string;
  fuelCostEur?: number | string;
  exchangeRateEurToMad?: number | string;
  averageDieselPriceMad?: number | string;
}

export class FleetFuelAnalyticsService {
  /**
   * حساب المسافة الجغرافية (Haversine) بالكيلومتر بين إحداثيات محطة الوقود وإحداثيات GPS للشاحنة
   */
  public static calculateGpsDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): string {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const earthRadiusKm = 6371;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = new Decimal(earthRadiusKm).times(new Decimal(c));
    return distance.toFixed(2);
  }

  /**
   * فصل استهلاك محرك الجر الأساسي (Tractor Engine) عن استهلاك محرك مقطورة التبريد (Carrier Transicold / Thermo King)
   * باستخدام Decimal.js حصرياً
   */
  public static calculateTractorReeferSplit(params: {
    totalFuelLiters: number | string;
    isReeferTrip: boolean;
    reeferBrand?: ReeferUnitBrand;
    reeferOperatingHours?: number | string;
    reeferBurnRateLPerHour?: number | string;
    reeferBaselineLPerHour?: number | string;
  }): TractorReeferFuelSplit {
    const totalDec = Decimal.max(0, new Decimal(params.totalFuelLiters || 0));
    const brand: ReeferUnitBrand = params.isReeferTrip
      ? params.reeferBrand || 'thermo_king'
      : 'none';
    const baselineRateDec = new Decimal(params.reeferBaselineLPerHour ?? 3.2);

    if (!params.isReeferTrip || totalDec.isZero()) {
      return {
        tractorLiters: totalDec.toFixed(2),
        reeferLiters: '0.00',
        totalLiters: totalDec.toFixed(2),
        tractorSharePct: totalDec.isZero() ? '0.00' : '100.00',
        reeferSharePct: '0.00',
        reeferOperatingHours: '0.00',
        reeferBurnRateLPerHour: '0.00',
        reeferBaselineLPerHour: baselineRateDec.toFixed(2),
        reeferBrand: 'none',
      };
    }

    const hoursDec = Decimal.max(0, new Decimal(params.reeferOperatingHours || 0));
    const rateDec = Decimal.max(0, new Decimal(params.reeferBurnRateLPerHour ?? 3.2));

    // Reefer liters cannot exceed 45% of total combined fuel burn
    const rawReeferLiters = hoursDec.times(rateDec);
    const maxAllowedReefer = totalDec.times(new Decimal('0.45'));
    const reeferLitersDec = Decimal.min(rawReeferLiters, maxAllowedReefer);
    const tractorLitersDec = Decimal.max(0, totalDec.minus(reeferLitersDec));

    const tractorShareDec = tractorLitersDec.dividedBy(totalDec).times(100);
    const reeferShareDec = new Decimal(100).minus(tractorShareDec);

    return {
      tractorLiters: tractorLitersDec.toFixed(2),
      reeferLiters: reeferLitersDec.toFixed(2),
      totalLiters: totalDec.toFixed(2),
      tractorSharePct: tractorShareDec.toFixed(2),
      reeferSharePct: reeferShareDec.toFixed(2),
      reeferOperatingHours: hoursDec.toFixed(2),
      reeferBurnRateLPerHour: rateDec.toFixed(2),
      reeferBaselineLPerHour: baselineRateDec.toFixed(2),
      reeferBrand: brand,
    };
  }

  /**
   * تقييم كفاءة الشاحنة والسائق (Tractor vs Reefer + CAN-Bus Variance + CPK MAD/EUR + Financial Savings/Waste)
   */
  public static evaluateTruckDriverEfficiency(
    input: RawTruckTripFuelInput
  ): TruckDriverEfficiencyRow {
    const distanceDec = Decimal.max(1, new Decimal(input.odometerDistanceKm || 1));
    const canBusLitersDec = Decimal.max(0, new Decimal(input.canBusTotalFuelLiters || 0));
    const ocrLitersDec = Decimal.max(
      0,
      new Decimal(input.ocrReceiptsTotalLiters || input.canBusTotalFuelLiters || 0)
    );
    const baselineLPer100Dec = Decimal.max(1, new Decimal(input.baselineLPer100Km || 33.5));
    const fxRateDec = Decimal.max(1, new Decimal(input.exchangeRateEurToMad || '10.85'));
    const dieselPriceMadDec = Decimal.max(1, new Decimal(input.averageDieselPriceMad || '13.20'));

    // Calculate total cost in MAD and EUR
    const directMadCostDec = new Decimal(input.fuelCostMad || 0);
    const eurCostDec = new Decimal(input.fuelCostEur || 0);
    const totalCostMadDec = directMadCostDec.plus(eurCostDec.times(fxRateDec));
    const totalCostEurDec = totalCostMadDec.dividedBy(fxRateDec);

    // Separate Tractor vs Reefer consumption
    const fuelSplit = this.calculateTractorReeferSplit({
      totalFuelLiters: canBusLitersDec.toFixed(2),
      isReeferTrip: input.isReeferTrip,
      reeferBrand: input.reeferBrand,
      reeferOperatingHours: input.reeferOperatingHours,
      reeferBurnRateLPerHour: input.reeferBurnRateLPerHour,
      reeferBaselineLPerHour: input.reeferBaselineLPerHour,
    });

    const tractorLitersDec = new Decimal(fuelSplit.tractorLiters);

    // L/100km calculations via Decimal.js
    const actualTractorLPer100Dec = tractorLitersDec.dividedBy(distanceDec).times(100);
    const combinedLPer100Dec = canBusLitersDec.dividedBy(distanceDec).times(100);

    // Variance against truck baseline (Tractor engine only for fair comparison)
    const varianceLPer100Dec = actualTractorLPer100Dec.minus(baselineLPer100Dec);
    const variancePctDec = varianceLPer100Dec.dividedBy(baselineLPer100Dec).times(100);

    // Expected tractor liters at baseline rate
    const expectedBaselineLitersDec = distanceDec.times(baselineLPer100Dec).dividedBy(100);
    // Positive = Financial Savings (actual < expected), Negative = Financial Waste (actual > expected)
    const litersSavedOrWastedDec = expectedBaselineLitersDec.minus(tractorLitersDec);
    const financialSavingsOrWasteMadDec = litersSavedOrWastedDec.times(dieselPriceMadDec);

    // CPK (Cost Per Kilometer) in MAD and EUR
    const cpkMadDec = totalCostMadDec.dividedBy(distanceDec);
    const cpkEurDec = totalCostEurDec.dividedBy(distanceDec);

    // Calculate Efficiency Score (0..100) and Grade
    let scoreDec = new Decimal(90);
    if (variancePctDec.lessThan(0)) {
      // Bonus for consuming less than baseline
      const bonus = Decimal.min(10, variancePctDec.abs().times('1.5'));
      scoreDec = scoreDec.plus(bonus);
    } else if (variancePctDec.greaterThan(0)) {
      // Penalty for over-burning above baseline
      const penalty = variancePctDec.times('2.2');
      scoreDec = scoreDec.minus(penalty);
    }

    // Additional penalty if OCR billed liters exceed CAN-Bus burn by > 3%
    const ocrVsCanDiffDec = ocrLitersDec.minus(canBusLitersDec);
    if (canBusLitersDec.greaterThan(0)) {
      const unverifiedPct = ocrVsCanDiffDec.dividedBy(canBusLitersDec).times(100);
      if (unverifiedPct.greaterThan(3)) {
        scoreDec = scoreDec.minus(Decimal.min(20, unverifiedPct.times('1.5')));
      }
    }

    const finalScore = Math.max(
      0,
      Math.min(100, scoreDec.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber())
    );

    let grade: FuelEfficiencyGrade = 'D';
    if (finalScore >= 92) grade = 'A+';
    else if (finalScore >= 84) grade = 'A';
    else if (finalScore >= 74) grade = 'B';
    else if (finalScore >= 62) grade = 'C';

    return {
      truckId: input.truckId,
      plateNumber: input.plateNumber,
      truckModel: input.truckModel,
      driverId: input.driverId,
      driverName: input.driverName,
      driverPhotoUrl: input.driverPhotoUrl,
      corridorCode: input.corridorCode,
      corridorName: input.corridorName,
      isReeferTrip: input.isReeferTrip,
      reeferBrand: fuelSplit.reeferBrand,
      odometerDistanceKm: distanceDec.toFixed(2),
      canBusFuelBurnLiters: canBusLitersDec.toFixed(2),
      ocrReceiptsTotalLiters: ocrLitersDec.toFixed(2),
      fuelSplit,
      baselineLPer100Km: baselineLPer100Dec.toFixed(2),
      actualTractorLPer100Km: actualTractorLPer100Dec.toFixed(2),
      combinedLPer100Km: combinedLPer100Dec.toFixed(2),
      varianceLPer100Km: varianceLPer100Dec.toFixed(2),
      variancePct: variancePctDec.toFixed(2),
      costPerKmMad: cpkMadDec.toFixed(3),
      costPerKmEur: cpkEurDec.toFixed(3),
      totalCostMad: totalCostMadDec.toFixed(2),
      financialSavingsOrWasteMad: financialSavingsOrWasteMadDec.toFixed(2),
      efficiencyScore: finalScore,
      grade,
      rank: 0,
    };
  }

  /**
   * الفحص الجنائي لإيصال الوقود الممسوح بالكاميرا (OCR) ومطابقته مع إحداثيات GPS وقراءات الخزان (CAN-Bus)
   */
  public static auditOcrFuelReceiptAgainstTelematics(
    input: OcrFuelReceiptAuditInput
  ): FuelBiAnomalyAlert | null {
    const claimedLitersDec = Decimal.max(0, new Decimal(input.receiptLiters || 0));
    const tankBeforeDec = Decimal.max(0, new Decimal(input.canBusTankLevelBeforeLiters || 0));
    const tankAfterDec = Decimal.max(0, new Decimal(input.canBusTankLevelAfterLiters || 0));
    const observedRiseDec = Decimal.max(0, tankAfterDec.minus(tankBeforeDec));
    const discrepancyLitersDec = Decimal.max(0, claimedLitersDec.minus(observedRiseDec));
    const tankCapacityDec = new Decimal(input.tankCapacityLiters || 1200);

    const origAmountDec = Decimal.max(0, new Decimal(input.receiptTotalAmount || 0));
    const fxDec = new Decimal(
      input.currency === 'EUR' ? input.exchangeRateToMad || '10.85' : '1.00'
    );
    const totalMadDec = origAmountDec.times(fxDec);

    const pricePerLiterMadDec = claimedLitersDec.greaterThan(0)
      ? totalMadDec.dividedBy(claimedLitersDec)
      : new Decimal('13.20');

    // 1. GPS Distance & Time Deviation
    const gpsDistanceKmStr = this.calculateGpsDistanceKm(
      input.stationLat,
      input.stationLng,
      input.truckGpsLat,
      input.truckGpsLng
    );
    const gpsDistDec = new Decimal(gpsDistanceKmStr);

    const receiptTimeMs = Date.parse(input.receiptTimestamp);
    const gpsTimeMs = Date.parse(input.truckGpsTimestamp);
    const timeDiffMinutes =
      !Number.isNaN(receiptTimeMs) && !Number.isNaN(gpsTimeMs)
        ? Math.round(Math.abs(receiptTimeMs - gpsTimeMs) / 60000)
        : 0;

    // Determine if an anomaly exists and classify priority
    let anomalyType: FuelAnomalyType | null = null;
    let severity: FuelAnomalySeverity = 'medium';
    let reasonSummary = '';
    let financialImpactDec = new Decimal(0);

    // Priority 1: GPS Station Mismatch (> 3.0 km away or > 90 mins time gap)
    if (gpsDistDec.greaterThan('3.00') || timeDiffMinutes > 90) {
      anomalyType = 'gps_station_mismatch';
      severity = gpsDistDec.greaterThan('15.00') ? 'critical' : 'high';
      financialImpactDec = discrepancyLitersDec.greaterThan(5)
        ? discrepancyLitersDec.times(pricePerLiterMadDec)
        : totalMadDec;
      reasonSummary = `تباين جغرافي/زمني: الشاحنة كانت على بُعد ${gpsDistanceKmStr} كم من المحطة (${input.stationName}) بفارق ${timeDiffMinutes} دقيقة عند إصدار الفاتورة.`;
    }
    // Priority 2: Significant Volume Discrepancy between OCR Receipt and CAN-Bus Tank Sensor (> 15 Liters)
    else if (discrepancyLitersDec.greaterThan('15.00')) {
      anomalyType = 'consumption_variance';
      severity = discrepancyLitersDec.greaterThan('50.00') ? 'critical' : 'high';
      financialImpactDec = discrepancyLitersDec.times(pricePerLiterMadDec);
      reasonSummary = `فارق كمية غير مبرر: الفاتورة تطالب بـ ${claimedLitersDec.toFixed(
        2
      )} لتر بينما حساس الخزان (CAN-Bus) سجل دخول ${observedRiseDec.toFixed(
        2
      )} لتر فقط (نقص ${discrepancyLitersDec.toFixed(2)} لتر).`;
    }
    // Priority 3: Low OCR Confidence (< 75%) or Claimed Liters exceed Physical Tank Capacity
    else if (input.ocrConfidenceScore < 75 || claimedLitersDec.greaterThan(tankCapacityDec)) {
      anomalyType = 'manual_ocr_review';
      severity = claimedLitersDec.greaterThan(tankCapacityDec) ? 'high' : 'medium';
      financialImpactDec = totalMadDec;
      reasonSummary = claimedLitersDec.greaterThan(tankCapacityDec)
        ? `تجاوز السعة القصوى للخزان (${tankCapacityDec.toFixed(0)}L): الفاتورة مسجل بها ${claimedLitersDec.toFixed(2)} لتر وتحتاج مراجعة يدوية.`
        : `إحالة للمراجعة اليدوية: دقة القراءة الضوئية للإيصال (${input.ocrConfidenceScore}%) أقل من العتبة الآمنة (75%).`;
    }

    if (!anomalyType) {
      return null;
    }

    return {
      id: `ANOM-${input.receiptId}`,
      anomalyType,
      severity,
      status: 'pending_review',
      truckId: input.truckId,
      plateNumber: input.plateNumber,
      driverId: input.driverId,
      driverName: input.driverName,
      stationName: input.stationName,
      detectedAt: input.receiptTimestamp,
      gpsDistanceDeviationKm: gpsDistanceKmStr,
      timeDeviationMinutes: timeDiffMinutes,
      claimedLiters: claimedLitersDec.toFixed(2),
      telematicsObservedLiters: observedRiseDec.toFixed(2),
      discrepancyLiters: discrepancyLitersDec.toFixed(2),
      financialImpactMad: financialImpactDec.toFixed(2),
      originalCurrency: input.currency,
      originalAmount: origAmountDec.toFixed(2),
      ocrConfidenceScore: input.ocrConfidenceScore,
      reasonSummary,
    };
  }

  /**
   * احتساب توزيع تكاليف الوقود حسب العملة (MAD / EUR) بدقة Decimal.js
   */
  public static calculateCurrencyFuelBreakdown(params: {
    madLiters: number | string;
    madCost: number | string;
    eurLiters: number | string;
    eurCostInEur: number | string;
    exchangeRateEurToMad?: number | string;
  }): CurrencyFuelCostBreakdown {
    const madLitersDec = Decimal.max(0, new Decimal(params.madLiters || 0));
    const madCostDec = Decimal.max(0, new Decimal(params.madCost || 0));
    const eurLitersDec = Decimal.max(0, new Decimal(params.eurLiters || 0));
    const eurCostEurDec = Decimal.max(0, new Decimal(params.eurCostInEur || 0));
    const fxDec = Decimal.max(1, new Decimal(params.exchangeRateEurToMad || '10.85'));

    const eurCostInMadDec = eurCostEurDec.times(fxDec);
    const combinedMadDec = madCostDec.plus(eurCostInMadDec);

    const madShareDec = combinedMadDec.greaterThan(0)
      ? madCostDec.dividedBy(combinedMadDec).times(100)
      : new Decimal(100);
    const eurShareDec = combinedMadDec.greaterThan(0)
      ? new Decimal(100).minus(madShareDec)
      : new Decimal(0);

    return {
      madTotalLiters: madLitersDec.toFixed(2),
      madTotalCost: madCostDec.toFixed(2),
      eurTotalLiters: eurLitersDec.toFixed(2),
      eurTotalCostInEur: eurCostEurDec.toFixed(2),
      eurTotalCostInMad: eurCostInMadDec.toFixed(2),
      exchangeRateUsed: fxDec.toFixed(4),
      combinedTotalCostMad: combinedMadDec.toFixed(2),
      madSharePct: madShareDec.toFixed(2),
      eurSharePct: eurShareDec.toFixed(2),
    };
  }

  /**
   * تجميع وبناء لوحة تحكم ذكاء الأعمال المتكاملة للأسطول والمحروقات (Fleet Fuel & Telematics BI Dashboard)
   */
  public static buildFleetFuelBiDashboard(params: {
    periodStart: string;
    periodEnd: string;
    truckTrips: RawTruckTripFuelInput[];
    receiptAudits: OcrFuelReceiptAuditInput[];
    exchangeRateEurToMad?: number | string;
  }): FleetFuelBiDashboardData {
    const fxDec = new Decimal(params.exchangeRateEurToMad || '10.85');

    // 1. Evaluate all truck/driver rows and rank leaderboard
    const leaderboard: TruckDriverEfficiencyRow[] = params.truckTrips.map((row) =>
      this.evaluateTruckDriverEfficiency({
        ...row,
        exchangeRateEurToMad: fxDec.toFixed(4),
      })
    );

    leaderboard.sort((a, b) => {
      if (b.efficiencyScore !== a.efficiencyScore) {
        return b.efficiencyScore - a.efficiencyScore;
      }
      return new Decimal(a.actualTractorLPer100Km)
        .minus(new Decimal(b.actualTractorLPer100Km))
        .toNumber();
    });

    leaderboard.forEach((item, idx) => {
      item.rank = idx + 1;
    });

    // 2. Aggregate fleet totals using Decimal.js
    let totalDistDec = new Decimal(0);
    let totalFuelDec = new Decimal(0);
    let totalTractorDec = new Decimal(0);
    let totalReeferDec = new Decimal(0);
    let weightedBaselineLitersDec = new Decimal(0);
    let netSavingsOrWasteDec = new Decimal(0);

    let madLitersDec = new Decimal(0);
    let madCostDec = new Decimal(0);
    let eurLitersDec = new Decimal(0);
    let eurCostInEurDec = new Decimal(0);

    // Group by corridor for chart data
    const corridorMap = new Map<
      'MA-ES-FR' | 'MA-MR-SN' | 'DOMESTIC-MA',
      {
        corridorName: string;
        tripsCount: number;
        distDec: InstanceType<typeof Decimal>;
        baselineWeightedLitersDec: InstanceType<typeof Decimal>;
        tractorLitersDec: InstanceType<typeof Decimal>;
        reeferLitersDec: InstanceType<typeof Decimal>;
        reeferHoursDec: InstanceType<typeof Decimal>;
        costMadDec: InstanceType<typeof Decimal>;
        savingsOrWasteMadDec: InstanceType<typeof Decimal>;
      }
    >();

    for (let i = 0; i < params.truckTrips.length; i++) {
      const raw = params.truckTrips[i];
      const evaluated = leaderboard.find(
        (r) => r.truckId === raw.truckId && r.driverId === raw.driverId
      )!;

      const dDec = new Decimal(evaluated.odometerDistanceKm);
      const totLDec = new Decimal(evaluated.canBusFuelBurnLiters);
      const tracLDec = new Decimal(evaluated.fuelSplit.tractorLiters);
      const reefLDec = new Decimal(evaluated.fuelSplit.reeferLiters);
      const reefHDec = new Decimal(evaluated.fuelSplit.reeferOperatingHours);
      const baseRateDec = new Decimal(evaluated.baselineLPer100Km);
      const baseLitersForRow = dDec.times(baseRateDec).dividedBy(100);
      const rowCostMadDec = new Decimal(evaluated.totalCostMad);
      const rowSavDec = new Decimal(evaluated.financialSavingsOrWasteMad);

      totalDistDec = totalDistDec.plus(dDec);
      totalFuelDec = totalFuelDec.plus(totLDec);
      totalTractorDec = totalTractorDec.plus(tracLDec);
      totalReeferDec = totalReeferDec.plus(reefLDec);
      weightedBaselineLitersDec = weightedBaselineLitersDec.plus(baseLitersForRow);
      netSavingsOrWasteDec = netSavingsOrWasteDec.plus(rowSavDec);

      // Currency breakdown allocation
      const rowEurCostDec = new Decimal(raw.fuelCostEur || 0);
      const rowMadCostDec = new Decimal(raw.fuelCostMad || 0);
      madCostDec = madCostDec.plus(rowMadCostDec);
      eurCostInEurDec = eurCostInEurDec.plus(rowEurCostDec);

      if (rowEurCostDec.greaterThan(0) && rowMadCostDec.greaterThan(0)) {
        // Split liters proportionally for mixed corridor trips (MA-ES-FR)
        const eurShareOfCost = rowEurCostDec.times(fxDec).dividedBy(rowCostMadDec);
        const rowEurLiters = totLDec.times(eurShareOfCost);
        eurLitersDec = eurLitersDec.plus(rowEurLiters);
        madLitersDec = madLitersDec.plus(totLDec.minus(rowEurLiters));
      } else if (rowEurCostDec.greaterThan(0)) {
        eurLitersDec = eurLitersDec.plus(totLDec);
      } else {
        madLitersDec = madLitersDec.plus(totLDec);
      }

      // Corridor grouping
      const existingCorr = corridorMap.get(raw.corridorCode) || {
        corridorName: raw.corridorName,
        tripsCount: 0,
        distDec: new Decimal(0),
        baselineWeightedLitersDec: new Decimal(0),
        tractorLitersDec: new Decimal(0),
        reeferLitersDec: new Decimal(0),
        reeferHoursDec: new Decimal(0),
        costMadDec: new Decimal(0),
        savingsOrWasteMadDec: new Decimal(0),
      };

      existingCorr.tripsCount += 1;
      existingCorr.distDec = existingCorr.distDec.plus(dDec);
      existingCorr.baselineWeightedLitersDec =
        existingCorr.baselineWeightedLitersDec.plus(baseLitersForRow);
      existingCorr.tractorLitersDec = existingCorr.tractorLitersDec.plus(tracLDec);
      existingCorr.reeferLitersDec = existingCorr.reeferLitersDec.plus(reefLDec);
      existingCorr.reeferHoursDec = existingCorr.reeferHoursDec.plus(reefHDec);
      existingCorr.costMadDec = existingCorr.costMadDec.plus(rowCostMadDec);
      existingCorr.savingsOrWasteMadDec = existingCorr.savingsOrWasteMadDec.plus(rowSavDec);
      corridorMap.set(raw.corridorCode, existingCorr);
    }

    const currencyBreakdown = this.calculateCurrencyFuelBreakdown({
      madLiters: madLitersDec.toFixed(2),
      madCost: madCostDec.toFixed(2),
      eurLiters: eurLitersDec.toFixed(2),
      eurCostInEur: eurCostInEurDec.toFixed(2),
      exchangeRateEurToMad: fxDec.toFixed(4),
    });

    const combinedCostMadDec = new Decimal(currencyBreakdown.combinedTotalCostMad);

    const fleetBaselineLPer100Dec = totalDistDec.greaterThan(0)
      ? weightedBaselineLitersDec.dividedBy(totalDistDec).times(100)
      : new Decimal('33.50');

    const fleetActualTractorLPer100Dec = totalDistDec.greaterThan(0)
      ? totalTractorDec.dividedBy(totalDistDec).times(100)
      : new Decimal(0);

    const fleetCpkMadDec = totalDistDec.greaterThan(0)
      ? combinedCostMadDec.dividedBy(totalDistDec)
      : new Decimal(0);

    const fleetCpkEurDec = fleetCpkMadDec.dividedBy(fxDec);

    // 3. Build Corridor Chart Points
    const corridorChartData: CorridorConsumptionChartPoint[] = [];
    for (const [code, val] of corridorMap.entries()) {
      const baseRate = val.distDec.greaterThan(0)
        ? val.baselineWeightedLitersDec.dividedBy(val.distDec).times(100)
        : new Decimal('33.50');
      const actRate = val.distDec.greaterThan(0)
        ? val.tractorLitersDec.dividedBy(val.distDec).times(100)
        : new Decimal(0);
      const reefRate = val.reeferHoursDec.greaterThan(0)
        ? val.reeferLitersDec.dividedBy(val.reeferHoursDec)
        : new Decimal(0);

      corridorChartData.push({
        corridorCode: code,
        corridorName: val.corridorName,
        tripsCount: val.tripsCount,
        totalDistanceKm: val.distDec.toFixed(2),
        baselineLPer100Km: baseRate.toFixed(2),
        actualTractorLPer100Km: actRate.toFixed(2),
        reeferAvgLPerHour: reefRate.toFixed(2),
        totalTractorLiters: val.tractorLitersDec.toFixed(2),
        totalReeferLiters: val.reeferLitersDec.toFixed(2),
        totalCostMad: val.costMadDec.toFixed(2),
        netSavingsOrWasteMad: val.savingsOrWasteMadDec.toFixed(2),
      });
    }

    // 4. Audit OCR Fuel Receipts for Anomalies
    const anomalyAlerts: FuelBiAnomalyAlert[] = [];
    let preventedFraudLossDec = new Decimal(0);
    let pendingManualReviewCount = 0;
    let geoMismatchAlertsCount = 0;

    for (const auditInput of params.receiptAudits) {
      const alert = this.auditOcrFuelReceiptAgainstTelematics(auditInput);
      if (alert) {
        anomalyAlerts.push(alert);
        if (alert.anomalyType === 'manual_ocr_review') {
          pendingManualReviewCount += 1;
        } else {
          preventedFraudLossDec = preventedFraudLossDec.plus(
            new Decimal(alert.financialImpactMad)
          );
        }
        if (alert.anomalyType === 'gps_station_mismatch') {
          geoMismatchAlertsCount += 1;
        }
      }
    }

    return {
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      activeTrucksCount: leaderboard.length,
      totalTripsAnalyzed: params.truckTrips.length,
      totalDistanceKm: totalDistDec.toFixed(2),
      totalFuelLiters: totalFuelDec.toFixed(2),
      totalTractorLiters: totalTractorDec.toFixed(2),
      totalReeferLiters: totalReeferDec.toFixed(2),
      fleetBaselineLPer100Km: fleetBaselineLPer100Dec.toFixed(2),
      fleetActualTractorLPer100Km: fleetActualTractorLPer100Dec.toFixed(2),
      fleetAverageCpkMad: fleetCpkMadDec.toFixed(3),
      fleetAverageCpkEur: fleetCpkEurDec.toFixed(3),
      netFuelSavingsOrWasteMad: netSavingsOrWasteDec.toFixed(2),
      preventedFraudLossMad: preventedFraudLossDec.toFixed(2),
      pendingManualReviewCount,
      geoMismatchAlertsCount,
      currencyBreakdown,
      corridorChartData,
      leaderboard,
      anomalyAlerts,
    };
  }
}

