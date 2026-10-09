import Decimal from 'decimal.js';
import type {
  StandardDtcProfile,
  DtcCategory,
  DtcSeverity,
  UrgencyLevel,
  FreezeFrameData,
  FleetObdDiagnosticEvent,
  PredictiveMaintenanceRecommendation,
  FleetHealthSummary,
  HighRiskTruckAlert,
} from '../types/obd-diagnostic.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export type DecimalInstance = InstanceType<typeof Decimal>;
export type DecimalValue = string | number | DecimalInstance;

// Standard Hourly Labor Rate in MAD for TMS Heavy Truck Workshop
export const HOURLY_LABOR_RATE_MAD = new Decimal('350.00');

/**
 * Standard SAE J1939 / J2012 DTC Heavy-Duty Truck Catalog
 */
export const STANDARD_DTC_CATALOG: Record<string, StandardDtcProfile> = {
  P0299: {
    code: 'P0299',
    standard: 'SAE_J1939',
    category: 'powertrain',
    severity: 'moderate',
    urgency: 'within_24h',
    name_ar: 'ضغط شاحن التوربو منخفض (Turbo Underboost)',
    name_fr: 'Pression de suralimentation du turbo insuffisante',
    name_es: 'Presión baja del turbocompresor',
    name_en: 'Turbocharger Underboost Condition',
    description_ar: 'انخفاض ضغط السحب في التوربو عن القيمة المطلوبة مما يقلل عزم المحرك ويزيد استهلاك الديزل.',
    description_fr: 'La pression de suralimentation mesurée est inférieure à la consigne du calculateur moteur.',
    description_es: 'La presión del turbo está por debajo del umbral mínimo configurado en la ECU.',
    description_en: 'PCM detected turbocharger boost pressure below calibrated threshold.',
    symptom_ar: 'فقدان عزم الشاحنة عند صعود المرتفعات وانبعاث دخان أسود.',
    symptom_fr: 'Perte de puissance en côte et fumée noire à l\'échappement.',
    symptom_es: 'Pérdida de potencia en pendientes y humo negro de escape.',
    action_ar: 'فحص خراطيم هواء الضغط، حساس ضغط الهواء MAP، وصمام Wastegate.',
    action_fr: 'Contrôler les durites d\'air, le capteur MAP et la soupape de décharge.',
    action_es: 'Inspeccionar mangueras de sobrealimentación, sensor MAP y válvula wastegate.',
    estimated_labor_hours: 3.0,
    estimated_parts_cost_mad: '2500.00',
    estimated_breakdown_cost_mad: '14500.00',
    required_spare_parts: [
      { code: 'TRB-HOSE-01', name: 'خراطيم التوربو المعززة (Turbo Silicone Hose Kit)', estimated_cost_mad: '1200.00', quantity: 1 },
      { code: 'SNS-MAP-02', name: 'حساس ضغط الهواء MAP Sensor', estimated_cost_mad: '1300.00', quantity: 1 },
    ],
    affected_systems: ['Turbocharger', 'Air Intake', 'Intercooler'],
  },
  P20EE: {
    code: 'P20EE',
    standard: 'SAE_J1939',
    category: 'powertrain',
    severity: 'critical',
    urgency: 'within_24h',
    name_ar: 'انخفاض كفاءة محفز غازات العادم NOx (SCR / AdBlue)',
    name_fr: 'Efficacité du catalyseur SCR NOx inférieure au seuil (Euro VI)',
    name_es: 'Eficiencia baja del catalizador NOx SCR (Normativa Euro VI)',
    name_en: 'SCR NOx Catalyst Efficiency Below Threshold (Bank 1)',
    description_ar: 'فشل معالجة أكاسيد النيتروجين في نظام AdBlue مما قد يدخل الشاحنة في وضع تقييد السرعة (Limp Mode) ومخالفة قوانين Euro VI بأوروبا.',
    description_fr: 'Le système SCR ne traite pas convenablement les gaz d\'échappement, risque de dégradation du couple moteur et amendes Euro VI.',
    description_es: 'El sistema SCR no reduce los NOx según norma Euro VI; riesgo inminente de limitación de potencia en autopistas europeas.',
    description_en: 'Selective Catalytic Reduction (SCR) efficiency fell below threshold for NOx emissions compliance.',
    symptom_ar: 'تحذير AdBlue على اللوحة مع خطر هبوط سرعة الشاحنة إلى 20 كم/ساعة تلقائياً.',
    symptom_fr: 'Alerte AdBlue au combiné, risque de bridage de la vitesse à 20 km/h.',
    symptom_es: 'Aviso de AdBlue en cuadro y limitación de velocidad por la ECU.',
    action_ar: 'فحص بخاخ سائل AdBlue، مستشعر NOx الأمامي والخلفي، وتنظيف مصفاة العادم.',
    action_fr: 'Contrôler l\'injecteur d\'AdBlue et remplacer les sondes NOx amont/aval.',
    action_es: 'Comprobar inyector de AdBlue y sustituir sondas NOx delantera/trasera.',
    estimated_labor_hours: 4.5,
    estimated_parts_cost_mad: '6800.00',
    estimated_breakdown_cost_mad: '28000.00',
    required_spare_parts: [
      { code: 'SCR-NOX-SNS', name: 'مستشعر أكسيد النيتروجين NOx Sensor Euro VI', estimated_cost_mad: '4200.00', quantity: 1 },
      { code: 'SCR-INJ-VAL', name: 'بخاخ حقن سائل اليوريا AdBlue Injector', estimated_cost_mad: '2600.00', quantity: 1 },
    ],
    affected_systems: ['SCR Catalytic System', 'AdBlue Dosing', 'Exhaust Aftertreatment'],
  },
  P0217: {
    code: 'P0217',
    standard: 'SAE_J1939',
    category: 'powertrain',
    severity: 'critical',
    urgency: 'immediate_stop',
    name_ar: 'ارتفاع حرج في درجة حرارة سائل تبريد المحرك (Overheating)',
    name_fr: 'Surchauffe critique du liquide de refroidissement moteur',
    name_es: 'Sobrecalentamiento crítico del refrigerante del motor',
    name_en: 'Engine Coolant Over-Temperature Condition',
    description_ar: 'تجاوز حرارة المحرك 108°C، خطر وشيك لاعوجاج أو كسر رأس المحرك (Cylinder Head). يتطلب الإيقاف الفوري.',
    description_fr: 'Température moteur supérieure à 108°C, risque immédiat de rupture du joint de culasse.',
    description_es: 'Temperatura de refrigerante superior a 108°C, peligro inminente para la culata del motor.',
    description_en: 'Engine coolant temperature reached critical dangerous limits; potential head gasket failure.',
    symptom_ar: 'مؤشر الحرارة في المنطقة الحمراء مع صوت صفير إنذار وارتفاع ضغط خزان التمدد.',
    symptom_fr: 'Aiguille de température dans le rouge, sifflement et pression excessive au vase d\'expansion.',
    symptom_es: 'Aguja de temperatura en zona roja y sobrepresión en vaso de expansión.',
    action_ar: 'إيقاف الشاحنة في مكان آمن فوراً، فحص مضخة الماء، الثرموستات، ومروحة التبريد.',
    action_fr: 'Arrêt d\'urgence immédiat, contrôle de la pompe à eau, thermostat et ventilateur.',
    action_es: 'Detener el camión de inmediato, inspeccionar bomba de agua, termostato y ventilador viscoso.',
    estimated_labor_hours: 5.0,
    estimated_parts_cost_mad: '3800.00',
    estimated_breakdown_cost_mad: '52000.00',
    required_spare_parts: [
      { code: 'COOL-PUMP-HD', name: 'مضخة ماء تبريد الخدمة الشاقة (Heavy-Duty Water Pump)', estimated_cost_mad: '2400.00', quantity: 1 },
      { code: 'COOL-THERMO', name: 'ثرموستات المحرك المزدوج (Dual Thermostat Unit)', estimated_cost_mad: '900.00', quantity: 1 },
      { code: 'COOL-FLUID-20L', name: 'سائل تبريد عضوي OAT 20L', estimated_cost_mad: '500.00', quantity: 1 },
    ],
    affected_systems: ['Cooling System', 'Water Pump', 'Engine Head'],
  },
  C1095: {
    code: 'C1095',
    standard: 'SAE_J1939',
    category: 'chassis',
    severity: 'critical',
    urgency: 'within_24h',
    name_ar: 'عطل في صمام ومستشعر ضغط الفرامل الهوائية (ABS/EBS Valve)',
    name_fr: 'Défaillance du modulateur de pression de freinage ABS/EBS',
    name_es: 'Fallo en válvula moduladora de presión de frenos ABS/EBS',
    name_en: 'Brake Pressure Switch / Modulator Valve Circuit Fault',
    description_ar: 'خلل كهربائي أو تسريب في صمام تعديل ضغط الهواء بالفرامل، مما يهدد توازن كبح المقطورة.',
    description_fr: 'Défaut sur le modulateur de pression pneumatique EBS, risque de déséquilibre au freinage lourd.',
    description_es: 'Avería en modulador EBS de frenos de aire comprimido, riesgo de pérdida de estabilidad con carga.',
    description_en: 'Electronic braking system detected circuit malfunction in modulator pressure switch.',
    symptom_ar: 'إضاءة لمبة تحذير ABS/EBS وتأخر استجابة فرامل المقطورة الخلفية.',
    symptom_fr: 'Témoin EBS allumé et retard de réponse pneumatique des freins de la semi-remorque.',
    symptom_es: 'Luz de advertencia de EBS encendida y retardo en frenada neumática del semirremolque.',
    action_ar: 'استبدال صمام التعديل EBS وفحص ضغط خراطيم الهواء وبطانات الفرامل.',
    action_fr: 'Remplacer le modulateur EBS et inspecter les conduites d\'air et garnitures de frein.',
    action_es: 'Reemplazar válvula moduladora EBS y revisar tuberías neumáticas y pastillas de freno.',
    estimated_labor_hours: 4.0,
    estimated_parts_cost_mad: '4500.00',
    estimated_breakdown_cost_mad: '36000.00',
    required_spare_parts: [
      { code: 'BRK-EBS-VALVE', name: 'صمام تعديل ضغط EBS الذكي (EBS Axle Modulator)', estimated_cost_mad: '3500.00', quantity: 1 },
      { code: 'BRK-PAD-SET', name: 'طقم بطانات فرامل أمامية/خلفية', estimated_cost_mad: '1000.00', quantity: 1 },
    ],
    affected_systems: ['EBS Braking', 'Air Compressors', 'Trailer Couplings'],
  },
  U0100: {
    code: 'U0100',
    standard: 'SAE_J1939',
    category: 'network',
    severity: 'moderate',
    urgency: 'within_24h',
    name_ar: 'انقطاع اتصال شبكة CAN-Bus مع وحدة التحكم بالمحرك (ECM/PCM)',
    name_fr: 'Perte de communication réseau CAN-Bus avec le calculateur moteur ECM',
    name_es: 'Pérdida de comunicación por bus CAN con unidad de control motor ECM',
    name_en: 'Lost Communication with Engine Control Module (ECM/PCM)',
    description_ar: 'اضطراب في الإشارات الرقمية عبر شبكة J1939 بين وحدات التحكم، قد يسبب انطفاء مفاجئ أو قراءات غير منتظمة.',
    description_fr: 'Interruption des trames J1939 du bus CAN avec le module moteur central.',
    description_es: 'Interrupción de tramas SAE J1939 en la red de comunicación del camión con la ECM.',
    description_en: 'CAN communication bus failure between vehicle gateway and engine management ECM.',
    symptom_ar: 'توقف عدادات السرعة والـ RPM عن العمل لحظياً وظهور أخطاء شبكية متعددة.',
    symptom_fr: 'Coupure intermittente des cadrans au tableau de bord et dysfonctionnements aléatoires.',
    symptom_es: 'Fallo intermitente en cuadro de instrumentos y lecturas de telemetría inestables.',
    action_ar: 'فحص مقاومة إنهاء شبكة CAN (120 Ohm) والتأكد من سلامة ضفيرة الأسلاك والفيشات.',
    action_fr: 'Tester la résistance de terminaison (120 Ohms) et le faisceau de câblage moteur.',
    action_es: 'Verificar resistencias terminales de red (120 Ohm) y cableado principal J1939.',
    estimated_labor_hours: 2.5,
    estimated_parts_cost_mad: '1800.00',
    estimated_breakdown_cost_mad: '19000.00',
    required_spare_parts: [
      { code: 'CAN-HARNESS-KIT', name: 'طقم كابلات ومقاومات شبكة J1939 (CAN Bus Cable Kit)', estimated_cost_mad: '1400.00', quantity: 1 },
      { code: 'RELAY-ECM-24V', name: 'مرحل تغذية رئيسي 24V HD Relay', estimated_cost_mad: '400.00', quantity: 1 },
    ],
    affected_systems: ['CAN-Bus J1939 Network', 'ECM Wiring Harness', 'Vehicle Gateway'],
  },
  P0524: {
    code: 'P0524',
    standard: 'SAE_J1939',
    category: 'powertrain',
    severity: 'critical',
    urgency: 'immediate_stop',
    name_ar: 'ضغط زيت المحرك منخفض جداً (Low Oil Pressure)',
    name_fr: 'Pression d\'huile moteur trop basse',
    name_es: 'Presión de aceite de motor excesivamente baja',
    name_en: 'Engine Oil Pressure Too Low',
    description_ar: 'هبوط ضغط تزييت المحرك لما دون 1.2 بار، خطر حرج للغاية لاحتكاك وتصلب عمود الكرنك والسبائك.',
    description_fr: 'Pression de lubrification sous 1.2 bar, risque de coulage de bielle et destruction moteur.',
    description_es: 'Presión de lubricación inferior a 1.2 bar, peligro de agarrotamiento del cigüeñal.',
    description_en: 'Engine oil lubrication pressure below critical threshold for mechanical protection.',
    symptom_ar: 'إضاءة حمراء فورية لضغط الزيت وصوت طقطقة معدنية خفيفة في المحرك.',
    symptom_fr: 'Témoin rouge d\'huile moteur allumé et claquement métallique audible.',
    symptom_es: 'Testigo rojo de aceite activado y ruidos mecánicos de fricción.',
    action_ar: 'إطفاء المحرك في الحال، فحص مستوى الزيت، حساس ضغط الزيت، ومضخة الزيت الميكانيكية.',
    action_fr: 'Couper le moteur immédiatement, vérifier le niveau d\'huile et la pompe à huile.',
    action_es: 'Apagar el motor de inmediato, comprobar nivel de aceite y bomba de lubricación.',
    estimated_labor_hours: 5.5,
    estimated_parts_cost_mad: '4200.00',
    estimated_breakdown_cost_mad: '75000.00',
    required_spare_parts: [
      { code: 'OIL-PUMP-HD', name: 'مضخة زيت المحرك عالية الضغط (Engine Oil Pump)', estimated_cost_mad: '3200.00', quantity: 1 },
      { code: 'SNS-OIL-PRS', name: 'حساس قياس ضغط زيت المحرك (Oil Pressure Sensor)', estimated_cost_mad: '1000.00', quantity: 1 },
    ],
    affected_systems: ['Lubrication System', 'Crankshaft Bearings', 'Oil Pump'],
  },
  P0101: {
    code: 'P0101',
    standard: 'SAE_J2012',
    category: 'powertrain',
    severity: 'minor',
    urgency: 'next_scheduled_service',
    name_ar: 'خلل في تدفق مستشعر كتلة الهواء (MAF Sensor)',
    name_fr: 'Plage/rendement du débitmètre d\'air massique (MAF)',
    name_es: 'Rendimiento fuera de rango del sensor de flujo de aire (MAF)',
    name_en: 'Mass Air Flow (MAF) Sensor Range/Performance',
    description_ar: 'قراءة غير دقيقة لكمية الهواء الداخل للمحرك مما يرفع استهلاك الديزل بنسبة 5% إلى 8%.',
    description_fr: 'Mesure imprécise du débit d\'air entraînant une surconsommation de gazole.',
    description_es: 'Medición errónea de caudal de aire que eleva el consumo de combustible.',
    description_en: 'MAF sensor signal voltage not within calibrated operating parameters.',
    symptom_ar: 'ارتفاع طفيف في استهلاك الديزل واستجابة بطيئة لدواسة الوقود.',
    symptom_fr: 'Légère surconsommation de carburant et réponse molle de l\'accélérateur.',
    symptom_es: 'Consumo elevado de diésel y respuesta perezosa del acelerador.',
    action_ar: 'تنظيف أو استبدال حساس MAF وفحص نظافة فلتر الهواء الرئيسي.',
    action_fr: 'Nettoyer ou remplacer le capteur MAF et remplacer le filtre à air.',
    action_es: 'Limpiar o sustituir el sensor MAF y cambiar el filtro de aire principal.',
    estimated_labor_hours: 1.5,
    estimated_parts_cost_mad: '1200.00',
    estimated_breakdown_cost_mad: '6000.00',
    required_spare_parts: [
      { code: 'AIR-MAF-SNS', name: 'حساس تدفق كتلة الهواء MAF Sensor', estimated_cost_mad: '850.00', quantity: 1 },
      { code: 'AIR-FLT-HD', name: 'فلتر هواء محرك ثقيل (Heavy Air Filter)', estimated_cost_mad: '350.00', quantity: 1 },
    ],
    affected_systems: ['Air Intake', 'Fuel Injection Trim'],
  },
  C0040: {
    code: 'C0040',
    standard: 'SAE_J2012',
    category: 'chassis',
    severity: 'minor',
    urgency: 'next_scheduled_service',
    name_ar: 'خلل في حساس سرعة العجلة الأمامية (Wheel Speed Sensor)',
    name_fr: 'Défaut du capteur de vitesse de roue avant droite',
    name_es: 'Fallo en sensor de velocidad de rueda delantera derecha',
    name_en: 'Right Front Wheel Speed Sensor Malfunction',
    description_ar: 'تذبذب في قراءة دوران العجلة قد يؤثر على فعالية نظام منع الانغلاق ABS على الطرق الزلقة.',
    description_fr: 'Signal instable du capteur de roue, impact sur le déclenchement optimal de l\'ABS.',
    description_es: 'Señal inestable de velocidad de rueda que afecta a la activación del ABS en mojado.',
    description_en: 'Irregular pulses or open circuit detected on front wheel speed sensor.',
    symptom_ar: 'إضاءة متقطعة لمصباح ABS عند السرعات البطيئة.',
    symptom_fr: 'Clignotement intermittent du voyant ABS à basse vitesse.',
    symptom_es: 'Parpadeo esporádico del testigo ABS a baja velocidad.',
    action_ar: 'تنظيف حلقة مسننات الحساس (Tone Ring) أو استبدال الحساس المغناطيسي.',
    action_fr: 'Nettoyer la cible magnétique et remplacer le capteur inductif de roue.',
    action_es: 'Limpiar la rueda fónica y sustituir el sensor de revoluciones de rueda.',
    estimated_labor_hours: 2.0,
    estimated_parts_cost_mad: '950.00',
    estimated_breakdown_cost_mad: '7500.00',
    required_spare_parts: [
      { code: 'WHL-SPD-SNS', name: 'حساس سرعة دوران العجلة (ABS Wheel Speed Sensor)', estimated_cost_mad: '950.00', quantity: 1 },
    ],
    affected_systems: ['ABS / ESP', 'Wheel Hub Assemblies'],
  },
};

