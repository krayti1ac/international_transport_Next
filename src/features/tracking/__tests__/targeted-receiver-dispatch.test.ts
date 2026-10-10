import { describe, it, expect, beforeEach, vi } from 'vitest';
import Decimal from 'decimal.js';
import {
  WhatsAppTargetedReceiverTemplates,
  type TargetedReceiverCertificatePayload,
} from '@/features/whatsapp/services/whatsapp-targeted-receiver-templates';
import { TargetedReceiverDispatcherService } from '../services/targeted-receiver-dispatcher.service';
import {
  dispatchCompartmentReceiverSchema,
  dispatchBatchReceiversSchema,
} from '../types/multi-temp-certificate.types';

vi.mock('@/features/whatsapp/services/whatsapp-meta-client', () => ({
  formatPhoneNumber: (phone: string) => {
    if (!phone) return '';
    let cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
    else if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);
    else if (cleaned.startsWith('0')) cleaned = '212' + cleaned.substring(1);
    return cleaned;
  },
  sendWhatsAppText: vi.fn().mockImplementation(async (options: { to: string; message: string }) => {
    return {
      success: true,
      messageId: `wamid.mock.targeted.${Date.now()}`,
      isTestMode: true,
      originalPhone: options.to,
      targetPhone: '212694585307',
    };
  }),
}));

vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn().mockResolvedValue(true),
}));

