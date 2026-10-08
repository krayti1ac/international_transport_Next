import Decimal from 'decimal.js';
type DecimalInstance = InstanceType<typeof Decimal>;

import type {
  ParsedFrigoIoTData,
  RawFrigoIoTInput,
  ReeferAlarmCode,
  ReeferAnomaly,
  ReeferOperatingMode,
  ReeferUnitBrand,
} from '../types/frigo-iot.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// Standard alarm catalog for Carrier Transicold & Thermo King
export const REEFER_STANDARD_ALARMS: Record<string, ReeferAlarmCode> = {
  // Carrier Transicold
  AL_01: {
    code: 'AL_01',
    brand: 'carrier',
    severity: 'critical',
    descriptionAr: 'انخفاض ضغط السحب (اشتباه تسريب فريون أو انسداد الفلتر)',
    descriptionFr: 'Basse pression aspiration (Suspicion fuite frigorigène)',
    descriptionEs: 'Baja presión de aspiración (Sospecha fuga de refrigerante)',
    remedyAr: 'فحص دارة الغاز ومستوى الفريون وضبط صمام التمدد',
    remedyFr: 'Vérifier le circuit frigorifique et le niveau de fluide',
    remedyEs: 'Verificar el circuito frigorífico y nivel de refrigerante',
  },
  AL_02: {
    code: 'AL_02',
    brand: 'carrier',
    severity: 'critical',
    descriptionAr: 'ارتفاع ضغط الطرد (حرارة المكثف مرتفعة أو انسداد الشفرات)',
    descriptionFr: 'Haute pression refoulement (Condenseur encrassé)',
    descriptionEs: 'Alta presión de descarga (Condensador sucio u obstruido)',
    remedyAr: 'تنظيف مروحة ومكثف المبرد وفحص تدفق الهواء',
    remedyFr: 'Nettoyer le condenseur et vérifier la ventilation',
    remedyEs: 'Limpiar el condensador y verificar la ventilación',
  },
  AL_15: {
    code: 'AL_15',
    brand: 'carrier',
    severity: 'warning',
    descriptionAr: 'انخفاض جهد بطارية وحدة التبريد الاحتياطية (< 11.8V)',
    descriptionFr: 'Tension batterie unité frigo basse (< 11.8V)',
    descriptionEs: 'Tensión baja de la batería de la unidad (< 11.8V)',
    remedyAr: 'فحص دينامو الشحن وسلامة كابلات البطارية',
    remedyFr: 'Contrôler l’alternateur et les câbles de batterie',
    remedyEs: 'Comprobar el alternador y conexiones de batería',
  },
  AL_20: {
    code: 'AL_20',
    brand: 'carrier',
    severity: 'warning',
    descriptionAr: 'حرارة رأس الضاغط مرتفعة فوق المعدل القياسي',
    descriptionFr: 'Température culasse compresseur élevée',
    descriptionEs: 'Temperatura de culata del compresor elevada',
    remedyAr: 'تقليل الحمل الحراري والتأكد من ضخ الزيت التبريدي',
    remedyFr: 'Réduire la charge thermique et vérifier la lubrification',
    remedyEs: 'Reducir la carga térmica y verificar la lubricación',
  },
  AL_64: {
    code: 'AL_64',
    brand: 'carrier',
    severity: 'critical',
    descriptionAr: 'تجاوز مهلة دورة إذابة الجليد (> 45 دقيقة بدون إنهاء)',
    descriptionFr: 'Dépassement du temps de dégivrage (> 45 min)',
    descriptionEs: 'Superación del tiempo de desescarche (> 45 min)',
    remedyAr: 'فحص حساس نهاية الإذابة (Defrost Terminate Switch) وصمام الغاز الساخن',
    remedyFr: 'Contrôler la sonde de fin de dégivrage et la vanne gaz chaud',
    remedyEs: 'Inspeccionar sonda de fin de desescarche y válvula de gas caliente',
  },

  // Thermo King
  TK_04: {
    code: 'TK_04',
    brand: 'thermo_king',
    severity: 'critical',
    descriptionAr: 'انحراف قراءة حساس حرارة الهواء الراجع (Return Air Drift)',
    descriptionFr: 'Dérive capteur température air reprise',
    descriptionEs: 'Desviación del sensor de temperatura de retorno',
    remedyAr: 'معايرة أو استبدال مسبار الحرارة الداخلي للمقطورة',
    remedyFr: 'Étalonner ou remplacer la sonde de température',
    remedyEs: 'Calibrar o sustituir la sonda de temperatura interna',
  },
  TK_10: {
    code: 'TK_10',
    brand: 'thermo_king',
    severity: 'critical',
    descriptionAr: 'ضغط طرد مرتفع للغاية (High Discharge Pressure Cutout)',
    descriptionFr: 'Coupure haute pression refoulement compresseur',
    descriptionEs: 'Corte por alta presión de descarga del compresor',
    remedyAr: 'إيقاف الوحدة فوراً والتأكد من عدم وجود غاز زائد أو هواء بالدارة',
    remedyFr: 'Arrêt immédiat et vérification des incondensables',
    remedyEs: 'Parada inmediata y comprobación de incondensables en el circuito',
  },
  TK_17: {
    code: 'TK_17',
    brand: 'thermo_king',
    severity: 'critical',
    descriptionAr: 'فشل إقلاع محرك الديزل للوحدة (Engine Fail to Crank)',
    descriptionFr: 'Échec de démarrage moteur diesel frigo',
    descriptionEs: 'Fallo de arranque del motor diésel de refrigeración',
    remedyAr: 'فحص سحب الوقود وشمعات التسخين ونظام التشغيل الذاتي',
    remedyFr: 'Vérifier l’alimentation gasoil et les bougies de préchauffage',
    remedyEs: 'Revisar suministro de diésel y bujías de precalentamiento',
  },
  TK_61: {
    code: 'TK_61',
    brand: 'thermo_king',
    severity: 'warning',
    descriptionAr: 'جهد منخفض لنظام بطارية المبرد (Low Battery Voltage)',
    descriptionFr: 'Tension batterie faible sous le seuil',
    descriptionEs: 'Tensión baja del sistema de batería',
    remedyAr: 'إعادة شحن البطارية وفحص استهلاك المحركات المساعدة',
    remedyFr: 'Recharger la batterie et contrôler les consommateurs',
    remedyEs: 'Recargar batería y revisar consumo de componentes auxiliares',
  },
  TK_82: {
    code: 'TK_82',
    brand: 'thermo_king',
    severity: 'critical',
    descriptionAr: 'تجاوز مؤقت إنهاء دورة إذابة الصقيع الأقصى',
    descriptionFr: 'Minuterie de sécurité dégivrage dépassée',
    descriptionEs: 'Temporizador de seguridad de desescarche superado',
    remedyAr: 'فحص سخانات الإذابة ومفتاح الأمان الحراري',
    remedyFr: 'Vérifier les résistances de dégivrage et le thermostat de sécurité',
    remedyEs: 'Comprobar resistencias de desescarche y termostato de seguridad',
  },
};