/**
 * Lookup DTC Profile from Standard Catalog or fallback to SAE classification heuristics
 */
export function lookupDtcProfile(code: string): StandardDtcProfile {
  const cleanCode = code.trim().toUpperCase();
  if (STANDARD_DTC_CATALOG[cleanCode]) {
    return STANDARD_DTC_CATALOG[cleanCode];
  }

  // Fallback SAE classification
  const prefix = cleanCode.charAt(0);
  let category: DtcCategory = 'powertrain';
  if (prefix === 'C') category = 'chassis';
  else if (prefix === 'B') category = 'body';
  else if (prefix === 'U') category = 'network';

  const severity: DtcSeverity = prefix === 'P' || prefix === 'C' ? 'moderate' : 'minor';
  const urgency: UrgencyLevel = 'next_scheduled_service';

  return {
    code: cleanCode,
    standard: 'SAE_J1939',
    category,
    severity,
    urgency,
    name_ar: `كود عطل تشخيصي (${cleanCode})`,
    name_fr: `Code anomalie diagnostic (${cleanCode})`,
    name_es: `Código de avería diagnóstico (${cleanCode})`,
    name_en: `Diagnostic Trouble Code (${cleanCode})`,
    description_ar: `عطل مسجل في فئة ${category} وفق بروتوكول التشخيص القياسي.`,
    description_fr: `Anomalie détectée dans la catégorie ${category} via bus J1939.`,
    description_es: `Fallo detectado en el subsistema ${category} mediante telemetría.`,
    description_en: `Telemetry fault detected under ${category} diagnostic subsystem.`,
    symptom_ar: 'تنبيه تشخيصي مسجل في وحدة التحكم.',
    symptom_fr: 'Alerte enregistrée dans l\'historique du calculateur.',
    symptom_es: 'Registro de fallo almacenado en centralita.',
    action_ar: 'فحص الحساسات والوصلات الكهربائية التابعة لهذا النظام.',
    action_fr: 'Vérifier les capteurs et connecteurs associés au système.',
    action_es: 'Inspeccionar sensores y conectores del sistema asociado.',
    estimated_labor_hours: 2.0,
    estimated_parts_cost_mad: '1500.00',
    estimated_breakdown_cost_mad: '9000.00',
    required_spare_parts: [
      { code: 'GEN-ELEC-PART', name: 'قطعة غيار كهربائية/ميكانيكية عامة', estimated_cost_mad: '1500.00', quantity: 1 },
    ],
    affected_systems: [category.toUpperCase()],
  };
}

