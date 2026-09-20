import Decimal from 'decimal.js';
import { STANDARD_FOREX_RATES } from '@/lib/forex';
import { calculateRemainingDays } from '@/lib/utils/document-radar';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * محطة أو معبر حدودي على الممر الإفريقي البري الدولي
 * African Overland Trade Corridor Waypoint / Border Crossing
 */
export interface AfricanWaypoint {
  id: string;
  nameAr: string;
  nameFr: string;
  nameEs: string;
  nameEn: string;
  country: 'MA' | 'MR' | 'SN';
  latitude: number;
  longitude: number;
  radiusKm: number;
  zoneType: 'border_crossing' | 'customs_hub' | 'seaport' | 'logistics_platform';
  descriptionAr: string;
  descriptionFr: string;
}

/**
 * شبكة المحطات والمعابر الاستراتيجية الخمسة للممر الإفريقي البري
 */
export const AFRICAN_CORRIDOR_WAYPOINTS: Record<string, AfricanWaypoint> = {
  el_guerguerat: {
    id: 'el_guerguerat',
    nameAr: 'معبر الكركارات الحدودي (المغرب / موريتانيا)',
    nameFr: 'Poste Frontière El Guerguerat (Maroc / Mauritanie)',
    nameEs: 'Paso Fronterizo El Guerguerat (Marruecos / Mauritania)',
    nameEn: 'El Guerguerat Border Post (Morocco / Mauritania)',
    country: 'MA',
    latitude: 21.3656,
    longitude: -16.9583,
    radiusKm: 5.0,
    zoneType: 'border_crossing',
    descriptionAr: 'بوابة الخروج الجمركية والأمنية الجنوبية للمملكة المغربية نحو إفريقيا',
    descriptionFr: "Poste de douane et de sécurité frontalier sud du Maroc vers l'Afrique",
  },
  nouadhibou_freezone: {
    id: 'nouadhibou_freezone',
    nameAr: 'منطقة نواديبو الحرة اللوجستية (موريتانيا)',
    nameFr: 'Zone Franche de Nouadhibou (Mauritanie)',
    nameEs: 'Zona Franca de Nouadhibou (Mauritania)',
    nameEn: 'Nouadhibou Free Zone (Mauritania)',
    country: 'MR',
    latitude: 20.9412,
    longitude: -17.0347,
    radiusKm: 4.0,
    zoneType: 'customs_hub',
    descriptionAr: 'محطة التبادل الجمركي وتفريغ وتحميل المنتجات السمكية والبضائع',
    descriptionFr: 'Plateforme douanière et logistique de transbordement des produits halieutiques',
  },
  nouakchott_hub: {
    id: 'nouakchott_hub',
    nameAr: 'مركز نواكشوط اللوجستي وتفريغ الشاحنات (موريتانيا)',
    nameFr: 'Plateforme Logistique de Nouakchott (Mauritanie)',
    nameEs: 'Centro Logístico de Nuakchot (Mauritania)',
    nameEn: 'Nouakchott Logistics Hub (Mauritania)',
    country: 'MR',
    latitude: 18.0735,
    longitude: -15.9582,
    radiusKm: 5.0,
    zoneType: 'logistics_platform',
    descriptionAr: 'منصة تفريغ شاحنات التبريد والمواد التموينية واستراحة السائقين بالعاصمة',
    descriptionFr: 'Plateforme de déchargement frigorifique et relais de transport international',
  },
  rosso_border: {
    id: 'rosso_border',
    nameAr: 'معبر روصو الحدودي والعبارة النهرية (موريتانيا / السنغال)',
    nameFr: 'Poste Frontière et Bac de Rosso (Mauritanie / Sénégal)',
    nameEs: 'Paso Fronterizo y Ferry de Rosso (Mauritania / Senegal)',
    nameEn: 'Rosso Border Crossing & River Ferry (Mauritania / Senegal)',
    country: 'MR',
    latitude: 16.5133,
    longitude: -15.8083,
    radiusKm: 3.0,
    zoneType: 'border_crossing',
    descriptionAr: 'نقطة العبور النهرية الرئيسية بين موريتانيا والسنغال على نهر السنغال',
    descriptionFr: 'Point de traversée fluviale majeur entre la Mauritanie et le Sénégal',
  },
  dakar_port_hub: {
    id: 'dakar_port_hub',
    nameAr: 'ميناء ومستودعات توزيع دكار (السنغال)',
    nameFr: 'Port et Entrepôts Logistiques de Dakar (Sénégal)',
    nameEs: 'Puerto y Almacenes de Dakar (Senegal)',
    nameEn: 'Dakar Port & Distribution Warehouses (Senegal)',
    country: 'SN',
    latitude: 14.7167,
    longitude: -17.4677,
    radiusKm: 6.0,
    zoneType: 'seaport',
    descriptionAr: 'المحطة النهائية لشريان غرب إفريقيا اللوجستي ومستودعات التوزيع الإقليمي',
    descriptionFr: 'Terminus du corridor ouest-africain et plateformes de distribution sous-régionale',
  },
};

