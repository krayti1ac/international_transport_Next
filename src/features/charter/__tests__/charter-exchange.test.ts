import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import type {
  SubcontractorCarrier,
  SubcontractorTruck,
  SubcontractorDriver,
  CreateCharterOrderInput,
} from '../types/charter.types';
import {
  calculateBrokerageMargin,
  verifyCarrierAndFleetCompliance,
  isValidMoroccanIce,
  getDaysUntilExpiration,
} from '../services/charter-compliance-margin.service';
import {
  generateEpodMagicToken,
  verifyEpodMagicToken,
  sealExternalEpodSubmission,
} from '../services/charter-epod-token.service';
import {
  createCharterOrderAction,
  submitExternalEpodAction,
  listCharterOrdersAction,
  listSubcontractorsAction,
} from '../services/charter.actions';

vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/whatsapp', () => ({
  sendWhatsAppCloudMessage: vi.fn().mockResolvedValue({ success: true, messageId: 'wa-cht-101' }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Charter & Subcontractor Fleet Exchange Engine', () => {
  const mockCarrier: SubcontractorCarrier = {
    id: 'CAR-101',
    companyName: 'TRANS ATLAS SUD SARL',
    ice: '001827364000031',
    identifiantFiscal: '34891022',
    registreCommerce: '18942 Agadir',
    cnss: '4829104',
    phone: '+212 528 84 10 20',
    address: 'Zone Industrielle Anza, Agadir',
    city: 'Agadir',
    country: 'MA',
    rating: 4.8,
    cmrInsurancePolicyNumber: 'WAFA-CMR-994821',
    cmrInsuranceExpiryDate: '2027-04-15',
    internationalTransportLicenseNumber: 'MT-LTI-2024-0412',
    internationalTransportLicenseExpiryDate: '2027-08-30',
    paymentTermsDays: 30,
    isBlacklisted: false,
    complianceStatus: 'compliant',
    activeTrucksCount: 14,
    createdAt: '2026-01-10',
  };

  const mockTruck: SubcontractorTruck = {
    id: 'TRK-201',
    carrierId: 'CAR-101',
    carrierName: 'TRANS ATLAS SUD SARL',
    plateNumber: '48201-A-33',
    truckType: 'refrigerated',
    maxPayloadTons: 24,
    hasReeferUnit: true,
    carteGriseExpiryDate: '2027-06-30',
    technicalInspectionExpiryDate: '2027-03-15',
    atpCertificateExpiryDate: '2027-09-01',
    isAvailable: true,
    complianceStatus: 'compliant',
  };

  const mockDriver: SubcontractorDriver = {
    id: 'DRV-301',
    carrierId: 'CAR-101',
    name: 'عبد الرحيم المنصوري',
    phone: '+212 661 44 99 22',
    cinNationalId: 'JC482910',
    licenseNumber: 'PERMIS-EC-94812',
    licenseExpiryDate: '2028-09-10',
    passportNumber: 'MA-994821',
    passportExpiryDate: '2029-02-14',
    schengenVisaExpiryDate: '2027-07-20',
    complianceStatus: 'compliant',
  };

  describe('1. Financial Brokerage Margin with Decimal.js & Negative Margin Guard', () => {
    it('calculates gross brokerage margin and percentage accurately with Decimal.js', () => {
      const margin = calculateBrokerageMargin('42000.00', '34500.00', 'MAD', 0);

      expect(margin.shipperAgreedRate).toBe('42000.00');
      expect(margin.subcontractorBuyRate).toBe('34500.00');
      expect(margin.grossBrokerageMargin).toBe('7500.00');
      expect(margin.brokerageMarginPercent).toBe('17.86');
      expect(margin.isProfitable).toBe(true);
      expect(margin.negativeMarginAlert).toBe(false);
      expect(margin.marginSafetyLevel).toBe('optimum');
    });

    it('triggers negative margin alert and hazard level when buy rate exceeds shipper agreed rate', () => {
      const margin = calculateBrokerageMargin('30000.00', '32500.00', 'MAD', 0);

      expect(margin.grossBrokerageMargin).toBe('-2500.00');
      expect(margin.isProfitable).toBe(false);
      expect(margin.negativeMarginAlert).toBe(true);
      expect(margin.marginSafetyLevel).toBe('hazard_negative');
    });

    it('flags moderate margin when margin percent is below minimum safe threshold', () => {
      const margin = calculateBrokerageMargin('40000.00', '38000.00', 'MAD', 0);

      expect(margin.grossBrokerageMargin).toBe('2000.00');
      expect(margin.brokerageMarginPercent).toBe('5.00');
      expect(margin.marginSafetyLevel).toBe('moderate');
    });
  });

  describe('2. Multi-Point Legal & Insurance Compliance Auditing', () => {
    it('verifies Moroccan ICE format strictly requiring 15 digits', () => {
      expect(isValidMoroccanIce('001827364000031')).toBe(true);
      expect(isValidMoroccanIce('12345')).toBe(false);
      expect(isValidMoroccanIce('00182736400003A')).toBe(false);
      expect(isValidMoroccanIce('')).toBe(false);
    });

    it('approves fully compliant carrier, truck, and driver without blocking issues', () => {
      const report = verifyCarrierAndFleetCompliance({
        carrier: mockCarrier,
        truck: mockTruck,
        driver: mockDriver,
        corridor: 'european_maritime',
        referenceDate: '2026-10-25',
      });

      expect(report.isFullyCompliant).toBe(true);
      expect(report.status).toBe('compliant');
      expect(report.blockingIssues).toHaveLength(0);
      expect(report.expiredDocuments).toHaveLength(0);
    });

    it('blocks carrier assignment when CMR goods insurance is expired', () => {
      const expiredInsuranceCarrier: SubcontractorCarrier = {
        ...mockCarrier,
        cmrInsuranceExpiryDate: '2026-09-01', // Expired
      };

      const report = verifyCarrierAndFleetCompliance({
        carrier: expiredInsuranceCarrier,
        truck: mockTruck,
        driver: mockDriver,
        referenceDate: '2026-10-25',
      });

      expect(report.isFullyCompliant).toBe(false);
      expect(report.status).toBe('expired');
      expect(report.blockingIssues.some((issue) => issue.includes('CMR'))).toBe(true);
    });

    it('immediately blocks blacklisted carrier from receiving any charter contracts', () => {
      const blacklistedCarrier: SubcontractorCarrier = {
        ...mockCarrier,
        isBlacklisted: true,
      };

      const report = verifyCarrierAndFleetCompliance({
        carrier: blacklistedCarrier,
        referenceDate: '2026-10-25',
      });

      expect(report.isFullyCompliant).toBe(false);
      expect(report.blockingIssues.some((i) => i.includes('القائمة السوداء'))).toBe(true);
    });
  });

  describe('3. External e-POD Magic Link Tokens & HMAC Cryptographic Nonce', () => {
    it('generates HMAC-SHA256 signed magic link token with order metadata', () => {
      const tokenRes = generateEpodMagicToken({
        orderNumber: 'CHT-2026-0089',
        carrierId: 'CAR-101',
        driverPhone: '+212 661 44 99 22',
        expiresInHours: 72,
      });

      expect(tokenRes.token).toContain('.');
      expect(tokenRes.magicLinkUrl).toContain('/charter/epod?token=');
      expect(new Date(tokenRes.expiresAtIso).getTime()).toBeGreaterThan(Date.now());
    });

    it('verifies valid magic token successfully and extracts payload', () => {
      const tokenRes = generateEpodMagicToken({
        orderNumber: 'CHT-2026-0089',
        carrierId: 'CAR-101',
        driverPhone: '+212 661 44 99 22',
        expiresInHours: 24,
      });

      const verifyRes = verifyEpodMagicToken(tokenRes.token);
      expect(verifyRes.isValid).toBe(true);
      expect(verifyRes.payload?.orderNumber).toBe('CHT-2026-0089');
      expect(verifyRes.payload?.carrierId).toBe('CAR-101');
    });

    it('rejects tampered token where payload was modified without valid HMAC signature', () => {
      const tokenRes = generateEpodMagicToken({
        orderNumber: 'CHT-2026-0089',
        carrierId: 'CAR-101',
        driverPhone: '+212 661 44 99 22',
      });

      const [encodedPayload] = tokenRes.token.split('.');
      const tamperedToken = `${encodedPayload}.fake_signature_hash_1234567890`;

      const verifyRes = verifyEpodMagicToken(tamperedToken);
      expect(verifyRes.isValid).toBe(false);
      expect(verifyRes.error).toContain('توقيع رمز الوصول غير معتمد');
    });

    it('seals external e-POD submission with immutable HMAC-SHA256 digest', () => {
      const seal = sealExternalEpodSubmission({
        token: 'mock-token',
        orderNumber: 'CHT-2026-0089',
        receiverName: 'JUAN ALVAREZ',
        signatureBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
        latitude: 39.4699,
        longitude: -0.3763,
        notes: 'Colis intacts',
      });

      expect(seal.hmacSeal).toHaveLength(64); // Valid SHA-256 Hex
      expect(seal.signatureDigest).toHaveLength(64);
      expect(seal.timestamp).toBeDefined();
    });
  });

  describe('4. Server Actions Integration & Negative Margin Protection', () => {
    it('blocks charter order creation when buy rate causes a negative margin', async () => {
      const input: CreateCharterOrderInput = {
        originCity: 'Agadir',
        destinationCity: 'Perpignan',
        corridor: 'european_maritime',
        loadingDate: '2026-10-25',
        deliveryDate: '2026-10-29',
        cargoDescription: 'Tomates',
        cargoWeightKg: 22000,
        shipperAgreedRate: '30000.00',
        subcontractorBuyRate: '35000.00', // Negative!
        currency: 'MAD',
        carrierId: 'CAR-101',
        truckId: 'TRK-201',
        driverId: 'DRV-301',
      };

      const res = await createCharterOrderAction(input);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Negative Margin Guard');
    });

    it('creates charter order and dispatches e-POD magic link via WhatsApp', async () => {
      const input: CreateCharterOrderInput = {
        originCity: 'Casablanca',
        destinationCity: 'Madrid',
        corridor: 'european_maritime',
        loadingDate: '2026-10-26',
        deliveryDate: '2026-10-28',
        cargoDescription: 'Pièces Automobiles',
        cargoWeightKg: 18000,
        shipperAgreedRate: '36000.00',
        subcontractorBuyRate: '29000.00', // Positive margin of 7000 MAD
        currency: 'MAD',
        carrierId: 'CAR-101',
        truckId: 'TRK-201',
        driverId: 'DRV-301',
      };

      const res = await createCharterOrderAction(input);
      expect(res.success).toBe(true);
      expect(res.order).toBeDefined();
      expect(res.order?.status).toBe('ASSIGNED');
      expect(res.order?.epodMagicLink).toContain('/charter/epod?token=');
      expect(res.order?.margin.grossBrokerageMargin).toBe('7000.00');
    });

    it('submits external e-POD without login and updates order status to DELIVERED', async () => {
      const ordersRes = await listCharterOrdersAction();
      const targetOrder = ordersRes.orders[0];
      expect(targetOrder.epodMagicToken).toBeDefined();

      const epodRes = await submitExternalEpodAction({
        token: targetOrder.epodMagicToken!,
        orderNumber: targetOrder.orderNumber,
        receiverName: 'MARIO ROSSI',
        signatureBase64: 'data:image/png;base64,sample_signature_data',
        latitude: 42.6986,
        longitude: 2.8956,
        notes: 'Marchandise reçue à 4°C',
      });

      expect(epodRes.success).toBe(true);
      expect(epodRes.hmacSeal).toBeDefined();

      const updatedOrders = await listCharterOrdersAction();
      const updated = updatedOrders.orders.find((o) => o.orderNumber === targetOrder.orderNumber);
      expect(updated?.status).toBe('DELIVERED');
      expect(updated?.epodReceiverName).toBe('MARIO ROSSI');
      expect(updated?.epodHmacSeal).toBeDefined();
    });
  });
});