/**
 * Calculates Predictive Health Index (0 - 100)
 * Evaluates active DTC severity, quantity, and live freeze-frame telematics
 */
export function calculateHealthIndex(
  activeEvents: Array<{ severity: DtcSeverity; dtc_code: string }>,
  freezeFrame?: FreezeFrameData
): string {
  let score = new Decimal('100.00');

  // Deduct based on active faults
  for (const event of activeEvents) {
    if (event.severity === 'critical') {
      score = score.minus(new Decimal('35.00'));
    } else if (event.severity === 'moderate') {
      score = score.minus(new Decimal('15.00'));
    } else if (event.severity === 'minor') {
      score = score.minus(new Decimal('5.00'));
    } else {
      score = score.minus(new Decimal('1.00'));
    }
  }

  // Telematics Freeze-Frame telemetry penalties
  if (freezeFrame) {
    // Engine Coolant Temperature Overheating (> 102°C is high, > 107°C critical)
    if (freezeFrame.coolant_temp_c && freezeFrame.coolant_temp_c > 102) {
      const overTemp = freezeFrame.coolant_temp_c > 107 ? new Decimal('25.00') : new Decimal('12.00');
      score = score.minus(overTemp);
    }

    // Engine Oil Pressure Low (< 150 kPa warning, < 120 kPa critical)
    if (freezeFrame.oil_pressure_kpa && freezeFrame.oil_pressure_kpa < 150) {
      const lowOil = freezeFrame.oil_pressure_kpa < 120 ? new Decimal('25.00') : new Decimal('15.00');
      score = score.minus(lowOil);
    }

    // Battery System Under-voltage (24V system: < 23.5V is low, < 22.0V critical)
    if (freezeFrame.battery_voltage && freezeFrame.battery_voltage < 23.5) {
      score = score.minus(new Decimal('8.00'));
    }

    // AdBlue Empty / Critically Low (< 10%)
    if (freezeFrame.def_adblue_level_pct !== undefined && freezeFrame.def_adblue_level_pct < 10) {
      score = score.minus(new Decimal('10.00'));
    }
  }

  // Bound score strictly between 0.00 and 100.00
  if (score.isNegative()) {
    score = new Decimal('0.00');
  }
  if (score.greaterThan(100)) {
    score = new Decimal('100.00');
  }

  return score.toFixed(2);
}

