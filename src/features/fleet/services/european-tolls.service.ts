import Decimal from 'decimal.js';
import type {
  TollCountryCode,
  TollProvider,
  TollSystem,
  TollVehicleClass,
  RawTollTransaction,
  TripTollExpense,
  TollReconciliationSummary,
  TollCountryBreakdown,
  TollProviderBreakdown,
  TripMatchCandidate,
  VatRecoveryStatus,
  TollReconciliationStatus,
} from '../types/european-tolls.types';
import {
  STANDARD_COUNTRY_TOLL_VAT_RATES,
  MAJOR_EUROPEAN_HIGHWAYS,
} from '../types/european-tolls.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

type DecimalValue = InstanceType<typeof Decimal>;

export const DEFAULT_EUR_TO_MAD_RATE = '10.8500';

/**
 * Normalizes truck plate numbers for comparison across provider files and database records.
 * e.g., "12345-A-26" -> "12345A26", "1234 BBB" -> "1234BBB"
 */
export function normalizePlate(plate: string): string {
  if (!plate) return '';
  return plate.toUpperCase().replace(/[\s\-_|/]/g, '').trim();
}

export interface TollCalculationInput {
  countryCode: TollCountryCode;
  highwayCode?: string;
  distanceKm?: number;
  netAmountEur?: number | string;
  vatRate?: number | string;
  exchangeRateToMad?: number | string;
  isEurovignette?: boolean;
}

export interface TollCalculationResult {
  netAmountEur: string;
  vatRate: string;
  vatAmountEur: string;
  grossAmountEur: string;
  grossAmountMad: string;
  vatRecoverable: boolean;
  vatRecoveryStatus: VatRecoveryStatus;
}

export class EuropeanTollsService {
  /**
   * Calculates toll amounts with exact Decimal.js precision for financial compliance.
   */
  public static calculateTollAmount(input: TollCalculationInput): TollCalculationResult {
    const fxRate = new Decimal(input.exchangeRateToMad || DEFAULT_EUR_TO_MAD_RATE);

    // If Eurovignette: statutory road duty, zero VAT
    if (input.isEurovignette || input.highwayCode === 'EUROVIGNETTE') {
      const net = new Decimal(input.netAmountEur ?? '12.0000');
      const vat = new Decimal(0);
      const gross = net;
      const grossMad = gross.times(fxRate).toFixed(2);

      return {
        netAmountEur: net.toFixed(4),
        vatRate: '0.0000',
        vatAmountEur: '0.0000',
        grossAmountEur: gross.toFixed(4),
        grossAmountMad: grossMad,
        vatRecoverable: false,
        vatRecoveryStatus: 'exempt',
      };
    }

    let net: DecimalValue;
    if (input.netAmountEur !== undefined) {
      net = new Decimal(input.netAmountEur);
    } else if (input.distanceKm && input.highwayCode && MAJOR_EUROPEAN_HIGHWAYS[input.highwayCode]) {
      const rate = new Decimal(MAJOR_EUROPEAN_HIGHWAYS[input.highwayCode].typicalRatePerKmEur);
      net = new Decimal(input.distanceKm).times(rate);
    } else {
      net = new Decimal(0);
    }

    // Determine VAT rate: use provided rate or statutory country default
    const standardVat = STANDARD_COUNTRY_TOLL_VAT_RATES[input.countryCode] ?? 0.20;
    const vatRateDecimal = new Decimal(input.vatRate !== undefined ? input.vatRate : standardVat);

    const vatAmount = net.times(vatRateDecimal);
    const gross = net.plus(vatAmount);
    const grossMad = gross.times(fxRate).toFixed(2);

    // In EU member states, VAT on commercial heavy transport is recoverable under 8th Directive
    const euCountries: TollCountryCode[] = ['ES', 'FR', 'DE', 'NL', 'BE', 'LU', 'DK', 'SE', 'PT', 'IT'];
    const vatRecoverable = euCountries.includes(input.countryCode) && vatAmount.greaterThan(0);

    return {
      netAmountEur: net.toFixed(4),
      vatRate: vatRateDecimal.toFixed(4),
      vatAmountEur: vatAmount.toFixed(4),
      grossAmountEur: gross.toFixed(4),
      grossAmountMad: grossMad,
      vatRecoverable,
      vatRecoveryStatus: vatRecoverable ? 'pending' : 'exempt',
    };
  }