/**
 * تسعيرات الرسوم والخدمات القياسية للممر الإفريقي
 */
export const AFRICAN_CORRIDOR_STANDARD_FEES = {
  GUERGUERAT_CUSTOMS_FEE_MAD: new Decimal('1500.00'), // رسوم جمارك وتخليص الكركارات
  MAURITANIA_TRANSIT_FEE_MRU: new Decimal('9950.00'), // رسوم ترانزيت موريتانيا (~2500 درهم)
  ROSSO_FERRY_FEE_XOF: new Decimal('75000.00'), // رسوم عبارة روصو النهرية (~1150 درهم)
  ECOWAS_BROWN_CARD_FEE_XOF: new Decimal('52000.00'), // تأمين البطاقة البنية Carte Brune CEDEAO (~800 درهم)
  DRIVER_DAILY_ALLOWANCE_MAD: new Decimal('400.00'), // بدل الطريق اليومي للسائق بالممر الإفريقي
} as const;

export interface AfricanExpenseOptions {
  guergueratFeeMad?: number | string;
  mauritaniaFeeMru?: number | string;
  rossoFerryFeeXof?: number | string;
  ecowasFeeXof?: number | string;
  fuelLiters?: number | string;
  fuelPricePerLiterMad?: number | string;
  tripDays?: number;
}

export interface AfricanRoadExpenseBreakdown {
  guergueratBorderFeeMad: number;
  mauritaniaTransitFeeMru: number;
  rossoFerryFeeXof: number;
  ecowasInsuranceFeeXof: number;
  driverRoadAllowanceMad: number;
  fuelCostMad: number;
  totalCostInMad: number;
  totalCostInMru: number;
  totalCostInXof: number;
}

/**
 * حساب تسوية مصروفات الممر الإفريقي البري بالعملات المتعددة (MAD, MRU, XOF)
 * مع تطبيق صارم لمكتبة Decimal.js (القاعدة المالية الصارمة رقم 2)
 */