/**
 * Calculates Breakdown Risk Probability (%)
 * Accounts for health score, critical faults, and corridor harshness
 */
export function calculateBreakdownRisk(
  healthIndexScore: DecimalValue,
  hasImmediateStop: boolean,
  corridor: string = 'DOMESTIC'
): string {
  const health = new Decimal(healthIndexScore);
  const healthDeficit = new Decimal('100.00').minus(health);

  // Base risk: health deficit multiplied by 1.15
  let risk = healthDeficit.times(new Decimal('1.15'));

  // Immediate stop fault guarantees at least 85% risk
  if (hasImmediateStop && risk.lessThan('85.00')) {
    risk = new Decimal('85.00');
  }

  // Corridor harshness multiplier
  if (corridor === 'MA-MR-SN') {
    // West African Sahara Corridor (extreme heat, desert dust, isolated road)
    risk = risk.times(new Decimal('1.25'));
  } else if (corridor === 'MA-ES-FR') {
    // European Corridor (strict motorway enforcement, high speeds)
    risk = risk.times(new Decimal('1.10'));
  }

  // Bound between 0.00% and 99.00%
  if (risk.isNegative()) risk = new Decimal('0.00');
  if (risk.greaterThan('99.00')) risk = new Decimal('99.00');

  return risk.toFixed(2);
}

