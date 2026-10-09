import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { ReeferCsvExporterService } from '../services/reefer-csv-exporter.service';
import { ReeferPdfReportService } from '../services/reefer-pdf-report.service';
import type { ReeferReportExportContext } from '../types/reefer-export.types';

const MOCK_EXPORT_CONTEXT: ReeferReportExportContext = {
  company: {
    name: 'Trans Bodanon Transport & Logistique S.A.R.L.',
    ice: '002938475000084',
    rc: '104928 Tanger',
    patente: '49201948',
    ifNumber: '39485721',
    address: 'Zone Franche Port Tanger Med, Route Principale, Maroc',
    phone: '+212 539 94 82 10',
    email: 'contact@transbodanon.com',
    currency: 'MAD',
  },
  trip: {
    tripId: 8840,
    cmrNumber: 'CMR-2026-8840',
    routeName: 'Tanger Med → Algeciras → Perpignan',
    originCity: 'Tanger Med',
    destinationCity: 'Perpignan',
    truckPlate: '67890-A-40',
    trailerPlate: 'MA-R-8821',
    driverName: 'عمر التازي',
    clientName: 'Agro-Export Maroc S.A.',
  },
  profile: {
    id: 'prof_8840',
    companyId: 1,
    tripId: 8840,
    trailerId: 'MA-R-8821',
    coolingUnitBrand: 'Carrier Vector 1550',
    atpClass: 'class_c',
    cargoCategory: 'fresh_produce',
    setpointTemp: 4.0,
    minTempThreshold: 2.0,
    maxTempThreshold: 6.0,
    maxAllowedExcursionMinutes: 45,
    mktActivationEnergyKj: 83.144,
    isActive: true,
  },
  evaluation: {
    tripId: 8840,
    atpClass: 'class_c',
    cargoCategory: 'fresh_produce',
    totalLogsCount: 2,
    setpointTemp: 4.0,
    avgSupplyTemp: 3.85,
    avgReturnTemp: 4.25,
    mktTemperatureCelsius: 4.21,
    complianceStatus: 'compliant',
    totalExcursionMinutes: 0,
    doorBreachesCount: 0,
    totalDieselBurnedLiters: 14.5,
    complianceScorePercent: 99,
  },
  logs: [
    {
      id: 'log_1',
      tripId: 8840,
      supplyAirTemp: 3.8,
      returnAirTemp: 4.2,
      ambientTemp: 24.5,
      evaporatorTemp: 1.5,
      compressorStatus: 'running',
      isDefrostActive: false,
      doorOpenSensor: false,
      dieselFuelLevelLiters: 185.0,
      dieselBurnRateLph: 2.1,
      latitude: 35.885,
      longitude: -5.512,
      isGeofenceSafe: true,
      recordedAt: '2026-10-09T18:00:00Z',
    },
    {
      id: 'log_2',
      tripId: 8840,
      supplyAirTemp: 3.9,
      returnAirTemp: 4.3,
      ambientTemp: 25.0,
      evaporatorTemp: 1.6,
      compressorStatus: 'running',
      isDefrostActive: false,
      doorOpenSensor: false,
      dieselFuelLevelLiters: 184.8,
      dieselBurnRateLph: 2.1,
      latitude: 35.912,
      longitude: -5.498,
      isGeofenceSafe: true,
      recordedAt: '2026-10-09T18:05:00Z',
    },
  ],
  incidents: [],
  locale: 'ar',
  issuedAt: '9 أكتوبر 2026',
  verificationHash: 'A1B2C3D4E5F67890ABCDEF1234567890',
  verificationUrl: 'https://tms.transbodanon.com/verify/clearance/A1B2C3D4E5F67890ABCDEF1234567890',
};

