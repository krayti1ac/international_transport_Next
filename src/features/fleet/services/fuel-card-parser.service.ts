import Decimal from 'decimal.js';
type DecimalInstance = InstanceType<typeof Decimal>;
import type {
  FuelCardProvider,
  FuelCardTransactionRaw,
} from '../types/fuel-reconciliation.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface ParseFuelCardCsvResult {
  success: boolean;
  provider: FuelCardProvider;
  transactions: FuelCardTransactionRaw[];
  errors: string[];
  totalParsed: number;
}

/**
 * Normalizes a plate number string to a canonical alphanumeric form for robust cross-matching.
 * E.g. "12345-A-1", "12345 A 1", "12345|A|1" -> "12345-A-1"
 */
export function normalizePlateNumber(raw: string): string {
  if (!raw) return 'UNKNOWN';
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/_{2,}/g, '-')
    .replace(/\|/g, '-');
}

/**
 * Detects fuel card provider based on header row keywords or content signatures.
 */
export function detectFuelCardProvider(headerLine: string, fullContent?: string): FuelCardProvider {
  const line = (headerLine + ' ' + (fullContent || '')).toLowerCase();

  if (line.includes('afriquia') || line.includes('fastoll') || line.includes('oasis') || line.includes('akw') || line.includes('carte oasis')) {
    return 'afriquia';
  }
  if (line.includes('totalenergies') || line.includes('total fleet') || line.includes('total card') || line.includes('as24')) {
    return 'totalenergies';
  }
  if (line.includes('shell') || line.includes('euroshell') || line.includes('shell fleet')) {
    return 'shell';
  }
  if (line.includes('ola energy') || line.includes('ola card')) {
    return 'ola_energy';
  }
  if (line.includes('winxo')) {
    return 'winxo';
  }
  if (line.includes('petrom')) {
    return 'petrom';
  }
  return 'generic';
}

/**
 * Splits CSV lines correctly handling quoted strings containing commas or semicolons.
 */
function parseCsvLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^["']|["']$/g, ''));
  return result;
}

/**
 * Intelligent CSV / Statement Parser for digital fuel cards (Afriquia, TotalEnergies, Shell, etc.)
 * Strictly enforces Decimal.js on financial amounts, unit prices, and volumes.
 */
