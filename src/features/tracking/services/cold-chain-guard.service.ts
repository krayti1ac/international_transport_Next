import Decimal from 'decimal.js';
import crypto from 'crypto';
import type {
  ColdChainAuditEvaluation,
  ReeferExcursionIncident,
  ReeferTelemetryLog,
  TripReeferMonitoringProfile,
} from '../types/reefer-compliance.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
type DecimalInstance = InstanceType<typeof Decimal>;

export class ColdChainGuardService {
  /**
   * Gas constant R in kJ / (mol * K)
   */
  private static readonly R_GAS_CONSTANT_KJ = new Decimal('0.008314472');

  /**
   * Default activation energy ΔH in kJ/mol (Arrhenius standard for food/pharma)
   */
  public static readonly DEFAULT_ACTIVATION_ENERGY_KJ = new Decimal('83.144');

  /**
   * Kelvin offset: 0°C = 273.15 K
   */
  private static readonly KELVIN_OFFSET = new Decimal('273.15');

  /**
   * حساب درجة الحرارة الحركية المتوسطة (MKT - Mean Kinetic Temperature)
   * وفق صيغة أرهينيوس القياسية المعتمدة من منظمة الصحة العالمية (WHO) والوكالة الأوروبية للأدوية (EMA)
   * TK = (ΔH / R) / ( -ln( (1/n) * Σ exp(-ΔH / (R * Ti)) ) )
   */
  public static calculateMeanKineticTemperature(
    temperaturesCelsius: number[],
    activationEnergyKj?: number | string | DecimalInstance
  ): DecimalInstance {
    if (!temperaturesCelsius || temperaturesCelsius.length === 0) {
      return new Decimal(0);
    }

    if (temperaturesCelsius.length === 1) {
      return new Decimal(temperaturesCelsius[0]);
    }

    const dH = activationEnergyKj
      ? new Decimal(activationEnergyKj.toString())
      : this.DEFAULT_ACTIVATION_ENERGY_KJ;

    // ΔH / R in Kelvin
    const dH_over_R = dH.dividedBy(this.R_GAS_CONSTANT_KJ);
    const n = new Decimal(temperaturesCelsius.length);

    let sumExp = new Decimal(0);

    for (const t of temperaturesCelsius) {
      const tempDecimal = new Decimal(t);
      const tempKelvin = tempDecimal.plus(this.KELVIN_OFFSET);

      // حماية ضد الصفر المطلق أو القيم غير الفيزيائية
      if (tempKelvin.lessThanOrEqualTo(0)) {
        continue;
      }

      // exponent argument: - (ΔH / R) / Ti
      const expArg = dH_over_R.negated().dividedBy(tempKelvin);
      const expVal = expArg.exp();
      sumExp = sumExp.plus(expVal);
    }

    if (sumExp.isZero()) {
      return new Decimal(0);
    }

    const avgExp = sumExp.dividedBy(n);
    const lnAvg = avgExp.ln();

    if (lnAvg.isZero()) {
      return new Decimal(0);
    }

    // TK = - (ΔH / R) / ln(avgExp)
    const tkResult = dH_over_R.negated().dividedBy(lnAvg);
    const mktCelsius = tkResult.minus(this.KELVIN_OFFSET);

    return mktCelsius.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  /**
   * تقييم وتدقيق شامل لبيانات التبريد للرحلة وفق ميثاق ATP وتوجيهات GDP
   */
  public static evaluateColdChainTrip(
    profile: TripReeferMonitoringProfile,
    logs: ReeferTelemetryLog[]
  ): ColdChainAuditEvaluation {
    const tripId = profile.tripId;
    const atpClass = profile.atpClass;
    const cargoCategory = profile.cargoCategory;
    const setpoint = new Decimal(profile.setpointTemp);
    const minThreshold = new Decimal(profile.minTempThreshold);
    const maxThreshold = new Decimal(profile.maxTempThreshold);
    const maxExcursionMinutes = profile.maxAllowedExcursionMinutes;

    if (!logs || logs.length === 0) {
      return {
        tripId,
        atpClass,
        cargoCategory,
        totalLogsCount: 0,
        setpointTemp: setpoint.toNumber(),
        avgSupplyTemp: setpoint.toNumber(),
        avgReturnTemp: setpoint.toNumber(),
        mktTemperatureCelsius: setpoint.toNumber(),
        complianceStatus: 'compliant',
        totalExcursionMinutes: 0,
        doorBreachesCount: 0,
        totalDieselBurnedLiters: 0,
        complianceScorePercent: 100,
        certificateHash: this.generateCertificateHash(profile, 'compliant', setpoint, 0, 100),
      };
    }

    let totalSupply = new Decimal(0);
    let totalReturn = new Decimal(0);
    const returnTemps: number[] = [];

    let excursionLogCount = 0;
    let doorBreachesCount = 0;
    let totalDieselBurned = new Decimal(0);

    for (const log of logs) {
      const supply = new Decimal(log.supplyAirTemp);
      const returnAir = new Decimal(log.returnAirTemp);

      totalSupply = totalSupply.plus(supply);
      totalReturn = totalReturn.plus(returnAir);
      returnTemps.push(log.returnAirTemp);

      // فحص الانحراف عن عتبات الحرارة المسموحة
      const isExcursion =
        supply.greaterThan(maxThreshold) ||
        supply.lessThan(minThreshold) ||
        returnAir.greaterThan(maxThreshold) ||
        returnAir.lessThan(minThreshold);

      if (isExcursion) {
        excursionLogCount++;
      }

      // فحص فتح الأبواب خارج المناطق الآمنة أو أثناء الترانزيت
      if (log.doorOpenSensor && !log.isGeofenceSafe) {
        doorBreachesCount++;
      }

      // حساب استهلاك الديزل (بمعدل الحرق أو الفارق)
      if (log.dieselBurnRateLph && log.dieselBurnRateLph > 0) {
        // افتراض فاصل 10 دقائق لكل تسجيل نموذجي = (10 / 60) ساعة
        const intervalHours = new Decimal(10).dividedBy(60);
        const fuelBurn = new Decimal(log.dieselBurnRateLph).times(intervalHours);
        totalDieselBurned = totalDieselBurned.plus(fuelBurn);
      }
    }

    const logCountDec = new Decimal(logs.length);
    const avgSupplyTemp = totalSupply.dividedBy(logCountDec).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const avgReturnTemp = totalReturn.dividedBy(logCountDec).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    // حساب MKT على حرارة الهواء الراجع (Return Air) الحساس للبضاعة
    const mkt = this.calculateMeanKineticTemperature(
      returnTemps,
      profile.mktActivationEnergyKj
    );

    // تقدير مدة الانحراف بالدقائق (10 دقائق لكل سجل انحراف افتراضياً)
    const estimatedExcursionMinutes = excursionLogCount * 10;

    // تحديد درجة الامتثال
    let complianceStatus: 'compliant' | 'warning' | 'breached' = 'compliant';
    if (
      estimatedExcursionMinutes > maxExcursionMinutes ||
      doorBreachesCount >= 3 ||
      (cargoCategory === 'deep_frozen' && avgReturnTemp.greaterThan(-10))
    ) {
      complianceStatus = 'breached';
    } else if (estimatedExcursionMinutes > 0 || doorBreachesCount > 0) {
      complianceStatus = 'warning';
    }

    // حساب درجة الامتثال المئوية (Score) بدقة Decimal.js
    let score = new Decimal(100);

    // خصم عن كل دقيقة انحراف
    if (estimatedExcursionMinutes > 0) {
      const excursionPenalty = new Decimal(estimatedExcursionMinutes)
        .dividedBy(Math.max(maxExcursionMinutes, 1))
        .times(30);
      score = score.minus(excursionPenalty);
    }

    // خصم عن انتهاكات فتح الأبواب
    if (doorBreachesCount > 0) {
      score = score.minus(new Decimal(doorBreachesCount).times(15));
    }

    // خصم إذا انحرف MKT عن Setpoint بأكثر من 1.5 درجة
    const mktDiff = mkt.minus(setpoint).abs();
    if (mktDiff.greaterThan(1.5)) {
      score = score.minus(mktDiff.times(5));
    }

    if (score.lessThan(0)) {
      score = new Decimal(0);
    }

    const complianceScorePercent = score.toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toNumber();
    const certificateHash = this.generateCertificateHash(
      profile,
      complianceStatus,
      mkt,
      estimatedExcursionMinutes,
      complianceScorePercent
    );

    return {
      tripId,
      atpClass,
      cargoCategory,
      totalLogsCount: logs.length,
      setpointTemp: setpoint.toNumber(),
      avgSupplyTemp: avgSupplyTemp.toNumber(),
      avgReturnTemp: avgReturnTemp.toNumber(),
      mktTemperatureCelsius: mkt.toNumber(),
      complianceStatus,
      totalExcursionMinutes: estimatedExcursionMinutes,
      doorBreachesCount,
      totalDieselBurnedLiters: totalDieselBurned.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      complianceScorePercent,
      certificateHash,
    };
  }

  /**
   * استخراج وتصنيف حوادث وانحرافات سلسلة التبريد من تدفق البيانات اللحظية
   */
  public static detectExcursionIncidents(
    profile: TripReeferMonitoringProfile,
    logs: ReeferTelemetryLog[]
  ): ReeferExcursionIncident[] {
    const incidents: ReeferExcursionIncident[] = [];
    const minThreshold = new Decimal(profile.minTempThreshold);
    const maxThreshold = new Decimal(profile.maxTempThreshold);

    for (const log of logs) {
      const returnAir = new Decimal(log.returnAirTemp);

      // انحراف حراري علوي
      if (returnAir.greaterThan(maxThreshold)) {
        const deviation = returnAir.minus(maxThreshold);
        incidents.push({
          id: `inc-high-${log.id}`,
          companyId: profile.companyId,
          profileId: profile.id,
          tripId: profile.tripId,
          incidentType: 'temp_high',
          severity: deviation.greaterThan(3.0) ? 'critical' : 'warning',
          startedAt: log.recordedAt,
          peakDeviationTemp: returnAir.toNumber(),
          durationMinutes: 10,
          mktImpactCelsius: deviation.toNumber(),
          actionTaken: 'تنبيه السائق وإعادة ضبط سرعة تدفق المروحة',
          isCleared: false,
          createdAt: log.recordedAt,
        });
      }

      // انحراف حراري سفلي (خطر تجميد البضائع الحساسة كالخضار أو الأدوية)
      if (returnAir.lessThan(minThreshold)) {
        const deviation = minThreshold.minus(returnAir);
        incidents.push({
          id: `inc-low-${log.id}`,
          companyId: profile.companyId,
          profileId: profile.id,
          tripId: profile.tripId,
          incidentType: 'temp_low',
          severity: deviation.greaterThan(2.0) ? 'critical' : 'warning',
          startedAt: log.recordedAt,
          peakDeviationTemp: returnAir.toNumber(),
          durationMinutes: 10,
          mktImpactCelsius: deviation.negated().toNumber(),
          actionTaken: 'تفعيل دورة السخان الكهربائي أو التخفيف من ضغط الضاغط',
          isCleared: false,
          createdAt: log.recordedAt,
        });
      }

      // اختراق أمني لأبواب المقطورة خارج محطات الشحن المرخصة
      if (log.doorOpenSensor && !log.isGeofenceSafe) {
        incidents.push({
          id: `inc-door-${log.id}`,
          companyId: profile.companyId,
          profileId: profile.id,
          tripId: profile.tripId,
          incidentType: 'door_breach_transit',
          severity: 'critical',
          startedAt: log.recordedAt,
          peakDeviationTemp: returnAir.toNumber(),
          durationMinutes: 10,
          actionTaken: 'إنذار فوري لغرفة العمليات لاشتباه فتح الأبواب أثناء الترانزيت',
          isCleared: false,
          createdAt: log.recordedAt,
        });
      }

      // فشل الضاغط أثناء تشغيل الرحلة
      if (log.compressorStatus === 'off' && returnAir.greaterThan(maxThreshold)) {
        incidents.push({
          id: `inc-comp-${log.id}`,
          companyId: profile.companyId,
          profileId: profile.id,
          tripId: profile.tripId,
          incidentType: 'compressor_failure',
          severity: 'critical',
          startedAt: log.recordedAt,
          peakDeviationTemp: returnAir.toNumber(),
          durationMinutes: 10,
          actionTaken: 'عطل كهربائي في الضاغط - توجيه لأقرب ورشة صيانة متخصصة',
          isCleared: false,
          createdAt: log.recordedAt,
        });
      }
    }

    return incidents;
  }

  /**
   * توليد هاش التحقق التشفيري لشهادة الامتثال الرقمية (SHA-256)
   */
  public static generateCertificateHash(
    profile: TripReeferMonitoringProfile,
    status: string,
    mkt: DecimalInstance,
    excursionMinutes: number,
    score: number
  ): string {
    const rawPayload = `${profile.tripId}:${profile.atpClass}:${profile.cargoCategory}:${status}:${mkt.toFixed(2)}:${excursionMinutes}:${score}`;
    const hash = crypto.createHash('sha256').update(rawPayload).digest('hex').toUpperCase();
    return `ATP-${profile.atpClass.toUpperCase()}-${profile.tripId}-${hash.substring(0, 16)}`;
  }
}