/**
 * Calculates the Enhanced Frigo Stability Degradation Index (SDI) with Decimal.js
 * Scale: 0 to 100 (100 = Perfect stability, < 60 = Critical risk to cold chain)
 */
export function calculateFrigoSDI(params: {
  tempDeviation: DecimalInstance;
  suctionPressure: DecimalInstance;
  dischargePressure: DecimalInstance;
  defrostActive: boolean;
  defrostDurationMin: number;
  batteryVdc: DecimalInstance;
  operatingMode: ReeferOperatingMode;
}): { sdiScore: number; status: 'optimal' | 'degraded' | 'critical' } {
  const baseSdi = new Decimal(100.0);
  let totalPenalty = new Decimal(0);

  // 1. Thermal Deviation Penalty: 8 points per °C above 1.0°C tolerance (up to 45 pts)
  if (params.tempDeviation.greaterThan(1.0)) {
    const excessTemp = params.tempDeviation.minus(1.0);
    const tempPenalty = Decimal.min(excessTemp.times(8.0), 45.0);
    totalPenalty = totalPenalty.plus(tempPenalty);
  }

  // 2. Refrigerant Pressure & Compression Ratio Penalty
  // Ideal suction: 1.2 to 2.8 Bar; Ideal discharge: 11.0 to 22.0 Bar
  if (params.operatingMode !== 'off') {
    if (params.suctionPressure.lessThan(0.9) || params.dischargePressure.lessThan(10.0)) {
      // Severe low pressure / refrigerant leak
      totalPenalty = totalPenalty.plus(25.0);
    } else if (params.suctionPressure.greaterThan(0)) {
      const compRatio = params.dischargePressure.dividedBy(params.suctionPressure);
      if (compRatio.lessThan(4.5) || compRatio.greaterThan(15.0)) {
        totalPenalty = totalPenalty.plus(15.0);
      }
    }
  }

  // 3. Defrost Overrun Penalty
  if (params.defrostActive) {
    if (params.defrostDurationMin > 45) {
      totalPenalty = totalPenalty.plus(30.0);
    } else if (params.defrostDurationMin > 30) {
      totalPenalty = totalPenalty.plus(15.0);
    }
  }

  // 4. Battery Voltage Penalty (< 11.8V is warning, < 11.2V is critical)
  if (params.batteryVdc.lessThan(11.2)) {
    totalPenalty = totalPenalty.plus(30.0);
  } else if (params.batteryVdc.lessThan(11.8)) {
    totalPenalty = totalPenalty.plus(15.0);
  }

  const finalSdi = Decimal.max(0, baseSdi.minus(totalPenalty));
  const sdiScore = parseFloat(finalSdi.toFixed(1));

  let status: 'optimal' | 'degraded' | 'critical' = 'optimal';
  if (sdiScore < 60) {
    status = 'critical';
  } else if (sdiScore < 85) {
    status = 'degraded';
  }

  return { sdiScore, status };
}

