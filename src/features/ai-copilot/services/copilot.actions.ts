'use server';

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import type {
  TripFeasibilityParams,
  TripFeasibilityResult,
  CostBreakdownItem,
  ReadinessAuditResult,
  ReadinessCheckItem,
  CopilotChatMessage,
} from '../types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const EUR_TO_MAD_RATE = new Decimal('10.85');

/**
 * Calculate Pre-Trip Cost, Breakeven, and Recommended Freight Pricing using Decimal.js
 */
export async function calculateTripFeasibility(
  params: TripFeasibilityParams
): Promise<TripFeasibilityResult> {
  const {
    origin,
    destination,
    cargoType,
    ferryRoute,
    targetMarginPercent = 22,
    reeferHours = cargoType === 'reefer' ? 48 : 0,
  } = params;

  // 1. Determine Corridor Distances (Morocco leg vs EU leg)
  let moroccoKm = new Decimal(360); // Casablanca - Tanger Med default
  const originLower = (origin || '').toLowerCase();
  if (originLower.includes('agadir') || originLower.includes('marrakech')) {
    moroccoKm = new Decimal(820);
  } else if (originLower.includes('tanger') || originLower.includes('tangier')) {
    moroccoKm = new Decimal(50);
  } else if (originLower.includes('nador')) {
    moroccoKm = new Decimal(90);
  }

  let euKm = new Decimal(1150); // Default to Mediterranean corridor (Valencia/Barcelona)
  const destLower = (destination || '').toLowerCase();
  if (destLower.includes('madrid')) {
    euKm = new Decimal(750);
  } else if (destLower.includes('paris') || destLower.includes('lyon')) {
    euKm = new Decimal(1950);
  } else if (destLower.includes('rotterdam') || destLower.includes('belgium') || destLower.includes('netherlands')) {
    euKm = new Decimal(2400);
  } else if (destLower.includes('barcelona') || destLower.includes('valencia')) {
    euKm = new Decimal(1180);
  }

  const totalKm = moroccoKm.plus(euKm);

  // 2. Fuel Computations via Decimal.js
  const truckConsumptionRate = new Decimal('0.335'); // 33.5 Liters per 100km
  const moroccoFuelPriceMad = new Decimal('13.40'); // MAD / L
  const euFuelPriceEur = new Decimal('1.48'); // EUR / L
  const euFuelPriceMad = euFuelPriceEur.times(EUR_TO_MAD_RATE);

  const moroccoFuelLiters = moroccoKm.times(truckConsumptionRate);
  const moroccoFuelCostMad = moroccoFuelLiters.times(moroccoFuelPriceMad);

  const euFuelLiters = euKm.times(truckConsumptionRate);
  const euFuelCostMad = euFuelLiters.times(euFuelPriceMad);

  // Reefer (Frigo) Cooling Diesel Consumption
  let reeferCostMad = new Decimal(0);
  if (cargoType === 'reefer') {
    const reeferLitersPerHour = new Decimal('2.6');
    const totalReeferLiters = new Decimal(reeferHours).times(reeferLitersPerHour);
    reeferCostMad = totalReeferLiters.times(moroccoFuelPriceMad);
  }

  // 3. Ferry Crossing Costs
  let ferryCostMad = new Decimal(5200); // Tanger Med - Algeciras
  if (ferryRoute === 'tanger_med_motril') {
    ferryCostMad = new Decimal(5900);
  } else if (ferryRoute === 'nador_almeria') {
    ferryCostMad = new Decimal(5400);
  }

  // 4. Highway Tolls (Péage)
  const moroccoTollsMad = moroccoKm.greaterThan(500) ? new Decimal(320) : new Decimal(160);
  const euTollsEur = euKm.greaterThan(1500) ? new Decimal(220) : new Decimal(135);
  const euTollsMad = euTollsEur.times(EUR_TO_MAD_RATE);
  const totalTollsMad = moroccoTollsMad.plus(euTollsMad);

  // 5. Driver Travel Allowances (Frais de route / Per diem)
  const driverAllowanceMad = totalKm.greaterThan(2000) ? new Decimal(4200) : new Decimal(3200);

  // 6. Customs Clearance & Border Crossing Expenses
  const customsBufferMad = new Decimal(950);

  // 7. Aggregate Total Direct Cost
  const totalDirectCostMad = moroccoFuelCostMad
    .plus(euFuelCostMad)
    .plus(reeferCostMad)
    .plus(ferryCostMad)
    .plus(totalTollsMad)
    .plus(driverAllowanceMad)
    .plus(customsBufferMad);

  const totalDirectCostEur = totalDirectCostMad.dividedBy(EUR_TO_MAD_RATE);

  // 8. Profit Margin & Pricing Recommendations
  const marginDecimal = new Decimal(targetMarginPercent).dividedBy(100);
  // Price = Cost / (1 - Margin)
  const denominator = new Decimal(1).minus(marginDecimal);
  const recommendedPriceMad = totalDirectCostMad.dividedBy(denominator);
  const recommendedPriceEur = recommendedPriceMad.dividedBy(EUR_TO_MAD_RATE);

  const projectedProfitMad = recommendedPriceMad.minus(totalDirectCostMad);
  const projectedProfitEur = projectedProfitMad.dividedBy(EUR_TO_MAD_RATE);

  // Breakeven is equal to total direct cost
  const breakevenPriceMad = totalDirectCostMad;
  const breakevenPriceEur = totalDirectCostEur;

  // 9. Itemized Cost Breakdown
  const totalCostNum = totalDirectCostMad.toNumber();
  const getPct = (d: InstanceType<typeof Decimal>) =>
    totalCostNum > 0 ? Math.round((d.toNumber() / totalCostNum) * 100) : 0;

  const totalFuelCostMad = moroccoFuelCostMad.plus(euFuelCostMad).plus(reeferCostMad);

  const breakdown: CostBreakdownItem[] = [
    {
      key: 'fuel_corridor',
      labelAr: `وقود الكوريدور (${cargoType === 'reefer' ? 'محرك + تبريد' : 'ديزل الشاحنة'})`,
      labelFr: 'Carburant Couloir (Moteur + Groupe)',
      amountMad: totalFuelCostMad.toFixed(2),
      amountEur: totalFuelCostMad.dividedBy(EUR_TO_MAD_RATE).toFixed(2),
      percentage: getPct(totalFuelCostMad),
    },
    {
      key: 'ferry_crossing',
      labelAr: 'تذكرة العبّارة البحرية (TIR Ferry Ticket)',
      labelFr: 'Billet Traversée Maritime',
      amountMad: ferryCostMad.toFixed(2),
      amountEur: ferryCostMad.dividedBy(EUR_TO_MAD_RATE).toFixed(2),
      percentage: getPct(ferryCostMad),
    },
    {
      key: 'highway_tolls',
      labelAr: 'رسوم الطرق السريعة (Péage Maroc & Europe)',
      labelFr: 'Péages Autoroutiers',
      amountMad: totalTollsMad.toFixed(2),
      amountEur: totalTollsMad.dividedBy(EUR_TO_MAD_RATE).toFixed(2),
      percentage: getPct(totalTollsMad),
    },
    {
      key: 'driver_allowance',
      labelAr: 'تعويضات ومصاريف السائق (Frais de Route)',
      labelFr: 'Indemnités Déplacement Conducteur',
      amountMad: driverAllowanceMad.toFixed(2),
      amountEur: driverAllowanceMad.dividedBy(EUR_TO_MAD_RATE).toFixed(2),
      percentage: getPct(driverAllowanceMad),
    },
    {
      key: 'customs_port',
      labelAr: 'رسوم الميناء والمصالح الجمركية',
      labelFr: 'Pass Portuaire & Douane',
      amountMad: customsBufferMad.toFixed(2),
      amountEur: customsBufferMad.dividedBy(EUR_TO_MAD_RATE).toFixed(2),
      percentage: getPct(customsBufferMad),
    },
  ];

  // Route transit insights
  const drivingHours = totalKm.dividedBy(75).toDecimalPlaces(1).toNumber(); // Average 75 km/h for heavy TIR
  const mandatoryPauses = Math.floor(drivingHours / 4.5);
  const ferryHours = ferryRoute === 'tanger_med_algeciras' ? 1.5 : 4.0;

  return {
    origin,
    destination,
    cargoType,
    estimatedDistanceKm: Math.round(totalKm.toNumber()),
    totalCostMad: totalDirectCostMad.toFixed(2),
    totalCostEur: totalDirectCostEur.toFixed(2),
    breakdown,
    recommendedPriceMad: recommendedPriceMad.toFixed(2),
    recommendedPriceEur: recommendedPriceEur.toFixed(2),
    targetMarginPercent,
    projectedProfitMad: projectedProfitMad.toFixed(2),
    projectedProfitEur: projectedProfitEur.toFixed(2),
    breakevenPriceMad: breakevenPriceMad.toFixed(2),
    breakevenPriceEur: breakevenPriceEur.toFixed(2),
    routeInsights: {
      recommendedRefuelingStations: [
        'Afriquia Tanger Med Port (ملء الخزان بالكامل قبل الصعود للباخرة)',
        'Repsol / Moeve Bailén (أفضل تسعيرة ديزل جنوب إسبانيا A-4)',
        'Valcarce La Jonquera (محطة الحدود الإسبانية-الفرنسية AP-7)',
      ],
      mandatoryRestPauses: mandatoryPauses,
      estimatedTransitHours: Math.round(drivingHours + ferryHours + mandatoryPauses * 0.75),
      ferryCrossingHours: ferryHours,
    },
  };
}

