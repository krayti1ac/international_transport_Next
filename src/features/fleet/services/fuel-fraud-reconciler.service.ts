import Decimal from 'decimal.js';
import { calculateDistance } from '@/lib/geofence';
import { normalizePlateNumber } from './fuel-card-parser.service';
import type {
  FuelCardProvider,
  FuelCardTransactionRaw,
  FieldFuelReceiptMatch,
  ReconciledFuelEntry,
  ReconciliationStatus,
  ReconciliationAnomaly,
  FuelReconciliationSummary,
  ProviderReconciliationStats,
} from '../types/fuel-reconciliation.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// International corridor certified highway fuel stations catalog
export const HIGHWAY_FUEL_STATIONS_GEO: Record<
  string,
  { name: string; lat: number; lng: number; country: string }
> = {
  // Morocco TIR Corridors
  tanger_med_afriquia: { name: 'Afriquia Tanger Med Port', lat: 35.885, lng: -5.505, country: 'MA' },
  tanger_med_total: { name: 'TotalEnergies Tanger Med', lat: 35.882, lng: -5.512, country: 'MA' },
  tanger_ville_shell: { name: 'Shell Tanger Ville A1', lat: 35.725, lng: -5.815, country: 'MA' },
  larache_afriquia: { name: 'Afriquia Aire Larache A1', lat: 35.195, lng: -6.155, country: 'MA' },
  kenitra_total: { name: 'TotalEnergies Kenitra Nord A1', lat: 34.295, lng: -6.575, country: 'MA' },
  casablanca_shell: { name: 'Shell Casablanca Ain Sebaa', lat: 33.605, lng: -7.535, country: 'MA' },
  berrechid_afriquia: { name: 'Afriquia Berrechid A3', lat: 33.275, lng: -7.585, country: 'MA' },
  settat_total: { name: 'TotalEnergies Settat A3', lat: 33.005, lng: -7.625, country: 'MA' },
  marrakech_shell: { name: 'Shell Marrakech Palmeraie A3', lat: 31.695, lng: -8.015, country: 'MA' },
  agadir_afriquia: { name: 'Afriquia Agadir Port Anza', lat: 30.435, lng: -9.615, country: 'MA' },
  laayoune_total: { name: 'TotalEnergies Laâyoune Port', lat: 27.155, lng: -13.205, country: 'MA' },
  dakhla_afriquia: { name: 'Afriquia Dakhla Baie', lat: 23.715, lng: -15.935, country: 'MA' },
  guerguerat_afriquia: { name: 'Afriquia Guerguerat Frontière', lat: 21.353, lng: -16.953, country: 'MA' },

  // Mauritania & Senegal Corridor
  nouadhibou_snim: { name: 'TotalEnergies Nouadhibou Port', lat: 20.935, lng: -17.035, country: 'MR' },
  nouakchott_star: { name: 'Star Oil Nouakchott Carrefour', lat: 18.085, lng: -15.975, country: 'MR' },
  rosso_total: { name: 'TotalEnergies Rosso Bac', lat: 16.515, lng: -15.805, country: 'MR' },
  saint_louis_shell: { name: 'Shell Saint-Louis Pont Faidherbe', lat: 16.025, lng: -16.495, country: 'SN' },
  dakar_total: { name: 'TotalEnergies Dakar Port Terminal', lat: 14.716, lng: -17.467, country: 'SN' },

  // Spain Corridor
  algeciras_repsol: { name: 'Repsol Puerto Algeciras', lat: 36.185, lng: -5.465, country: 'ES' },
  algeciras_cepsa: { name: 'Cepsa Los Barrios Algeciras', lat: 36.181, lng: -5.492, country: 'ES' },
  san_roque_valcarce: { name: 'Valcarce San Roque Red TIR', lat: 36.205, lng: -5.415, country: 'ES' },
  bailen_repsol: { name: 'Repsol Bailén Cruce A-4', lat: 38.095, lng: -3.775, country: 'ES' },
  valdemoro_cepsa: { name: 'Cepsa Valdemoro Madrid A-4', lat: 40.185, lng: -3.685, country: 'ES' },
  zaragoza_plaza: { name: 'Repsol PLAZA Zaragoza A-2', lat: 41.635, lng: -0.995, country: 'ES' },
  barcelona_zona_franca: { name: 'Galp Barcelona Zona Franca', lat: 41.345, lng: 2.135, country: 'ES' },
  la_jonquera_tortuga: { name: 'Red Tortuga La Jonquera Frontière', lat: 42.415, lng: 2.875, country: 'ES' },
};

