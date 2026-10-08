import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import {
  getCustomsCertificateConfig,
  canonicalizeXml,
  signCustomsXmlPayload,
  verifyCustomsXmlSignature,
} from '../services/customs-mtls-signer.service';
import {
  buildBadrDumXml,
  buildPortNetManifestXml,
  transmitBadrDum,
  transmitPortNetManifest,
} from '../services/portnet-badr-edi.service';
import type { BadrDumData, PortNetManifestData } from '../types/customs-mtls.types';

// Mock Supabase Server client for testing
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: () => ({
      select: () => ({
        or: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: async () => ({
                data: { id: 101, trip_id: 272, status: 'submitted', response_payload: {} },
                error: null,
              }),
            }),
          }),
        }),
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
          single: async () => ({
            data: {
              id: 272,
              cmr_export_number: 'CMR-272-EXP',
              ferry_localizador: 'LOC-272-TM',
              weight_export: 22000,
              price_export: 45000,
              truck: { plate_number: '12345-A-26' },
              trailer: { plate_number: 'REM-001-B' },
              driver: { name: 'Karim Driver', passport_number: 'PA123456', cin: 'K123456' },
              client: { name: 'Agro Export SARL', ice: '001928374650001' },
            },
            error: null,
          }),
        }),
      }),
      update: () => ({
        eq: async () => ({ data: null, error: null }),
      }),
      upsert: async (record: any) => ({ data: record, error: null }),
    }),
  }),
}));

vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn().mockResolvedValue({ success: true }),
}));