export function calculateAfricanRoadExpenses(
  options: AfricanExpenseOptions = {}
): AfricanRoadExpenseBreakdown {
  const guergueratFee = new Decimal(
    options.guergueratFeeMad ?? AFRICAN_CORRIDOR_STANDARD_FEES.GUERGUERAT_CUSTOMS_FEE_MAD
  );
  const mauritaniaFeeMru = new Decimal(
    options.mauritaniaFeeMru ?? AFRICAN_CORRIDOR_STANDARD_FEES.MAURITANIA_TRANSIT_FEE_MRU
  );
  const rossoFerryFeeXof = new Decimal(
    options.rossoFerryFeeXof ?? AFRICAN_CORRIDOR_STANDARD_FEES.ROSSO_FERRY_FEE_XOF
  );
  const ecowasFeeXof = new Decimal(
    options.ecowasFeeXof ?? AFRICAN_CORRIDOR_STANDARD_FEES.ECOWAS_BROWN_CARD_FEE_XOF
  );

  const fuelLiters = new Decimal(options.fuelLiters ?? 0);
  const fuelPrice = new Decimal(options.fuelPricePerLiterMad ?? '13.00');
  const fuelCostMad = fuelLiters.times(fuelPrice);

  const tripDays = options.tripDays ?? 6; // 6 أيام افتراضياً لمسار الكركارات - دكار ذهاباً وإياباً
  const driverAllowance = AFRICAN_CORRIDOR_STANDARD_FEES.DRIVER_DAILY_ALLOWANCE_MAD.times(tripDays);

  // تحويل كافة المصاريف إلى MAD بدقة Decimal.js الصارمة
  const mauritaniaFeeInMad = mauritaniaFeeMru.times(STANDARD_FOREX_RATES.MRU_TO_MAD);
  const rossoFerryFeeInMad = rossoFerryFeeXof.times(STANDARD_FOREX_RATES.XOF_TO_MAD);
  const ecowasFeeInMad = ecowasFeeXof.times(STANDARD_FOREX_RATES.XOF_TO_MAD);

  const totalCostInMadDec = guergueratFee
    .plus(mauritaniaFeeInMad)
    .plus(rossoFerryFeeInMad)
    .plus(ecowasFeeInMad)
    .plus(driverAllowance)
    .plus(fuelCostMad);

  const totalCostInMruDec = totalCostInMadDec.times(STANDARD_FOREX_RATES.MAD_TO_MRU);
  const totalCostInXofDec = totalCostInMadDec.times(STANDARD_FOREX_RATES.MAD_TO_XOF);

  return {
    guergueratBorderFeeMad: guergueratFee.toDecimalPlaces(2).toNumber(),
    mauritaniaTransitFeeMru: mauritaniaFeeMru.toDecimalPlaces(2).toNumber(),
    rossoFerryFeeXof: rossoFerryFeeXof.toDecimalPlaces(0).toNumber(),
    ecowasInsuranceFeeXof: ecowasFeeXof.toDecimalPlaces(0).toNumber(),
    driverRoadAllowanceMad: driverAllowance.toDecimalPlaces(2).toNumber(),
    fuelCostMad: fuelCostMad.toDecimalPlaces(2).toNumber(),
    totalCostInMad: totalCostInMadDec.toDecimalPlaces(2).toNumber(),
    totalCostInMru: totalCostInMruDec.toDecimalPlaces(2).toNumber(),
    totalCostInXof: totalCostInXofDec.toDecimalPlaces(0).toNumber(),
  };
}

/**
 * تقييم صلاحية تأشيرة الممر الإفريقي للسائق (موريتانيا / السنغال / غرب إفريقيا)
 */
export interface AfricanVisaEvaluation {
  status: 'valid' | 'expiring' | 'expired' | 'missing';
  daysRemaining: number;
  color: 'green' | 'amber' | 'rose' | 'slate';
  badgeLabelAr: string;
  badgeLabelFr: string;
  badgeLabelEs: string;
  isEligibleForAfricanTransit: boolean;
}

export function evaluateAfricanDriverVisa(
  visaExpiryDate?: string | Date | null,
  visaNumber?: string | null,
  baseDate: Date = new Date()
): AfricanVisaEvaluation {
  if (!visaExpiryDate || !visaNumber) {
    return {
      status: 'missing',
      daysRemaining: 9999,
      color: 'slate',
      badgeLabelAr: 'تأشيرة غير مسجلة',
      badgeLabelFr: 'Visa non enregistré',
      badgeLabelEs: 'Visado no registrado',
      isEligibleForAfricanTransit: false,
    };
  }

  const days = calculateRemainingDays(visaExpiryDate, baseDate);

  if (days < 0) {
    return {
      status: 'expired',
      daysRemaining: days,
      color: 'rose',
      badgeLabelAr: `منتهية منذ ${Math.abs(days)} يوم (ممنوع من العبور)`,
      badgeLabelFr: `Expiré depuis ${Math.abs(days)} j (interdit de transit)`,
      badgeLabelEs: `Expirado hace ${Math.abs(days)} d (tránsito no permitido)`,
      isEligibleForAfricanTransit: false,
    };
  }

  if (days <= 30) {
    return {
      status: 'expiring',
      daysRemaining: days,
      color: 'amber',
      badgeLabelAr: `توشك على الانتهاء (${days} يوم متبقي)`,
      badgeLabelFr: `Expire bientôt (${days} j restants)`,
      badgeLabelEs: `Expira pronto (${days} d restantes)`,
      isEligibleForAfricanTransit: true,
    };
  }

  return {
    status: 'valid',
    daysRemaining: days,
    color: 'green',
    badgeLabelAr: `سارية (${days} يوم متبقي)`,
    badgeLabelFr: `Valide (${days} j restants)`,
    badgeLabelEs: `Válido (${days} d restantes)`,
    isEligibleForAfricanTransit: true,
  };
}

/**
 * بنية كشف الترانزيت الجمركي الإفريقي ودفتر المرور
 * African Overland Transit Manifest (Déclaration TRIE / Carnet de Passage)
 */
