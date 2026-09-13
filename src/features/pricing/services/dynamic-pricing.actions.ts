'use server';

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import type {
  DynamicPricingParams,
  DynamicPricingQuote,
  PricingCostBreakdown,
  CorridorPreset,
} from '../types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export const CORRIDOR_PRESETS: CorridorPreset[] = [
  {
    id: 'agadir_perpignan',
    nameAr: 'أكادير ⟵ بربينيان (منتجات فلاحية مبردة)',
    nameFr: 'Agadir ⟵ Perpignan (Primeurs Frigo)',
    originCity: 'Agadir',
    destCity: 'Perpignan',
    distanceKm: 2450,
    moroccoKm: 820,
    europeKm: 1630,
    ferryRoute: 'tanger_med_algeciras',
    defaultCargo: 'reefer_temperature_controlled',
  },
  {
    id: 'casablanca_paris',
    nameAr: 'الدار البيضاء ⟵ باريس (صناعات ومعدات)',
    nameFr: 'Casablanca ⟵ Paris (Industriel & Équipements)',
    originCity: 'Casablanca',
    destCity: 'Paris',
    distanceKm: 2320,
    moroccoKm: 340,
    europeKm: 1980,
    ferryRoute: 'tanger_med_algeciras',
    defaultCargo: 'dry_box',
  },
  {
    id: 'tanger_madrid',
    nameAr: 'طنجة ⟵ مدريد (شحن سريع ومكوكات)',
    nameFr: 'Tanger ⟵ Madrid (Navette Express)',
    originCity: 'Tanger',
    destCity: 'Madrid',
    distanceKm: 750,
    moroccoKm: 50,
    europeKm: 700,
    ferryRoute: 'tanger_med_algeciras',
    defaultCargo: 'mega_curtain',
  },
  {
    id: 'nador_barcelona',
    nameAr: 'الناظور ⟵ برشلونة (تصدير كيميائي / ADR)',
    nameFr: 'Nador ⟵ Barcelone (Chimique / ADR)',
    originCity: 'Nador',
    destCity: 'Barcelona',
    distanceKm: 1280,
    moroccoKm: 60,
    europeKm: 1220,
    ferryRoute: 'nador_almeria',
    defaultCargo: 'hazardous_adr',
  },
  {
    id: 'marrakech_lyon',
    nameAr: 'مراكش ⟵ ليون (منسوجات وسلع عامة)',
    nameFr: 'Marrakech ⟵ Lyon (Textile & Général)',
    originCity: 'Marrakech',
    destCity: 'Lyon',
    distanceKm: 2380,
    moroccoKm: 580,
    europeKm: 1800,
    ferryRoute: 'tanger_med_algeciras',
    defaultCargo: 'dry_box',
  },
];

// Constants for logistical pricing
const DIESEL_PRICE_MAD_LITER = new Decimal('12.85'); // Morocco average pump price
const DIESEL_PRICE_EUR_LITER = new Decimal('1.55'); // Spain/France average pump price
const DEFAULT_EXCHANGE_RATE = new Decimal('10.90'); // MAD per EUR
const FERRY_COSTS_MAD: Record<string, InstanceType<typeof Decimal>> = {
  tanger_med_algeciras: new Decimal('4600.00'),
  tanger_med_motril: new Decimal('6200.00'),
  nador_almeria: new Decimal('5100.00'),
};

