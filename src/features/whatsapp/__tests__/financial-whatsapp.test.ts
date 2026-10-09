import { describe, it, expect, beforeEach, vi } from 'vitest';
import Decimal from 'decimal.js';
import {
  WhatsAppFinancialTemplates,
  FuelTheftAlertPayload,
  DriverClearanceAlertPayload,
} from '../services/whatsapp-financial-templates';
import { FinancialWhatsAppDispatcherService } from '../services/financial-whatsapp-dispatcher.service';

vi.mock('../services/whatsapp-meta-client', () => ({
  sendWhatsAppText: vi.fn().mockImplementation(async (options: { to: string; message: string }) => {
    return {
      success: true,
      messageId: `wamid.mock.${Date.now()}`,
      isTestMode: true,
      originalPhone: options.to,
      targetPhone: '212694585307',
    };
  }),
}));

describe('WhatsApp Automated Payslips & Fuel Fraud Alerts Engine', () => {
  beforeEach(() => {
    FinancialWhatsAppDispatcherService.resetCooldown();
  });

  describe('1. Fuel Theft & Rapid Siphoning Alert Template', () => {
    const payload: FuelTheftAlertPayload = {
      plateNumber: '84920-A-26',
      driverName: 'محمد بلقاسم (Mohamed Belkacem)',
      droppedLiters: 45.5,
      financialLossMad: 659.75,
      locationName: 'Tanger Med Highway Rest Area A1',
      gpsLat: 35.735,
      gpsLng: -5.822,
      timestamp: '2026-10-09T03:30:00Z',
    };

    it('formats critical theft alert in Arabic (RTL) with Decimal.js precision and Google Maps link', () => {
      const msg = WhatsAppFinancialTemplates.buildFuelTheftAlert(payload, 'ar');

      expect(msg).toContain('⚠️ *إنذار حرج: رصد عملية شفط وسرقة وقود مفاجئة!*');
      expect(msg).toContain('84920-A-26');
      expect(msg).toContain('محمد بلقاسم');
      expect(msg).toContain('-45.5 لتر');
      expect(msg).toContain('-659.75 درهم');
      expect(msg).toContain('https://www.google.com/maps?q=35.735,-5.822');
      expect(msg).toContain('Tanger Med Highway Rest Area A1');
    });

    it('formats critical theft alert in French (LTR)', () => {
      const msg = WhatsAppFinancialTemplates.buildFuelTheftAlert(payload, 'fr');

      expect(msg).toContain('⚠️ *ALERTE CRITIQUE : DÉTECTION DE VOL / SIPHONAGE CARBURANT*');
      expect(msg).toContain('84920-A-26');
      expect(msg).toContain('-45.5 Litres');
      expect(msg).toContain('-659.75 MAD');
      expect(msg).toContain('https://www.google.com/maps?q=35.735,-5.822');
    });

    it('formats critical theft alert in Spanish (LTR)', () => {
      const msg = WhatsAppFinancialTemplates.buildFuelTheftAlert(payload, 'es');

      expect(msg).toContain('⚠️ *ALERTA CRÍTICA: DETECCIÓN DE ROBO / SIFONAJE DE COMBUSTIBLE*');
      expect(msg).toContain('84920-A-26');
      expect(msg).toContain('-45.5 Litros');
      expect(msg).toContain('-659.75 MAD');
      expect(msg).toContain('https://www.google.com/maps?q=35.735,-5.822');
    });
  });

  describe('2. Driver Monthly Clearance Statement Notification Template', () => {
    const payload: DriverClearanceAlertPayload = {
      driverName: 'عمر التازي (Omar Tazi)',
      statementNumber: 'CLR-2026-09-0042',
      periodLabel: '2026-09-01 ── 2026-09-30',
      netPayoutMad: 7700.0,
      clearanceUrl: 'https://trans-bodanon.com/verify/clearance/a3f4e2d19b78c6e',
    };

    it('formats driver clearance notification in Arabic (RTL) with verification URL', () => {
      const msg = WhatsAppFinancialTemplates.buildDriverClearanceAlert(payload, 'ar');

      expect(msg).toContain('💼 *ترانس بودانون TMS — كشف تصفية المستحقات وإبراء الذمة المالية*');
      expect(msg).toContain('عمر التازي');
      expect(msg).toContain('CLR-2026-09-0042');
      expect(msg).toContain('7700.00 درهم');
      expect(msg).toContain('https://trans-bodanon.com/verify/clearance/a3f4e2d19b78c6e');
      expect(msg).toContain('HMAC-SHA256');
    });

    it('formats driver clearance notification in French (LTR)', () => {
      const msg = WhatsAppFinancialTemplates.buildDriverClearanceAlert(payload, 'fr');

      expect(msg).toContain('💼 *TRANS BODANON TMS — QUITUS FISCAL & DÉCHARGE FINANCIÈRE*');
      expect(msg).toContain('CLR-2026-09-0042');
      expect(msg).toContain('7700.00 MAD');
      expect(msg).toContain('https://trans-bodanon.com/verify/clearance/a3f4e2d19b78c6e');
      expect(msg).toContain('HMAC-SHA256');
    });

    it('formats driver clearance notification in Spanish (LTR)', () => {
      const msg = WhatsAppFinancialTemplates.buildDriverClearanceAlert(payload, 'es');

      expect(msg).toContain('💼 *TRANS BODANON TMS — LIQUIDACIÓN Y FINIQUITO DE GASTOS*');
      expect(msg).toContain('CLR-2026-09-0042');
      expect(msg).toContain('7700.00 MAD');
      expect(msg).toContain('https://trans-bodanon.com/verify/clearance/a3f4e2d19b78c6e');
    });
  });

  describe('3. International Phone Normalization', () => {
    it('normalizes local Moroccan numbers (06/07) to E.164 without plus', () => {
      expect(FinancialWhatsAppDispatcherService.normalizePhoneNumber('0661234567')).toBe(
        '212661234567'
      );
      expect(FinancialWhatsAppDispatcherService.normalizePhoneNumber('0712345678')).toBe(
        '212712345678'
      );
    });

    it('handles international numbers with spaces, dashes, and plus prefix', () => {
      expect(FinancialWhatsAppDispatcherService.normalizePhoneNumber('+212 661-234567')).toBe(
        '212661234567'
      );
      expect(FinancialWhatsAppDispatcherService.normalizePhoneNumber('+34 612 345 678')).toBe(
        '34612345678'
      );
      expect(FinancialWhatsAppDispatcherService.normalizePhoneNumber('+33 6 12 34 56 78')).toBe(
        '33612345678'
      );
    });
  });

  describe('4. Anti-Spam & Cooldown Protection', () => {
    it('skips duplicate dispatch during cooldown window', async () => {
      const incidentId = 'inc-test-999';
      const phone = '0661234567';
      const payload: FuelTheftAlertPayload = {
        plateNumber: '84920-A-26',
        driverName: 'Test Driver',
        droppedLiters: 30,
        financialLossMad: 420,
      };

      // First dispatch
      const firstRes = await FinancialWhatsAppDispatcherService.dispatchFuelTheftAlert({
        incidentId,
        phone,
        payload,
      });

      expect(firstRes.success).toBe(true);
      expect(firstRes.skippedCooldown).toBeFalsy();

      // Second immediate dispatch should hit cooldown
      const secondRes = await FinancialWhatsAppDispatcherService.dispatchFuelTheftAlert({
        incidentId,
        phone,
        payload,
      });

      expect(secondRes.success).toBe(true);
      expect(secondRes.skippedCooldown).toBe(true);

      // Forced bypass allows sending
      const forcedRes = await FinancialWhatsAppDispatcherService.dispatchFuelTheftAlert({
        incidentId,
        phone,
        payload,
        forceBypassCooldown: true,
      });

      expect(forcedRes.success).toBe(true);
      expect(forcedRes.skippedCooldown).toBeFalsy();
    });
  });

  describe('5. Driver Clearance Dispatch Execution', () => {
    it('dispatches driver clearance notification safely in simulation mode', async () => {
      const res = await FinancialWhatsAppDispatcherService.dispatchDriverClearance({
        statementId: 'stmt-001',
        phone: '+212661998877',
        locale: 'ar',
        payload: {
          driverName: 'سعيد المرابط (Said El Mourabit)',
          statementNumber: 'CLR-2026-001',
          periodLabel: '2026-09-01 ── 2026-09-30',
          netPayoutMad: 8200.0,
          clearanceUrl: 'https://trans-bodanon.com/verify/clearance/test-hash',
        },
      });

      expect(res.success).toBe(true);
      expect(res.phone).toBe('212661998877');
      expect(res.isSimulated).toBe(true);
    });
  });
});
