/**
 * Dynamic Freight Pricing & Instant Quotation Builder Service
 * Strictly adheres to Decimal.js financial precision rules.
 * Trans Bodanon TMS
 */

import Decimal from 'decimal.js';
import { STANDARD_FOREX_RATES, convertCurrency } from '@/lib/forex';
import { CORRIDOR_PRESETS } from '../types';
import type {
  CreateQuotationInput,
  FreightQuotation,
  QuotationCostBreakdown,
  QuotationTierDetail,
  PricingCurrency,
  PricingTierKey,
} from '../types/freight-quotation.types';
import type { CargoType, PricingCorridorType } from '../types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// Base CPK rates (Coût Par Kilomètre) in MAD/km
export const BASE_CPK_EUROPE_MAD = new Decimal('9.40');
export const BASE_CPK_AFRICA_MAD = new Decimal('10.85');

// Cargo Specific Additional Surcharges (MAD/km)
export const CARGO_CPK_SURCHARGE_MAD: Record<CargoType, InstanceType<typeof Decimal>> = {
  dry_box: new Decimal('0.00'),
  reefer_temperature_controlled: new Decimal('1.60'), // Frigo unit diesel & maintenance
  mega_curtain: new Decimal('0.50'),
  hazardous_adr: new Decimal('2.20'),
};

// Crossing & Transit Fees in MAD
export const FERRY_CROSSING_FEES_MAD = {
  tanger_med_algeciras: new Decimal('4600.00'),
  tanger_med_motril: new Decimal('6200.00'),
  nador_almeria: new Decimal('5100.00'),
  african_overland_transit: new Decimal('5800.00'), // Guerguerat, Rosso ferry, customs escort
};

// Legal VAT notices for International Freight (Article 92-I-10° du CGI Maroc)
export const VAT_EXEMPTION_NOTICE_AR =
  'إعفاء كلي من الضريبة على القيمة المضافة بموجب المادة 92-I-10° من المدونة العامة للضرائب (النقل الدولي للبضائع)';
export const VAT_EXEMPTION_NOTICE_FR =
  "Exonération totale de TVA en vertu de l'article 92-I-10° du Code Général des Impôts (Transport international de marchandises)";
export const VAT_EXEMPTION_NOTICE_ES =
  'Exención total del IVA en virtud del artículo 92-I-10° del Código General de Impuestos (Transporte internacional de mercancías)';

/**
 * Resolves corridor type from cities and presets.
 */
export function resolveQuotationCorridor(
  origin: string,
  destination: string,
  forcedCorridor?: PricingCorridorType
): PricingCorridorType {
  if (forcedCorridor) return forcedCorridor;

  const destLower = destination.toLowerCase().trim();
  const africanDestinations = [
    'nouakchott',
    'dakar',
    'nouadhibou',
    'rosso',
    'bamako',
    'senegal',
    'mauritania',
    'guerguerat',
  ];

  if (africanDestinations.some((d) => destLower.includes(d))) {
    return 'african_overland';
  }

  const preset = CORRIDOR_PRESETS.find(
    (p) =>
      p.originCity.toLowerCase() === origin.toLowerCase() &&
      p.destCity.toLowerCase() === destination.toLowerCase()
  );

  return preset?.corridorType || 'european_maritime';
}

/**
 * Builds quotation cost breakdown using Decimal.js.
 */
