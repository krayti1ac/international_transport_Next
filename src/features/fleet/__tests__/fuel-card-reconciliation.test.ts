import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  parseFuelCardStatement,
  detectFuelCardProvider,
  normalizePlateNumber,
} from '../services/fuel-card-parser.service';
import {
  reconcileFuelCardTransactions,
  resolveFuelStationCoords,
  HIGHWAY_FUEL_STATIONS_GEO,
} from '../services/fuel-fraud-reconciler.service';
import type {
  FuelCardTransactionRaw,
  FieldFuelReceiptMatch,
} from '../types/fuel-reconciliation.types';

describe('Digital Fuel Card Reconciliation & Fraud Detection Engine', () => {
  describe('Provider Auto-Detection & Plate Normalization', () => {
    it('should normalize varied vehicle plate formats to a canonical string', () => {
      expect(normalizePlateNumber(' 12345 A 1 ')).toBe('12345-A-1');
      expect(normalizePlateNumber('12345-a-1')).toBe('12345-A-1');
      expect(normalizePlateNumber('12345|A|1')).toBe('12345-A-1');
    });

    it('should correctly detect provider signatures from header rows', () => {
      expect(detectFuelCardProvider('N° Carte, Immatriculation, Carte Oasis Afriquia')).toBe('afriquia');
      expect(detectFuelCardProvider('TotalEnergies Fleet Card, Registration, Date')).toBe('totalenergies');
      expect(detectFuelCardProvider('PAN / Card Number, Vehicle, Shell Card Hub')).toBe('shell');
    });
  });

  describe('CSV Statement Ingestion & Financial Sanitation', () => {
    it('should parse an Afriquia Oasis statement and calculate missing amounts with Decimal.js', () => {
      const csv = `N° Carte;Immatriculation;Date;Heure;Station;Ville;Volume (L);P.U TTC;Montant TTC
7082-9910-4401;12345-A-1;2026-10-08;14:30;Afriquia Tanger Med;Tanger;650,00;12,80;8320,00
7082-9910-4402;67890-B-2;2026-10-08;16:00;Afriquia Berrechid;Berrechid;400,00;12,80;`;

      const result = parseFuelCardStatement(csv, 'afriquia');

      expect(result.success).toBe(true);
      expect(result.transactions.length).toBe(2);
      expect(result.transactions[0].liters).toBe(650.0);
      expect(result.transactions[0].totalAmount).toBe(8320.0);
      // Row 2 had empty total amount -> automatically computed: 400 * 12.80 = 5120.00
      expect(result.transactions[1].totalAmount).toBe(5120.0);
      expect(result.transactions[1].truckPlate).toBe('67890-B-2');
    });

    it('should parse a TotalEnergies Fleet statement with comma delimiters', () => {
      const csv = `Card Number,Registration,Date,Time,Station Name,Product,Quantity,Unit Price,Amount Incl VAT
5041-3312-8820,11223-D-7,2026-10-07,11:15,TotalEnergies Kenitra Nord A1,Diesel,420.50,13.10,5508.55`;

      const result = parseFuelCardStatement(csv, 'totalenergies');

      expect(result.success).toBe(true);
      expect(result.transactions.length).toBe(1);
      expect(result.transactions[0].truckPlate).toBe('11223-D-7');
      expect(result.transactions[0].liters).toBe(420.5);
      expect(result.transactions[0].totalAmount).toBe(5508.55);
    });

    it('should parse a Shell Card statement', () => {
      const csv = `PAN / Card,Vehicle,Transaction Date,Site,Litres,Gross Amount
4120-0019-7754,44556-H-9,2026-10-06 09:45,Shell Casablanca Ain Sebaa,500.0,6625.00`;

      const result = parseFuelCardStatement(csv, 'shell');

      expect(result.success).toBe(true);
      expect(result.transactions.length).toBe(1);
      expect(result.transactions[0].liters).toBe(500.0);
      expect(result.transactions[0].totalAmount).toBe(6625.0);
      // Unit price computed: 6625 / 500 = 13.25
      expect(result.transactions[0].unitPrice).toBe(13.25);
    });
  });

  describe('Station Geolocation Resolver', () => {
    it('should resolve known international corridor fuel stations', () => {
      const tangerMed = resolveFuelStationCoords('Afriquia Tanger Med Port', 'Tanger');
      expect(tangerMed).toBeDefined();
      expect(tangerMed?.lat).toBe(35.885);
      expect(tangerMed?.lng).toBe(-5.505);

      const dakar = resolveFuelStationCoords('TotalEnergies Port Terminal', 'Dakar');
      expect(dakar).toBeDefined();
      expect(dakar?.lat).toBe(14.716);

      const algeciras = resolveFuelStationCoords('Repsol Puerto Algeciras', 'Algeciras');
      expect(algeciras).toBeDefined();
      expect(algeciras?.lat).toBe(36.185);
    });
  });

  describe('Triple-Way Reconciliation & Fraud Detection', () => {
    it('should achieve 100% match when card, receipt, and GPS location coincide', () => {
      const card: FuelCardTransactionRaw = {
        transactionId: 'TX-AFR-01',
        cardNumber: '7082-9910-1111',
        truckPlate: '12345-A-1',
        timestamp: '2026-10-08T12:00:00Z',
        stationName: 'Afriquia Tanger Med Port',
        fuelType: 'Gasoil 10 ppm',
        liters: 600.0,
        unitPrice: 12.8,
        totalAmount: 7680.0,
        currency: 'MAD',
      };

      const receipt: FieldFuelReceiptMatch = {
        receiptId: 501,
        truckId: 1,
        truckPlate: '12345-A-1',
        receiptDate: '2026-10-08T12:05:00Z',
        receiptLiters: 600.0,
        receiptAmount: 7680.0,
        stationName: 'Afriquia Tanger Med Port',
      };

      const gps = [
        {
          truckPlate: '12345-A-1',
          latitude: 35.885,
          longitude: -5.505, // Right at Tanger Med
          timestamp: '2026-10-08T12:00:00Z',
          speed: 0,
        },
      ];

      const { reconciledEntries, summary } = reconcileFuelCardTransactions({
        cardTransactions: [card],
        fieldReceipts: [receipt],
        gpsLocations: gps,
        trucks: [{ id: 1, plate_number: '12345-A-1', max_tank_capacity: 900 }],
      });

      expect(reconciledEntries.length).toBe(1);
      const entry = reconciledEntries[0];
      expect(entry.status).toBe('matched');
      expect(entry.confidenceScore).toBe(100);
      expect(entry.volumeVarianceLiters).toBe(0);
      expect(entry.financialVarianceMad).toBe(0);
      expect(entry.stationDistanceToGpsKm).toBeLessThan(1.0);
      expect(entry.gpsVerificationStatus).toBe('verified');
      expect(summary.totalMatched).toBe(1);
      expect(summary.reconciliationRate).toBe(100);
    });

    it('should flag Ghost Refueling fraud when truck GPS was far from refuel station', () => {
      const card: FuelCardTransactionRaw = {
        transactionId: 'TX-SHL-GHOST',
        cardNumber: '4120-0019-9999',
        truckPlate: '11223-D-7',
        timestamp: '2026-10-08T14:00:00Z',
        stationName: 'Shell Casablanca Ain Sebaa', // Casablanca
        fuelType: 'Diesel',
        liters: 500.0,
        unitPrice: 13.0,
        totalAmount: 6500.0,
        currency: 'MAD',
      };

      // Truck GPS shows truck was in Tanger Med (~300 km away!)
      const gps = [
        {
          truckPlate: '11223-D-7',
          latitude: 35.885,
          longitude: -5.505, // Tanger Med
          timestamp: '2026-10-08T14:00:00Z',
          speed: 70,
        },
      ];

      const { reconciledEntries, summary } = reconcileFuelCardTransactions({
        cardTransactions: [card],
        fieldReceipts: [],
        gpsLocations: gps,
        trucks: [{ id: 3, plate_number: '11223-D-7', max_tank_capacity: 900 }],
      });

      expect(reconciledEntries.length).toBe(1);
      const entry = reconciledEntries[0];
      expect(entry.status).toBe('ghost_refuel');
      expect(entry.stationDistanceToGpsKm).toBeGreaterThan(250.0);
      expect(entry.gpsVerificationStatus).toBe('suspicious');
      expect(entry.anomalies.some((a) => a.category === 'location_mismatch')).toBe(true);
      expect(entry.confidenceScore).toBeLessThan(60);
      expect(summary.totalFraudSuspected).toBe(1);
    });

    it('should flag Overfill fraud when refueled liters exceed mechanical dual-tank capacity', () => {
      const card: FuelCardTransactionRaw = {
        transactionId: 'TX-AFR-OVERFILL',
        cardNumber: '7082-9910-7777',
        truckPlate: '44556-H-9',
        timestamp: '2026-10-08T08:00:00Z',
        stationName: 'Afriquia Berrechid A3',
        fuelType: 'Gasoil 10 ppm',
        liters: 1180.0, // Exceeds 900L maximum capacity!
        unitPrice: 12.8,
        totalAmount: 15104.0,
        currency: 'MAD',
      };

      const { reconciledEntries, summary } = reconcileFuelCardTransactions({
        cardTransactions: [card],
        fieldReceipts: [],
        trucks: [{ id: 4, plate_number: '44556-H-9', max_tank_capacity: 900 }],
      });

      const entry = reconciledEntries[0];
      expect(entry.status).toBe('overfill_fraud');
      const overfillAnomaly = entry.anomalies.find((a) => a.category === 'overfill_exceeded');
      expect(overfillAnomaly).toBeDefined();
      expect(overfillAnomaly?.severity).toBe('critical');
      // 1180 - 900 = 280L excess
      expect(overfillAnomaly?.varianceLiters).toBe(280.0);
      expect(summary.totalFraudSuspected).toBe(1);
    });

    it('should detect duplicate card swipes within 35 minutes', () => {
      const card1: FuelCardTransactionRaw = {
        transactionId: 'TX-TOT-DUP-1',
        cardNumber: '5041-3312-0001',
        truckPlate: '99887-J-3',
        timestamp: '2026-10-08T10:00:00Z',
        stationName: 'TotalEnergies Settat A3',
        fuelType: 'Diesel',
        liters: 400.0,
        unitPrice: 13.1,
        totalAmount: 5240.0,
        currency: 'MAD',
      };

      const card2: FuelCardTransactionRaw = {
        transactionId: 'TX-TOT-DUP-2',
        cardNumber: '5041-3312-0001',
        truckPlate: '99887-J-3',
        timestamp: '2026-10-08T10:18:00Z', // 18 minutes later!
        stationName: 'TotalEnergies Settat A3',
        fuelType: 'Diesel',
        liters: 380.0,
        unitPrice: 13.1,
        totalAmount: 4978.0,
        currency: 'MAD',
      };

      const { reconciledEntries, summary } = reconcileFuelCardTransactions({
        cardTransactions: [card1, card2],
        fieldReceipts: [],
      });

      expect(reconciledEntries.some((e) => e.status === 'duplicate_swipe')).toBe(true);
      expect(summary.totalFraudSuspected).toBeGreaterThanOrEqual(1);
    });

    it('should compute volume and price variances accurately with Decimal.js', () => {
      const card: FuelCardTransactionRaw = {
        transactionId: 'TX-VAR-01',
        cardNumber: '7082-9910-3333',
        truckPlate: '67890-B-2',
        timestamp: '2026-10-08T09:00:00Z',
        stationName: 'TotalEnergies Kenitra',
        fuelType: 'Diesel',
        liters: 450.0,
        unitPrice: 13.1,
        totalAmount: 5895.0,
        currency: 'MAD',
      };

      const receipt: FieldFuelReceiptMatch = {
        receiptId: 502,
        truckId: 2,
        truckPlate: '67890-B-2',
        receiptDate: '2026-10-08T09:10:00Z',
        receiptLiters: 420.0, // Variance: +30 L
        receiptAmount: 5502.0, // Variance: +393.00 MAD
        stationName: 'TotalEnergies Kenitra',
      };

      const { reconciledEntries } = reconcileFuelCardTransactions({
        cardTransactions: [card],
        fieldReceipts: [receipt],
      });

      const entry = reconciledEntries[0];
      expect(entry.status).toBe('variance');
      expect(entry.volumeVarianceLiters).toBe(30.0);
      expect(entry.financialVarianceMad).toBe(393.0);
    });
  });
});