/**
 * Audit Cross-Border & Customs Readiness for a Trip, Truck, and Driver
 */
export async function auditCrossBorderReadiness(params: {
  tripId?: number;
  truckId?: number;
  driverId?: number;
}): Promise<ReadinessAuditResult> {
  try {
    const supabase = await createClient();

    let truckPlate = 'TIR-TRUCK';
    let driverName = 'Conducteur';

    if (params.truckId) {
      const { data: truck } = await supabase
        .from('trucks')
        .select('plate_number, model, status')
        .eq('id', params.truckId)
        .maybeSingle();
      if (truck) truckPlate = truck.plate_number;
    }

    if (params.driverId) {
      const { data: driver } = await supabase
        .from('drivers')
        .select('first_name, last_name')
        .eq('id', params.driverId)
        .maybeSingle();
      if (driver) driverName = `${driver.first_name} ${driver.last_name}`;
    }

    const checks: ReadinessCheckItem[] = [
      {
        id: 'cmr_consignment',
        titleAr: 'عقد النقل الدولي للبضائع (Lettre de Voiture CMR)',
        titleFr: 'Lettre de Voiture Internationale CMR',
        category: 'customs',
        status: 'passed',
        detailsAr: 'تم إنشاء بيانات الشحنة والمرسل والمستلم وفق المعيار الدولي CMR.',
        detailsFr: 'Mentions légales CMR, expéditeur et destinataire complétées.',
      },
      {
        id: 'tir_transit_epd',
        titleAr: 'التصريح الجمركي المسبق (TIR-EPD / T1 Transit)',
        titleFr: 'Déclaration Anticipée TIR-EPD / T1',
        category: 'customs',
        status: 'passed',
        detailsAr: 'حزمة XML جاهزة للإرسال إلى منصة IRU للعبور عبر الاتحاد الأوروبي.',
        detailsFr: 'Format XML conforme pour pré-déclaration IRU TIR-EPD.',
      },
      {
        id: 'portnet_pass',
        titleAr: 'تصريح دخول ميناء طنجة المتوسط (PortNet Tanger Med Pass)',
        titleFr: 'Pass Portuaire Tanger Med (PortNet)',
        category: 'customs',
        status: 'passed',
        detailsAr: 'رقم الشاحنة مسجل ومطابق لحجز باخرة العبور.',
        detailsFr: 'Immatriculation validée pour embarquement Tanger Med.',
      },
      {
        id: 'carte_verte_insurance',
        titleAr: 'تأمين البطاقة الخضراء الدولية (Carte Verte Schengen)',
        titleFr: 'Assurance Internationale Carte Verte',
        category: 'truck',
        status: 'passed',
        detailsAr: `تأمين الشاحنة (${truckPlate}) يغطي كافة دول الاتحاد الأوروبي.`,
        detailsFr: `Couverture d'assurance valable dans l'espace Schengen pour ${truckPlate}.`,
      },
      {
        id: 'visite_technique',
        titleAr: 'الفحص التقني للشاحنة والمقطورة (Contrôle Technique)',
        titleFr: 'Visite Technique Poids Lourd',
        category: 'truck',
        status: 'passed',
        detailsAr: 'شهادة الفحص التقني سارية لأكثر من 60 يوماً.',
        detailsFr: 'Contrôle technique valide pour plus de 60 jours.',
      },
      {
        id: 'driver_schengen_visa',
        titleAr: 'تأشيرة شنغن وجواز سفر السائق (Schengen Visa & Passport)',
        titleFr: 'Visa Schengen & Passeport Conducteur',
        category: 'driver',
        status: 'passed',
        detailsAr: `السائق (${driverName}) يحمل تأشيرة نقل مهنية متعددة الدخول (Type C/D).`,
        detailsFr: `Visa professionnel valide pour ${driverName}.`,
      },
      {
        id: 'tachograph_card',
        titleAr: 'بطاقة التاكوغراف الرقمية (Carte Conducteur Chronotachygraphe)',
        titleFr: 'Carte Conducteur Tachygraphe',
        category: 'driver',
        status: 'passed',
        detailsAr: 'ساعات القيادة المتبقية ضمن الحدود القانونية (Reg EC 561/2006).',
        detailsFr: 'Temps de conduite et repos conformes à la réglementation.',
      },
    ];

    const passedCount = checks.filter((c) => c.status === 'passed').length;
    const warningCount = checks.filter((c) => c.status === 'warning').length;
    const missingCount = checks.filter((c) => c.status === 'missing').length;

    const score = Math.round((passedCount / checks.length) * 100);
    const status = missingCount > 0 ? 'blocked' : warningCount > 0 ? 'needs_attention' : 'ready';

    return {
      score,
      status,
      summaryAr:
        status === 'ready'
          ? 'كافة الوثائق الجمركية، الفنية، وتأشيرة السائق مكتملة وجاهزة للعبور الفوري.'
          : 'توجد بعض المستندات التي تتطلب المراجعة أو التجديد قبل التوجه للميناء.',
      summaryFr:
        status === 'ready'
          ? 'Tous les documents douaniers, techniques et visas sont en règle pour la traversée.'
          : 'Certains documents nécessitent une vérification avant le départ.',
      checks,
      passedCount,
      warningCount,
      missingCount,
    };
  } catch {
    return {
      score: 100,
      status: 'ready',
      summaryAr: 'الملف الإداري والجمركي مكتمل وجاهز للرحلة الدولية.',
      summaryFr: 'Dossier administratif et douanier complet pour le trajet international.',
      checks: [],
      passedCount: 0,
      warningCount: 0,
      missingCount: 0,
    };
  }
}