/**
 * Parses, validates, and enhances raw Frigo IoT packets from CAN-bus, Modbus, or Traccar
 */
export function parseFrigoTelemetryPacket(raw: RawFrigoIoTInput): ParsedFrigoIoTData {
  const truckId = raw.truckId || 0;
  const truckPlate = raw.truckPlate || 'TRK-UNKNOWN';
  const trailerPlate = raw.trailerPlate || undefined;
  const model = raw.model || 'Vector 1550 / SLXi 400';

  // Normalize Brand
  let unitBrand: ReeferUnitBrand = 'generic';
  const brandRaw = (raw.unitBrand || '').toLowerCase();
  if (brandRaw.includes('carrier') || model.toLowerCase().includes('vector') || model.toLowerCase().includes('maxima')) {
    unitBrand = 'carrier';
  } else if (brandRaw.includes('thermo') || model.toLowerCase().includes('slx') || model.toLowerCase().includes('spectrum')) {
    unitBrand = 'thermo_king';
  }

  // Temperature & Setpoint with Decimal.js
  const curTempDec = new Decimal(raw.currentTemp !== undefined ? raw.currentTemp : -18.0);
  const targetTempDec = new Decimal(raw.targetTemp !== undefined ? raw.targetTemp : -18.0);
  const tempDevDec = curTempDec.minus(targetTempDec).abs();
  const ambientTempDec = new Decimal(raw.ambientTemp !== undefined ? raw.ambientTemp : 25.0);

  // Pressures with Decimal.js
  const suctionDec = new Decimal(raw.suctionPressureBar !== undefined ? raw.suctionPressureBar : 1.8);
  const dischargeDec = new Decimal(raw.dischargePressureBar !== undefined ? raw.dischargePressureBar : 16.2);
  const compRatioDec = suctionDec.greaterThan(0)
    ? dischargeDec.dividedBy(suctionDec)
    : new Decimal(0);

  // Operating Mode
  let operatingMode: ReeferOperatingMode = 'continuous';
  if (raw.operatingMode) {
    const modeStr = String(raw.operatingMode).toLowerCase();
    if (modeStr.includes('cycle') || modeStr.includes('sentry') || modeStr.includes('start_stop')) {
      operatingMode = 'cycle_sentry';
    } else if (modeStr.includes('electric') || modeStr.includes('standby')) {
      operatingMode = 'electric_standby';
    } else if (modeStr.includes('off')) {
      operatingMode = 'off';
    }
  }

  // Defrost State
  const defrostActive = Boolean(raw.defrostActive);
  const defrostDurationMin = Number(raw.defrostDurationMin || 0);
  const defrostCoilTemp = Number(raw.defrostCoilTemp || (defrostActive ? 8.5 : -15.0));

  let defrostStatus: ParsedFrigoIoTData['defrostStatus'] = 'idle';
  if (defrostActive) {
    if (defrostDurationMin > 45) {
      defrostStatus = 'overrun_critical';
    } else if (defrostDurationMin > 30) {
      defrostStatus = 'overrun_warning';
    } else {
      defrostStatus = 'active_normal';
    }
  }

  // Electrical Battery
  const batteryDec = new Decimal(raw.backupBatteryVdc !== undefined ? raw.backupBatteryVdc : 12.6);
  let batteryStatus: ParsedFrigoIoTData['batteryStatus'] = 'good';
  if (batteryDec.lessThan(11.2)) {
    batteryStatus = 'critical';
  } else if (batteryDec.lessThan(11.8)) {
    batteryStatus = 'low';
  }

  // Pressure Status
  let pressureStatus: ParsedFrigoIoTData['pressureStatus'] = 'optimal';
  if (suctionDec.lessThan(0.9) || dischargeDec.lessThan(10.0)) {
    pressureStatus = 'critical';
  } else if (compRatioDec.lessThan(4.5) || compRatioDec.greaterThan(14.0)) {
    pressureStatus = 'warning';
  }

  // Calculate Enhanced SDI
  const { sdiScore, status: sdiStatus } = calculateFrigoSDI({
    tempDeviation: tempDevDec,
    suctionPressure: suctionDec,
    dischargePressure: dischargeDec,
    defrostActive,
    defrostDurationMin,
    batteryVdc: batteryDec,
    operatingMode,
  });

  // Parse Alarms
  const alarms: ReeferAlarmCode[] = [];
  const rawCodes = Array.isArray(raw.alarmCodes)
    ? raw.alarmCodes
    : typeof raw.alarmCodes === 'string'
    ? raw.alarmCodes.split(',').map((c) => c.trim())
    : [];

  rawCodes.forEach((code) => {
    const cleanCode = code.toUpperCase();
    if (REEFER_STANDARD_ALARMS[cleanCode]) {
      alarms.push(REEFER_STANDARD_ALARMS[cleanCode]);
    } else if (cleanCode) {
      alarms.push({
        code: cleanCode,
        brand: unitBrand,
        severity: 'warning',
        descriptionAr: `إنذار فني غير معرّف (${cleanCode})`,
        descriptionFr: `Code d'alarme unité frigo (${cleanCode})`,
        descriptionEs: `Código de alarma unidad (${cleanCode})`,
      });
    }
  });

  // Detect Active Anomalies
  const anomalies: ReeferAnomaly[] = [];

  // Anomaly 1: Refrigerant Leak / Pressure Loss
  if (pressureStatus === 'critical' && operatingMode !== 'off') {
    anomalies.push({
      type: 'refrigerant_leak',
      severity: 'critical',
      titleAr: 'اشتباه تسريب فريون أو نقص حرج في الضغط',
      titleFr: 'Suspicion fuite de fluide frigorigène',
      titleEs: 'Sospecha de fuga de refrigerante',
      messageAr: `ضغط السحب انخفض إلى ${suctionDec.toFixed(2)} Bar وضغط الطرد إلى ${dischargeDec.toFixed(2)} Bar، مما يشير إلى تسرب غاز التبريد قبل تلف الشحنة.`,
      messageFr: `Pression d'aspiration chutée à ${suctionDec.toFixed(2)} Bar et refoulement à ${dischargeDec.toFixed(2)} Bar.`,
      messageEs: `Presión de aspiración caída a ${suctionDec.toFixed(2)} Bar y descarga a ${dischargeDec.toFixed(2)} Bar.`,
      detectedValue: `${suctionDec.toFixed(2)} / ${dischargeDec.toFixed(2)} Bar`,
      thresholdValue: '1.2 / 11.0 Bar',
    });
  }

  // Anomaly 2: Defrost Overrun Timeout
  if (defrostStatus === 'overrun_critical' || defrostStatus === 'overrun_warning') {
    anomalies.push({
      type: 'defrost_overrun',
      severity: defrostStatus === 'overrun_critical' ? 'critical' : 'warning',
      titleAr: 'تجاوز مهلة دورة إذابة الجليد (Defrost Overrun)',
      titleFr: 'Dépassement du temps de dégivrage',
      titleEs: 'Superación del tiempo de desescarche',
      messageAr: `دورة إذابة الجليد نشطة منذ ${defrostDurationMin} دقيقة دون إنهاء تلقائي، مما يرفع خطر سخونة مقصورة الشحن الحساسة.`,
      messageFr: `Cycle de dégivrage actif depuis ${defrostDurationMin} minutes sans terminaison.`,
      messageEs: `Ciclo de desescarche activo durante ${defrostDurationMin} minutos sin finalizar.`,
      detectedValue: `${defrostDurationMin} min`,
      thresholdValue: '30 min',
    });
  }

  // Anomaly 3: Low Battery Voltage
  if (batteryStatus !== 'good') {
    anomalies.push({
      type: 'low_battery',
      severity: batteryStatus === 'critical' ? 'critical' : 'warning',
      titleAr: 'انخفاض جهد بطارية وحدة التبريد الاحتياطية',
      titleFr: 'Tension batterie unité frigo faible',
      titleEs: 'Batería de la unidad frigo por debajo del límite',
      messageAr: `جهد البطارية انخفض إلى ${batteryDec.toFixed(2)} VDC، مما يهدد بتوقف وحدة التبريد أثناء الاستراحة أو الانتظار بالمعابر.`,
      messageFr: `Tension batterie mesurée à ${batteryDec.toFixed(2)} VDC.`,
      messageEs: `Tensión de la batería medida a ${batteryDec.toFixed(2)} VDC.`,
      detectedValue: `${batteryDec.toFixed(2)} V`,
      thresholdValue: '11.8 V',
    });
  }

  // Anomaly 4: Thermal Excursion
  if (tempDevDec.greaterThan(2.5)) {
    anomalies.push({
      type: 'thermal_excursion',
      severity: tempDevDec.greaterThan(4.0) ? 'critical' : 'warning',
      titleAr: 'انحراف حراري ملموس عن الدرجة المطلوبة',
      titleFr: 'Excursion thermique critique',
      titleEs: 'Excursión térmica crítica',
      messageAr: `درجة الحرارة الحالية ${curTempDec.toFixed(1)}°C تنحرف بـ ${tempDevDec.toFixed(1)}°C عن الضبط المطلوب (${targetTempDec.toFixed(1)}°C).`,
      messageFr: `Température mesurée à ${curTempDec.toFixed(1)}°C contre consigne de ${targetTempDec.toFixed(1)}°C.`,
      messageEs: `Temperatura medida en ${curTempDec.toFixed(1)}°C frente a consigna de ${targetTempDec.toFixed(1)}°C.`,
      detectedValue: `${curTempDec.toFixed(1)}°C`,
      thresholdValue: `${targetTempDec.toFixed(1)}°C (±1.5°C)`,
    });
  }

  const recordedAt = raw.timestamp
    ? typeof raw.timestamp === 'number'
      ? new Date(raw.timestamp).toISOString()
      : String(raw.timestamp)
    : new Date().toISOString();

  return {
    truckId,
    truckPlate,
    trailerPlate,
    unitBrand,
    model,
    currentTemp: parseFloat(curTempDec.toFixed(1)),
    targetTemp: parseFloat(targetTempDec.toFixed(1)),
    tempDeviation: parseFloat(tempDevDec.toFixed(1)),
    ambientTemp: parseFloat(ambientTempDec.toFixed(1)),
    suctionPressureBar: parseFloat(suctionDec.toFixed(2)),
    dischargePressureBar: parseFloat(dischargeDec.toFixed(2)),
    compressionRatio: parseFloat(compRatioDec.toFixed(2)),
    pressureStatus,
    defrostActive,
    defrostDurationMin,
    defrostCoilTemp,
    defrostStatus,
    backupBatteryVdc: parseFloat(batteryDec.toFixed(2)),
    batteryStatus,
    operatingMode,
    engineHours: Number(raw.engineHours || 0),
    compressorRpm: Number(raw.compressorRpm || (operatingMode === 'off' ? 0 : 1850)),
    fuelLevelReefer: Number(raw.fuelLevelReefer || 85),
    doorOpen: Boolean(raw.doorOpen),
    sdiScore,
    sdiStatus,
    alarms,
    anomalies,
    recordedAt,
  };
}