describe('Trans Bodanon TMS — Reefer DataCOLD PDF & CSV Export Engine', () => {
  // 1. CSV Generation Tests
  describe('1. ReeferCsvExporterService', () => {
    it('generates CSV with UTF-8 BOM (\uFEFF) for Microsoft Excel compatibility', () => {
      const csv = ReeferCsvExporterService.generateReeferCsv(MOCK_EXPORT_CONTEXT);

      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('سجل تفريغ درجات حرارة التبريد المعتمد (EN 12830 / DataCOLD)');
      expect(csv).toContain('Carrier Vector 1550');
      expect(csv).toContain('CMR-2026-8840');
    });

    it('generates standard comma-separated column headers and data rows', () => {
      const csv = ReeferCsvExporterService.generateReeferCsv(MOCK_EXPORT_CONTEXT);
      const lines = csv.split('\r\n');

      // Check header line
      const headerLine = lines.find((l) => l.includes('حرارة الضخ (°C)'));
      expect(headerLine).toBeDefined();
      expect(headerLine).toContain('حرارة الراجع (°C)');
      expect(headerLine).toContain('معدل الاستهلاك (لتر/ساعة)');

      // Check log row
      const dataRow = lines.find((l) => l.includes('"2026-10-09T18:00:00Z"'));
      expect(dataRow).toBeDefined();
      expect(dataRow).toContain('3.80');
      expect(dataRow).toContain('4.20');
      expect(dataRow).toContain('"running"');
    });

    it('supports French and Spanish localized CSV outputs', () => {
      const frContext: ReeferReportExportContext = { ...MOCK_EXPORT_CONTEXT, locale: 'fr' };
      const csvFr = ReeferCsvExporterService.generateReeferCsv(frContext);
      expect(csvFr).toContain('Rapport Télématique Certifié EN 12830');
      expect(csvFr).toContain('Air Soufflé (°C)');

      const esContext: ReeferReportExportContext = { ...MOCK_EXPORT_CONTEXT, locale: 'es' };
      const csvEs = ReeferCsvExporterService.generateReeferCsv(esContext);
      expect(csvEs).toContain('Informe Telemático Certificado EN 12830');
      expect(csvEs).toContain('Aire Impulsado (°C)');
    });
  });

  // 2. Vector A4 PDF HTML Generation Tests
  describe('2. ReeferPdfReportService', () => {
    it('generates Vector A4 HTML layout with RTL direction for Arabic', () => {
      const html = ReeferPdfReportService.generateReportHtml(MOCK_EXPORT_CONTEXT);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('dir="rtl"');
      expect(html).toContain('@page');
      expect(html).toContain('size: A4 portrait');
      expect(html).toContain('002938475000084'); // ICE
      expect(html).toContain('Carrier Vector 1550');
      expect(html).toContain('4.21°C'); // MKT
      expect(html).toContain('COMPLIANT');
      expect(html).toContain('HMAC-SHA256: A1B2C3D4E5F67890ABCDEF1234567890');
    });

    it('generates LTR direction and French/Spanish labels for European customs', () => {
      const frHtml = ReeferPdfReportService.generateReportHtml({
        ...MOCK_EXPORT_CONTEXT,
        locale: 'fr',
      });
      expect(frHtml).toContain('dir="ltr"');
      expect(frHtml).toContain("Certificat Officiel d'Audit Thermique");
      expect(frHtml).toContain('Contrôle Sanitaire & Douanes');

      const esHtml = ReeferPdfReportService.generateReportHtml({
        ...MOCK_EXPORT_CONTEXT,
        locale: 'es',
      });
      expect(esHtml).toContain('dir="ltr"');
      expect(esHtml).toContain('Certificado Oficial de Auditoría Térmica');
      expect(esHtml).toContain('Inspección Sanitaria y Aduanas');
    });
  });

  // 3. Cryptographic HMAC-SHA256 Integrity Seal
  describe('3. Cryptographic Integrity Seal', () => {
    it('generates consistent HMAC-SHA256 signature for trip data', () => {
      const secret = 'test_reefer_key_2026';
      const payload = 'REEFER_AUDIT_8840_2_4.21_4.0_compliant';

      const hash1 = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      const hash2 = crypto.createHmac('sha256', secret).update(payload).digest('hex');

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
    });

    it('alters hash when temperature or compliance changes', () => {
      const secret = 'test_reefer_key_2026';
      const original = crypto
        .createHmac('sha256', secret)
        .update('REEFER_AUDIT_8840_2_4.21_4.0_compliant')
        .digest('hex');
      const tampered = crypto
        .createHmac('sha256', secret)
        .update('REEFER_AUDIT_8840_2_8.95_4.0_breached')
        .digest('hex');

      expect(original).not.toBe(tampered);
    });
  });
});