/**
 * Calculates Financial Proactive Cost vs Breakdown Cost & Net Savings
 * ALL financial calculations use Decimal.js with 2 decimal places
 */
export function calculateFinancialImpact(
  partsCostMad: DecimalValue,
  laborHours: DecimalValue,
  catalogBreakdownCostMad: DecimalValue,
  corridor: string = 'DOMESTIC'
): {
  estimated_proactive_cost_mad: string;
  estimated_breakdown_cost_mad: string;
  estimated_savings_mad: string;
} {
  const parts = new Decimal(partsCostMad);
  const hours = new Decimal(laborHours);
  const laborCost = hours.times(HOURLY_LABOR_RATE_MAD);

  // Proactive cost = Parts + Labor
  const proactiveCost = parts.plus(laborCost);

  // Corridor breakdown multiplier (European recovery is much higher in EUR converted to MAD)
  let corridorMultiplier = new Decimal('1.00');
  if (corridor === 'MA-ES-FR') {
    corridorMultiplier = new Decimal('1.35'); // High European towing, AP-7/A10 impound & road assist
  } else if (corridor === 'MA-MR-SN') {
    corridorMultiplier = new Decimal('1.25'); // Sahara remote extraction & desert recovery costs
  }

  const breakdownCost = new Decimal(catalogBreakdownCostMad).times(corridorMultiplier);

  // Net Savings = Breakdown Cost - Proactive Cost
  let savings = breakdownCost.minus(proactiveCost);
  if (savings.isNegative()) {
    savings = new Decimal('0.00');
  }

  return {
    estimated_proactive_cost_mad: proactiveCost.toFixed(2),
    estimated_breakdown_cost_mad: breakdownCost.toFixed(2),
    estimated_savings_mad: savings.toFixed(2),
  };
}