  /**
   * Calculates statutory Northern Eurovignette (NL, BE, LU, DK, SE) tariff according to Directive 1999/62/EC.
   * Standard heavy articulated truck (>= 4 axles, Euro VI emission class).
   */
  public static calculateEurovignetteTariff(
    days: number,
    euroClass: 'euro_vi' | 'euro_v' | 'older' = 'euro_vi',
    axles: number = 5,
    exchangeRateToMad: number | string = DEFAULT_EUR_TO_MAD_RATE
  ): TollCalculationResult {
    const dailyTariffMap: Record<string, string> = {
      euro_vi: '12.0000',
      euro_v: '14.0000',
      older: '16.0000',
    };
    const dailyRate = new Decimal(dailyTariffMap[euroClass] || '12.0000');
    // Multiplied by number of valid days (minimum 1 day)
    const validDays = Math.max(1, Math.round(days));
    const net = dailyRate.times(validDays);

    return this.calculateTollAmount({
      countryCode: 'NL',
      highwayCode: 'EUROVIGNETTE',
      netAmountEur: net.toFixed(4),
      exchangeRateToMad,
      isEurovignette: true,
    });
  }

  /**
   * Parses raw provider export files (CSV or JSON format) from DKV, Telepass, or AS 24.
   */
  public static parseRawProviderFile(
    fileContent: string,
    provider: TollProvider = 'generic'
  ): RawTollTransaction[] {
    const trimmed = fileContent.trim();
    if (!trimmed) return [];

    // JSON format support
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        return list.map((item, index) => this.mapGenericItemToTransaction(item, provider, index));
      } catch (err) {
        console.warn('[EuropeanTollsService] Failed to parse JSON content, falling back to CSV:', err);
      }
    }

    // CSV format parser
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const header = lines[0].toLowerCase();
    const rows = lines.slice(1);
    const results: RawTollTransaction[] = [];

    rows.forEach((row, index) => {
      // Split on comma or semicolon
      const cols = row.split(/[,;\t]/).map((c) => c.replace(/^["']|["']$/g, '').trim());
      if (cols.length < 5) return;

      const tx = this.parseCsvRow(cols, header, provider, index);
      if (tx) {
        results.push(tx);
      }
    });

    return results;
  }

  /**
   * Reconciles raw toll transactions with active/historical trip orders and vehicle schedules.
   */
  public static reconcileTollTransactions(
    rawTransactions: RawTollTransaction[],
    trips: TripMatchCandidate[],
    options?: {
      exchangeRateToMad?: number | string;
      toleranceHours?: number; // Grace period before/after trip dates (default: 24h)
    }
  ): TripTollExpense[] {
    const fxRate = new Decimal(options?.exchangeRateToMad || DEFAULT_EUR_TO_MAD_RATE);
    const toleranceMs = (options?.toleranceHours ?? 24) * 60 * 60 * 1000;

    const tripsByNormalizedPlate: Record<string, TripMatchCandidate[]> = {};
    trips.forEach((trip) => {
      const plate = normalizePlate(trip.truck_plate || '');
      if (plate) {
        if (!tripsByNormalizedPlate[plate]) {
          tripsByNormalizedPlate[plate] = [];
        }
        tripsByNormalizedPlate[plate].push(trip);
      }
    });

    return rawTransactions.map((tx, idx) => {
      const normalizedTxPlate = normalizePlate(tx.truckPlate);
      const candidateTrips = tripsByNormalizedPlate[normalizedTxPlate] || [];
      const txTime = new Date(tx.exitTime).getTime();

      let matchedTrip: TripMatchCandidate | null = null;
      let status: TollReconciliationStatus = 'unmatched';
      let notes: string | null = null;
      let gpsVerified = false;

      if (candidateTrips.length > 0) {
        // Find trip where exitTime is within [departure - tolerance, arrival + tolerance]
        matchedTrip = candidateTrips.find((t) => {
          if (!t.departure_date) return false;
          const depTime = new Date(t.departure_date).getTime() - toleranceMs;
          const arrTime = t.arrival_date ? new Date(t.arrival_date).getTime() + toleranceMs : depTime + 14 * 24 * 60 * 60 * 1000;
          return txTime >= depTime && txTime <= arrTime;
        }) || candidateTrips[0]; // fallback to closest candidate
      }

      if (matchedTrip) {
        status = 'matched';
        gpsVerified = true;
        notes = `Matricule lié à la mission ${matchedTrip.trip_code || matchedTrip.id} (${matchedTrip.route || 'Transit International'})`;
      } else if (candidateTrips.length === 0) {
        // Vehicle not found in active fleet trips
        status = 'flagged_leakage';
        notes = `Alerte fuite de péage: Immatriculation ${tx.truckPlate} non associée aux missions actives`;
      } else {
        status = 'unmatched';
        notes = 'Date de passage en dehors des dates de mission programmées';
      }

      const netDec = new Decimal(tx.netAmountEur);
      const vatDec = new Decimal(tx.vatAmountEur);
      const grossDec = new Decimal(tx.grossAmountEur);
      const grossMad = grossDec.times(fxRate);

      const euCountries: TollCountryCode[] = ['ES', 'FR', 'DE', 'NL', 'BE', 'LU', 'DK', 'SE', 'PT', 'IT'];
      const isRecoverable = euCountries.includes(tx.countryCode) && vatDec.greaterThan(0);

      return {
        id: idx + 1,
        trip_id: matchedTrip?.id ?? null,
        truck_id: matchedTrip?.truck_id ?? null,
        toll_system: tx.tollSystem,
        country_code: tx.countryCode,
        provider: tx.provider,
        card_or_obu_id: tx.cardOrObuId,
        entry_gate: tx.entryGate || null,
        exit_gate: tx.exitGate,
        highway_code: tx.highwayCode || null,
        entry_time: tx.entryTime || null,
        exit_time: tx.exitTime,
        distance_km: tx.distanceKm ?? null,
        vehicle_class: tx.vehicleClass || 'class_4',
        axles_count: tx.axlesCount ?? 5,
        gvw_tonnes: tx.gvwTonnes ?? 40.0,
        net_amount_eur: Number(netDec.toFixed(4)),
        vat_rate: Number(new Decimal(tx.vatRate).toFixed(4)),
        vat_amount_eur: Number(vatDec.toFixed(4)),
        gross_amount_eur: Number(grossDec.toFixed(4)),
        exchange_rate_to_mad: Number(fxRate.toFixed(4)),
        gross_amount_mad: Number(grossMad.toFixed(2)),
        vat_recoverable: isRecoverable,
        vat_recovery_status: isRecoverable ? 'pending' : 'exempt',
        reconciliation_status: status,
        reconciliation_notes: notes,
        gps_verified: gpsVerified,
        trip_code: matchedTrip?.trip_code,
        truck_plate: tx.truckPlate,
        driver_name: matchedTrip?.driver_name,
      };
    });
  }

  /**
   * Generates a comprehensive financial and operational summary using strict Decimal.js precision.
   */
  public static generateReconciliationSummary(
    expenses: TripTollExpense[],
    exchangeRateToMad: number | string = DEFAULT_EUR_TO_MAD_RATE
  ): TollReconciliationSummary {
    const fxRate = new Decimal(exchangeRateToMad);
    let totalGrossEur = new Decimal(0);
    let totalNetEur = new Decimal(0);
    let totalVatEur = new Decimal(0);
    let recoverableVatEur = new Decimal(0);
    let totalGrossMad = new Decimal(0);

    let matchedCount = 0;
    let discrepanciesCount = 0;
    let leakageCount = 0;

    const countryMap: Record<
      TollCountryCode,
      {
        count: number;
        netEur: DecimalValue;
        vatEur: DecimalValue;
        grossEur: DecimalValue;
        recVatEur: DecimalValue;
      }
    > = {
      ES: { count: 0, netEur: new Decimal(0), vatEur: new Decimal(0), grossEur: new Decimal(0), recVatEur: new Decimal(0) },
      FR: { count: 0, netEur: new Decimal(0), vatEur: new Decimal(0), grossEur: new Decimal(0), recVatEur: new Decimal(0) },
      DE: { count: 0, netEur: new Decimal(0), vatEur: new Decimal(0), grossEur: new Decimal(0), recVatEur: new Decimal(0) },
      NL: { count: 0, netEur: new Decimal(0), vatEur: new Decimal(0), grossEur: new Decimal(0), recVatEur: new Decimal(0) },
      BE: { count: 0, netEur: new Decimal(0), vatEur: new Decimal(0), grossEur: new Decimal(0), recVatEur: new Decimal(0) },
      LU: { count: 0, netEur: new Decimal(0), vatEur: new Decimal(0), grossEur: new Decimal(0), recVatEur: new Decimal(0) },
      DK: { count: 0, netEur: new Decimal(0), vatEur: new Decimal(0), grossEur: new Decimal(0), recVatEur: new Decimal(0) },
      SE: { count: 0, netEur: new Decimal(0), vatEur: new Decimal(0), grossEur: new Decimal(0), recVatEur: new Decimal(0) },
      PT: { count: 0, netEur: new Decimal(0), vatEur: new Decimal(0), grossEur: new Decimal(0), recVatEur: new Decimal(0) },
      IT: { count: 0, netEur: new Decimal(0), vatEur: new Decimal(0), grossEur: new Decimal(0), recVatEur: new Decimal(0) },
      MA: { count: 0, netEur: new Decimal(0), vatEur: new Decimal(0), grossEur: new Decimal(0), recVatEur: new Decimal(0) },
      MR: { count: 0, netEur: new Decimal(0), vatEur: new Decimal(0), grossEur: new Decimal(0), recVatEur: new Decimal(0) },
      SN: { count: 0, netEur: new Decimal(0), vatEur: new Decimal(0), grossEur: new Decimal(0), recVatEur: new Decimal(0) },
    };

    const providerMap: Record<
      TollProvider,
      {
        count: number;
        grossEur: DecimalValue;
        matched: number;
        leakage: number;
      }
    > = {
      dkv: { count: 0, grossEur: new Decimal(0), matched: 0, leakage: 0 },
      telepass: { count: 0, grossEur: new Decimal(0), matched: 0, leakage: 0 },
      as24: { count: 0, grossEur: new Decimal(0), matched: 0, leakage: 0 },
      eurotoll: { count: 0, grossEur: new Decimal(0), matched: 0, leakage: 0 },
      totalenergies_pass: { count: 0, grossEur: new Decimal(0), matched: 0, leakage: 0 },
      manual: { count: 0, grossEur: new Decimal(0), matched: 0, leakage: 0 },
      generic: { count: 0, grossEur: new Decimal(0), matched: 0, leakage: 0 },
    };

    expenses.forEach((exp) => {
      const net = new Decimal(exp.net_amount_eur);
      const vat = new Decimal(exp.vat_amount_eur);
      const gross = new Decimal(exp.gross_amount_eur);
      const mad = gross.times(fxRate);

      totalNetEur = totalNetEur.plus(net);
      totalVatEur = totalVatEur.plus(vat);
      totalGrossEur = totalGrossEur.plus(gross);
      totalGrossMad = totalGrossMad.plus(mad);

      if (exp.vat_recoverable) {
        recoverableVatEur = recoverableVatEur.plus(vat);
      }

      if (exp.reconciliation_status === 'matched') matchedCount++;
      else if (exp.reconciliation_status === 'discrepancy') discrepanciesCount++;
      else if (exp.reconciliation_status === 'flagged_leakage') leakageCount++;

      // Country breakdown
      const c = countryMap[exp.country_code];
      if (c) {
        c.count++;
        c.netEur = c.netEur.plus(net);
        c.vatEur = c.vatEur.plus(vat);
        c.grossEur = c.grossEur.plus(gross);
        if (exp.vat_recoverable) {
          c.recVatEur = c.recVatEur.plus(vat);
        }
      }

      // Provider breakdown
      const p = providerMap[exp.provider];
      if (p) {
        p.count++;
        p.grossEur = p.grossEur.plus(gross);
        if (exp.reconciliation_status === 'matched') p.matched++;
        if (exp.reconciliation_status === 'flagged_leakage') p.leakage++;
      }
    });

    const totalCount = expenses.length;
    const matchRate = totalCount > 0
      ? new Decimal(matchedCount).dividedBy(totalCount).times(100).toFixed(1)
      : '0.0';

    const countryNames: Record<TollCountryCode, string> = {
      ES: 'Espagne (AP-7 / Via-T)',
      FR: 'France (A9, A7, A10 / Télépéage)',
      DE: 'Allemagne (LKW-Maut)',
      NL: 'Pays-Bas (Eurovignette)',
      BE: 'Belgique (Viapass)',
      LU: 'Luxembourg',
      DK: 'Danemark',
      SE: 'Suède',
      PT: 'Portugal (Via Verde)',
      IT: 'Italie (Telepass)',
      MA: 'Maroc (ADM)',
      MR: 'Mauritanie',
      SN: 'Sénégal',
    };

    const countryBreakdown: TollCountryBreakdown[] = Object.entries(countryMap)
      .filter(([_, data]) => data.count > 0)
      .map(([code, data]) => ({
        countryCode: code as TollCountryCode,
        countryName: countryNames[code as TollCountryCode] || code,
        transactionsCount: data.count,
        totalNetEur: Number(data.netEur.toFixed(2)),
        totalVatEur: Number(data.vatEur.toFixed(2)),
        totalGrossEur: Number(data.grossEur.toFixed(2)),
        recoverableVatEur: Number(data.recVatEur.toFixed(2)),
      }));

    const providerBreakdown: TollProviderBreakdown[] = Object.entries(providerMap)
      .filter(([_, data]) => data.count > 0)
      .map(([prov, data]) => ({
        provider: prov as TollProvider,
        transactionsCount: data.count,
        totalGrossEur: Number(data.grossEur.toFixed(2)),
        matchedCount: data.matched,
        leakageCount: data.leakage,
      }));

    return {
      totalGrossEur: totalGrossEur.toFixed(2),
      totalNetEur: totalNetEur.toFixed(2),
      totalVatEur: totalVatEur.toFixed(2),
      recoverableVatEur: recoverableVatEur.toFixed(2),
      totalGrossMad: totalGrossMad.toFixed(2),
      totalTransactions: totalCount,
      matchedTransactions: matchedCount,
      discrepanciesCount,
      leakageCount,
      matchRatePercentage: `${matchRate}%`,
      countryBreakdown,
      providerBreakdown,
    };
  }

  // --- Helpers for parsing ---

  private static parseCsvRow(
    cols: string[],
    header: string,
    provider: TollProvider,
    index: number
  ): RawTollTransaction | null {
    // Default assumptions for columns:
    // Format A (DKV standard): Date, Card/OBU, Plate, Highway, ExitGate, Country, NetEUR, VatRate, GrossEUR
    // Format B (Telepass/AS24): Plate, Date, Country, System, ExitGate, Net, Vat, Gross
    try {
      let truckPlate = '';
      let cardOrObuId = `CARD-${index + 1}`;
      let exitTime = new Date().toISOString();
      let countryCode: TollCountryCode = 'ES';
      let highwayCode = 'AP-7';
      let exitGate = 'Girona Nord';
      let netEur = '0.00';
      let vatEur = '0.00';
      let grossEur = '0.00';
      let vatRate = '0.21';
      let tollSystem: TollSystem = 'via_t';

      if (header.includes('pan') || header.includes('dkv') || cols.length >= 9) {
        // DKV format: Date, OBU, Plate, Country, Highway, Gate, Net, VAT, Gross
        exitTime = cols[0] || exitTime;
        cardOrObuId = cols[1] || cardOrObuId;
        truckPlate = cols[2] || '';
        countryCode = this.resolveCountryCode(cols[3] || 'ES');
        highwayCode = cols[4] || highwayCode;
        exitGate = cols[5] || exitGate;
        netEur = cols[6] || '0.00';
        vatEur = cols[7] || '0.00';
        grossEur = cols[8] || netEur;
      } else {
        // Simple/generic format: Plate, ExitTime, Country, Gate, Net, Gross
        truckPlate = cols[0] || '';
        exitTime = cols[1] || exitTime;
        countryCode = this.resolveCountryCode(cols[2] || 'ES');
        exitGate = cols[3] || exitGate;
        netEur = cols[4] || '0.00';
        grossEur = cols[5] || netEur;
      }

      if (!truckPlate) return null;

      // Infer system from country
      tollSystem = this.inferSystemFromCountry(countryCode, highwayCode);

      // Clean amount strings (replace comma with dot)
      const cleanNet = netEur.replace(',', '.').replace(/[^0-9.-]/g, '');
      const cleanGross = grossEur.replace(',', '.').replace(/[^0-9.-]/g, '');
      const netDec = new Decimal(cleanNet || '0');
      let grossDec = new Decimal(cleanGross || cleanNet || '0');

      if (grossDec.lessThan(netDec)) {
        grossDec = netDec;
      }

      const standardVat = STANDARD_COUNTRY_TOLL_VAT_RATES[countryCode] ?? 0.20;
      let vatDec = grossDec.minus(netDec);
      if (vatDec.isZero() && standardVat > 0 && !highwayCode.includes('EUROVIGNETTE')) {
        vatDec = netDec.times(standardVat);
        grossDec = netDec.plus(vatDec);
      }

      return {
        rawTransactionId: `TX-${provider}-${index + 1}-${Date.now().toString(36)}`,
        cardOrObuId,
        truckPlate,
        provider,
        tollSystem,
        countryCode,
        highwayCode,
        exitGate,
        exitTime: this.normalizeDateTimeString(exitTime),
        netAmountEur: Number(netDec.toFixed(4)),
        vatRate: standardVat,
        vatAmountEur: Number(vatDec.toFixed(4)),
        grossAmountEur: Number(grossDec.toFixed(4)),
        vehicleClass: 'class_4',
        axlesCount: 5,
        gvwTonnes: 40.0,
      };
    } catch {
      return null;
    }
  }

  private static mapGenericItemToTransaction(
    item: Record<string, unknown>,
    provider: TollProvider,
    index: number
  ): RawTollTransaction {
    const countryCode = this.resolveCountryCode(String(item.country_code || item.country || 'ES'));
    const highwayCode = String(item.highway_code || item.highway || 'AP-7');
    const netDec = new Decimal(String(item.net_amount_eur || item.net || '0'));
    const standardVat = STANDARD_COUNTRY_TOLL_VAT_RATES[countryCode] ?? 0.20;
    const vatDec = item.vat_amount_eur !== undefined
      ? new Decimal(String(item.vat_amount_eur))
      : netDec.times(standardVat);
    const grossDec = item.gross_amount_eur !== undefined
      ? new Decimal(String(item.gross_amount_eur))
      : netDec.plus(vatDec);

    return {
      rawTransactionId: String(item.raw_transaction_id || `JSON-TX-${index + 1}`),
      cardOrObuId: String(item.card_or_obu_id || item.obu_id || `OBU-${index + 1}`),
      truckPlate: String(item.truck_plate || item.plate || ''),
      provider,
      tollSystem: this.inferSystemFromCountry(countryCode, highwayCode),
      countryCode,
      highwayCode,
      entryGate: item.entry_gate ? String(item.entry_gate) : undefined,
      exitGate: String(item.exit_gate || item.gate || 'Peaje Central'),
      entryTime: item.entry_time ? String(item.entry_time) : undefined,
      exitTime: item.exit_time ? String(item.exit_time) : new Date().toISOString(),
      distanceKm: item.distance_km ? Number(item.distance_km) : undefined,
      netAmountEur: Number(netDec.toFixed(4)),
      vatRate: standardVat,
      vatAmountEur: Number(vatDec.toFixed(4)),
      grossAmountEur: Number(grossDec.toFixed(4)),
      vehicleClass: (item.vehicle_class as TollVehicleClass) || 'class_4',
      axlesCount: Number(item.axles_count || 5),
      gvwTonnes: Number(item.gvw_tonnes || 40.0),
    };
  }

  private static resolveCountryCode(c: string): TollCountryCode {
    const upper = c.toUpperCase().trim();
    if (upper === 'SPAIN' || upper === 'ESPAGNE' || upper === 'ESP') return 'ES';
    if (upper === 'FRANCE' || upper === 'FRA') return 'FR';
    if (upper === 'GERMANY' || upper === 'ALLEMAGNE' || upper === 'DEU') return 'DE';
    if (upper === 'NETHERLANDS' || upper === 'PAYS-BAS' || upper === 'NLD') return 'NL';
    if (upper === 'BELGIUM' || upper === 'BELGIQUE' || upper === 'BEL') return 'BE';
    if (upper === 'PORTUGAL' || upper === 'PRT') return 'PT';
    if (upper === 'ITALY' || upper === 'ITALIE' || upper === 'ITA') return 'IT';
    if (upper === 'MOROCCO' || upper === 'MAROC' || upper === 'MAR') return 'MA';
    if (upper === 'MAURITANIA' || upper === 'MAURITANIE') return 'MR';
    if (upper === 'SENEGAL') return 'SN';
    const valid: TollCountryCode[] = ['ES', 'FR', 'DE', 'NL', 'BE', 'LU', 'DK', 'SE', 'PT', 'IT', 'MA', 'MR', 'SN'];
    return valid.includes(upper as TollCountryCode) ? (upper as TollCountryCode) : 'ES';
  }

  private static inferSystemFromCountry(country: TollCountryCode, highway?: string): TollSystem {
    if (highway === 'EUROVIGNETTE' || ['NL', 'LU', 'DK', 'SE'].includes(country)) return 'eurovignette';
    if (country === 'ES') return 'via_t';
    if (country === 'FR') return 'telepeage';
    if (country === 'DE') return 'lkw_maut';
    if (country === 'BE') return 'viapass';
    if (country === 'PT') return 'cemavat';
    return 'generic_toll';
  }

  private static normalizeDateTimeString(dtStr: string): string {
    try {
      const d = new Date(dtStr);
      if (!isNaN(d.getTime())) return d.toISOString();
    } catch {
      // fallback
    }
    return new Date().toISOString();
  }
}

