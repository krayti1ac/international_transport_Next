import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  EuropeanTollsService,
  normalizePlate,
} from '../services/european-tolls.service';
import type {
  RawTollTransaction,
  TripMatchCandidate,
} from '../types/european-tolls.types';
import {
  uploadTollInvoiceBatchSchema,
  manualTollEstimateSchema,
} from '../schemas/european-tolls.schemas';

describe('European Tolls & Eurovignette Engine', () => {
  describe('1. Financial Precision & Toll Calculations (Decimal.js)', () => {
    it('calculates Spanish AP-7 toll with statutory 21% IVA and MAD conversion', () => {
      const result = EuropeanTollsService.calculateTollAmount({
        countryCode: 'ES',
        netAmountEur: '48.2000',
        exchangeRateToMad: '10.8500',
      });

      // 48.20 * 0.21 = 10.1220 EUR VAT
      // 48.20 + 10.1220 = 58.3220 EUR Gross
      // 58.3220 * 10.85 = 632.7937 MAD -> 632.79 MAD
      expect(result.netAmountEur).toBe('48.2000');
      expect(result.vatRate).toBe('0.2100');
      expect(result.vatAmountEur).toBe('10.1220');
      expect(result.grossAmountEur).toBe('58.3220');
      expect(result.grossAmountMad).toBe('632.79');
      expect(result.vatRecoverable).toBe(true);
      expect(result.vatRecoveryStatus).toBe('pending');
    });

    it('calculates French A9 toll with statutory 20% TVA and typical rate per km', () => {
      // Highway A9 has 0.29 EUR/km typical rate
      const result = EuropeanTollsService.calculateTollAmount({
        countryCode: 'FR',
        highwayCode: 'A9',
        distanceKm: 200,
        exchangeRateToMad: '10.8500',
      });

      // Net = 200 * 0.29 = 58.0000 EUR
      // VAT = 58.00 * 0.20 = 11.6000 EUR
      // Gross = 69.6000 EUR
      // MAD = 69.60 * 10.85 = 755.16 MAD
      expect(result.netAmountEur).toBe('58.0000');
      expect(result.vatRate).toBe('0.2000');
      expect(result.vatAmountEur).toBe('11.6000');
      expect(result.grossAmountEur).toBe('69.6000');
      expect(result.grossAmountMad).toBe('755.16');
      expect(result.vatRecoverable).toBe(true);
    });

    it('calculates Eurovignette as tax-exempt statutory road charge (0% VAT)', () => {
      const result = EuropeanTollsService.calculateEurovignetteTariff(
        3, // 3 days
        'euro_vi',
        5,
        '10.8500'
      );

      // 3 days * 12.00 EUR = 36.0000 EUR Net & Gross, 0 VAT
      // 36.00 * 10.85 = 390.60 MAD
      expect(result.netAmountEur).toBe('36.0000');
      expect(result.vatRate).toBe('0.0000');
      expect(result.vatAmountEur).toBe('0.0000');
      expect(result.grossAmountEur).toBe('36.0000');
      expect(result.grossAmountMad).toBe('390.60');
      expect(result.vatRecoverable).toBe(false);
      expect(result.vatRecoveryStatus).toBe('exempt');
    });

    it('preserves strict Decimal.js precision without binary floating point drift', () => {
      const result = EuropeanTollsService.calculateTollAmount({
        countryCode: 'ES',
        netAmountEur: '0.1',
        vatRate: '0.2',
        exchangeRateToMad: '10.0',
      });

      // 0.1 * 0.2 = 0.02
      // 0.1 + 0.02 = 0.12 (not 0.12000000000000002)
      expect(result.vatAmountEur).toBe('0.0200');
      expect(result.grossAmountEur).toBe('0.1200');
      expect(result.grossAmountMad).toBe('1.20');
    });
  });

  describe('2. Provider File Parsing & Plate Normalization', () => {
    it('normalizes various plate notations into uniform canonical format', () => {
      expect(normalizePlate('12345-A-26')).toBe('12345A26');
      expect(normalizePlate('12345|A|26')).toBe('12345A26');
      expect(normalizePlate(' 1234-XYZ ')).toBe('1234XYZ');
      expect(normalizePlate('99999_B_10')).toBe('99999B10');
      expect(normalizePlate('')).toBe('');
    });

    it('parses DKV standard CSV export lines correctly', () => {
      const csv = `ExitTime,CardOrOBU,TruckPlate,Country,Highway,ExitGate,NetEUR,VatRate,GrossEUR
2026-10-09T08:30:00Z,DKV-BOX-9841,12345-A-26,ES,AP-7,La Jonquera,48.20,0.21,58.32
2026-10-09T11:45:00Z,DKV-BOX-9841,12345-A-26,FR,A9,Montpellier Sud,62.50,0.20,75.00`;

      const parsed = EuropeanTollsService.parseRawProviderFile(csv, 'dkv');
      expect(parsed).toHaveLength(2);
      expect(parsed[0].truckPlate).toBe('12345-A-26');
      expect(parsed[0].provider).toBe('dkv');
      expect(parsed[0].countryCode).toBe('ES');
      expect(parsed[0].tollSystem).toBe('via_t');
      expect(parsed[0].netAmountEur).toBe(48.2);
      expect(parsed[0].vatAmountEur).toBe(10.12);

      expect(parsed[1].countryCode).toBe('FR');
      expect(parsed[1].tollSystem).toBe('telepeage');
      expect(parsed[1].netAmountEur).toBe(62.5);
    });

    it('parses JSON format statements correctly', () => {
      const json = JSON.stringify([
        {
          raw_transaction_id: 'TEL-101',
          plate: '67890-B-40',
          country: 'FR',
          highway: 'A63',
          exit_gate: 'Bordeaux Sud',
          net: '54.80',
          vat_amount_eur: '10.96',
          gross: '65.76',
        },
      ]);

      const parsed = EuropeanTollsService.parseRawProviderFile(json, 'telepass');
      expect(parsed).toHaveLength(1);
      expect(parsed[0].truckPlate).toBe('67890-B-40');
      expect(parsed[0].provider).toBe('telepass');
      expect(parsed[0].countryCode).toBe('FR');
      expect(parsed[0].tollSystem).toBe('telepeage');
      expect(parsed[0].grossAmountEur).toBe(65.76);
    });
  });

  describe('3. Reconciliation Engine & Trip Matching', () => {
    const candidateTrips: TripMatchCandidate[] = [
      {
        id: 101,
        trip_code: 'TRIP-101',
        truck_plate: '12345-A-26',
        route: 'Tanger Med -> Perpignan',
        driver_name: 'Mohamed Amine',
        departure_date: '2026-10-08T00:00:00Z',
        arrival_date: '2026-10-10T23:59:59Z',
      },
    ];

    it('matches transaction with active trip order on plate and date window', () => {
      const rawTx: RawTollTransaction[] = [
        {
          rawTransactionId: 'TX-1',
          cardOrObuId: 'DKV-1',
          truckPlate: '12345-A-26',
          provider: 'dkv',
          tollSystem: 'via_t',
          countryCode: 'ES',
          highwayCode: 'AP-7',
          exitGate: 'La Jonquera',
          exitTime: '2026-10-09T10:00:00Z',
          netAmountEur: 48.2,
          vatRate: 0.21,
          vatAmountEur: 10.12,
          grossAmountEur: 58.32,
        },
      ];

      const reconciled = EuropeanTollsService.reconcileTollTransactions(rawTx, candidateTrips);
      expect(reconciled).toHaveLength(1);
      expect(reconciled[0].reconciliation_status).toBe('matched');
      expect(reconciled[0].trip_id).toBe(101);
      expect(reconciled[0].gps_verified).toBe(true);
      expect(reconciled[0].vat_recoverable).toBe(true);
    });

    it('flags unauthorized toll swipe on unregistered vehicle as leakage', () => {
      const rawTx: RawTollTransaction[] = [
        {
          rawTransactionId: 'TX-LEAK',
          cardOrObuId: 'DKV-UNKNOWN',
          truckPlate: '99999-Z-99', // Unknown plate not in active fleet trips
          provider: 'dkv',
          tollSystem: 'via_t',
          countryCode: 'ES',
          highwayCode: 'AP-7',
          exitGate: 'Girona Sud',
          exitTime: '2026-10-09T03:00:00Z',
          netAmountEur: 30.0,
          vatRate: 0.21,
          vatAmountEur: 6.3,
          grossAmountEur: 36.3,
        },
      ];

      const reconciled = EuropeanTollsService.reconcileTollTransactions(rawTx, candidateTrips);
      expect(reconciled).toHaveLength(1);
      expect(reconciled[0].reconciliation_status).toBe('flagged_leakage');
      expect(reconciled[0].trip_id).toBeNull();
      expect(reconciled[0].reconciliation_notes).toContain('Alerte fuite');
    });
  });

  describe('4. Financial Reconciliation Summary & Breakdown', () => {
    it('aggregates totals, recoverable VAT, and country breakdown correctly', () => {
      const rawTx: RawTollTransaction[] = [
        {
          rawTransactionId: 'TX-1',
          cardOrObuId: 'DKV-1',
          truckPlate: '12345-A-26',
          provider: 'dkv',
          tollSystem: 'via_t',
          countryCode: 'ES',
          exitGate: 'La Jonquera',
          exitTime: '2026-10-09T08:00:00Z',
          netAmountEur: 100.0,
          vatRate: 0.21,
          vatAmountEur: 21.0,
          grossAmountEur: 121.0,
        },
        {
          rawTransactionId: 'TX-2',
          cardOrObuId: 'DKV-1',
          truckPlate: '12345-A-26',
          provider: 'dkv',
          tollSystem: 'telepeage',
          countryCode: 'FR',
          exitGate: 'Montpellier',
          exitTime: '2026-10-09T12:00:00Z',
          netAmountEur: 200.0,
          vatRate: 0.2,
          vatAmountEur: 40.0,
          grossAmountEur: 240.0,
        },
      ];

      const trips: TripMatchCandidate[] = [
        {
          id: 101,
          truck_plate: '12345-A-26',
          departure_date: '2026-10-08T00:00:00Z',
        },
      ];

      const expenses = EuropeanTollsService.reconcileTollTransactions(rawTx, trips);
      const summary = EuropeanTollsService.generateReconciliationSummary(expenses, '10.8500');

      // Net: 100 + 200 = 300.00
      // VAT: 21 + 40 = 61.00
      // Gross EUR: 121 + 240 = 361.00
      // Recoverable VAT: 61.00 (both ES and FR are EU recoverable)
      // Gross MAD: 361.00 * 10.85 = 3916.85
      expect(summary.totalNetEur).toBe('300.00');
      expect(summary.totalVatEur).toBe('61.00');
      expect(summary.totalGrossEur).toBe('361.00');
      expect(summary.recoverableVatEur).toBe('61.00');
      expect(summary.totalGrossMad).toBe('3916.85');
      expect(summary.totalTransactions).toBe(2);
      expect(summary.matchedTransactions).toBe(2);
      expect(summary.matchRatePercentage).toBe('100.0%');
      expect(summary.countryBreakdown).toHaveLength(2);
    });
  });

  describe('5. Zod Schema Validations', () => {
    it('validates correct upload batch input', () => {
      const valid = uploadTollInvoiceBatchSchema.safeParse({
        provider: 'dkv',
        invoice_number: 'INV-2026-99',
        invoice_date: '2026-10-09',
        raw_file_content: 'Plate,Date\n12345A26,2026-10-09',
        exchange_rate_to_mad: 10.85,
      });
      expect(valid.success).toBe(true);
    });

    it('rejects empty file content or invalid provider', () => {
      const invalid = uploadTollInvoiceBatchSchema.safeParse({
        provider: 'invalid_provider',
        invoice_number: 'INV-1',
        invoice_date: '2026-10-09',
        raw_file_content: '',
      });
      expect(invalid.success).toBe(false);
    });

    it('validates manual toll estimate schema', () => {
      const valid = manualTollEstimateSchema.safeParse({
        country_code: 'ES',
        highway_code: 'AP-7',
        distance_km: 150,
      });
      expect(valid.success).toBe(true);
    });
  });
});

