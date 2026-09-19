import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateFuelVarianceAndCost,
  calculateIdlingLoss,
  forecastNextMonthFuel,
  generateFleetPredictiveInsights,
} from '@/features/analytics/services/fleet-predictive.actions';
import {
  exportTripToPortNetPayload,
  pushDeclarationToCustomsGateway,
} from '@/features/customs/services/portnet-badr-push.actions';
import {
  generateCustomsHmacSignature,
  buildPortNetXml,
  type PortNetPayloadData,
} from '@/features/customs/services/portnet-xml';

// Mock audit logging
vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn().mockResolvedValue(true),
}));

// Mock Supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 101,
              cmr_export_number: 'CMR-101-EXP',
              ferry_localizador: 'LOC-101-BAL',
              ferry_company: 'Balearia',
              weight_export: 23500,
              goods_description_export: 'Export Primeurs',
              truck: { plate_number: '12345-A-26' },
              trailer: { plate_number: 'REM-9988-B' },
              driver: { name: 'Mohamed Amrani', passport_number: 'PA1234567', cin: 'K987654' },
              client: { name: 'Agro Export Maroc SARL', ice: '001234567890001' },
              client_import: { name: 'Importaciones del Sur SL', ice: 'ESB12345678' },
            },
            error: null,
          }),
        }),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  }),
}));

