import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateDossierVerificationSeal,
  getLocalizedCargoLabel,
  buildInsuranceWhatsAppMessage,
  buildInsuranceEmailHtml,
  dispatchInsuranceClaimDossier,
  clearInsuranceDispatchCooldowns,
  getInsuranceDispatchHistory,
} from '../services/insurance-dossier-dispatcher.service';
import {
  dispatchInsuranceClaimAction,
  getInsuranceDispatchHistoryAction,
} from '../services/insurance-dispatch.actions';
import type { DispatchInsuranceClaimValidated } from '../types/insurance-dispatch.types';

// Mock WhatsApp and Email delivery clients
vi.mock('@/features/whatsapp/services/whatsapp-meta-client', () => ({
  sendWhatsAppText: vi.fn().mockResolvedValue({
    success: true,
    targetPhone: '212522500100',
    provider: 'meta',
  }),
}));

vi.mock('@/lib/email', () => ({
  sendCompanyEmail: vi.fn().mockResolvedValue({
    success: true,
    data: { id: 'mock-smtp-mail-id-9988' },
  }),
}));

vi.mock('@/lib/audit.server', () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

describe('Reefer Insurance Claim Dossier & e-POD Dispatch Gateway', () => {
  beforeEach(() => {
    clearInsuranceDispatchCooldowns();
    vi.clearAllMocks();
  });

  const samplePayload: DispatchInsuranceClaimValidated = {
    claimReference: 'CLM-2026-8840-01',
    tripId: 8840,
    tripNumber: 'TRIP-2026-8840',
    truckPlate: '67890-A-40',
    driverName: 'Mohamed El Idrissi',
    cargoCategory: 'fresh_produce',
    annexId: 'ANNEX-8840-A1',
    insuredCargoValue: 145000,
    grossLossAmount: 18705,
    deductibleAmount: 5000,
    netIndemnityAmount: 13705,
    currency: 'MAD',
    policyNumber: 'POL-FRIGO-2026-TANGIER',
    insurerCompany: 'allianz',
    adjusterName: 'Expert Transport M. Berrada',
    channel: 'both',
    recipientEmail: 'sinistres.transport@allianz.ma',
    recipientPhone: '+212522500100',
    includeEpodAnnex: true,
    includeMktSummary: true,
    forceBypassCooldown: false,
    locale: 'fr',
  };

  describe('HMAC-SHA256 Cryptographic Dossier Sealing', () => {
    it('generates a 64-character hex seal and signed verification URL', () => {
      const { seal, verificationUrl } = generateDossierVerificationSeal({
        claimReference: 'CLM-2026-8840-01',
        tripId: 8840,
        netIndemnityAmount: 13705,
        policyNumber: 'POL-FRIGO-2026-TANGIER',
      });

      expect(seal).toHaveLength(64);
      expect(verificationUrl).toContain('/verify/reefer-claim/CLM-2026-8840-01');
      expect(verificationUrl).toContain('seal=');
      expect(verificationUrl).toContain(seal.substring(0, 32));
    });

    it('generates deterministic seal for identical inputs', () => {
      const seal1 = generateDossierVerificationSeal({
        claimReference: 'CLM-2026-8840-01',
        tripId: 8840,
        netIndemnityAmount: 13705,
        policyNumber: 'POL-FRIGO-2026-TANGIER',
      });

      const seal2 = generateDossierVerificationSeal({
        claimReference: 'CLM-2026-8840-01',
        tripId: 8840,
        netIndemnityAmount: 13705,
        policyNumber: 'POL-FRIGO-2026-TANGIER',
      });

      expect(seal1.seal).toBe(seal2.seal);
    });

    it('alters seal when net indemnity or claim reference differs', () => {
      const sealOriginal = generateDossierVerificationSeal({
        claimReference: 'CLM-2026-8840-01',
        tripId: 8840,
        netIndemnityAmount: 13705,
        policyNumber: 'POL-FRIGO-2026-TANGIER',
      });

      const sealModified = generateDossierVerificationSeal({
        claimReference: 'CLM-2026-8840-01',
        tripId: 8840,
        netIndemnityAmount: 14000,
        policyNumber: 'POL-FRIGO-2026-TANGIER',
      });

      expect(sealOriginal.seal).not.toBe(sealModified.seal);
    });
  });

  describe('Trilingual Message & Template Builders', () => {
    it('returns correct localized cargo labels for AR, FR, ES', () => {
      expect(getLocalizedCargoLabel('fresh_produce', 'ar')).toContain('فواكه');
      expect(getLocalizedCargoLabel('fresh_produce', 'fr')).toContain('Fruits & Légumes');
      expect(getLocalizedCargoLabel('fresh_produce', 'es')).toContain('Frutas y Hortalizas');

      expect(getLocalizedCargoLabel('pharma_cold', 'ar')).toContain('أدوية');
      expect(getLocalizedCargoLabel('pharma_cold', 'fr')).toContain('Produits Pharmaceutiques');
      expect(getLocalizedCargoLabel('pharma_cold', 'es')).toContain('Farma y Vacunas');
    });

    it('builds French WhatsApp message with full legal and financial details', () => {
      const msg = buildInsuranceWhatsAppMessage(
        { ...samplePayload, locale: 'fr' },
        'https://tms.transbodanon.com/verify/reefer-claim/test',
        'mock-seal-abcdef'
      );

      expect(msg).toContain('NOTIFICATION OFFICIELLE DE SINISTRE FRET FRIGORIFIQUE');
      expect(msg).toContain('CLM-2026-8840-01');
      expect(msg).toContain('TRIP-2026-8840');
      expect(msg).toContain('67890-A-40');
      expect(msg).toContain('Mohamed El Idrissi');
      expect(msg).toContain('13705.00 MAD');
      expect(msg).toContain('ANNEX-8840-A1');
      expect(msg).toContain('https://tms.transbodanon.com/verify/reefer-claim/test');
    });

    it('builds Arabic WhatsApp message with complete Arabic fields and formatting', () => {
      const msg = buildInsuranceWhatsAppMessage(
        { ...samplePayload, locale: 'ar' },
        'https://tms.transbodanon.com/verify/reefer-claim/test',
        'mock-seal-abcdef'
      );

      expect(msg).toContain('إخطار رسمي بمطالبة تأمينية لتلف حمولة مبردة');
      expect(msg).toContain('CLM-2026-8840-01');
      expect(msg).toContain('*الخبير المكلف:* Expert Transport M. Berrada');
      expect(msg).toContain('13705.00 MAD');
      expect(msg).toContain('ملحق e-POD لفتح الأبواب');
    });

    it('builds Spanish WhatsApp message with accurate terminology', () => {
      const msg = buildInsuranceWhatsAppMessage(
        { ...samplePayload, locale: 'es' },
        'https://tms.transbodanon.com/verify/reefer-claim/test',
        'mock-seal-abcdef'
      );

      expect(msg).toContain('NOTIFICACIÓN FORMAL DE SINIESTRO DE TRANSPORTE FRIGORÍFICO');
      expect(msg).toContain('*Expediente de Siniestro:* CLM-2026-8840-01');
      expect(msg).toContain('Indemnización Neta Reclamada: 13705.00 MAD');
      expect(msg).toContain('Acta e-POD de apertura de puertas');
    });

    it('builds professional HTML email with financial table, seal, and verify button', () => {
      const email = buildInsuranceEmailHtml(
        samplePayload,
        'https://tms.transbodanon.com/verify/reefer-claim/test',
        'abcdef1234567890seal'
      );

      expect(email.subject).toContain('CLM-2026-8840-01');
      expect(email.subject).toContain('Allianz Maroc / Allianz Trade');
      expect(email.html).toContain('Dossier Sinistre CLM-2026-8840-01');
      expect(email.html).toContain('13705.00 MAD');
      expect(email.html).toContain('abcdef1234567890seal');
      expect(email.html).toContain('Consulter le Dossier & Télécharger l\'e-POD Certifié');
    });
  });

  describe('Anti-Spam Cooldown & Multi-Channel Dispatch Logic', () => {
    it('dispatches to both WhatsApp and Email on initial invocation', async () => {
      const res = await dispatchInsuranceClaimDossier(samplePayload);

      expect(res.success).toBe(true);
      expect(res.channel).toBe('both');
      expect(res.whatsapp?.success).toBe(true);
      expect(res.email?.success).toBe(true);
      expect(res.dossierSeal).toBeDefined();
      expect(res.dossierVerificationUrl).toContain('CLM-2026-8840-01');
    });

    it('activates anti-spam cooldown when dispatched immediately again without bypass', async () => {
      const first = await dispatchInsuranceClaimDossier(samplePayload);
      expect(first.success).toBe(true);

      const second = await dispatchInsuranceClaimDossier(samplePayload);
      expect(second.success).toBe(false);
      expect(second.rateLimited).toBe(true);
      expect(second.errorMessage).toContain('Anti-spam cooldown active');
    });

    it('allows immediate re-dispatch if forceBypassCooldown is set to true', async () => {
      const first = await dispatchInsuranceClaimDossier(samplePayload);
      expect(first.success).toBe(true);

      const second = await dispatchInsuranceClaimDossier({
        ...samplePayload,
        forceBypassCooldown: true,
      });
      expect(second.success).toBe(true);
      expect(second.rateLimited).toBeUndefined();
    });

    it('supports WhatsApp-only and Email-only independent channels', async () => {
      clearInsuranceDispatchCooldowns();

      const waOnly = await dispatchInsuranceClaimDossier({
        ...samplePayload,
        channel: 'whatsapp',
      });
      expect(waOnly.success).toBe(true);
      expect(waOnly.whatsapp?.success).toBe(true);
      expect(waOnly.email).toBeUndefined();

      const mailOnly = await dispatchInsuranceClaimDossier({
        ...samplePayload,
        channel: 'email',
        forceBypassCooldown: true,
      });
      expect(mailOnly.success).toBe(true);
      expect(mailOnly.email?.success).toBe(true);
      expect(mailOnly.whatsapp).toBeUndefined();
    });

    it('retains dispatch logs in queryable history', async () => {
      clearInsuranceDispatchCooldowns();
      await dispatchInsuranceClaimDossier(samplePayload);

      const history = await getInsuranceDispatchHistory(samplePayload.claimReference);
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].claimReference).toBe(samplePayload.claimReference);
    });
  });

  describe('Server Actions Validation & Execution', () => {
    it('validates schema and successfully executes dispatchInsuranceClaimAction', async () => {
      clearInsuranceDispatchCooldowns();

      const actionRes = await dispatchInsuranceClaimAction(samplePayload);
      expect(actionRes.success).toBe(true);
      expect(actionRes.data?.claimReference).toBe('CLM-2026-8840-01');
    });

    it('rejects action when required adjuster name is empty', async () => {
      const actionRes = await dispatchInsuranceClaimAction({
        ...samplePayload,
        adjusterName: '',
      });

      expect(actionRes.success).toBe(false);
      expect(actionRes.error).toContain('adjusterName');
    });

    it('retrieves dispatch history via getInsuranceDispatchHistoryAction', async () => {
      clearInsuranceDispatchCooldowns();
      await dispatchInsuranceClaimAction(samplePayload);

      const historyRes = await getInsuranceDispatchHistoryAction('CLM-2026-8840-01');
      expect(historyRes.success).toBe(true);
      expect(historyRes.data.length).toBeGreaterThanOrEqual(1);
    });
  });
});
