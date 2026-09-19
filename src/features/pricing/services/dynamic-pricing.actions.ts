'use server';

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import { convertCurrency, STANDARD_FOREX_RATES } from '@/lib/forex';
import {
  type DynamicPricingParams,
  type DynamicPricingQuote,
  type PricingCostBreakdown,
  type CorridorPreset,
  type PricingCorridorType,
  CORRIDOR_PRESETS,
} from '../types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// Constants for logistical pricing
const DIESEL_PRICE_MAD_LITER = new Decimal('12.85'); // Morocco average pump price
const DIESEL_PRICE_EUR_LITER = new Decimal('1.55'); // Spain/France average pump price
const DIESEL_PRICE_AFRICA_MAD_LITER = new Decimal('14.20'); // Mauritania/Senegal average equivalent
const DEFAULT_EXCHANGE_RATE = new Decimal('10.90'); // MAD per EUR

const FERRY_COSTS_MAD: Record<string, InstanceType<typeof Decimal>> = {
  tanger_med_algeciras: new Decimal('4600.00'),
  tanger_med_motril: new Decimal('6200.00'),
  nador_almeria: new Decimal('5100.00'),
  none_land_africa: new Decimal('0.00'),
};

function isAfricanDestination(destCity: string): boolean {
  const c = destCity.toLowerCase().trim();
  const africanCities = ['nouakchott', 'dakar', 'nouadhibou', 'bamako', 'rosso', 'conakry', 'niamey', 'abidjan'];
  return africanCities.some((city) => c.includes(city));
}