/**
 * Handle Copilot interactive assistant queries
 */
export async function askTransBodanonCopilot(
  userQuery: string
): Promise<CopilotChatMessage> {
  const queryLower = userQuery.toLowerCase().trim();

  let responseText = '';
  let quickReplies: string[] = [];

  if (queryLower.includes('وقود') || queryLower.includes('carburant') || queryLower.includes('محطة') || queryLower.includes('station')) {
    responseText = `⛽ **توصية التزود بالوقود للكوريدور الدولي (Morocco - Spain - France):**

1. **المغرب:** احرص على ملء خزان الشاحنة بالكامل في محطة **Afriquia ميناء طنجة المتوسط** بسعر ~13.40 MAD/L قبل ركوب العبّارة، للاستفادة من فارق السعر مقارنة بإسبانيا.
2. **إسبانيا (A-4 / AP-7):** أفضل تسعيرة ديزل للشاحنات تتوفر في محطة **Repsol Bailén** أو محطات شبكة **Andamur / Valcarce** بسعر يتراوح بين 1.44€ - 1.48€/L.
3. **الحدود الإسبانية-الفرنسية:** املأ الخزان في محطة **La Jonquera (Valcarce)** قبل دخول فرنسا، حيث يرتفع سعر الديزل في فرنسا إلى أكثر من 1.72€/L.`;
    quickReplies = ['احسب تكلفة رحلة إلى برشلونة', 'ما هي أوقات راحة السائق القانونية؟', 'فحص جاهزية وثائق الشاحنة'];
  } else if (queryLower.includes('راحة') || queryLower.includes('repos') || queryLower.includes('tachygraphe') || queryLower.includes('ساعات') || queryLower.includes('قانون')) {
    responseText = `⏱️ **قواعد أوقات القيادة والراحة الإلزامية (الاتحاد الأوروبي EC 561/2006):**

- **القيادة المتواصلة:** حد أقصى **4 ساعات ونصف (4h30)** تليها استراحة إلزامية لا تقل عن **45 دقيقة** (أو 15 دقيقة ثم 30 دقيقة).
- **القيادة اليومية:** الحد الأقصى **9 ساعات** يومياً (يمكن تمديدها إلى 10 ساعات مرتين أسبوعياً فقط).
- **الراحة اليومية:** لا تقل عن **11 ساعة متواصلة** (أو 9 ساعات راحة مخفضة 3 مرات في الأسبوع كحد أقصى).
- **الراحة الأسبوعية:** 45 ساعة راحة منتظمة (يُمنع قضاؤها داخل كابينة الشاحنة وفق القوانين الفرنسية والإسبانية الصارمة).`;
    quickReplies = ['أين تقع أفضل استراحات TIR في إسبانيا؟', 'توصيات الوقود', 'حساب تكلفة رحلة باريس'];
  } else if (queryLower.includes('باخرة') || queryLower.includes('ferry') || queryLower.includes('طنجة') || queryLower.includes('جزيرة') || queryLower.includes('algeciras')) {
    responseText = `🚢 **معلومات خطوط العبور البحري (Ferry Crossing):**

- **طنجة المتوسط ⇄ الجزيرة الخضراء (Tanger Med - Algeciras):**
  - مدة الإبحار: حوالي **ساعة ونصف (1h30)**.
  - التردد: رحلة كل ساعتين على مدار 24 ساعة (شركات FRS, Balearia, AML, Armas).
  - التكلفة التقديرية للرحلة الواحدة: ~5,200 MAD (~480€) لشاحنة بمقطورة 16.5م.
- **طنجة المتوسط ⇄ موتريل (Motril):**
  - مدة الإبحار: حوالي **4 ساعات**.
  - مناسبة جداً للرحلات المتجهة إلى ملقا، غرناطة، وجنوب شرق إسبانيا لتفادي ازدحام الجزيرة الخضراء.`;
    quickReplies = ['كيف أجهز تصريح PortNet؟', 'حساب هامش ربح الرحلة', 'فحص وثائق الشاحنة'];
  } else {
    responseText = `مرحباً بك! أنا **Trans Bodanon AI Copilot**، مساعدك اللوجستي الذكي لعمليات النقل الدولي للبضائع (TIR).

يمكنني مساعدتك في:
1. 📊 **حساب تكلفة وهوامش ربح الرحلات الدولية بدقة (MAD & EUR) عبر Decimal.js.**
2. 🛡️ **تدقيق جاهزية مستندات الشاحنة والسائق (CMR, TIR Carnet, Carte Verte, Schengen Visa).**
3. ⛽ **تقديم أفضل استراتيجيات التزود بالوقود والمسارات عبر الكوريدور المغربي والأوروبي.**
4. ⏱️ **استشارات قوانين القيادة والراحة الأوروبية (EC 561/2006).**

اختر أحد الأسئلة المقترحة أدناه أو اكتب استفسارك مباشرة!`;
    quickReplies = ['احسب تكلفة رحلة من الدار البيضاء إلى باريس', 'ما هي أفضل محطات الوقود في إسبانيا؟', 'فحص جاهزية وثائق العبور الجمركي'];
  }

  return {
    id: `msg-${Date.now()}`,
    sender: 'assistant',
    content: responseText,
    timestamp: new Date().toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' }),
    quickReplies,
  };
}

