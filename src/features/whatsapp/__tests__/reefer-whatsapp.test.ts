import { describe, expect, it, beforeEach, vi } from 'vitest';
import Decimal from 'decimal.js';
import {
  WhatsAppReeferTemplates,
  type GdpCertificateNotificationPayload,
  type ReeferExcursionAlertPayload,
} from '../services/whatsapp-reefer-templates';
import { ReeferWhatsAppDispatcherService } from '@/features/tracking/services/reefer-whatsapp-dispatcher.service';

vi.mock('@/features/whatsapp/services/whatsapp-meta-client', () => ({
  sendWhatsAppText: vi.fn().mockImplementation(async (options: { to: string; message: string }) => {
    return {
      success: true,
      messageId: `wamid.mock.reefer.${Date.now()}`,
      isTestMode: true,
      originalPhone: options.to,
      targetPhone: '212694585307',
    };
  }),
}));

describe('WhatsApp GDP Certificate & Reefer Excursion Dispatch Engine', () => {
  beforeEach(() => {
    ReeferWhatsAppDispatcherService.resetCooldown();
  });

  describe('1. GDP Cold Chain Certificate Template (Trilingual)', () => {
    const mockPayload: GdpCertificateNotificationPayload = {
      tripId: 8842,
      cmrNumber: 'CMR-MA-8842',
      route: 'أكادير ➔ بربينيان (Agadir ➔ Perpignan)',
      truckPlate: '44521-A-40',
      trailerPlate: 'REM-3312',
      atpClass: 'class_c',
      cargoCategory: 'fresh_produce',
      setpointTemp: 4.0,
      mktTemperatureCelsius: 4.25,
      avgSupplyTemp: 3.8,
      avgReturnTemp: 4.3,
      totalExcursionMinutes: 0,
      doorBreachesCount: 0,
      complianceScorePercent: 100,
      certificateHash: 'ATP-CLASS_C-8842-E938AB21C7741F09',
    };

    it('renders Arabic GDP certificate message with correct details and RTL formatting', () => {
      const msg = WhatsAppReeferTemplates.buildGdpCertificateNotification(mockPayload, 'ar');
      expect(msg).toContain('شهادة الامتثال الرسمية لسلسلة التبريد الدولي');
      expect(msg).toContain('رحلة #8842');
      expect(msg).toContain('44521-A-40');
      expect(msg).toContain('بواكير وخضار وفواكه طازجة');
      expect(msg).toContain('+4.25°C');
      expect(msg).toContain('100% (مطابق للمعايير الدولية)');
      expect(msg).toContain('ATP-CLASS_C-8842-E938AB21C7741F09');
      expect(msg).toContain('https://transbodanon.com/verify/cold-chain/ATP-CLASS_C-8842-E938AB21C7741F09');
    });

    it('renders French GDP certificate message with LTR conventions', () => {
      const msg = WhatsAppReeferTemplates.buildGdpCertificateNotification(mockPayload, 'fr');
      expect(msg).toContain('CERTIFICAT OFFICIEL DE CONFORMITÉ DE LA CHAÎNE DU FROID');
      expect(msg).toContain('Voyage #8842');
      expect(msg).toContain('Fruits & Légumes frais');
      expect(msg).toContain('*Température Cinétique Moyenne (MKT) :* +4.25°C');
      expect(msg).toContain('Classe ATP : CLASS_C');
    });

    it('renders Spanish GDP certificate message with accurate logistics terms', () => {
      const msg = WhatsAppReeferTemplates.buildGdpCertificateNotification(mockPayload, 'es');
      expect(msg).toContain('CERTIFICADO OFICIAL DE CONFORMIDAD DE CADENA DE FRÍO');
      expect(msg).toContain('Viaje #8842');
      expect(msg).toContain('Frutas y verduras frescas');
      expect(msg).toContain('*Temperatura Cinética Media (MKT):* +4.25°C');
    });
  });

  describe('2. Critical Excursion & Transit Breach Alert Templates', () => {
    const mockAlert: ReeferExcursionAlertPayload = {
      tripId: 9001,
      truckPlate: '99823-B-50',
      trailerPlate: 'REM-1002',
      driverName: 'الحسن بوعلام',
      driverPhone: '+212611223344',
      incidentType: 'temp_high',
      severity: 'critical',
      currentTemp: 9.8,
      setpointTemp: 4.0,
      peakDeviationTemp: 9.8,
      durationMinutes: 25,
      locationName: 'محطة استراحة طنجة المتوسط',
      gpsLat: 35.8872,
      gpsLng: -5.5034,
      timestamp: '2026-10-09T18:45:00Z',
    };

    it('renders Arabic emergency alert with Google Maps link and intervention advice', () => {
      const alert = WhatsAppReeferTemplates.buildReeferExcursionAlert(mockAlert, 'ar');
      expect(alert).toContain('إنذار حرج: رصد اختراق حراري في مقصورة التبريد');
      expect(alert).toContain('99823-B-50');
      expect(alert).toContain('الحسن بوعلام');
      expect(alert).toContain('+9.8°C');
      expect(alert).toContain('25 دقيقة');
      expect(alert).toContain('https://www.google.com/maps?q=35.8872,-5.5034');
      expect(alert).toContain('تعليمات التدخل الفوري');
    });

    it('handles door breach during transit in French and Spanish', () => {
      const breachAlert: ReeferExcursionAlertPayload = {
        ...mockAlert,
        incidentType: 'door_breach_transit',
      };

      const frAlert = WhatsAppReeferTemplates.buildReeferExcursionAlert(breachAlert, 'fr');
      expect(frAlert).toContain('Ouverture de portes non autorisée en plein transit');

      const esAlert = WhatsAppReeferTemplates.buildReeferExcursionAlert(breachAlert, 'es');
      expect(esAlert).toContain('Apertura de puertas no autorizada en tránsito');
    });
  });

  describe('3. ReeferWhatsAppDispatcherService & Cooldown Radar', () => {
    it('normalizes Moroccan and international phone numbers', () => {
      expect(ReeferWhatsAppDispatcherService.normalizePhoneNumber('0694585307')).toBe('212694585307');
      expect(ReeferWhatsAppDispatcherService.normalizePhoneNumber('+212 694-585307')).toBe('212694585307');
      expect(ReeferWhatsAppDispatcherService.normalizePhoneNumber('+34 600 123 456')).toBe('34600123456');
    });

    it('enforces 15-minute cooldown guard on repeated excursion dispatches', async () => {
      const alertPayload: ReeferExcursionAlertPayload = {
        tripId: 7701,
        truckPlate: '12345-A-1',
        incidentType: 'temp_high',
        severity: 'critical',
        currentTemp: 8.5,
        setpointTemp: 4.0,
        peakDeviationTemp: 8.5,
        durationMinutes: 15,
      };

      // 1st dispatch
      const first = await ReeferWhatsAppDispatcherService.dispatchReeferExcursionAlert({
        incidentId: 'inc-test-101',
        phone: '0694585307',
        payload: alertPayload,
      });

      expect(first.success).toBe(true);
      expect(first.skippedCooldown).toBe(false);

      // 2nd dispatch within seconds -> should skip due to cooldown
      const second = await ReeferWhatsAppDispatcherService.dispatchReeferExcursionAlert({
        incidentId: 'inc-test-101',
        phone: '0694585307',
        payload: alertPayload,
      });

      expect(second.success).toBe(true);
      expect(second.skippedCooldown).toBe(true);

      // Force bypass cooldown
      const bypass = await ReeferWhatsAppDispatcherService.dispatchReeferExcursionAlert({
        incidentId: 'inc-test-101',
        phone: '0694585307',
        payload: alertPayload,
        forceBypassCooldown: true,
      });

      expect(bypass.success).toBe(true);
      expect(bypass.skippedCooldown).toBe(false);
    });

    it('successfully dispatches GDP certificate without cooldown limitations', async () => {
      const certPayload: GdpCertificateNotificationPayload = {
        tripId: 5541,
        truckPlate: '88712-B-40',
        atpClass: 'class_c',
        cargoCategory: 'pharma_cold',
        setpointTemp: 5.0,
        mktTemperatureCelsius: 5.12,
        avgSupplyTemp: 4.9,
        avgReturnTemp: 5.2,
        totalExcursionMinutes: 0,
        doorBreachesCount: 0,
        complianceScorePercent: 100,
        certificateHash: 'ATP-CLASS_C-5541-PHARMA1234567890',
      };

      const res = await ReeferWhatsAppDispatcherService.dispatchGdpCertificate({
        tripId: 5541,
        phone: '0694585307',
        payload: certPayload,
        locale: 'fr',
      });

      expect(res.success).toBe(true);
      expect(res.phone).toBe('212694585307');
    });
  });
});