describe('Targeted Receiver WhatsApp Dispatch Engine (Multi-Temp)', () => {
  beforeEach(() => {
    TargetedReceiverDispatcherService.resetCooldown();
  });

  const MOCK_TARGETED_PAYLOAD: TargetedReceiverCertificatePayload = {
    receiverName: 'Carlos Rodriguez (Mercamadrid Frigo)',
    receiverPhone: '+34612345678',
    compartmentCode: 'C1',
    compartmentName: 'Front Frozen Zone',
    cargoCategory: 'deep_frozen',
    trailerPlate: 'MA-R-8821',
    tripNumber: 'TRIP-2026-8840',
    cmrNumber: 'CMR-2026-8840',
    clientName: 'Atlas Agro Frigo S.A.',
    setpointTempC: -20.0,
    mktTempC: -19.45,
    avgSupplyTempC: -20.2,
    avgReturnTempC: -19.6,
    status: 'compliant',
    complianceScore: 100,
    verificationHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    verificationUrl: 'https://tms.transbodanon.com/verify/cold-chain/e3b0c44298fc1c14',
    arrivalLocationName: 'Muelle 14 - Mercamadrid',
    isGeofenceTriggered: true,
  };

  describe('1. WhatsApp Targeted Receiver Templates (Trilingual)', () => {
    it('builds compliant Arabic notification with geofence arrival notice', () => {
      const msg = WhatsAppTargetedReceiverTemplates.buildTargetedReceiverNotification(
        MOCK_TARGETED_PAYLOAD,
        'ar'
      );

      // Identity & Logistics
      expect(msg).toContain('شهادة الامتثال الحراري الرسمية — الحجرة C1');
      expect(msg).toContain('Carlos Rodriguez (Mercamadrid Frigo)');
      expect(msg).toContain('MA-R-8821');
      expect(msg).toContain('CMR-2026-8840');
      expect(msg).toContain('TRIP-2026-8840');

      // Geofence trigger
      expect(msg).toContain('إشعار وصول للمستودع');
      expect(msg).toContain('Muelle 14 - Mercamadrid');

      // Thermal metrics & MKT
      expect(msg).toContain('-20.0°C');
      expect(msg).toContain('-19.45°C');
      expect(msg).toContain('100/100');
      expect(msg).toContain('مطابق تماماً لمعايير GDP / EN 12830');

      // Cryptographic integrity seal & verification link
      expect(msg).toContain('e3b0c44298fc1c14');
      expect(msg).toContain('https://tms.transbodanon.com/verify/cold-chain/e3b0c44298fc1c14');
    });

    it('builds compliant French notification with French technical labels', () => {
      const msg = WhatsAppTargetedReceiverTemplates.buildTargetedReceiverNotification(
        {
          ...MOCK_TARGETED_PAYLOAD,
          compartmentCode: 'C2',
          compartmentName: 'Central Chilled Zone',
          cargoCategory: 'fresh_produce',
          setpointTempC: 4.0,
          mktTempC: 3.85,
          avgSupplyTempC: 3.2,
          avgReturnTempC: 4.1,
        },
        'fr'
      );

      expect(msg).toContain('CERTIFICAT DE CONFORMITÉ THERMIQUE — ZONE C2');
      expect(msg).toContain('Carlos Rodriguez');
      expect(msg).toContain('Destinataire');
      expect(msg).toContain('Arrivée sur site :');
      expect(msg).toContain('Fruits & Légumes Frais (+4°C)');
      expect(msg).toContain('Température de Consigne :* +4.0°C');
      expect(msg).toContain('+3.85°C');
      expect(msg).toContain('100% CONFORME (Normes GDP / EN 12830)');
      expect(msg).toContain('Sceau Numérique HMAC-SHA256');
    });

    it('builds compliant Spanish notification with Spanish technical labels', () => {
      const msg = WhatsAppTargetedReceiverTemplates.buildTargetedReceiverNotification(
        {
          ...MOCK_TARGETED_PAYLOAD,
          compartmentCode: 'C3',
          compartmentName: 'Rear Pharma Zone',
          cargoCategory: 'pharma_cold',
          setpointTempC: 18.0,
          mktTempC: 18.25,
          status: 'warning',
          complianceScore: 85,
        },
        'es'
      );

      expect(msg).toContain('CERTIFICADO DE CONFORMIDAD TÉRMICA — ZONA C3');
      expect(msg).toContain('Carlos Rodriguez');
      expect(msg).toContain('Destinatario');
      expect(msg).toContain('Llegada a destino:');
      expect(msg).toContain('Fármacos y Vacunas (GDP)');
      expect(msg).toContain('AVISO (Fluctuaciones Menores)');
      expect(msg).toContain('85/100');
      expect(msg).toContain('Sello Digital HMAC-SHA256');
    });

    it('formats all cargo categories and compliance badges correctly', () => {
      expect(WhatsAppTargetedReceiverTemplates.formatCargoCategory('deep_frozen', 'ar')).toContain('تجميد');
      expect(WhatsAppTargetedReceiverTemplates.formatCargoCategory('pharma_cold', 'fr')).toContain('Pharmaceutiques');
      expect(WhatsAppTargetedReceiverTemplates.formatCargoCategory('fresh_produce', 'es')).toContain('Hortalizas');
      expect(WhatsAppTargetedReceiverTemplates.formatCargoCategory('meat_chilled', 'ar')).toContain('لحوم');

      expect(WhatsAppTargetedReceiverTemplates.formatStatus('breached', 'ar')).toContain('خرق حرج');
      expect(WhatsAppTargetedReceiverTemplates.formatStatus('breached', 'fr')).toContain('RUPTURE');
      expect(WhatsAppTargetedReceiverTemplates.formatStatus('breached', 'es')).toContain('INCUMPLIMIENTO');
    });
  });

  describe('2. Phone Normalization & Cooldown Anti-Spam Radar', () => {
    it('normalizes Moroccan and international phone numbers correctly', () => {
      expect(TargetedReceiverDispatcherService.normalizePhoneNumber('0694585307')).toBe('212694585307');
      expect(TargetedReceiverDispatcherService.normalizePhoneNumber('+34612345678')).toBe('34612345678');
      expect(TargetedReceiverDispatcherService.normalizePhoneNumber('0033612345678')).toBe('33612345678');
    });

    it('rejects invalid or too short phone numbers', async () => {
      const res = await TargetedReceiverDispatcherService.dispatchCompartmentToReceiver({
        payload: {
          ...MOCK_TARGETED_PAYLOAD,
          receiverPhone: '123',
        },
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('رقم هاتف المستلم غير صالح');
    });

    it('enforces 15-minute anti-spam cooldown on repeated dispatches to same receiver', async () => {
      // First dispatch
      const res1 = await TargetedReceiverDispatcherService.dispatchCompartmentToReceiver({
        payload: MOCK_TARGETED_PAYLOAD,
        tripId: 8840,
      });

      expect(res1.success).toBe(true);
      expect(res1.skippedCooldown).toBeFalsy();

      // Immediate second dispatch to same recipient & compartment
      const res2 = await TargetedReceiverDispatcherService.dispatchCompartmentToReceiver({
        payload: MOCK_TARGETED_PAYLOAD,
        tripId: 8840,
      });

      expect(res2.success).toBe(true);
      expect(res2.skippedCooldown).toBe(true);

      // Force bypass cooldown
      const res3 = await TargetedReceiverDispatcherService.dispatchCompartmentToReceiver({
        payload: MOCK_TARGETED_PAYLOAD,
        tripId: 8840,
        forceBypassCooldown: true,
      });

      expect(res3.success).toBe(true);
      expect(res3.skippedCooldown).toBeFalsy();
    });

    it('resets cooldown cleanly when resetCooldown is called', async () => {
      await TargetedReceiverDispatcherService.dispatchCompartmentToReceiver({
        payload: MOCK_TARGETED_PAYLOAD,
        tripId: 8840,
      });

      TargetedReceiverDispatcherService.resetCooldown();

      const res = await TargetedReceiverDispatcherService.dispatchCompartmentToReceiver({
        payload: MOCK_TARGETED_PAYLOAD,
        tripId: 8840,
      });

      expect(res.success).toBe(true);
      expect(res.skippedCooldown).toBeFalsy();
    });

    it('dispatches batch receiver notifications', async () => {
      const batchRes = await TargetedReceiverDispatcherService.dispatchBatchReceivers({
        items: [
          {
            payload: {
              ...MOCK_TARGETED_PAYLOAD,
              compartmentCode: 'C1',
              receiverPhone: '+212611111111',
              receiverName: 'Destinataire C1',
            },
          },
          {
            payload: {
              ...MOCK_TARGETED_PAYLOAD,
              compartmentCode: 'C2',
              receiverPhone: '+34622222222',
              receiverName: 'Destinatario C2',
            },
          },
        ],
      });

      expect(batchRes.success).toBe(true);
      expect(batchRes.results).toHaveLength(2);
      expect(batchRes.dispatchedCount).toBe(2);
    });
  });

  describe('3. Zod Input Validation Schemas', () => {
    it('validates correct dispatchCompartmentReceiverSchema input', () => {
      const valid = {
        compartmentId: '123e4567-e89b-12d3-a456-426614174000',
        trailerId: 42,
        tripId: 8840,
        receiverName: 'Atlas Distribution S.L.',
        receiverPhone: '+34612345678',
        locale: 'es',
        forceBypassCooldown: false,
      };

      const parsed = dispatchCompartmentReceiverSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it('rejects short receiver name or phone in schema', () => {
      const invalid = {
        compartmentId: '123e4567-e89b-12d3-a456-426614174000',
        trailerId: 42,
        receiverName: 'A', // too short
        receiverPhone: '12', // too short
      };

      const parsed = dispatchCompartmentReceiverSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('validates batch receiver schema', () => {
      const validBatch = {
        trailerId: 42,
        receivers: [
          {
            compartmentCode: 'C1',
            receiverName: 'Receiver C1',
            receiverPhone: '+212600000000',
          },
          {
            compartmentCode: 'C2',
            receiverName: 'Receiver C2',
            receiverPhone: '+34600000000',
          },
        ],
      };

      const parsed = dispatchBatchReceiversSchema.safeParse(validBatch);
      expect(parsed.success).toBe(true);
    });
  });

  describe('4. Decimal.js Precision Guarantees', () => {
    it('calculates MKT and temperature offsets with Decimal.js without floating point drift', () => {
      const temp1 = new Decimal('-20.2');
      const temp2 = new Decimal('-19.6');
      const avg = temp1.plus(temp2).dividedBy(2);

      expect(avg.toFixed(2)).toBe('-19.90');

      const setpoint = new Decimal('-20.0');
      const delta = avg.minus(setpoint).abs();
      expect(delta.toFixed(2)).toBe('0.10');
    });
  });
});