describe('Phase 9: Predictive Fleet & Customs Integration (PortNet / BADR Push)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Predictive Fleet & Fuel Insights (Decimal.js Engine)', () => {
    it('calculates fuel variance and excess cost accurately using Decimal.js', () => {
      // 10,000 km traveled, 3,900 Liters consumed (39 L/100km) vs benchmark 36 L/100km at 13.20 MAD/L
      const res = calculateFuelVarianceAndCost(10000, 3900, 36, 13.20);

      // Expected = (10000 * 36) / 100 = 3600 Liters
      expect(res.expectedLiters).toBe(3600);
      // Variance = 3900 - 3600 = 300 Liters
      expect(res.varianceLiters).toBe(300);
      // Variance percentage = (300 / 3600) * 100 = 8.33%
      expect(res.variancePercentage).toBe(8.33);
      // Excess cost = 300 * 13.20 = 3960 MAD
      expect(res.excessCostMad).toBe(3960);
      // Actual rate = (3900 * 100) / 10000 = 39 L/100km
      expect(res.actualRateL100km).toBe(39);
    });

    it('returns zero excess cost when fuel consumption is within benchmark', () => {
      // 10,000 km traveled, 3,500 Liters consumed (35 L/100km, which is below benchmark of 36)
      const res = calculateFuelVarianceAndCost(10000, 3500, 36, 13.20);

      expect(res.expectedLiters).toBe(3600);
      expect(res.varianceLiters).toBe(-100);
      expect(res.excessCostMad).toBe(0); // Zero excess cost because it's a saving
      expect(res.actualRateL100km).toBe(35);
    });

    it('calculates engine idling loss and wasted financial cost correctly', () => {
      // 50 hours of idling at border crossings * 2.5 L/hr * 13.50 MAD/L
      const idling = calculateIdlingLoss(50, 2.5, 13.50);

      // Waste liters = 50 * 2.5 = 125 Liters
      expect(idling.idlingWasteLiters).toBe(125);
      // Waste cost = 125 * 13.50 = 1687.50 MAD
      expect(idling.idlingWasteCostMad).toBe(1687.50);
    });

    it('forecasts next month fuel budget accurately with scheduled trips', () => {
      // 50,000 projected km at 36 L/100km and 13.50 MAD/L diesel
      const forecast = forecastNextMonthFuel(50000, 36, 13.50, 25);

      expect(forecast.projectedTripsCount).toBe(25);
      expect(forecast.projectedKm).toBe(50000);
      // Liters = (50000 * 36) / 100 = 18,000 L
      expect(forecast.projectedFuelLiters).toBe(18000);
      // Cost = 18000 * 13.50 = 243,000 MAD
      expect(forecast.projectedFuelCostMad).toBe(243000);
      expect(forecast.confidenceScore).toBeGreaterThanOrEqual(80);
    });

    it('generates complete predictive report structure without crashing', async () => {
      const report = await generateFleetPredictiveInsights();

      expect(report.success).toBe(true);
      expect(report.data).toBeDefined();
      expect(report.data?.metrics.totalKm).toBeGreaterThan(0);
      expect(report.data?.metrics.expectedFuelLiters).toBeGreaterThan(0);
      expect(report.data?.forecast.projectedFuelCostMad).toBeGreaterThan(0);
      expect(report.data?.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('2. Direct Customs Gateway (PortNet & BADR API Push)', () => {
    const mockPayloadData: PortNetPayloadData = {
      declarationType: 'PRE_GATE_PASS',
      version: '2.0',
      referenceNumber: 'PN-DEC-TEST-9988',
      timestamp: '2026-09-19T12:00:00.000Z',
      booking: {
        localizador: 'LOC-BAL-8821',
        shippingLine: 'Balearia',
        portOfLoading: 'MA-TNG (Tanger Med)',
        portOfDischarge: 'ES-ALG (Algeciras)',
      },
      transport: {
        carrierName: 'TRANS BODANON SARL',
        carrierTirHolder: 'MA/042/2026',
        carrierIce: '001928374650001',
        truckPlate: '98765-B-26',
        trailerPlate: 'REM-1122-C',
        driverName: 'Rachid Berrada',
        driverPassport: 'PA998877',
        driverCin: 'T123456',
      },
      consignment: {
        cmrNumber: 'CMR-9988-EXP',
        mrnNumber: 'MRN-MA-9988-2026',
        grossWeightKg: 22800,
        sealNumber: 'SEAL-MA-009988',
        goodsDescription: 'Tomatoes & Citrus Primeurs',
        clientIce: '001234567890001',
        shipperName: 'Maroc Primeurs Export',
        consigneeName: 'Mercamadrid Fruits SA',
      },
    };

    it('generates standard PortNet EDI/XML containing all required fields', () => {
      const xml = buildPortNetXml(mockPayloadData);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<PortNetDeclaration version="2.0" type="PRE_GATE_PASS">');
      expect(xml).toContain('<Localizador>LOC-BAL-8821</Localizador>');
      expect(xml).toContain('<TruckPlate>98765-B-26</TruckPlate>');
      expect(xml).toContain('<TrailerPlate>REM-1122-C</TrailerPlate>');
      expect(xml).toContain('<CMRNumber>CMR-9988-EXP</CMRNumber>');
      expect(xml).toContain('<ICE>001234567890001</ICE>');
      expect(xml).toContain('<GrossWeightUnit="KG">22800</GrossWeightUnit>');
      expect(xml).toContain('TRANS BODANON SARL');
    });

    it('generates a valid 64-character hex HMAC-SHA256 digital signature', () => {
      const sig1 = generateCustomsHmacSignature(JSON.stringify(mockPayloadData), 'secret-key-1');
      const sig2 = generateCustomsHmacSignature(JSON.stringify(mockPayloadData), 'secret-key-1');
      const sig3 = generateCustomsHmacSignature(JSON.stringify(mockPayloadData), 'different-secret');

      expect(sig1).toHaveLength(64);
      expect(sig1).toMatch(/^[0-9a-f]{64}$/);
      // Deterministic signature
      expect(sig1).toBe(sig2);
      // Different keys produce different signatures
      expect(sig1).not.toBe(sig3);
    });

    it('exports trip data to valid PortNet payload and XML', async () => {
      const exportRes = await exportTripToPortNetPayload(101);

      expect(exportRes.success).toBe(true);
      expect(exportRes.data).toBeDefined();
      expect(exportRes.data?.booking.localizador).toBe('LOC-101-BAL');
      expect(exportRes.data?.consignment.cmrNumber).toBe('CMR-101-EXP');
      expect(exportRes.data?.consignment.clientIce).toBe('001234567890001');
      expect(exportRes.data?.transport.truckPlate).toBe('12345-A-26');
      expect(exportRes.xml).toContain('CMR-101-EXP');
    });

    it('pushes declaration to PortNet gateway and signs payload with audit trail', async () => {
      const pushRes = await pushDeclarationToCustomsGateway(101, 'portnet');

      expect(pushRes.success).toBe(true);
      expect(pushRes.gateway).toBe('portnet');
      expect(pushRes.status).toBe('accepted');
      expect(pushRes.referenceNumber).toContain('PN-DEC-101');
      expect(pushRes.signature).toHaveLength(64);
      expect(pushRes.payloadXml).toContain('PortNetDeclaration');
    });

    it('pushes declaration to Moroccan BADR customs gateway with valid signature', async () => {
      const pushRes = await pushDeclarationToCustomsGateway(101, 'badr');

      expect(pushRes.success).toBe(true);
      expect(pushRes.gateway).toBe('badr');
      expect(pushRes.status).toBe('accepted');
      expect(pushRes.signature).toBeDefined();
      expect(pushRes.payloadJson.booking.shippingLine).toBe('Balearia');
    });
  });
});