export async function calculateDynamicFreightPrice(
  params: DynamicPricingParams
): Promise<{ success: boolean; data?: DynamicPricingQuote; error?: string }> {
  try {
    const exchangeRate = new Decimal(params.exchangeRateEurToMad || DEFAULT_EXCHANGE_RATE);

    // Check presets if match
    const matchedPreset = CORRIDOR_PRESETS.find(
      (p) =>
        p.originCity.toLowerCase() === params.originCity.toLowerCase() &&
        p.destCity.toLowerCase() === params.destinationCity.toLowerCase()
    );

    // Determine corridor
    const isAfrican =
      params.corridorType === 'african_overland' ||
      matchedPreset?.corridorType === 'african_overland' ||
      params.ferryRoute === 'none_land_africa' ||
      isAfricanDestination(params.destinationCity);

    const corridorType: PricingCorridorType = isAfrican ? 'african_overland' : 'european_maritime';

    // Resolve distance and regional segments
    let totalDistanceKm = params.roadDistanceKm || 2000;
    let moroccoKm = params.moroccoKm;
    let europeKm = params.europeKm;
    let africaKm = params.africaKm;

    if (matchedPreset && !params.roadDistanceKm) {
      totalDistanceKm = matchedPreset.distanceKm;
      moroccoKm = matchedPreset.moroccoKm;
      europeKm = matchedPreset.europeKm;
      africaKm = matchedPreset.africaKm;
    } else if (isAfrican) {
      if (moroccoKm === undefined || africaKm === undefined) {
        const totalDec = new Decimal(totalDistanceKm);
        moroccoKm = totalDec.times('0.65').round().toNumber();
        africaKm = totalDec.minus(moroccoKm).toNumber();
      }
      europeKm = 0;
    } else if (moroccoKm === undefined || europeKm === undefined) {
      // Default heuristic: 30% Morocco, 70% Europe for international TIR to Europe
      const totalDec = new Decimal(totalDistanceKm);
      moroccoKm = totalDec.times('0.30').round().toNumber();
      europeKm = totalDec.minus(moroccoKm).toNumber();
      africaKm = 0;
    }

    const moroccoKmDec = new Decimal(moroccoKm || 0);
    const europeKmDec = new Decimal(europeKm || 0);
    const africaKmDec = new Decimal(africaKm || 0);
    const totalKmDec = isAfrican
      ? moroccoKmDec.plus(africaKmDec)
      : moroccoKmDec.plus(europeKmDec);

    // 1. Truck Fuel Consumption Model (33L/100km standard, +3L for 24t+ load)
    const weightTons = new Decimal(params.weightTons || 22);
    let baseConsumptionLitersPer100Km = new Decimal('33.0');
    if (weightTons.gt(20)) {
      baseConsumptionLitersPer100Km = baseConsumptionLitersPer100Km.plus(
        weightTons.minus(20).times('0.35')
      );
    }
    if (params.cargoType === 'mega_curtain') {
      baseConsumptionLitersPer100Km = baseConsumptionLitersPer100Km.plus('1.5'); // Aerodynamic drag
    }

    // Fuel consumed per segment
    const fuelLitersMorocco = moroccoKmDec.dividedBy(100).times(baseConsumptionLitersPer100Km);
    const fuelCostMoroccoMad = fuelLitersMorocco.times(DIESEL_PRICE_MAD_LITER);

    let fuelCostEuropeMad = new Decimal(0);
    let fuelCostAfricaMad = new Decimal(0);
    let fuelLitersNonMorocco = new Decimal(0);

    if (isAfrican) {
      const fuelLitersAfrica = africaKmDec.dividedBy(100).times(baseConsumptionLitersPer100Km);
      fuelCostAfricaMad = fuelLitersAfrica.times(DIESEL_PRICE_AFRICA_MAD_LITER);
      fuelLitersNonMorocco = fuelLitersAfrica;
    } else {
      const fuelLitersEurope = europeKmDec.dividedBy(100).times(baseConsumptionLitersPer100Km);
      const fuelCostEuropeEur = fuelLitersEurope.times(DIESEL_PRICE_EUR_LITER);
      fuelCostEuropeMad = fuelCostEuropeEur.times(exchangeRate);
      fuelLitersNonMorocco = fuelLitersEurope;
    }

    const fuelTotalMad = fuelCostMoroccoMad.plus(fuelCostEuropeMad).plus(fuelCostAfricaMad);
    const fuelTotalEur = fuelTotalMad.dividedBy(exchangeRate);

    // 2. Smart Bunkering Calculation
    let smartBunkeringSavingsMad = new Decimal(0);
    let bunkeringAdviceAr = '';
    let bunkeringAdviceFr = '';

    if (isAfrican) {
      // Smart Bunkering for Africa: Fill up at Dakhla / Guerguerat station before crossing into Mauritania
      const pumpDiffAfrica = DIESEL_PRICE_AFRICA_MAD_LITER.minus(DIESEL_PRICE_MAD_LITER);
      const bunkeredVolume = Decimal.min(new Decimal(700), fuelLitersNonMorocco);
      smartBunkeringSavingsMad = bunkeredVolume.times(pumpDiffAfrica);
      bunkeringAdviceAr = `تزود بالكامل بمحطات الداخلة أو معبر الكركارات: يوفر ما يقارب ${smartBunkeringSavingsMad.toFixed(0)} درهم ويؤمن الوقود عبر المقاطع الصحراوية الخالية من المحطات.`;
      bunkeringAdviceFr = `Plein complet à Dakhla ou El Guerguerat : économie estimée à ${smartBunkeringSavingsMad.toFixed(0)} MAD tout en sécurisant l'autonomie désertique.`;
    } else {
      // Smart Bunkering for Europe: Fill up 750L in Morocco before ferry
      const eurPriceInMad = DIESEL_PRICE_EUR_LITER.times(exchangeRate);
      const pumpDiffEurope = eurPriceInMad.minus(DIESEL_PRICE_MAD_LITER);
      const bunkeredVolume = Decimal.min(new Decimal(750), fuelLitersNonMorocco);
      smartBunkeringSavingsMad = bunkeredVolume.times(pumpDiffEurope);
      const savingsEur = smartBunkeringSavingsMad.dividedBy(exchangeRate);
      bunkeringAdviceAr = `تزود بالوقود كاملاً بميناء طنجة المتوسط قبل الإبحار: يوفر ما يقارب ${smartBunkeringSavingsMad.toFixed(0)} درهم مقارنة بأسعار محطات إسبانيا وفرنسا.`;
      bunkeringAdviceFr = `Plein complet à Tanger Med avant traversée: économie estimée à ${savingsEur.toFixed(0)} € par rapport au gasoil européen.`;
    }
    const smartBunkeringSavingsEur = smartBunkeringSavingsMad.dividedBy(exchangeRate);

    // 3. Ferry & Border Crossing Costs
    let ferryCrossingCostMad = new Decimal(0);
    let africanBorderFeesMad = new Decimal(0);

    if (isAfrican) {
      ferryCrossingCostMad = new Decimal(0); // 100% overland!
      // Guerguerat clearing (1500 MAD) + Mauritania transit pass (2500 MAD) + ECOWAS brown card insurance (800 MAD)
      africanBorderFeesMad = new Decimal('4800.00');
    } else {
      const ferryRoute = params.ferryRoute || matchedPreset?.ferryRoute || 'tanger_med_algeciras';
      ferryCrossingCostMad = FERRY_COSTS_MAD[ferryRoute] || new Decimal('4600.00');
    }
    const ferryCrossingCostEur = ferryCrossingCostMad.dividedBy(exchangeRate);

    // 4. Highway Tolls & Road Taxes (Péages)
    let tollCostMoroccoMad = moroccoKmDec.times('0.42');
    let tollCostEuropeMad = new Decimal(0);
    if (!isAfrican) {
      const tollCostEuropeEur = europeKmDec.times('0.21');
      tollCostEuropeMad = tollCostEuropeEur.times(exchangeRate);
    } else {
      // African municipal / road transit fee in Mauritania & Senegal
      tollCostEuropeMad = africaKmDec.times('0.25');
    }
    const tollsTotalMad = tollCostMoroccoMad.plus(tollCostEuropeMad);
    const tollsTotalEur = tollsTotalMad.dividedBy(exchangeRate);

    // 5. Driver Per Diem Allowances & International Transit
    // Average driving speed 65 km/h + border transit hours
    const drivingHours = totalKmDec.dividedBy(60);
    const borderDelayHours = isAfrican ? 24 : 12; // Guerguerat crossing typically 24h
    const totalTransitDays = drivingHours.plus(borderDelayHours).dividedBy(24).ceil();
    const driverDailyRate = isAfrican ? new Decimal('800.00') : new Decimal('750.00');
    const driverAllowancesMad = totalTransitDays.times(driverDailyRate);
    const driverAllowancesEur = driverAllowancesMad.dividedBy(exchangeRate);

    // 6. Reefer (Frigo) Temperature Control Energy Consumption
    let reeferRunningCostMad = new Decimal(0);
    if (params.cargoType === 'reefer_temperature_controlled') {
      const transitHours = totalTransitDays.times(24);
      const isFrozen = (params.reeferSetpointTemp ?? 4) <= -15;
      const reeferConsumptionPerHour = isFrozen ? new Decimal('3.5') : new Decimal('2.7');
      const reeferDieselPrice = new Decimal('10.20');
      reeferRunningCostMad = transitHours.times(reeferConsumptionPerHour).times(reeferDieselPrice);
    }

    // 7. Customs Clearance, Port Handling & Border DUM
    let customsPortFeesMad = isAfrican
      ? new Decimal('2200.00') // Guerguerat export scanner & clearance
      : new Decimal('1850.00'); // PortNet + Tanger Med transit + DUM

    if (params.cargoType === 'hazardous_adr') {
      customsPortFeesMad = customsPortFeesMad.plus('1500.00');
    }

    // 8. Overhead & Insurance Buffer (5% of running cost)
    const subtotalDirect = fuelTotalMad
      .plus(ferryCrossingCostMad)
      .plus(africanBorderFeesMad)
      .plus(tollsTotalMad)
      .plus(driverAllowancesMad)
      .plus(reeferRunningCostMad)
      .plus(customsPortFeesMad);
    const overheadBufferMad = subtotalDirect.times('0.05');

    // 9. Seasonality Index (الموسمية الفلاحية واللوجستية)
    const month = params.departureMonth || new Date().getMonth() + 1;
    let seasonalityIndex = new Decimal('1.00');
    let seasonalityReasonAr = 'موسم تشغيلي اعتيادي لتدفق البضائع العامة';
    let seasonalityReasonFr = 'Saisonnalité régulière des flux de fret';

    if (isAfrican) {
      if (month >= 10 || month <= 4) {
        seasonalityIndex = new Decimal('1.18');
        seasonalityReasonAr = 'موسم ذروة التصدير الفلاحي والغذائي المغربي إلى أسواق موريتانيا والسنغال وغرب إفريقيا';
        seasonalityReasonFr = 'Pleine campagne d\'exportation des primeurs et vivres marocains vers l\'Afrique de l\'Ouest';
      } else if (month >= 6 && month <= 8) {
        seasonalityIndex = new Decimal('1.08');
        seasonalityReasonAr = 'تدفقات تجارية صيفية منتظمة مع ارتفاع الطلب على شاحنات التبريد للحرارة الصحراوية';
        seasonalityReasonFr = 'Flux estivaux réguliers avec forte demande sous température contrôlée';
      }
    } else if (params.cargoType === 'reefer_temperature_controlled') {
      if (month >= 11 || month <= 4) {
        seasonalityIndex = new Decimal('1.25');
        seasonalityReasonAr = 'ذروة تصدير الخضروات والحوامض والبواكر المغربية نحو أوروبا (طلب مرتفع جداً)';
        seasonalityReasonFr = 'Pic de la campagne maraîchère et agrumes vers l\'Europe (Forte tension)';
      }
    } else {
      if (month === 9 || month === 10) {
        seasonalityIndex = new Decimal('1.10');
        seasonalityReasonAr = 'انتعاش الإنتاج الصناعي وقطع غيار السيارات بعد العطلة الصيفية';
        seasonalityReasonFr = 'Reprise industrielle automnale';
      }
    }

    // 10. Deadhead Return Cushion
    let deadheadRiskPercent = isAfrican ? 35 : 25; // African routes have higher empty backhaul risk
    let deadheadCushionMad = new Decimal(0);
    if (params.includeReturnCushion !== false) {
      deadheadCushionMad = isAfrican ? fuelTotalMad.times('0.20') : fuelTotalMad.times('0.15');
    }

    // Total Direct Cost (Breakeven / Floor Price)
    const totalDirectCostMad = subtotalDirect
      .plus(overheadBufferMad)
      .plus(deadheadCushionMad);
    const totalDirectCostEur = totalDirectCostMad.dividedBy(exchangeRate);

    // Target Margins
    const baseTargetMargin = new Decimal(params.targetMarginPercent || 22).dividedBy(100);

    // Tier 1: Floor
    const floorPriceMad = totalDirectCostMad;
    const floorPriceEur = totalDirectCostEur;

    // Tier 2: Spot
    const spotPriceMad = totalDirectCostMad
      .times(new Decimal(1).plus(baseTargetMargin))
      .times(seasonalityIndex);
    const spotPriceEur = spotPriceMad.dividedBy(exchangeRate);
    const spotProfitMad = spotPriceMad.minus(totalDirectCostMad);
    const spotProfitEur = spotProfitMad.dividedBy(exchangeRate);
    const spotMarginPercent = spotPriceMad.gt(0)
      ? spotProfitMad.dividedBy(spotPriceMad).times(100).toNumber()
      : 0;

    // Tier 3: Express / Dedicated Premium
    const expressMargin = baseTargetMargin.plus('0.12');
    const expressPriceMad = totalDirectCostMad
      .times(new Decimal(1).plus(expressMargin))
      .times(seasonalityIndex)
      .plus(new Decimal('1800.00'));
    const expressPriceEur = expressPriceMad.dividedBy(exchangeRate);
    const expressProfitMad = expressPriceMad.minus(totalDirectCostMad);
    const expressProfitEur = expressProfitMad.dividedBy(exchangeRate);
    const expressMarginPercent = expressPriceMad.gt(0)
      ? expressProfitMad.dividedBy(expressPriceMad).times(100).toNumber()
      : 0;

    // Currency conversions for African currencies (MRU, XOF)
    const toMru = (mad: InstanceType<typeof Decimal>) =>
      convertCurrency(mad.toNumber(), 'MAD', 'MRU').toFixed(2);
    const toXof = (mad: InstanceType<typeof Decimal>) =>
      convertCurrency(mad.toNumber(), 'MAD', 'XOF').toFixed(0);

    const breakdown: PricingCostBreakdown = {
      fuelCostMoroccoMad: fuelCostMoroccoMad.toFixed(2),
      fuelCostEuropeMad: fuelCostEuropeMad.toFixed(2),
      fuelCostAfricaMad: fuelCostAfricaMad.toFixed(2),
      fuelTotalMad: fuelTotalMad.toFixed(2),
      fuelTotalEur: fuelTotalEur.toFixed(2),
      fuelTotalMru: toMru(fuelTotalMad),
      fuelTotalXof: toXof(fuelTotalMad),
      ferryCrossingCostMad: ferryCrossingCostMad.toFixed(2),
      ferryCrossingCostEur: ferryCrossingCostEur.toFixed(2),
      africanBorderFeesMad: africanBorderFeesMad.toFixed(2),
      tollCostMoroccoMad: tollCostMoroccoMad.toFixed(2),
      tollCostEuropeMad: tollCostEuropeMad.toFixed(2),
      tollsTotalMad: tollsTotalMad.toFixed(2),
      tollsTotalEur: tollsTotalEur.toFixed(2),
      driverAllowancesMad: driverAllowancesMad.toFixed(2),
      driverAllowancesEur: driverAllowancesEur.toFixed(2),
      reeferRunningCostMad: reeferRunningCostMad.toFixed(2),
      customsPortFeesMad: customsPortFeesMad.toFixed(2),
      overheadBufferMad: overheadBufferMad.toFixed(2),
      deadheadCushionMad: deadheadCushionMad.toFixed(2),
      totalDirectCostMad: totalDirectCostMad.toFixed(2),
      totalDirectCostEur: totalDirectCostEur.toFixed(2),
      totalDirectCostMru: toMru(totalDirectCostMad),
      totalDirectCostXof: toXof(totalDirectCostMad),
    };

    const quoteId = `TBQ-${Date.now().toString(36).toUpperCase()}`;

    const quote: DynamicPricingQuote = {
      id: quoteId,
      generatedAt: new Date().toISOString(),
      originCity: params.originCity,
      destinationCity: params.destinationCity,
      cargoType: params.cargoType,
      corridorType,
      totalDistanceKm: totalKmDec.round().toNumber(),
      moroccoKm: moroccoKm || 0,
      europeKm: europeKm || 0,
      africaKm: africaKm || 0,
      exchangeRate: exchangeRate.toNumber(),
      seasonalityIndex: seasonalityIndex.toNumber(),
      seasonalityImpactPercent: seasonalityIndex.minus(1).times(100).round().toNumber(),
      seasonalityReasonAr,
      seasonalityReasonFr,
      deadheadRiskPercent,
      smartBunkeringSavingsMad: smartBunkeringSavingsMad.toFixed(2),
      smartBunkeringSavingsEur: smartBunkeringSavingsEur.toFixed(2),
      smartBunkeringSavingsMru: toMru(smartBunkeringSavingsMad),
      smartBunkeringSavingsXof: toXof(smartBunkeringSavingsMad),
      bunkeringAdviceAr,
      bunkeringAdviceFr,
      breakdown,
      tiers: {
        floor: {
          nameAr: 'السعر الأدنى التنافسي (سعر التكلفة)',
          nameFr: 'Tarif Plancher (Seuil de rentabilité)',
          descriptionAr: isAfrican
            ? 'يغطي تكاليف الكيلومترات الصحراوية ورسوم معبر الكركارات دون هامش ربح'
            : 'يغطي التكاليف المباشرة والعبّارة دون هامش ربح (للشحنات الإستراتيجية وموازنة المسارات)',
          descriptionFr: 'Couvre l\'intégralité des coûts opérationnels directs sans marge bénéficiaire',
          priceMad: floorPriceMad.toFixed(2),
          priceEur: floorPriceEur.toFixed(2),
          priceMru: toMru(floorPriceMad),
          priceXof: toXof(floorPriceMad),
          profitAmountMad: '0.00',
          profitAmountEur: '0.00',
          profitAmountMru: '0.00',
          profitAmountXof: '0',
          marginPercent: 0,
          highlightColor: 'slate',
        },
        spot: {
          nameAr: 'السعر الذكي المقترح (Spot Rate)',
          nameFr: 'Tarif Spot Recommandé (Marché Optimal)',
          descriptionAr: isAfrican
            ? 'التسعير التنافسي الأمثل لرحلات إفريقيا الغربية مع ضمان التغطية التأمينية والربحية المستدامة'
            : 'السعر التنافسي الموصى به لتحقيق أعلى نسبة قبول من العميل مع ضمان ربحية مستدامة',
          descriptionFr: 'Tarif optimisé pour maximiser le taux de conversion tout en sécurisant la marge cible',
          priceMad: spotPriceMad.toFixed(2),
          priceEur: spotPriceEur.toFixed(2),
          priceMru: toMru(spotPriceMad),
          priceXof: toXof(spotPriceMad),
          profitAmountMad: spotProfitMad.toFixed(2),
          profitAmountEur: spotProfitEur.toFixed(2),
          profitAmountMru: toMru(spotProfitMad),
          profitAmountXof: toXof(spotProfitMad),
          marginPercent: Math.round(spotMarginPercent * 10) / 10,
          isRecommended: true,
          highlightColor: 'emerald',
        },
        expressPremium: {
          nameAr: 'السعر السريع الممتاز (Express & Premium)',
          nameFr: 'Tarif Express & Sécurisé (Service Premium)',
          descriptionAr: isAfrican
            ? 'خدمة سريعة بطاقم سائقين مزدوج، أولوية العبور بالكركارات، وتتبع GPS حي بالأقمار الاصطناعية'
            : 'خدمة فائقة السرعة مع طاقم سائقين مزدوج، أولوية الصعود للباخرة، ومراقبة حرارية حية 24/7',
          descriptionFr: 'Service express double équipage, priorité de passage et télématique active 24/7',
          priceMad: expressPriceMad.toFixed(2),
          priceEur: expressPriceEur.toFixed(2),
          priceMru: toMru(expressPriceMad),
          priceXof: toXof(expressPriceMad),
          profitAmountMad: expressProfitMad.toFixed(2),
          profitAmountEur: expressProfitEur.toFixed(2),
          profitAmountMru: toMru(expressProfitMad),
          profitAmountXof: toXof(expressProfitMad),
          marginPercent: Math.round(expressMarginPercent * 10) / 10,
          highlightColor: 'indigo',
        },
      },
    };

    return { success: true, data: quote };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to calculate dynamic freight price';
    return { success: false, error: errorMsg };
  }
}

export async function saveQuotationProposal(quote: DynamicPricingQuote, clientId?: number, notes?: string) {
  try {
    const supabase = await createClient();

    const payload = {
      quote_id: quote.id,
      origin: quote.originCity,
      destination: quote.destinationCity,
      cargo_type: quote.cargoType,
      corridor_type: quote.corridorType,
      recommended_price_mad: quote.tiers.spot.priceMad,
      recommended_price_eur: quote.tiers.spot.priceEur,
      client_id: clientId || null,
      notes: notes || null,
      created_at: new Date().toISOString(),
    };

    await supabase.from('audit_logs').insert([
      {
        action: 'generate_dynamic_quote',
        entity_type: 'freight_quotation',
        entity_id: 0,
        new_values: JSON.stringify(payload),
        reason: `Dynamic freight quote generated for ${quote.originCity} -> ${quote.destinationCity} (${quote.corridorType})`,
      },
    ]);

    return { success: true, quoteId: quote.id };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to save quotation proposal';
    return { success: false, error: errorMsg };
  }
}