export function calculateQuotationCostBreakdown(params: {
  distanceKm: number;
  corridorType: PricingCorridorType;
  cargoType: CargoType;
  currency: PricingCurrency;
  targetMarginPercent: number;
}): QuotationCostBreakdown {
  const distDec = new Decimal(params.distanceKm);
  const isAfrican = params.corridorType === 'african_overland';

  // 1. Base CPK Rate
  const baseCpk = isAfrican ? BASE_CPK_AFRICA_MAD : BASE_CPK_EUROPE_MAD;
  const cargoSurcharge = CARGO_CPK_SURCHARGE_MAD[params.cargoType] || new Decimal('0.00');
  const effectiveCpk = baseCpk.plus(cargoSurcharge);
  const cpkDistanceCost = distDec.times(effectiveCpk);

  // 2. Fuel Component
  // Standard consumption 36 L/100km * fuel pump price (~13.20 MAD)
  const fuelLiters = distDec.times(new Decimal('0.36'));
  const fuelPricePerLiter = isAfrican ? new Decimal('13.80') : new Decimal('14.20');
  const fuelCost = fuelLiters.times(fuelPricePerLiter);

  // 3. Ferry and Border Crossing Fees
  const ferryCost = isAfrican
    ? FERRY_CROSSING_FEES_MAD.african_overland_transit
    : FERRY_CROSSING_FEES_MAD.tanger_med_algeciras;

  // 4. Tolls & Autoroute Taxes
  // Africa: 0 tolls; Europe: Morocco tolls + European tolls
  const tollsCost = isAfrican
    ? new Decimal('0.00')
    : distDec.times(new Decimal('0.85')); // Average blended tolls/km

  // 5. Driver International Allowances (0.75 MAD/km)
  const driverAllowances = distDec.times(new Decimal('0.75'));

  // 6. Reefer GenSet Unit Cost
  const reeferCost =
    params.cargoType === 'reefer_temperature_controlled'
      ? distDec.times(new Decimal('1.25'))
      : new Decimal('0.00');

  // 7. Overhead & Emergency Risk Buffer (Fixed 800 MAD + 2.5% buffer)
  const directSubtotal = cpkDistanceCost
    .plus(fuelCost)
    .plus(ferryCost)
    .plus(tollsCost)
    .plus(driverAllowances)
    .plus(reeferCost);

  const overheadBuffer = new Decimal('800.00').plus(
    directSubtotal.times(new Decimal('0.025'))
  );

  const totalDirectCostMad = directSubtotal.plus(overheadBuffer);

  // Convert to target currency
  const totalDirectCostTarget = new Decimal(
    convertCurrency(totalDirectCostMad, 'MAD', params.currency)
  );

  const targetMarginDec = new Decimal(params.targetMarginPercent).dividedBy(100);
  const marginAmountTarget = totalDirectCostTarget.times(targetMarginDec);
  const netFreightPriceTarget = totalDirectCostTarget.plus(marginAmountTarget);

  return {
    baseCpkRateMad: effectiveCpk.toFixed(2),
    distanceKm: params.distanceKm,
    cpkDistanceCostMad: cpkDistanceCost.toFixed(2),
    fuelTotalCostMad: fuelCost.toFixed(2),
    ferryAndTransitCostMad: ferryCost.toFixed(2),
    tollsCostMad: tollsCost.toFixed(2),
    driverAllowancesCostMad: driverAllowances.toFixed(2),
    reeferCostMad: reeferCost.toFixed(2),
    overheadBufferMad: overheadBuffer.toFixed(2),
    totalDirectCostMad: totalDirectCostMad.toFixed(2),
    totalDirectCostSelectedCurrency: totalDirectCostTarget.toFixed(2),
    marginAmountSelectedCurrency: marginAmountTarget.toFixed(2),
    netFreightPriceSelectedCurrency: netFreightPriceTarget.toFixed(2),
  };
}

/**
 * Builds the 3 strategic commercial tiers: Floor, Spot (Recommended), and Express Premium.
 */
export function buildQuotationTiers(
  totalDirectCostMad: InstanceType<typeof Decimal>,
  currency: PricingCurrency,
  targetMarginPercent: number
): Record<PricingTierKey, QuotationTierDetail> {
  const costInCurrency = new Decimal(
    convertCurrency(totalDirectCostMad, 'MAD', currency)
  );

  // Floor Tier: 12% margin
  const floorMargin = new Decimal('12.0');
  const floorNet = costInCurrency.times(new Decimal('1').plus(floorMargin.dividedBy(100)));

  // Spot Tier: Recommended target margin (e.g. 22%)
  const spotMargin = new Decimal(targetMarginPercent || 22);
  const spotNet = costInCurrency.times(new Decimal('1').plus(spotMargin.dividedBy(100)));

  // Express Premium Tier: 32% margin
  const expressMargin = new Decimal('32.0');
  const expressNet = costInCurrency.times(new Decimal('1').plus(expressMargin.dividedBy(100)));

  const formatPrice = (p: InstanceType<typeof Decimal>) => {
    return currency === 'XOF' ? p.toFixed(0) : p.toFixed(2);
  };

  return {
    floor: {
      tierKey: 'floor',
      nameAr: 'السعر الأدنى التعاقدي (Floor Rate)',
      nameFr: 'Tarif Plancher Contractuel (Floor)',
      nameEs: 'Tarifa Mínima Contractual (Floor)',
      descriptionAr: 'هامش أمان أساسي للعملاء الدائمين وأحجام الشحن الكبيرة',
      descriptionFr: 'Marge minimale pour volumes réguliers et grands comptes',
      descriptionEs: 'Margen mínimo para clientes habituales y grandes volúmenes',
      marginPercent: floorMargin.toNumber(),
      netPrice: formatPrice(floorNet),
      totalPriceWithVat: formatPrice(floorNet), // 0% VAT
      isRecommended: false,
    },
    spot: {
      tierKey: 'spot',
      nameAr: 'السعر الفوري الموصى به (Spot Standard)',
      nameFr: 'Tarif Spot Standard (Recommandé)',
      nameEs: 'Tarifa Spot Estándar (Recomendada)',
      descriptionAr: 'التسعير التنافسي الموصى به مع توازن الهامش التشغيلي',
      descriptionFr: 'Tarif spot optimal combinant compétitivité et marge',
      descriptionEs: 'Tarifa spot óptima que combina competitividad y margen',
      marginPercent: spotMargin.toNumber(),
      netPrice: formatPrice(spotNet),
      totalPriceWithVat: formatPrice(spotNet),
      isRecommended: true,
    },
    expressPremium: {
      tierKey: 'expressPremium',
      nameAr: 'الخدمة الممتازة السريعة (Express Premium)',
      nameFr: 'Service Express Prioritaire (Premium)',
      nameEs: 'Servicio Exprés Prioritario (Premium)',
      descriptionAr: 'أولوية شحن فورية، سائق مزدوج، وضمان زمني للوصول',
      descriptionFr: 'Priorité d’embarquement, double équipage et transit garanti',
      descriptionEs: 'Prioridad de embarque, doble conductor y tránsito garantizado',
      marginPercent: expressMargin.toNumber(),
      netPrice: formatPrice(expressNet),
      totalPriceWithVat: formatPrice(expressNet),
      isRecommended: false,
    },
  };
}