export interface ReconciliationEngineParams {
  cardTransactions: FuelCardTransactionRaw[];
  fieldReceipts: FieldFuelReceiptMatch[];
  gpsLocations?: Array<{
    truckId?: number;
    truckPlate?: string;
    latitude: number;
    longitude: number;
    timestamp: string;
    speed?: number;
  }>;
  trucks?: Array<{
    id: number;
    plate_number: string;
    fuel_consumption_rate?: number;
    max_tank_capacity?: number;
  }>;
}

/**
 * Resolves station coordinates from station name string or city.
 */
export function resolveFuelStationCoords(
  stationText: string,
  cityText?: string
): { name: string; lat: number; lng: number } | null {
  const query = `${stationText || ''} ${cityText || ''}`.toLowerCase();

  // 1. High-priority explicit hub & city matches
  if (query.includes('tanger med') || query.includes('tangermed')) return HIGHWAY_FUEL_STATIONS_GEO.tanger_med_afriquia;
  if (query.includes('dakar')) return HIGHWAY_FUEL_STATIONS_GEO.dakar_total;
  if (query.includes('algeciras')) return HIGHWAY_FUEL_STATIONS_GEO.algeciras_repsol;
  if (query.includes('guerguerat') || query.includes('guergarat')) return HIGHWAY_FUEL_STATIONS_GEO.guerguerat_afriquia;
  if (query.includes('larache')) return HIGHWAY_FUEL_STATIONS_GEO.larache_afriquia;
  if (query.includes('kenitra')) return HIGHWAY_FUEL_STATIONS_GEO.kenitra_total;
  if (query.includes('agadir')) return HIGHWAY_FUEL_STATIONS_GEO.agadir_afriquia;
  if (query.includes('dakhla')) return HIGHWAY_FUEL_STATIONS_GEO.dakhla_afriquia;
  if (query.includes('laayoune') || query.includes('laâyoune')) return HIGHWAY_FUEL_STATIONS_GEO.laayoune_total;
  if (query.includes('rosso')) return HIGHWAY_FUEL_STATIONS_GEO.rosso_total;
  if (query.includes('nouadhibou')) return HIGHWAY_FUEL_STATIONS_GEO.nouadhibou_snim;
  if (query.includes('nouakchott')) return HIGHWAY_FUEL_STATIONS_GEO.nouakchott_star;
  if (query.includes('saint-louis') || query.includes('saint louis')) return HIGHWAY_FUEL_STATIONS_GEO.saint_louis_shell;
  if (query.includes('la jonquera') || query.includes('jonquera')) return HIGHWAY_FUEL_STATIONS_GEO.la_jonquera_tortuga;
  if (query.includes('san roque')) return HIGHWAY_FUEL_STATIONS_GEO.san_roque_valcarce;
  if (query.includes('valdemoro') || query.includes('madrid')) return HIGHWAY_FUEL_STATIONS_GEO.valdemoro_cepsa;
  if (query.includes('zaragoza')) return HIGHWAY_FUEL_STATIONS_GEO.zaragoza_plaza;
  if (query.includes('barcelona')) return HIGHWAY_FUEL_STATIONS_GEO.barcelona_zona_franca;
  if (query.includes('bailen') || query.includes('bailén')) return HIGHWAY_FUEL_STATIONS_GEO.bailen_repsol;
  if (query.includes('berrechid')) return HIGHWAY_FUEL_STATIONS_GEO.berrechid_afriquia;
  if (query.includes('settat')) return HIGHWAY_FUEL_STATIONS_GEO.settat_total;
  if (query.includes('marrakech')) return HIGHWAY_FUEL_STATIONS_GEO.marrakech_shell;
  if (query.includes('casablanca') || query.includes('ain sebaa')) return HIGHWAY_FUEL_STATIONS_GEO.casablanca_shell;

  // 2. Generic multi-keyword matching
  for (const [, st] of Object.entries(HIGHWAY_FUEL_STATIONS_GEO)) {
    const stNameLower = st.name.toLowerCase();
    const keywords = stNameLower.split(/[\s,/-]+/).filter((k) => k.length >= 4 && k !== 'port' && k !== 'totalenergies' && k !== 'afriquia' && k !== 'shell');

    let matches = 0;
    for (const kw of keywords) {
      if (query.includes(kw)) matches++;
    }

    if (matches >= 1) {
      return { name: st.name, lat: st.lat, lng: st.lng };
    }
  }

  return null;
}