export interface AfricanTransitManifest {
  manifestNumber: string;
  tripId: number;
  orderNumber: string;
  customsSealNumber: string; // رقم الختم الجمركي (Plomb Douanier)
  carnetDePassageNumber: string; // رقم دفتر المرور الدولي / تريبتيك إفريقي
  ecowasCardNumber: string; // رقم بطاقة التأمين البنية (Carte Brune CEDEAO)
  truckPlate: string;
  trailerPlate: string;
  driverName: string;
  driverCin: string;
  driverLicense: string;
  africanVisaNumber: string;
  africanVisaExpiry: string;
  loadingPoint: string;
  destinationPoint: string;
  transitWaypoints: string[];
  cargoDescription: string;
  cargoWeightKg: number;
  declaredValueMad: number;
  declaredValueMru: number;
  declaredValueXof: number;
  departureDate: string;
  corridorType: 'african_overland';
  borderCrossingStatus: 'pending' | 'cleared_guerguerat' | 'transit_mauritania' | 'delivered_senegal';
}

/**
 * توليد كشف الترانزيت الجمركي الإفريقي من بيانات الرحلة
 */
export function buildAfricanTransitManifest(params: {
  tripId: number;
  orderNumber: string;
  truckPlate: string;
  trailerPlate?: string;
  driverName: string;
  driverCin?: string;
  driverLicense?: string;
  africanVisaNumber?: string;
  africanVisaExpiry?: string;
  customsSealNumber?: string;
  carnetDePassageNumber?: string;
  ecowasCardNumber?: string;
  loadingPoint?: string;
  destinationPoint?: string;
  cargoDescription?: string;
  cargoWeightKg?: number;
  declaredValueMad?: number;
  departureDate?: string;
}): AfricanTransitManifest {
  const tripPadded = params.tripId.toString().padStart(5, '0');
  const manifestNum = `TRIE-AFR-${new Date().getFullYear()}-${tripPadded}`;
  const sealNum = params.customsSealNumber || `PLOMB-MA-${tripPadded}`;
  const carnetNum = params.carnetDePassageNumber || `CPD-MR-${tripPadded}`;
  const ecowasNum = params.ecowasCardNumber || `CB-CEDEAO-${tripPadded}`;

  const declaredMad = new Decimal(params.declaredValueMad || 250000);
  const declaredMru = declaredMad.times(STANDARD_FOREX_RATES.MAD_TO_MRU).toDecimalPlaces(2).toNumber();
  const declaredXof = declaredMad.times(STANDARD_FOREX_RATES.MAD_TO_XOF).toDecimalPlaces(0).toNumber();

  return {
    manifestNumber: manifestNum,
    tripId: params.tripId,
    orderNumber: params.orderNumber,
    customsSealNumber: sealNum,
    carnetDePassageNumber: carnetNum,
    ecowasCardNumber: ecowasNum,
    truckPlate: params.truckPlate,
    trailerPlate: params.trailerPlate || '---',
    driverName: params.driverName,
    driverCin: params.driverCin || '---',
    driverLicense: params.driverLicense || '---',
    africanVisaNumber: params.africanVisaNumber || '---',
    africanVisaExpiry: params.africanVisaExpiry || '---',
    loadingPoint: params.loadingPoint || 'أكادير / المغرب',
    destinationPoint: params.destinationPoint || 'دكار / السنغال',
    transitWaypoints: [
      AFRICAN_CORRIDOR_WAYPOINTS.el_guerguerat.nameAr,
      AFRICAN_CORRIDOR_WAYPOINTS.nouadhibou_freezone.nameAr,
      AFRICAN_CORRIDOR_WAYPOINTS.nouakchott_hub.nameAr,
      AFRICAN_CORRIDOR_WAYPOINTS.rosso_border.nameAr,
      AFRICAN_CORRIDOR_WAYPOINTS.dakar_port_hub.nameAr,
    ],
    cargoDescription: params.cargoDescription || 'خضروات وفواكه طازجة مبردة (Fresh Produce)',
    cargoWeightKg: params.cargoWeightKg || 24000,
    declaredValueMad: declaredMad.toDecimalPlaces(2).toNumber(),
    declaredValueMru: declaredMru,
    declaredValueXof: declaredXof,
    departureDate: params.departureDate || new Date().toISOString().split('T')[0],
    corridorType: 'african_overland',
    borderCrossingStatus: 'pending',
  };
}