export async function calculateDynamicFreightPrice(
  params: DynamicPricingParams
): Promise<{ success: boolean; data?: DynamicPricingQuote; error?: string }> {
  try {
    const exchangeRate = new Decimal(params.exchangeRateEurToMad || DEFAULT_EXCHANGE_RATE);
    
    // Resolve distance and regional segments
    let totalDistanceKm = params.roadDistanceKm || 2000;
    let moroccoKm = params.moroccoKm;
    let europeKm = params.europeKm;

    // Check presets if match
    const matchedPreset = CORRIDOR_PRESETS.find(
      (p) =>
        p.originCity.toLowerCase() === params.originCity.toLowerCase() &&
        p.destCity.toLowerCase() === params.destinationCity.toLowerCase()
    );

    if (matchedPreset && !params.roadDistanceKm) {
      totalDistanceKm = matchedPreset.distanceKm;
      moroccoKm = matchedPreset.moroccoKm;
      europeKm = matchedPreset.europeKm;
    } else if (moroccoKm === undefined || europeKm === undefined) {
      // Default heuristic: 30% Morocco, 70% Europe for international TIR
      const totalDec = new Decimal(totalDistanceKm);
      moroccoKm = totalDec.times('0.30').round().toNumber();
      europeKm = totalDec.minus(moroccoKm).toNumber();
    }

    const moroccoKmDec = new Decimal(moroccoKm);
    const europeKmDec = new Decimal(europeKm);
    const totalKmDec = moroccoKmDec.plus(europeKmDec);

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
    const fuelLitersEurope = europeKmDec.dividedBy(100).times(baseConsumptionLitersPer100Km);

    const fuelCostMoroccoMad = fuelLitersMorocco.times(DIESEL_PRICE_MAD_LITER);
    // European diesel in EUR converted to MAD
    const fuelCostEuropeEur = fuelLitersEurope.times(DIESEL_PRICE_EUR_LITER);
    const fuelCostEuropeMad = fuelCostEuropeEur.times(exchangeRate);

    const fuelTotalMad = fuelCostMoroccoMad.plus(fuelCostEuropeMad);
    const fuelTotalEur = fuelTotalMad.dividedBy(exchangeRate);

    // 2. Smart Bunkering Calculation (Fill up 800L in Morocco vs purchasing in Spain/France)
    // Price diff per liter: (1.55 EUR * 10.90) - 12.85 MAD = ~4.04 MAD/L
    const eurPriceInMad = DIESEL_PRICE_EUR_LITER.times(exchangeRate);
    const pumpDiffPerLiter = eurPriceInMad.minus(DIESEL_PRICE_MAD_LITER);
    const bunkeredVolumeLiters = Decimal.min(new Decimal(750), fuelLitersEurope);
    const smartBunkeringSavingsMad = bunkeredVolumeLiters.times(pumpDiffPerLiter);
    const smartBunkeringSavingsEur = smartBunkeringSavingsMad.dividedBy(exchangeRate);

    // 3. Ferry Crossing Costs
    const ferryRoute = params.ferryRoute || matchedPreset?.ferryRoute || 'tanger_med_algeciras';
    const ferryCrossingCostMad = FERRY_COSTS_MAD[ferryRoute] || new Decimal('4600.00');
    const ferryCrossingCostEur = ferryCrossingCostMad.dividedBy(exchangeRate);

    // 4. Highway Tolls (Péage)
    // Morocco autoroutes ~ 0.42 MAD/km; Spain/France tolls ~ 0.21 EUR/km
    const tollCostMoroccoMad = moroccoKmDec.times('0.42');
    const tollCostEuropeEur = europeKmDec.times('0.21');
    const tollCostEuropeMad = tollCostEuropeEur.times(exchangeRate);
    const tollsTotalMad = tollCostMoroccoMad.plus(tollCostEuropeMad);
    const tollsTotalEur = tollsTotalMad.dividedBy(exchangeRate);

    // 5. Driver Per Diem Allowances & International Transit (Indemnités de déplacement)
    // Average speed 70 km/h -> driving hours + border/ferry 12h
    const drivingHours = totalKmDec.dividedBy(65);
    const totalTransitDays = drivingHours.plus(12).dividedBy(24).ceil(); // Transit days rounded up
    // Driver daily allowance: ~750 MAD/day during international trip
    const driverAllowancesMad = totalTransitDays.times('750.00');
    const driverAllowancesEur = driverAllowancesMad.dividedBy(exchangeRate);

    // 6. Reefer (Frigo) Temperature Control Energy Consumption
    let reeferRunningCostMad = new Decimal(0);
    if (params.cargoType === 'reefer_temperature_controlled') {
      const transitHours = totalTransitDays.times(24);
      // Reefer unit consumes 2.8 L/hr of non-road diesel (~9.50 MAD/L)
      const isFrozen = (params.reeferSetpointTemp ?? 4) <= -15;
      const reeferConsumptionLitersPerHour = isFrozen ? new Decimal('3.4') : new Decimal('2.6');
      const reeferDieselPrice = new Decimal('9.80');
      reeferRunningCostMad = transitHours.times(reeferConsumptionLitersPerHour).times(reeferDieselPrice);
    }

    // 7. Customs Clearance, Port Handling & PortNet/DUM
    let customsPortFeesMad = new Decimal('1850.00'); // PortNet + Tanger Med transit + DUM
    if (params.cargoType === 'hazardous_adr') {
      customsPortFeesMad = customsPortFeesMad.plus('1200.00'); // ADR port escort & dangerous goods authorization
    }

    // 8. Overhead & Insurance Buffer (5% of running cost)
    const subtotalDirect = fuelTotalMad
      .plus(ferryCrossingCostMad)
      .plus(tollsTotalMad)
      .plus(driverAllowancesMad)
      .plus(reeferRunningCostMad)
      .plus(customsPortFeesMad);
    const overheadBufferMad = subtotalDirect.times('0.05');

    // 9. Seasonality Index (الموسمية الفلاحية واللوجستية)
    const month = params.departureMonth || new Date().getMonth() + 1;
    let seasonalityIndex = new Decimal('1.00');
    let seasonalityReasonAr = 'موسم تشغيلي اعتيادي لتدفق البضائع العامة والصناعية';
    let seasonalityReasonFr = 'Saisonnalité régulière des flux de fret général et industriel';

    if (params.cargoType === 'reefer_temperature_controlled') {
      if (month >= 11 || month <= 4) {
        // High produce export season (Citrus, Tomatoes, Berries)
        seasonalityIndex = new Decimal('1.25');
        seasonalityReasonAr = 'ذروة تصدير الخضروات والحوامض والبواكر المغربية (طلب مرتفع جداً على شاحنات التبريد)';
        seasonalityReasonFr = 'Pic de la campagne maraîchère et agrumes au Maroc (Forte tension sur la capacité frigorifique)';
      } else if (month === 5 || month === 6) {
        seasonalityIndex = new Decimal('1.12');
        seasonalityReasonAr = 'نهاية الموسم الفلاحي وتصدير الفواكه الصيفية المبكرة';
        seasonalityReasonFr = 'Fin de campagne agricole et primeurs de printemps';
      }
    } else {
      if (month === 9 || month === 10) {
        // Post-summer industrial & automotive ramp-up
        seasonalityIndex = new Decimal('1.10');
        seasonalityReasonAr = 'انتعاش الإنتاج الصناعي وقطع غيار السيارات بعد العطلة الصيفية';
        seasonalityReasonFr = 'Reprise industrielle et flux composants automobiles automne';
      } else if (month === 12) {
        seasonalityIndex = new Decimal('1.15');
        seasonalityReasonAr = 'ذروة شحنات نهاية السنة وأعياد الميلاد في أوروبا';
        seasonalityReasonFr = 'Pic logistique des fêtes de fin d’année en Europe';
      }
    }

    // 10. Deadhead Return Cushion (عامل حمولة العودة الفارغة)
    let deadheadRiskPercent = 25; // Base 25% empty return probability
    let deadheadCushionMad = new Decimal(0);
    if (params.includeReturnCushion !== false) {
      if (seasonalityIndex.gte('1.20')) {
        // In high produce season, return cargo from EU to Morocco is scarce
        deadheadRiskPercent = 45;
        deadheadCushionMad = fuelTotalMad.times('0.25'); // Cushion 25% of return fuel
      } else {
        deadheadCushionMad = fuelTotalMad.times('0.10');
      }
    }

    // Total Direct Cost (Breakeven / Floor Price)
    const totalDirectCostMad = subtotalDirect
      .plus(overheadBufferMad)
      .plus(deadheadCushionMad);
    const totalDirectCostEur = totalDirectCostMad.dividedBy(exchangeRate);

    // Target Margins
    const baseTargetMargin = new Decimal(params.targetMarginPercent || 22).dividedBy(100);

    // Tier 1: Floor (Breakeven - 0% profit)
    const floorPriceMad = totalDirectCostMad;
    const floorPriceEur = totalDirectCostEur;

    // Tier 2: Spot Recommended Rate (Adjusted for Seasonality & Target Margin)
    // Formula: Floor * (1 + targetMargin) * seasonality
    const spotPriceMad = totalDirectCostMad
      .times(new Decimal(1).plus(baseTargetMargin))
      .times(seasonalityIndex);
    const spotPriceEur = spotPriceMad.dividedBy(exchangeRate);
    const spotProfitMad = spotPriceMad.minus(totalDirectCostMad);
    const spotProfitEur = spotProfitMad.dividedBy(exchangeRate);
    const spotMarginPercent = spotPriceMad.gt(0)
      ? spotProfitMad.dividedBy(spotPriceMad).times(100).toNumber()
      : 0;

    // Tier 3: Express / Dedicated Premium (Priority slot, 2-driver relay, 24/7 telematics, +12% margin)
    const expressMargin = baseTargetMargin.plus('0.12');
    const expressPriceMad = totalDirectCostMad
      .times(new Decimal(1).plus(expressMargin))
      .times(seasonalityIndex)
      .plus(new Decimal('1500.00')); // Dual driver surcharge
    const expressPriceEur = expressPriceMad.dividedBy(exchangeRate);
    const expressProfitMad = expressPriceMad.minus(totalDirectCostMad);
    const expressProfitEur = expressProfitMad.dividedBy(exchangeRate);
    const expressMarginPercent = expressPriceMad.gt(0)
      ? expressProfitMad.dividedBy(expressPriceMad).times(100).toNumber()
      : 0;

    const breakdown: PricingCostBreakdown = {
      fuelCostMoroccoMad: fuelCostMoroccoMad.toFixed(2),
      fuelCostEuropeMad: fuelCostEuropeMad.toFixed(2),
      fuelTotalMad: fuelTotalMad.toFixed(2),
      fuelTotalEur: fuelTotalEur.toFixed(2),
      ferryCrossingCostMad: ferryCrossingCostMad.toFixed(2),
      ferryCrossingCostEur: ferryCrossingCostEur.toFixed(2),
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
    };

    const quoteId = `TBQ-${Date.now().toString(36).toUpperCase()}`;

    const quote: DynamicPricingQuote = {
      id: quoteId,
      generatedAt: new Date().toISOString(),
      originCity: params.originCity,
      destinationCity: params.destinationCity,
      cargoType: params.cargoType,
      totalDistanceKm: totalKmDec.round().toNumber(),
      moroccoKm,
      europeKm,
      exchangeRate: exchangeRate.toNumber(),
      seasonalityIndex: seasonalityIndex.toNumber(),
      seasonalityImpactPercent: seasonalityIndex.minus(1).times(100).round().toNumber(),
      seasonalityReasonAr,
      seasonalityReasonFr,
      deadheadRiskPercent,
      smartBunkeringSavingsMad: smartBunkeringSavingsMad.toFixed(2),
      smartBunkeringSavingsEur: smartBunkeringSavingsEur.toFixed(2),
      bunkeringAdviceAr: `تزود بالوقود كاملاً بميناء طنجة المتوسط قبل الإبحار: يوفر ما يقارب ${smartBunkeringSavingsMad.toFixed(0)} درهم مقارنة بأسعار محطات إسبانيا وفرنسا.`,
      bunkeringAdviceFr: `Plein complet à Tanger Med avant traversée: économie estimée à ${smartBunkeringSavingsEur.toFixed(0)} € par rapport au gasoil européen.`,
      breakdown,
      tiers: {
        floor: {
          nameAr: 'السعر الأدنى التنافسي (سعر التكلفة)',
          nameFr: 'Tarif Plancher (Seuil de rentabilité)',
          descriptionAr: 'يغطي التكاليف المباشرة دون هامش ربح (للشحنات الإستراتيجية وموازنة المسارات)',
          descriptionFr: 'Couvre l\'intégralité des coûts opérationnels directs sans marge bénéficiaire',
          priceMad: floorPriceMad.toFixed(2),
          priceEur: floorPriceEur.toFixed(2),
          profitAmountMad: '0.00',
          profitAmountEur: '0.00',
          marginPercent: 0,
          highlightColor: 'slate',
        },
        spot: {
          nameAr: 'السعر الذكي المقترح (Spot Rate)',
          nameFr: 'Tarif Spot Recommandé (Marché Optimal)',
          descriptionAr: 'السعر التنافسي الموصى به لتحقيق أعلى نسبة قبول من العميل مع ضمان ربحية مستدامة',
          descriptionFr: 'Tarif optimisé pour maximiser le taux de conversion tout en sécurisant la marge cible',
          priceMad: spotPriceMad.toFixed(2),
          priceEur: spotPriceEur.toFixed(2),
          profitAmountMad: spotProfitMad.toFixed(2),
          profitAmountEur: spotProfitEur.toFixed(2),
          marginPercent: Math.round(spotMarginPercent * 10) / 10,
          isRecommended: true,
          highlightColor: 'emerald',
        },
        expressPremium: {
          nameAr: 'السعر السريع الممتاز (Express & Premium)',
          nameFr: 'Tarif Express & Sécurisé (Service Premium)',
          descriptionAr: 'خدمة فائقة السرعة مع طاقم سائقين مزدوج، أولوية الصعود للباخرة، ومراقبة حرارية حية 24/7',
          descriptionFr: 'Service express double équipage, priorité embarquement ferry et télématique active 24/7',
          priceMad: expressPriceMad.toFixed(2),
          priceEur: expressPriceEur.toFixed(2),
          profitAmountMad: expressProfitMad.toFixed(2),
          profitAmountEur: expressProfitEur.toFixed(2),
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

    // Prepare quotation audit entry or draft trip note
    const payload = {
      quote_id: quote.id,
      origin: quote.originCity,
      destination: quote.destinationCity,
      cargo_type: quote.cargoType,
      recommended_price_mad: quote.tiers.spot.priceMad,
      recommended_price_eur: quote.tiers.spot.priceEur,
      client_id: clientId || null,
      notes: notes || null,
      created_at: new Date().toISOString(),
    };

    // Log to audit or internal proposal tracking
    await supabase.from('audit_logs').insert([
      {
        action: 'generate_dynamic_quote',
        entity_type: 'freight_quotation',
        entity_id: 0,
        new_values: JSON.stringify(payload),
        reason: `Dynamic freight quote generated for ${quote.originCity} -> ${quote.destinationCity}`,
      },
    ]);

    return { success: true, quoteId: quote.id };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to save quotation proposal';
    return { success: false, error: errorMsg };
  }
}