describe('Sovereign Customs & Port Gateways: mTLS, XML-DSig & BADR/PortNet EDI', () => {
  const sampleBadrData: BadrDumData = {
    tripId: 272,
    referenceNumber: 'DUM-REF-272-TEST',
    regimeDouanier: '1000',
    bureauDouanier: 'MA003100', // Tanger Med
    declarantAgrement: 'AGR-MA-TB-042',
    declarantName: 'TRANS BODANON TRANSIT SARL',
    carrierIce: '001928374650001',
    exporterIce: '001234567890001',
    exporterName: 'Primeurs Souss SARL',
    importerName: 'Iberia Fresh SL',
    importerCountry: 'ES',
    truckPlate: '12345-A-26',
    trailerPlate: 'REM-9988-B',
    cmrNumber: 'CMR-2026-272',
    commodityCodeHs: '0702000000', // Tomatoes
    goodsDescription: 'Tomates Rondes Primeurs',
    grossWeightKg: 22500.5,
    netWeightKg: 20700.46,
    customsValueMad: 125000.0,
    packagesCount: 33,
    ferryBookingRef: 'LOC-FR-9988',
  };

  const sampleManifestData: PortNetManifestData = {
    tripId: 272,
    referenceNumber: 'PN-MAN-272-TEST',
    voyageNumber: 'VOY-TM-2026-01',
    shippingLine: 'Balearia',
    portOfLoading: 'MAPTM',
    portOfDischarge: 'ESALG',
    truckPlate: '12345-A-26',
    trailerPlate: 'REM-9988-B',
    driverName: 'Mohamed Driver',
    driverPassport: 'PA998877',
    driverCin: 'K554433',
    cmrNumber: 'CMR-2026-272',
    mrnNumber: '26MA003100DUM00272',
    grossWeightKg: 22500.5,
    sealNumber: 'MA-DOUANE-000272',
    goodsDescription: 'Fruits et Primeurs',
    ferryLocalizador: 'LOC-BAL-272',
    timestamp: '2026-10-08T18:00:00Z',
  };

  describe('1. X.509 Certificate & XML-DSig RSA-SHA256 Signer', () => {
    it('should load a valid X.509 certificate configuration with positive expiry days', () => {
      const cert = getCustomsCertificateConfig();
      expect(cert.isValid).toBe(true);
      expect(cert.daysUntilExpiry).toBeGreaterThan(0);
      expect(cert.certPem).toContain('BEGIN');
      expect(cert.keyPem).toContain('BEGIN');
      expect(cert.issuerCN).toBeDefined();
    });

    it('should canonicalize XML by stripping extraneous whitespace between tags', () => {
      const dirtyXml = `
        <Root>
          <Child> Value </Child>
        </Root>
      `;
      const canonical = canonicalizeXml(dirtyXml);
      expect(canonical).toBe('<Root><Child> Value </Child></Root>');
      expect(canonical).not.toContain('\n');
    });

    it('should generate a compliant W3C XML-DSig block with RSA-SHA256 digest and signature', () => {
      const rawXml = '<Declaration><Id>12345</Id></Declaration>';
      const signResult = signCustomsXmlPayload(rawXml);

      expect(signResult.signatureAlgorithm).toBe('RSA-SHA256');
      expect(signResult.digestValue).toBeDefined();
      expect(signResult.signatureValue).toBeDefined();
      expect(signResult.certificateFingerprintSha256).toBeDefined();
      expect(signResult.signedXml).toContain('<ds:Signature');
      expect(signResult.signedXml).toContain('<ds:SignedInfo>');
      expect(signResult.signedXml).toContain('<ds:SignatureValue>');
      expect(signResult.signedXml).toContain('<ds:X509Certificate>');
    });

    it('should successfully verify the RSA-SHA256 signature against original payload', () => {
      const rawXml = '<CustomsDoc><Amount>150000</Amount></CustomsDoc>';
      const cert = getCustomsCertificateConfig();
      const signResult = signCustomsXmlPayload(rawXml, cert);

      const isValid = verifyCustomsXmlSignature(rawXml, signResult.signatureValue, cert.certPem);
      expect(isValid).toBe(true);

      const isTamperedValid = verifyCustomsXmlSignature(
        '<CustomsDoc><Amount>999999</Amount></CustomsDoc>',
        signResult.signatureValue,
        cert.certPem
      );
      expect(isTamperedValid).toBe(false);
    });
  });

  describe('2. BADR DUM & PortNet CUSCAR XML Generation (Strict Decimal.js)', () => {
    it('should build BADR DUM XML with exact Decimal.js values and clean ICE', () => {
      const xml = buildBadrDumXml(sampleBadrData);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<BadrDeclaration version="2.4" regime="1000">');
      expect(xml).toContain('<BureauDouanier>MA003100</BureauDouanier>');
      expect(xml).toContain('<GrossWeightKg>22500.50</GrossWeightKg>');
      expect(xml).toContain('<NetWeightKg>20700.46</NetWeightKg>');
      expect(xml).toContain('<CustomsValueMAD>125000.00</CustomsValueMAD>');
      expect(xml).toContain('<CommodityCodeHS>0702000000</CommodityCodeHS>');
    });

    it('should build PortNet CUSCAR Cargo Manifest XML for maritime transit', () => {
      const xml = buildPortNetManifestXml(sampleManifestData);

      expect(xml).toContain('<PortNetManifest version="3.1" type="CUSCAR_FERRY">');
      expect(xml).toContain('<PortOfLoading>MAPTM</PortOfLoading>');
      expect(xml).toContain('<PortOfDischarge>ESALG</PortOfDischarge>');
      expect(xml).toContain('<TruckPlate>12345-A-26</TruckPlate>');
      expect(xml).toContain('<Localizador>LOC-BAL-272</Localizador>');
      expect(xml).toContain('<SealNumber>MA-DOUANE-000272</SealNumber>');
    });
  });

  describe('3. Sovereign Clearance Simulation & Inspection Channel Triage', () => {
    it('should triage perishable agro-export to GREEN (Circuit Vert) with immediate BAE release', async () => {
      const receipt = await transmitBadrDum(sampleBadrData);

      expect(receipt.inspectionChannel).toBe('GREEN');
      expect(receipt.validationStatus).toBe('CLEARED_BAE');
      expect(receipt.mrn).toContain('26MA');
      expect(receipt.baeNumber).toContain('BAE-ADII-');
      expect(receipt.baeDate).toBeDefined();

      // Verify Decimal.js liquidation tax calculation: 125,000 * 0.0025 + 50 = 312.5 + 50 = 362.50
      const expectedTax = new Decimal(125000).times(0.0025).plus(50).toNumber();
      expect(receipt.liquidationAmountMad).toBe(expectedTax);
    });

    it('should triage high-value goods (>500,000 MAD) to ORANGE channel (Documentary inspection)', async () => {
      const highValData = { ...sampleBadrData, customsValueMad: 750000 };
      const receipt = await transmitBadrDum(highValData);

      expect(receipt.inspectionChannel).toBe('ORANGE');
      expect(receipt.validationStatus).toBe('INSPECTION_REQUIRED');
      expect(receipt.baeNumber).toBeUndefined();
    });

    it('should triage hazardous/chemical goods to RED channel (Scanner and physical inspection)', async () => {
      const hazardousData = { ...sampleBadrData, goodsDescription: 'Produits chimiques dangereux classe 3' };
      const receipt = await transmitBadrDum(hazardousData);

      expect(receipt.inspectionChannel).toBe('RED');
      expect(receipt.validationStatus).toBe('INSPECTION_REQUIRED');
    });

    it('should transmit PortNet manifest and return signed XML with gate pass ID', async () => {
      const res = await transmitPortNetManifest(sampleManifestData);

      expect(res.success).toBe(true);
      expect(res.gatePassId).toBe('PASS-TM-00272');
      expect(res.signedXml).toContain('<ds:Signature');
    });
  });

  describe('4. Inbound Customs Webhook Endpoint Processing', () => {
    it('should process asynchronous customs release callbacks', async () => {
      const { POST, GET } = await import('@/app/api/webhooks/customs/route');

      // GET healthcheck
      const getReq = new Request('http://localhost:3000/api/webhooks/customs');
      const getRes = await GET();
      const getData = await getRes.json();
      expect(getData.status).toBe('online');
      expect(getData.gateways).toContain('BADR (ADII Morocco)');

      // POST webhook payload
      const webhookPayload = {
        gateway: 'badr' as const,
        declarationType: 'DUM' as const,
        referenceNumber: 'DUM-REF-272-TEST',
        mrn: '26MA003100DUM00272',
        status: 'CLEARED_BAE' as const,
        inspectionChannel: 'GREEN' as const,
        baeNumber: 'BAE-ADII-00272',
        timestamp: new Date().toISOString(),
      };

      const postReq = new Request('http://localhost:3000/api/webhooks/customs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      });

      const postRes = await POST(postReq as any);
      expect(postRes.status).toBe(200);
      const postData = await postRes.json();
      expect(postData.success).toBe(true);
      expect(postData.referenceNumber).toBe('DUM-REF-272-TEST');
      expect(postData.status).toBe('CLEARED_BAE');
    });
  });
});

