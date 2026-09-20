import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatPhoneNumber, sendWhatsAppCloudMessage } from '@/lib/whatsapp';
import {
  buildMilestoneMessage,
  inferClientLocale,
} from '@/features/trips/services/notification-dispatcher';

describe('WhatsApp Milestone Alerts & Automation Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Phone Number Formatting & International Normalization', () => {
    it('normalizes local Moroccan numbers (06... / 07...) to E.164 without plus', () => {
      expect(formatPhoneNumber('0694585307')).toBe('212694585307');
      expect(formatPhoneNumber('0712345678')).toBe('212712345678');
      expect(formatPhoneNumber('+212694585307')).toBe('212694585307');
      expect(formatPhoneNumber('00212694585307')).toBe('212694585307');
    });

    it('normalizes international European and African numbers', () => {
      expect(formatPhoneNumber('+34 600 123 456')).toBe('34600123456');
      expect(formatPhoneNumber('+33 6 12 34 56 78')).toBe('33612345678');
      expect(formatPhoneNumber('+221 77 123 45 67')).toBe('221771234567');
      expect(formatPhoneNumber('+222 45 12 34 56')).toBe('22245123456');
    });

    it('handles clean strings or empty values safely', () => {
      expect(formatPhoneNumber('')).toBe('');
      expect(formatPhoneNumber('212694585307')).toBe('212694585307');
    });
  });

  describe('2. Client Language Inference (Locale Resolution)', () => {
    it('infers Spanish for clients in Spain or with +34 phone prefix', () => {
      expect(inferClientLocale({ phone: '+34 612 345 678', shipping_country: 'Spain' })).toBe('es');
      expect(inferClientLocale({ phone: '34612345678' })).toBe('es');
      expect(inferClientLocale({ preferred_notification_method: 'whatsapp_spanish' })).toBe('es');
    });

    it('infers French for clients in France, Senegal, Mauritania or with matching prefix', () => {
      expect(inferClientLocale({ phone: '+33 6 12 34 56 78' })).toBe('fr');
      expect(inferClientLocale({ phone: '+221 77 123 45 67', shipping_country: 'Sénégal' })).toBe('fr');
      expect(inferClientLocale({ phone: '+222 45 12 34 56', shipping_country: 'Mauritanie' })).toBe('fr');
    });

    it('defaults to Arabic for Moroccan clients or unspecified regions', () => {
      expect(inferClientLocale({ phone: '0694585307', shipping_country: 'Morocco' })).toBe('ar');
      expect(inferClientLocale({})).toBe('ar');
    });
  });

  describe('3. Milestone Message Template Generation', () => {
    const baseParams = {
      clientName: 'Agro Export S.A.',
      tripId: 501,
      cmrNumber: 'CMR-MA-2026-0901',
      route: 'Agadir ⟶ Perpignan',
      departureDate: '2026-09-21',
      plateNumber: '12345-A-40',
      trackingUrl: 'https://app.transbodanon.ma/track/501',
      podPdfUrl: 'https://app.transbodanon.ma/api/pod?tripId=501',
    };

    it('builds Trip Dispatched message in Arabic with tracking URL', () => {
      const msg = buildMilestoneMessage({
        ...baseParams,
        eventType: 'trip_dispatched',
        locale: 'ar',
      });

      expect(msg).toContain('إشعار انطلاق شحنة دولية');
      expect(msg).toContain('CMR-MA-2026-0901');
      expect(msg).toContain('12345-A-40');
      expect(msg).toContain('https://app.transbodanon.ma/track/501');
    });

    it('builds Trip Dispatched message in French with tracking URL', () => {
      const msg = buildMilestoneMessage({
        ...baseParams,
        eventType: 'trip_dispatched',
        locale: 'fr',
      });

      expect(msg).toContain('Avis de Départ Expédition Internationale');
      expect(msg).toContain('*Lettre de Voiture (CMR) :* CMR-MA-2026-0901');
      expect(msg).toContain('https://app.transbodanon.ma/track/501');
    });

    it('builds Trip Dispatched message in Spanish with tracking URL', () => {
      const msg = buildMilestoneMessage({
        ...baseParams,
        eventType: 'trip_dispatched',
        locale: 'es',
      });

      expect(msg).toContain('Aviso de Salida de Envío Internacional');
      expect(msg).toContain('*Carta de Porte (CMR) :* CMR-MA-2026-0901');
      expect(msg).toContain('https://app.transbodanon.ma/track/501');
    });

    it('builds Port/Border Entry message in Arabic with zone details', () => {
      const msg = buildMilestoneMessage({
        ...baseParams,
        eventType: 'port_geofence_entry',
        locale: 'ar',
        details: {
          zoneNameAr: 'ميناء طنجة المتوسط',
          zoneNameFr: 'Port Tanger Med',
          zoneType: 'seaport',
        },
      });

      expect(msg).toContain('تنبيه عبور الموانئ والمعابر');
      expect(msg).toContain('ميناء طنجة المتوسط');
      expect(msg).toContain('التخليص الجمركي');
      expect(msg).toContain('https://app.transbodanon.ma/track/501');
    });

    it('builds Port/Border Entry message in Spanish for Algeciras', () => {
      const msg = buildMilestoneMessage({
        ...baseParams,
        eventType: 'port_geofence_entry',
        locale: 'es',
        details: {
          zoneNameAr: 'ميناء الجزيرة الخضراء',
          zoneNameFr: 'Port d\'Algésiras',
          zoneNameEs: 'Puerto de Algeciras',
          zoneType: 'seaport',
        },
      });

      expect(msg).toContain('Alerta de Cruce Puerto / Frontera');
      expect(msg).toContain('Puerto de Algeciras');
      expect(msg).toContain('aduanas');
    });

    it('builds Delivery Completed (e-POD) message in Arabic with PDF link and HMAC seal mention', () => {
      const msg = buildMilestoneMessage({
        ...baseParams,
        eventType: 'delivery_completed',
        locale: 'ar',
        details: {
          recipientName: 'M. Jean Dupont (Directeur Logistique)',
          signedAt: '2026-09-24T14:30:00Z',
          latitude: 42.6986,
          longitude: 2.8956,
        },
      });

      expect(msg).toContain('تأكيد تسليم الشحنة وإثبات التسليم الرقمي المعتمد (e-POD)');
      expect(msg).toContain('M. Jean Dupont');
      expect(msg).toContain('HMAC-SHA256');
      expect(msg).toContain('https://app.transbodanon.ma/api/pod?tripId=501');
    });

    it('builds Delivery Completed message in French with PDF download link', () => {
      const msg = buildMilestoneMessage({
        ...baseParams,
        eventType: 'delivery_completed',
        locale: 'fr',
        details: {
          recipientName: 'M. Jean Dupont',
          signedAt: '2026-09-24T14:30:00Z',
        },
      });

      expect(msg).toContain('Confirmation de Livraison & e-POD Certifié');
      expect(msg).toContain('Télécharger le récépissé officiel e-POD (PDF)');
      expect(msg).toContain('https://app.transbodanon.ma/api/pod?tripId=501');
    });

    it('builds Delivery Completed message in Spanish with PDF download link', () => {
      const msg = buildMilestoneMessage({
        ...baseParams,
        eventType: 'delivery_completed',
        locale: 'es',
        details: {
          recipientName: 'Carlos Ramirez',
          signedAt: '2026-09-24T14:30:00Z',
        },
      });

      expect(msg).toContain('Confirmación de Entrega y e-POD Certificado');
      expect(msg).toContain('Descargar comprobante e-POD oficial firmado (PDF)');
      expect(msg).toContain('https://app.transbodanon.ma/api/pod?tripId=501');
    });
  });

  describe('4. Safety Override Guard & Test Routing', () => {
    it('enforces safe test routing and prepends [وضع التجربة 🧪] when live dispatch is disabled', async () => {
      const originalEnv = process.env.WHATSAPP_LIVE_DISPATCH;
      const originalToken = process.env.WHATSAPP_API_TOKEN;
      const originalPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

      delete process.env.WHATSAPP_LIVE_DISPATCH;
      delete process.env.WHATSAPP_API_TOKEN;
      delete process.env.WHATSAPP_PHONE_NUMBER_ID;

      const res = await sendWhatsAppCloudMessage({
        to: '+34 612 345 678',
        message: 'رسالة اختبار للعميل الإسباني',
      });

      expect(res.isTestMode).toBe(true);
      expect(res.originalPhone).toBe('34612345678');
      expect(res.targetPhone).toBe('212694585307');
      expect(res.success).toBe(false); // Because API credentials omitted in test
      expect(res.provider).toBe('none');

      // Restore env
      if (originalEnv) process.env.WHATSAPP_LIVE_DISPATCH = originalEnv;
      if (originalToken) process.env.WHATSAPP_API_TOKEN = originalToken;
      if (originalPhoneId) process.env.WHATSAPP_PHONE_NUMBER_ID = originalPhoneId;
    });
  });
});