/**
 * Aggregates Fleet Health Summary & High Risk Truck Alerts
 */
export function buildFleetHealthSummary(
  trucks: Array<{ id: number; plate_number: string; model?: string | null }>,
  events: FleetObdDiagnosticEvent[],
  recommendations: PredictiveMaintenanceRecommendation[]
): FleetHealthSummary {
  const totalTrucks = trucks.length;
  let criticalCount = 0;
  let moderateCount = 0;
  let minorCount = 0;

  // Group active events by truck
  const eventsByTruck = new Map<number, FleetObdDiagnosticEvent[]>();
  for (const event of events) {
    if (event.status !== 'active') continue;
    if (event.severity === 'critical') criticalCount++;
    else if (event.severity === 'moderate') moderateCount++;
    else if (event.severity === 'minor') minorCount++;

    const truckList = eventsByTruck.get(event.truck_id) || [];
    truckList.push(event);
    eventsByTruck.set(event.truck_id, truckList);
  }

  let totalHealthSum = new Decimal('0.00');
  const highRiskTrucks: HighRiskTruckAlert[] = [];
  let atRiskCount = 0;

  for (const truck of trucks) {
    const truckEvents = eventsByTruck.get(truck.id) || [];
    // Latest freeze-frame if any
    const latestEvent = truckEvents[0];
    const freezeFrame = latestEvent?.freeze_frame_data;

    const health = calculateHealthIndex(truckEvents, freezeFrame);
    const hasImmediateStop = truckEvents.some((e) => {
      const prof = lookupDtcProfile(e.dtc_code);
      return prof.urgency === 'immediate_stop';
    });
    const risk = calculateBreakdownRisk(health, hasImmediateStop, 'DOMESTIC');

    totalHealthSum = totalHealthSum.plus(new Decimal(health));

    const healthDec = new Decimal(health);
    const riskDec = new Decimal(risk);

    if (riskDec.greaterThan('40.00') || healthDec.lessThan('70.00') || truckEvents.length > 0) {
      if (riskDec.greaterThan('40.00') || healthDec.lessThan('70.00')) {
        atRiskCount++;
      }
      const topFault = latestEvent?.dtc_code || 'None';
      const severity = latestEvent?.severity || 'minor';
      const profile = lookupDtcProfile(topFault);

      highRiskTrucks.push({
        truck_id: truck.id,
        plate_number: truck.plate_number,
        model: truck.model,
        health_index: health,
        risk_pct: risk,
        top_fault: topFault,
        severity,
        urgency: profile.urgency,
        active_faults_count: truckEvents.length,
      });
    }
  }

  const avgHealth = totalTrucks > 0
    ? totalHealthSum.dividedBy(new Decimal(totalTrucks)).toFixed(2)
    : '100.00';

  // Aggregate recommendations financial projections
  let proactiveSum = new Decimal('0.00');
  let breakdownSum = new Decimal('0.00');
  let savingsSum = new Decimal('0.00');

  for (const rec of recommendations) {
    if (rec.status === 'completed' || rec.status === 'dismissed') continue;
    proactiveSum = proactiveSum.plus(new Decimal(rec.estimated_cost_mad || '0'));
    breakdownSum = breakdownSum.plus(new Decimal(rec.estimated_breakdown_cost_mad || '0'));
    savingsSum = savingsSum.plus(new Decimal(rec.estimated_savings_mad || '0'));
  }

  // Sort high risk trucks descending by risk percentage
  highRiskTrucks.sort((a, b) => new Decimal(b.risk_pct).minus(new Decimal(a.risk_pct)).toNumber());

  return {
    total_trucks_scanned: totalTrucks,
    average_fleet_health_index: avgHealth,
    critical_faults_count: criticalCount,
    moderate_faults_count: moderateCount,
    minor_faults_count: minorCount,
    trucks_at_breakdown_risk: atRiskCount,
    total_projected_proactive_cost_mad: proactiveSum.toFixed(2),
    total_projected_breakdown_cost_mad: breakdownSum.toFixed(2),
    total_net_savings_mad: savingsSum.toFixed(2),
    high_risk_trucks: highRiskTrucks,
  };
}
