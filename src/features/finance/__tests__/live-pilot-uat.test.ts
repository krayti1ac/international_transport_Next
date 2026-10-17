import { describe, expect, it } from 'vitest';
import { BulkTransferGeneratorService } from '../services/bulk-transfer-generator.service';
import { processMultiTenantSmartDunningCron } from '../services/smart-dunning-cron.service';
import {
  assembleClientTripDossierAction,
  calculatePortalInstantQuoteAndCheckCreditAction,
  grantBookingFreezeOverrideAction,
} from '@/features/portal/services/portal.actions';

describe('Trans Bodanon TMS — Tracks F, G & Live Pilot Execution UAT Suite', () => {
  it('Track F: generates SEPA XML & Moroccan SIMT/LCN transfers for Drivers + Suppliers and builds exact Decimal.js treasury ledger entries', () => {
    const sepaXml = BulkTransferGeneratorService.generateSepaPain001Xml({
      initiatorName: 'Trans Bodanon International',
      debtorName: 'Trans Bodanon International',
      debtorIban: 'ES9121000418450200051332',
      debtorBic: 'CAIXESBBXXX',
      batchReference: 'SEPA-PILOT-20261017',
      executionDate: '2026-10-17',
      currency: 'EUR',
      items: [
        {
          recipientName: 'FRS Iberia / DFDS Tanger-Med Algeciras',
          bankIban: 'ES9121000418450200051332',
          bankBic: 'CAIXESBBXXX',
          amount: '4200.00',
          endToEndId: 'SUP-FERRY-902',
          remittanceInformation: 'Traversées Détroit Octobre 2026',
        },
        {
          recipientName: 'Hassan Amrani (Driver Euro Allowance)',
          bankIban: 'FR1420041010050500013M02606',
          bankBic: 'BNPAFR2PXXX',
          amount: '850.50',
          endToEndId: 'DRV-EUR-101',
          remittanceInformation: 'Frais de route Europe Octobre 2026',
        },
      ],
    });

    expect(sepaXml.transactionsCount).toBe(2);
    expect(sepaXml.totalAmount).toBe(5050.5);
    expect(sepaXml.fileContent).toContain('<CtrlSum>5050.50</CtrlSum>');

    // Verify automatic Treasury Ledger Sync entries in EUR -> MAD (rate 10.85)
    const ledgerSync = BulkTransferGeneratorService.buildTreasuryLedgerEntriesForBatch({
      batchId: 77,
      batchReference: 'SEPA-PILOT-20261017',
      executionDate: '2026-10-17',
      currency: 'EUR',
      exchangeRateEurToMad: '10.85',
      items: [
        {
          endToEndId: 'SUP-FERRY-902',
          recipientType: 'supplier',
          recipientId: 302,
          recipientName: 'FRS Iberia / DFDS Tanger-Med Algeciras',
          amount: '4200.00',
          remittanceInformation: 'Traversées Détroit Octobre 2026',
        },
        {
          endToEndId: 'DRV-EUR-101',
          recipientType: 'driver',
          recipientId: 101,
          recipientName: 'Hassan Amrani',
          amount: '850.50',
          remittanceInformation: 'Frais de route Europe Octobre 2026',
        },
      ],
    });

    expect(ledgerSync.entries).toHaveLength(2);
    expect(ledgerSync.entries[0].category).toBe('supplier_payable');
    expect(ledgerSync.entries[0].amount_mad_equivalent).toBe('45570.00'); // 4200 * 10.85
    expect(ledgerSync.entries[1].category).toBe('driver_settlement');
    expect(ledgerSync.entries[1].amount_mad_equivalent).toBe('9227.93'); // 850.50 * 10.85 = 9227.925 -> 9227.93
    expect(ledgerSync.totalOriginalCurrency).toBe('5050.50');
    expect(ledgerSync.totalMadEquivalent).toBe('54797.93');
  });

  it('Track G: evaluates Instant Quote with Credit Limit + PVI check and assembles Zero-Leakage Complete Trip Dossier', async () => {
    // 1. Healthy client within credit limit
    const healthyQuote = await calculatePortalInstantQuoteAndCheckCreditAction(
      {
        clientId: 201,
        clientName: 'Souss Primeurs Export',
        routeFrom: 'Agadir',
        routeTo: 'Perpignan',
        roadDistanceKm: 2100,
        cargoType: 'fresh_produce',
        trailerType: 'frigo',
        weightTons: 21,
        currency: 'EUR',
        exchangeRateEurToMad: '10.85',
        creditLimitMad: '250000.00',
      },
      {
        settledInvoices: [
          {
            invoiceId: 'H-1',
            clientId: 201,
            issueDate: '2026-08-01',
            settledDate: '2026-08-25', // 24 days vs 30 -> PVI = 0.80 (prompt_payer)
            agreedTermsDays: 30,
            amount: '4000.00',
            currency: 'EUR',
          },
        ],
        openReceivables: [
          {
            id: 'INV-OPEN-1',
            documentNumber: 'FAC-2026-500',
            documentType: 'invoice',
            clientId: 201,
            clientName: 'Souss Primeurs Export',
            issueDate: '2026-10-05',
            contractualDueDate: '2026-11-04',
            agreedTermsDays: 30,
            currency: 'MAD',
            totalAmount: '50000.00',
            paidAmount: '0.00',
          },
        ],
      }
    );

    expect(healthyQuote.success).toBe(true);
    expect(healthyQuote.evaluation.corridorType).toBe('european_maritime');
    expect(healthyQuote.evaluation.vatRatePct).toBe('0.00');
    expect(healthyQuote.evaluation.clientPviScore).toBe('0.80');
    expect(healthyQuote.evaluation.isCreditApproved).toBe(true);
    expect(healthyQuote.evaluation.isFrozenByDunningStage4).toBe(false);

    // 2. Assemble One-Click Complete Trip Dossier (QR Invoice + e-CMR + HMAC e-POD + ISO 14083 Carbon Audit)
    const dossierRes = await assembleClientTripDossierAction({
      tripId: 1,
      clientId: 201,
      distanceKm: 2100,
      cargoWeightTons: 21,
      isReefer: true,
    });

    expect(dossierRes.success).toBe(true);
    expect(dossierRes.dossier.zeroInternalCostLeakageVerified).toBe(true);
    expect(dossierRes.dossier.invoiceSummary.qrVerificationHash).toMatch(/^TBS-QR-[A-F0-9]{32}$/);
    expect(dossierRes.dossier.ePodCertificate.hmacSha256ForensicSignature).toHaveLength(64);
    expect(dossierRes.dossier.carbonAuditCertificate.standard).toContain('ISO 14083');
    // 2100 km * 21 tons = 44100.00 tkm; (0.885 + 0.165) * 2100 = 2205.00 kgCO2e
    expect(dossierRes.dossier.carbonAuditCertificate.tonKilometers).toBe('44100.00');
    expect(dossierRes.dossier.carbonAuditCertificate.wtwEmissionsKgCo2e).toBe('2205.00');
  });

  it('Live Pilot Execution UAT: runs Multi-Tenant Cron Dunning Worker, triggers Stage-4 Freeze, and unlocks via Audited Admin Override', async () => {
    const cronRun = await processMultiTenantSmartDunningCron({
      referenceDate: '2026-10-17',
      exchangeRateEurToMad: '10.85',
      dryRun: true,
      injectedTenants: [
        {
          companyId: 1,
          companyName: 'Trans Bodanon International',
          settledInvoices: [],
          openReceivables: [
            {
              id: 'PILOT-LEGAL-99',
              documentNumber: 'FAC-PILOT-99',
              documentType: 'invoice',
              clientId: 999,
              clientName: 'Delinquent Exporter SARL',
              issueDate: '2026-06-01',
              contractualDueDate: '2026-07-04', // 105 days overdue on 2026-10-17 (105 % 15 === 0)
              agreedTermsDays: 30,
              currency: 'MAD',
              totalAmount: '140000.00',
              paidAmount: '0.00',
            },
          ],
        },
      ],
    });

    expect(cronRun.success).toBe(true);
    expect(cronRun.totalLegalEscalations).toBe(1);
    expect(cronRun.frozenClientIds).toContain(999);

    // Attempt instant quote booking while frozen -> blocked by Stage 4
    const blockedQuote = await calculatePortalInstantQuoteAndCheckCreditAction(
      {
        clientId: 999,
        clientName: 'Delinquent Exporter SARL',
        routeFrom: 'Agadir',
        routeTo: 'Madrid',
        roadDistanceKm: 1650,
        cargoType: 'fresh_produce',
        trailerType: 'frigo',
        weightTons: 20,
      },
      {
        openReceivables: [
          {
            id: 'PILOT-LEGAL-99',
            documentNumber: 'FAC-PILOT-99',
            documentType: 'invoice',
            clientId: 999,
            clientName: 'Delinquent Exporter SARL',
            issueDate: '2026-06-01',
            contractualDueDate: '2026-07-04',
            agreedTermsDays: 30,
            currency: 'MAD',
            totalAmount: '140000.00',
            paidAmount: '0.00',
          },
        ],
      }
    );

    expect(blockedQuote.evaluation.isFrozenByDunningStage4).toBe(true);
    expect(blockedQuote.evaluation.isCreditApproved).toBe(false);

    // Issue audited administrative override -> unlocks client 999
    const overrideRes = await grantBookingFreezeOverrideAction({
      clientId: 999,
      reason: 'بروتوكول جدولة مديونية موقع ومصدق مع الإدارة العامة (Live Pilot UAT)',
    });
    expect(overrideRes.success).toBe(true);

    const unlockedQuote = await calculatePortalInstantQuoteAndCheckCreditAction(
      {
        clientId: 999,
        clientName: 'Delinquent Exporter SARL',
        routeFrom: 'Agadir',
        routeTo: 'Madrid',
        roadDistanceKm: 1650,
        cargoType: 'fresh_produce',
        trailerType: 'frigo',
        weightTons: 20,
      },
      {
        openReceivables: [
          {
            id: 'PILOT-LEGAL-99',
            documentNumber: 'FAC-PILOT-99',
            documentType: 'invoice',
            clientId: 999,
            clientName: 'Delinquent Exporter SARL',
            issueDate: '2026-06-01',
            contractualDueDate: '2026-07-04',
            agreedTermsDays: 30,
            currency: 'MAD',
            totalAmount: '140000.00',
            paidAmount: '0.00',
          },
        ],
      }
    );

    expect(unlockedQuote.evaluation.isFrozenByDunningStage4).toBe(false);
    expect(unlockedQuote.evaluation.isCreditApproved).toBe(true);
  });
});