/**
 * Master function to build a complete formal Freight Quotation.
 */
export function buildFreightQuotation(input: CreateQuotationInput): FreightQuotation {
  const timestamp = new Date().toISOString();
  const validityDays = input.validityDays || 15;
  const validUntilDate = new Date();
  validUntilDate.setDate(validUntilDate.getDate() + validityDays);

  const corridorType = resolveQuotationCorridor(
    input.originCity,
    input.destinationCity,
    input.corridorType
  );

  // Resolve distance
  let distanceKm = input.roadDistanceKm || 2000;
  if (!input.roadDistanceKm) {
    const preset = CORRIDOR_PRESETS.find(
      (p) =>
        p.originCity.toLowerCase() === input.originCity.toLowerCase() &&
        p.destCity.toLowerCase() === input.destinationCity.toLowerCase()
    );
    if (preset) distanceKm = preset.distanceKm;
  }

  const currency: PricingCurrency = input.currency || 'MAD';
  const targetMargin = input.targetMarginPercent || 22;
  const selectedTierKey: PricingTierKey = input.selectedTier || 'spot';

  // Cost Breakdown calculation
  const breakdown = calculateQuotationCostBreakdown({
    distanceKm,
    corridorType,
    cargoType: input.cargoType,
    currency,
    targetMarginPercent: targetMargin,
  });

  const totalCostMadDec = new Decimal(breakdown.totalDirectCostMad);

  // Generate Tiers
  const tiers = buildQuotationTiers(totalCostMadDec, currency, targetMargin);
  const selectedTier = tiers[selectedTierKey];

  // Unique ID and Reference
  const quoteId = `qt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const corridorCode = corridorType === 'african_overland' ? 'AFR' : 'EUR';
  const quotationNumber = `QT-2026-${corridorCode}-${String(
    Math.floor(1000 + Math.random() * 9000)
  )}`;

  // Exchange rate to MAD string
  let rateStr = '1.00';
  if (currency === 'EUR') rateStr = STANDARD_FOREX_RATES.EUR_TO_MAD.toFixed(4);
  else if (currency === 'MRU') rateStr = STANDARD_FOREX_RATES.MRU_TO_MAD.toFixed(4);
  else if (currency === 'XOF') rateStr = STANDARD_FOREX_RATES.XOF_TO_MAD.toFixed(4);

  return {
    id: quoteId,
    quotationNumber,
    status: 'DRAFT',
    clientId: input.clientId,
    clientName: input.clientName,
    clientEmail: input.clientEmail,
    clientPhone: input.clientPhone,
    originCity: input.originCity,
    destinationCity: input.destinationCity,
    corridorType,
    totalDistanceKm: distanceKm,
    cargoType: input.cargoType,
    weightTons: input.weightTons || 22,
    targetMarginPercent: targetMargin,
    currency,
    exchangeRateToMad: rateStr,
    costBreakdown: breakdown,
    selectedTier: selectedTierKey,
    tiers,
    finalPrice: selectedTier.netPrice,
    vatRatePercent: 0,
    vatAmount: '0.00',
    vatExemptionLegalNoticeAr: VAT_EXEMPTION_NOTICE_AR,
    vatExemptionLegalNoticeFr: VAT_EXEMPTION_NOTICE_FR,
    vatExemptionLegalNoticeEs: VAT_EXEMPTION_NOTICE_ES,
    totalPriceWithVat: selectedTier.totalPriceWithVat,
    validUntil: validUntilDate.toISOString(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