/**
 * Executes Triple-Way Fuel Reconciliation:
 * 1. Digital Fuel Card Transaction (Afriquia, Total, Shell)
 * 2. Field Driver Fuel Receipt
 * 3. Telematics GPS Proximity & Fuel Tank Mechanical Limits
 * Fully powered by Decimal.js for financial accuracy.
 */
export function reconcileFuelCardTransactions(
  params: ReconciliationEngineParams
): {
  reconciledEntries: ReconciledFuelEntry[];
  summary: FuelReconciliationSummary;
} {
  const { cardTransactions, fieldReceipts, gpsLocations = [], trucks = [] } = params;

  // Index receipts by normalized truck plate
  const receiptsByPlate = new Map<string, FieldFuelReceiptMatch[]>();
  fieldReceipts.forEach((r) => {
    const key = normalizePlateNumber(r.truckPlate);
    if (!receiptsByPlate.has(key)) receiptsByPlate.set(key, []);
    receiptsByPlate.get(key)!.push(r);
  });

  // Index trucks by normalized plate
  const trucksByPlate = new Map<string, { id: number; maxTankCapacity: number }>();
  trucks.forEach((t) => {
    const key = normalizePlateNumber(t.plate_number);
    trucksByPlate.set(key, {
      id: t.id,
      maxTankCapacity: t.max_tank_capacity || 900, // Standard dual-tank capacity for international TIR tractors
    });
  });

  // Track matched receipt IDs to avoid duplicate mapping
  const claimedReceiptIds = new Set<number>();

  const reconciledEntries: ReconciledFuelEntry[] = [];

  for (let i = 0; i < cardTransactions.length; i++) {
    const card = cardTransactions[i];
    const normPlate = normalizePlateNumber(card.truckPlate);
    const truckInfo = trucksByPlate.get(normPlate);
    const maxTankCapacity = truckInfo?.maxTankCapacity || 900;

    const cardLitersDec = new Decimal(card.liters || 0);
    const cardAmountDec = new Decimal(card.totalAmount || 0);

    const anomalies: ReconciliationAnomaly[] = [];
    let confidenceDeduction = 0;

    // 1. Check Mechanical Tank Overfill (> 900 L standard)
    if (cardLitersDec.greaterThan(maxTankCapacity)) {
      confidenceDeduction += 45;
      const excessDec = cardLitersDec.minus(maxTankCapacity);
      anomalies.push({
        category: 'overfill_exceeded',
        severity: 'critical',
        titleAr: 'تجاوز السعة الميكانيكية القصوى لخزان الشاحنة',
        titleFr: 'Dépassement de la capacité mécanique du réservoir',
        titleEs: 'Superación de la capacidad máxima del depósito',
        descriptionAr: `الكمية المفوترة بالبطاقة (${cardLitersDec.toFixed(1)} لتر) تتجاوز سعة خزان الشاحنة (${maxTankCapacity} لتر) بـ ${excessDec.toFixed(1)} لتر، مما يشير إلى تزويد مركبة أخرى أو براميل إضافية.`,
        descriptionFr: `Volume facturé (${cardLitersDec.toFixed(1)} L) supérieur à la capacité maximale (${maxTankCapacity} L) de ${excessDec.toFixed(1)} L.`,
        descriptionEs: `Volumen facturado (${cardLitersDec.toFixed(1)} L) supera la capacidad máxima (${maxTankCapacity} L) en ${excessDec.toFixed(1)} L.`,
        varianceLiters: parseFloat(excessDec.toFixed(1)),
      });
    }

    // 2. Check Duplicate Swipe (same card or plate within 35 minutes)
    const cardTimeMs = new Date(card.timestamp).getTime();
    for (let j = 0; j < cardTransactions.length; j++) {
      if (i === j) continue;
      const other = cardTransactions[j];
      if (
        (other.cardNumber === card.cardNumber || normalizePlateNumber(other.truckPlate) === normPlate) &&
        Math.abs(new Date(other.timestamp).getTime() - cardTimeMs) < 35 * 60 * 1000
      ) {
        confidenceDeduction += 30;
        anomalies.push({
          category: 'duplicate_swipe',
          severity: 'critical',
          titleAr: 'سحب مكرر لبطاقة الوقود في وقت وجيز (Duplicate Swipe)',
          titleFr: 'Passage de carte rapproché suspect',
          titleEs: 'Pase duplicado de tarjeta en corto intervalo',
          descriptionAr: `تم رصد عمليتي تزود بالوقود لنفس البطاقة/الشاحنة بفارق زمني أقل من 35 دقيقة (${other.stationName} و ${card.stationName}).`,
          descriptionFr: `Deux transactions détectées sur la même carte/plaque en moins de 35 minutes.`,
          descriptionEs: `Dos transacciones detectadas con la misma tarjeta/placa en menos de 35 minutos.`,
        });
        break;
      }
    }

    // 3. Match Field Fuel Receipt
    const candidateReceipts = receiptsByPlate.get(normPlate) || [];
    let bestReceipt: FieldFuelReceiptMatch | undefined = undefined;
    let minLitersDiffDec = new Decimal(999999);

    for (const receipt of candidateReceipts) {
      if (claimedReceiptIds.has(receipt.receiptId)) continue;

      const receiptTimeMs = new Date(receipt.receiptDate).getTime();
      const timeDiffHours = Math.abs(receiptTimeMs - cardTimeMs) / (1000 * 60 * 60);

      // Match window: within ±48 hours
      if (timeDiffHours <= 48) {
        const diffDec = cardLitersDec.minus(receipt.receiptLiters).abs();
        if (diffDec.lessThan(minLitersDiffDec)) {
          minLitersDiffDec = diffDec;
          bestReceipt = receipt;
        }
      }
    }

    if (bestReceipt) {
      claimedReceiptIds.add(bestReceipt.receiptId);
    } else {
      confidenceDeduction += 20;
      anomalies.push({
        category: 'missing_field_receipt',
        severity: 'warning',
        titleAr: 'غياب وصل الوقود الميداني من السائق في النظام',
        titleFr: 'Ticket de carburant chauffeur manquant',
        titleEs: 'Falta justificante de repostaje del conductor',
        descriptionAr: `تمت فوترة العملية بواسطة البطاقة (${card.stationName}) دون تسجيل وصل تزود ميداني مطابق من طرف السائق.`,
        descriptionFr: `Transaction facturée par carte (${card.stationName}) sans reçu correspondant saisi par le chauffeur.`,
        descriptionEs: `Transacción facturada por tarjeta (${card.stationName}) sin recibo coincidente registrado por el conductor.`,
      });
    }

    // 4. Calculate Variances with Decimal.js
    let volumeVarianceDec = new Decimal(0);
    let financialVarianceDec = new Decimal(0);

    if (bestReceipt) {
      const receiptLitersDec = new Decimal(bestReceipt.receiptLiters);
      const receiptAmountDec = new Decimal(bestReceipt.receiptAmount);

      volumeVarianceDec = cardLitersDec.minus(receiptLitersDec);
      financialVarianceDec = cardAmountDec.minus(receiptAmountDec);

      // Volume discrepancy > 5 Liters
      if (volumeVarianceDec.abs().greaterThan(5.0)) {
        confidenceDeduction += 15;
        anomalies.push({
          category: 'volume_variance',
          severity: volumeVarianceDec.abs().greaterThan(15.0) ? 'critical' : 'warning',
          titleAr: 'فارق كمية الوقود بين الكشف والوصل',
          titleFr: 'Écart de volume entre carte et reçu',
          titleEs: 'Discrepancia de volumen entre tarjeta y recibo',
          descriptionAr: `فارق ${volumeVarianceDec.toFixed(1)} لتر بين كشف البطاقة (${cardLitersDec.toFixed(1)}L) والوصل الميداني (${receiptLitersDec.toFixed(1)}L).`,
          descriptionFr: `Écart de ${volumeVarianceDec.toFixed(1)} L entre le relevé carte (${cardLitersDec.toFixed(1)} L) et le reçu terrain (${receiptLitersDec.toFixed(1)} L).`,
          descriptionEs: `Diferencia de ${volumeVarianceDec.toFixed(1)} L entre el extracto (${cardLitersDec.toFixed(1)} L) y el recibo (${receiptLitersDec.toFixed(1)} L).`,
          varianceLiters: parseFloat(volumeVarianceDec.toFixed(1)),
        });
      }

      // Financial discrepancy > 50 MAD
      if (financialVarianceDec.abs().greaterThan(50.0)) {
        confidenceDeduction += 15;
        anomalies.push({
          category: 'price_variance',
          severity: financialVarianceDec.abs().greaterThan(150.0) ? 'critical' : 'warning',
          titleAr: 'فارق القيمة المالية المفوترة للوقود',
          titleFr: 'Écart financier facturé',
          titleEs: 'Discrepancia financiera facturada',
          descriptionAr: `فارق مالي قدره ${financialVarianceDec.toFixed(2)} درهم بين المبلغ المفوتر (${cardAmountDec.toFixed(2)}) والوصل (${receiptAmountDec.toFixed(2)}).`,
          descriptionFr: `Écart de ${financialVarianceDec.toFixed(2)} MAD entre montant carte et reçu.`,
          descriptionEs: `Diferencia de ${financialVarianceDec.toFixed(2)} MAD entre importe de tarjeta y recibo.`,
          varianceAmount: parseFloat(financialVarianceDec.toFixed(2)),
        });
      }
    }

    // 5. GPS Proximity Verification & Ghost Refueling Detection
    const stationCoords = resolveFuelStationCoords(card.stationName, card.stationCity);
    let stationDistanceToGpsKm: number | undefined = undefined;
    let gpsVerificationStatus: ReconciledFuelEntry['gpsVerificationStatus'] = 'no_gps_data';

    if (stationCoords && gpsLocations.length > 0) {
      // Find truck location ping closest to transaction timestamp (within 24 hours)
      const matchingGpsPings = gpsLocations.filter((loc) => {
        const pingPlate = loc.truckPlate ? normalizePlateNumber(loc.truckPlate) : '';
        const plateMatches = pingPlate === normPlate || (truckInfo && loc.truckId === truckInfo.id);
        if (!plateMatches) return false;

        const pingTimeMs = new Date(loc.timestamp).getTime();
        return Math.abs(pingTimeMs - cardTimeMs) <= 24 * 60 * 60 * 1000;
      });

      if (matchingGpsPings.length > 0) {
        // Pick the closest ping in time
        matchingGpsPings.sort((a, b) => {
          const diffA = Math.abs(new Date(a.timestamp).getTime() - cardTimeMs);
          const diffB = Math.abs(new Date(b.timestamp).getTime() - cardTimeMs);
          return diffA - diffB;
        });

        const closestPing = matchingGpsPings[0];
        const distKm = calculateDistance(
          closestPing.latitude,
          closestPing.longitude,
          stationCoords.lat,
          stationCoords.lng
        );

        stationDistanceToGpsKm = parseFloat(distKm.toFixed(1));

        if (distKm <= 15.0) {
          gpsVerificationStatus = 'verified';
        } else {
          gpsVerificationStatus = 'suspicious';

          // Critical Ghost Refuel if > 25.0 km
          if (distKm > 25.0) {
            confidenceDeduction += 50;
            anomalies.push({
              category: 'location_mismatch',
              severity: 'critical',
              titleAr: 'اشتباه تزود وهمي بالوقود (Ghost Refueling / الشاحنة بعيدة عن المحطة)',
              titleFr: 'Suspicion ravitaillement fictif (Véhicule hors site)',
              titleEs: 'Sospecha de repostaje fantasma (Vehículo fuera de zona)',
              descriptionAr: `البطاقة استُعملت في (${card.stationName} - ${stationCoords.name})، بينما إحداثيات GPS للشاحنة وقت المعاملة تؤكد تواجدها على بُعد ${distKm.toFixed(1)} كم من المحطة!`,
              descriptionFr: `Carte utilisée à (${card.stationName}), mais le GPS du camion indique une distance de ${distKm.toFixed(1)} km au moment de la transaction !`,
              descriptionEs: `Tarjeta usada en (${card.stationName}), ¡pero el GPS del camión sitúa el vehículo a ${distKm.toFixed(1)} km en ese momento!`,
              distanceKm: parseFloat(distKm.toFixed(1)),
            });
          }
        }
      }
    }

    // 6. Final Status & Confidence Score
    const confidenceScore = Math.max(0, Math.min(100, 100 - confidenceDeduction));

    let status: ReconciliationStatus = 'matched';
    const hasCriticalLocation = anomalies.some((a) => a.category === 'location_mismatch');
    const hasOverfill = anomalies.some((a) => a.category === 'overfill_exceeded');
    const hasDuplicate = anomalies.some((a) => a.category === 'duplicate_swipe');
    const hasVariance = anomalies.some((a) => a.category === 'volume_variance' || a.category === 'price_variance');

    if (hasCriticalLocation) {
      status = 'ghost_refuel';
    } else if (hasOverfill) {
      status = 'overfill_fraud';
    } else if (hasDuplicate) {
      status = 'duplicate_swipe';
    } else if (!bestReceipt) {
      status = 'unmatched_card';
    } else if (hasVariance) {
      status = 'variance';
    } else {
      status = 'matched';
    }

    // Deduce Provider from transaction ID prefix or heuristics
    let provider: FuelCardProvider = 'afriquia';
    const cardIdUpper = card.transactionId.toUpperCase();
    if (cardIdUpper.includes('TOTAL')) provider = 'totalenergies';
    else if (cardIdUpper.includes('SHELL')) provider = 'shell';
    else if (cardIdUpper.includes('OLA')) provider = 'ola_energy';
    else if (cardIdUpper.includes('WINXO')) provider = 'winxo';
    else if (cardIdUpper.includes('PETROM')) provider = 'petrom';

    reconciledEntries.push({
      id: `REC-${i + 1}-${Date.now().toString(36)}`,
      provider,
      cardTransaction: card,
      matchedReceipt: bestReceipt,
      status,
      confidenceScore,
      volumeVarianceLiters: parseFloat(volumeVarianceDec.toFixed(2)),
      financialVarianceMad: parseFloat(financialVarianceDec.toFixed(2)),
      stationDistanceToGpsKm,
      gpsVerificationStatus,
      anomalies,
      reconciledAt: new Date().toISOString(),
    });
  }

  // 7. Compile Financial Summary strictly using Decimal.js
  let totalCardAmountDec = new Decimal(0);
  let totalReceiptAmountDec = new Decimal(0);
  let netDiscrepancyDec = new Decimal(0);

  let totalMatched = 0;
  let totalVariance = 0;
  let totalFraudSuspected = 0;

  const providerMap = new Map<
    FuelCardProvider,
    { count: number; matchedCount: number; fraudCount: number; amountDec: InstanceType<typeof Decimal> }
  >();

  for (const entry of reconciledEntries) {
    const cardAmt = new Decimal(entry.cardTransaction.totalAmount || 0);
    totalCardAmountDec = totalCardAmountDec.plus(cardAmt);

    if (entry.matchedReceipt) {
      const recAmt = new Decimal(entry.matchedReceipt.receiptAmount || 0);
      totalReceiptAmountDec = totalReceiptAmountDec.plus(recAmt);
      netDiscrepancyDec = netDiscrepancyDec.plus(cardAmt.minus(recAmt));
    } else {
      netDiscrepancyDec = netDiscrepancyDec.plus(cardAmt);
    }

    if (entry.status === 'matched') {
      totalMatched++;
    } else if (entry.status === 'variance') {
      totalVariance++;
    } else if (entry.status === 'ghost_refuel' || entry.status === 'overfill_fraud' || entry.status === 'duplicate_swipe') {
      totalFraudSuspected++;
    }

    // Provider stats
    const prov = entry.provider;
    if (!providerMap.has(prov)) {
      providerMap.set(prov, {
        count: 0,
        matchedCount: 0,
        fraudCount: 0,
        amountDec: new Decimal(0),
      });
    }
    const stat = providerMap.get(prov)!;
    stat.count++;
    stat.amountDec = stat.amountDec.plus(cardAmt);
    if (entry.status === 'matched') stat.matchedCount++;
    if (entry.status === 'ghost_refuel' || entry.status === 'overfill_fraud' || entry.status === 'duplicate_swipe') {
      stat.fraudCount++;
    }
  }

  const reconciliationRate =
    reconciledEntries.length > 0
      ? parseFloat(
          new Decimal(totalMatched)
            .dividedBy(reconciledEntries.length)
            .times(100)
            .toFixed(1)
        )
      : 100.0;

  const providerBreakdown: ProviderReconciliationStats[] = Array.from(providerMap.entries()).map(
    ([provider, stat]) => ({
      provider,
      totalCount: stat.count,
      matchedCount: stat.matchedCount,
      fraudCount: stat.fraudCount,
      totalAmountMad: parseFloat(stat.amountDec.toFixed(2)),
    })
  );

  const summary: FuelReconciliationSummary = {
    totalCardTransactions: reconciledEntries.length,
    totalMatched,
    totalVariance,
    totalFraudSuspected,
    totalCardAmountMad: parseFloat(totalCardAmountDec.toFixed(2)),
    totalReceiptAmountMad: parseFloat(totalReceiptAmountDec.toFixed(2)),
    netDiscrepancyMad: parseFloat(netDiscrepancyDec.toFixed(2)),
    reconciliationRate,
    providerBreakdown,
    generatedAt: new Date().toISOString(),
  };

  return { reconciledEntries, summary };
}