export function parseFuelCardStatement(
  rawContent: string,
  preferredProvider?: FuelCardProvider
): ParseFuelCardCsvResult {
  const errors: string[] = [];
  const transactions: FuelCardTransactionRaw[] = [];

  if (!rawContent || !rawContent.trim()) {
    return {
      success: false,
      provider: preferredProvider || 'generic',
      transactions: [],
      errors: ['محتوى كشف بطاقات الوقود فارغ (Statement content is empty)'],
      totalParsed: 0,
    };
  }

  const lines = rawContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      success: false,
      provider: preferredProvider || 'generic',
      transactions: [],
      errors: ['كشف الحساب يجب أن يحتوي على سطر الترويسة وسجل معاملة واحد على الأقل'],
      totalParsed: 0,
    };
  }

  // Detect delimiter: semicolon, comma, or tab
  const headerRaw = lines[0];
  let delimiter = ',';
  if (headerRaw.includes(';') && (headerRaw.split(';').length > headerRaw.split(',').length)) {
    delimiter = ';';
  } else if (headerRaw.includes('\t')) {
    delimiter = '\t';
  }

  const provider = preferredProvider || detectFuelCardProvider(headerRaw, rawContent.slice(0, 500));
  const headers = parseCsvLine(headerRaw, delimiter).map((h) => h.toLowerCase().trim());

  // Dynamic Header Column Index Resolvers
  const getIndex = (aliases: string[]): number => {
    return headers.findIndex((h) => aliases.some((alias) => h.includes(alias)));
  };

  const cardIdx = getIndex(['carte', 'card', 'pan', 'n° carte', 'num_carte']);
  const plateIdx = getIndex(['immat', 'matricule', 'vehicule', 'vehicle', 'registration', 'plaque', 'plate']);
  const dateIdx = getIndex(['date', 'date transaction', 'trans_date', 'timestamp']);
  const timeIdx = getIndex(['heure', 'time']);
  const stationIdx = getIndex(['station', 'site', 'lieu', 'point de vente', 'station name', 'merchant']);
  const cityIdx = getIndex(['ville', 'city', 'localite', 'region']);
  const productIdx = getIndex(['produit', 'product', 'carburant', 'fuel', 'grade', 'article']);
  const litersIdx = getIndex(['volume', 'litres', 'liters', 'quantite', 'quantity', 'qte', 'qty']);
  const unitPriceIdx = getIndex(['p.u', 'pu', 'prix unitaire', 'unit price', 'unit_price', 'pu ttc']);
  const amountIdx = getIndex(['montant', 'amount', 'total', 'montant ttc', 'gross amount', 'total ttc']);
  const vatIdx = getIndex(['tva', 'vat', 'tax']);
  const odoIdx = getIndex(['km', 'kilometrage', 'odometer', 'index']);

  for (let rowIndex = 1; rowIndex < lines.length; rowIndex++) {
    const rowRaw = lines[rowIndex];
    if (!rowRaw || rowRaw.startsWith('#')) continue;

    const cols = parseCsvLine(rowRaw, delimiter);
    if (cols.length < 3) continue;

    try {
      const cardNumber = cardIdx >= 0 ? cols[cardIdx] || `CARD-${rowIndex}` : `CARD-${rowIndex}`;
      const rawPlate = plateIdx >= 0 ? cols[plateIdx] : '';
      const truckPlate = normalizePlateNumber(rawPlate || `TRK-UNKNOWN-${rowIndex}`);

      const dateStr = dateIdx >= 0 ? cols[dateIdx] : new Date().toISOString().split('T')[0];
      const timeStr = timeIdx >= 0 ? cols[timeIdx] : '12:00';
      const timestamp = dateStr.includes('T')
        ? dateStr
        : `${dateStr} ${timeStr}`.trim();

      const stationName = stationIdx >= 0 && cols[stationIdx] ? cols[stationIdx] : 'Station Service Transit';
      const stationCity = cityIdx >= 0 ? cols[cityIdx] : undefined;
      const fuelType = productIdx >= 0 && cols[productIdx] ? cols[productIdx] : 'Gasoil 10 ppm';

      // Financial Decimal.js parsing
      const parseNumberSafe = (val?: string): DecimalInstance => {
        if (!val) return new Decimal(0);
        // Clean French/Moroccan number format e.g. "1 450,50" -> "1450.50"
        const clean = val.replace(/\s+/g, '').replace(/,/g, '.').replace(/[^0-9.-]/g, '');
        return clean ? new Decimal(clean) : new Decimal(0);
      };

      const litersDec = litersIdx >= 0 ? parseNumberSafe(cols[litersIdx]) : new Decimal(0);
      let unitPriceDec = unitPriceIdx >= 0 ? parseNumberSafe(cols[unitPriceIdx]) : new Decimal(0);
      let totalAmountDec = amountIdx >= 0 ? parseNumberSafe(cols[amountIdx]) : new Decimal(0);
      const vatDec = vatIdx >= 0 ? parseNumberSafe(cols[vatIdx]) : new Decimal(0);

      // Financial cross-completion using Decimal.js
      if (totalAmountDec.isZero() && !litersDec.isZero() && !unitPriceDec.isZero()) {
        totalAmountDec = litersDec.times(unitPriceDec);
      } else if (unitPriceDec.isZero() && !totalAmountDec.isZero() && !litersDec.isZero()) {
        unitPriceDec = totalAmountDec.dividedBy(litersDec);
      }

      const odometerKm = odoIdx >= 0 ? Number(parseNumberSafe(cols[odoIdx]).toFixed(0)) : undefined;

      const liters = parseFloat(litersDec.toFixed(2));
      const unitPrice = parseFloat(unitPriceDec.toFixed(2));
      const totalAmount = parseFloat(totalAmountDec.toFixed(2));
      const vatAmount = parseFloat(vatDec.toFixed(2));

      // Currency deduction
      let currency = 'MAD';
      const upperRow = rowRaw.toUpperCase();
      if (upperRow.includes('EUR') || upperRow.includes('€')) {
        currency = 'EUR';
      } else if (upperRow.includes('XOF') || upperRow.includes('CFA')) {
        currency = 'XOF';
      }

      transactions.push({
        transactionId: `TX-${provider.toUpperCase()}-${rowIndex}-${Date.now().toString(36)}`,
        cardNumber,
        truckPlate,
        timestamp,
        stationName,
        stationCity,
        fuelType,
        liters,
        unitPrice,
        totalAmount,
        vatAmount,
        currency,
        odometerKm,
      });
    } catch (rowErr) {
      errors.push(`خطأ في قراءة السطر ${rowIndex + 1}: ${rowErr instanceof Error ? rowErr.message : String(rowErr)}`);
    }
  }

  return {
    success: transactions.length > 0,
    provider,
    transactions,
    errors,
    totalParsed: transactions.length,
  };
}
