import { describe, expect, it } from 'vitest';
import { SmartDunningCashFlowService } from '../services/smart-dunning-cashflow.service';

describe('SmartDunningCashFlowService — Track D (PVI, Aging Buckets & Multi-Currency Cash Flow Radar)', () => {
  it('calculates PVI ratio using Decimal.js and classifies payment behavior tiers accurately', () => {
    // Prompt payer: pays in 21 days vs 30 days contractual terms -> PVI = 0.70
    const pviPrompt = SmartDunningCashFlowService.calculatePviRatio(21, 30);
    expect(pviPrompt).toBe('0.70');
    expect(SmartDunningCashFlowService.classifyBehaviorTier(pviPrompt)).toBe('prompt_payer');

    // On-time payer: pays in 30 days vs 30 days terms -> PVI = 1.00
    const pviOnTime = SmartDunningCashFlowService.calculatePviRatio(30, 30);
    expect(pviOnTime).toBe('1.00');
    expect(SmartDunningCashFlowService.classifyBehaviorTier(pviOnTime)).toBe('on_time');

    // Slow payer: pays in 39 days vs 30 days terms -> PVI = 1.30
    const pviSlow = SmartDunningCashFlowService.calculatePviRatio(39, 30);
    expect(pviSlow).toBe('1.30');
    expect(SmartDunningCashFlowService.classifyBehaviorTier(pviSlow)).toBe('slow_payer');

    // High-risk delinquent: pays in 48 days vs 30 days terms -> PVI = 1.60
    const pviDelinquent = SmartDunningCashFlowService.calculatePviRatio(48, 30);
    expect(pviDelinquent).toBe('1.60');
    expect(SmartDunningCashFlowService.classifyBehaviorTier(pviDelinquent)).toBe(
      'high_risk_delinquent'
    );
  });

  it('computes PVI-adjusted realistic collection date from issue date, agreed terms, and client PVI score', () => {
    // Issue date 2026-10-01, 30 days terms, client PVI = 1.50 -> expected in 45 days (2026-11-15)
    const adjustedSlow = SmartDunningCashFlowService.calculatePviAdjustedDate({
      issueDate: '2026-10-01',
      agreedTermsDays: 30,
      clientPviScore: '1.50',
    });
    expect(adjustedSlow).toBe('2026-11-15');

    // Prompt payer PVI = 0.80 -> 30 * 0.80 = 24 days -> 2026-10-25
    const adjustedPrompt = SmartDunningCashFlowService.calculatePviAdjustedDate({
      issueDate: '2026-10-01',
      agreedTermsDays: 30,
      clientPviScore: '0.80',
    });
    expect(adjustedPrompt).toBe('2026-10-25');
  });

  it('classifies aging buckets and escalates dunning stages including accelerated high-risk rules', () => {
    expect(SmartDunningCashFlowService.classifyAgingBucket(-5)).toBe('current');
    expect(SmartDunningCashFlowService.classifyAgingBucket(0)).toBe('current');
    expect(SmartDunningCashFlowService.classifyAgingBucket(15)).toBe('days_1_30');
    expect(SmartDunningCashFlowService.classifyAgingBucket(45)).toBe('days_31_60');
    expect(SmartDunningCashFlowService.classifyAgingBucket(75)).toBe('days_61_90');
    expect(SmartDunningCashFlowService.classifyAgingBucket(95)).toBe('days_over_90');

    // Standard on-time tier escalation
    expect(SmartDunningCashFlowService.determineEscalationStage(0, 'on_time')).toBe(
      'gentle_reminder'
    );
    expect(SmartDunningCashFlowService.determineEscalationStage(14, 'on_time')).toBe(
      'overdue_notice_1'
    );
    expect(SmartDunningCashFlowService.determineEscalationStage(40, 'on_time')).toBe(
      'overdue_notice_2'
    );
    expect(SmartDunningCashFlowService.determineEscalationStage(65, 'on_time')).toBe(
      'final_legal_mise_en_demeure'
    );

    // High-risk delinquent accelerates to final_legal_mise_en_demeure at >45 days overdue
    expect(
      SmartDunningCashFlowService.determineEscalationStage(48, 'high_risk_delinquent')
    ).toBe('final_legal_mise_en_demeure');
  });

  it('evaluates historical client PVI across multiple settled invoices', () => {
    const evalResult = SmartDunningCashFlowService.evaluateClientHistoricalPvi([
      {
        invoiceId: 1,
        clientId: 77,
        issueDate: '2026-08-01',
        dueDate: '2026-08-31',
        settledDate: '2026-09-06', // 36 days vs 30 -> 1.20
        agreedTermsDays: 30,
        amount: '25000.00',
        currency: 'MAD',
      },
      {
        invoiceId: 2,
        clientId: 77,
        issueDate: '2026-09-01',
        dueDate: '2026-10-01',
        settledDate: '2026-10-13', // 42 days vs 30 -> 1.40
        agreedTermsDays: 30,
        amount: '30000.00',
        currency: 'MAD',
      },
    ]);

    expect(evalResult.settledCount).toBe(2);
    expect(evalResult.averageActualDaysToPay).toBe('39.0');
    expect(evalResult.pviScore).toBe('1.30');
    expect(evalResult.behaviorTier).toBe('slow_payer');
  });

  it('generates trilingual (AR, FR, ES) dunning messages across all 4 escalation stages', () => {
    const arLegal = SmartDunningCashFlowService.buildTrilingualDunningMessage({
      locale: 'ar',
      escalationStage: 'final_legal_mise_en_demeure',
      clientName: 'شركة أطلس للتصدير',
      documentNumber: 'FAC-2026-990',
      remainingAmount: '92000.00',
      currency: 'MAD',
      contractualDueDate: '2026-08-01',
      daysOverdue: 75,
    });
    expect(arLegal.subject).toContain('Mise en Demeure');
    expect(arLegal.bodyText).toContain('92000.00 MAD');
    expect(arLegal.bodyText).toContain('48 ساعة');

    const frNotice2 = SmartDunningCashFlowService.buildTrilingualDunningMessage({
      locale: 'fr',
      escalationStage: 'overdue_notice_2',
      clientName: 'Rungis Primeurs SAS',
      documentNumber: 'FAC-2026-845',
      remainingAmount: '4800.00',
      currency: 'EUR',
      contractualDueDate: '2026-09-01',
      daysOverdue: 45,
    });
    expect(frNotice2.subject).toContain('2ème RELANCE');
    expect(frNotice2.bodyText).toContain('4800.00 EUR');

    const esGentle = SmartDunningCashFlowService.buildTrilingualDunningMessage({
      locale: 'es',
      escalationStage: 'gentle_reminder',
      clientName: 'Mercadona Logística S.A.',
      documentNumber: 'FAC-2026-901',
      remainingAmount: '5000.00',
      currency: 'EUR',
      contractualDueDate: '2026-10-30',
      daysOverdue: 0,
    });
    expect(esGentle.subject).toContain('Aviso Preventivo de Vencimiento');
    expect(esGentle.bodyText).toContain('5000.00 EUR');
  });

  it('builds complete multi-currency (MAD/EUR) dashboard with 30/60/90-day Nominal vs. PVI-Adjusted cash flows', () => {
    const dashboard = SmartDunningCashFlowService.buildSmartDunningDashboard({
      referenceDate: '2026-10-16',
      exchangeRateEurToMad: '10.85',
      historicalSettledInvoices: [
        // Client 10: slow payer (takes 45 days on 30-day terms -> PVI = 1.50)
        {
          invoiceId: 'H-1',
          clientId: 10,
          issueDate: '2026-07-01',
          settledDate: '2026-08-15',
          agreedTermsDays: 30,
          amount: '1000.00',
          currency: 'EUR',
        },
      ],
      openReceivables: [
        {
          id: 'INV-10',
          documentNumber: 'FAC-10',
          documentType: 'invoice',
          clientId: 10,
          clientName: 'EuroFruit Valencia SL',
          issueDate: '2026-10-01',
          contractualDueDate: '2026-10-26',
          agreedTermsDays: 25,
          currency: 'EUR',
          totalAmount: '2000.00',
          paidAmount: '0.00',
        },
        // LCN bill in MAD due in 10 days for prompt/on-time client 20 (PVI = 1.00)
        {
          id: 'LCN-20',
          documentNumber: 'LCN-9988',
          documentType: 'lcn_bill',
          clientId: 20,
          clientName: 'Souss Agrumes Export',
          issueDate: '2026-09-26',
          contractualDueDate: '2026-10-26',
          agreedTermsDays: 30,
          currency: 'MAD',
          totalAmount: '50000.00',
          paidAmount: '0.00',
        },
      ],
    });

    // 2000 EUR * 10.85 = 21700.00 MAD + 50000.00 MAD = 71700.00 MAD
    expect(dashboard.totalOpenEur).toBe('2000.00');
    expect(dashboard.totalOpenMad).toBe('50000.00');
    expect(dashboard.totalConsolidatedReceivablesMad).toBe('71700.00');

    // LCN expected in 0_30_days should be 50000.00 MAD
    const horizon30 = dashboard.cashFlowHorizons.find((h) => h.horizonKey === '0_30_days');
    expect(horizon30).toBeDefined();
    expect(horizon30?.lcnExpectedMad).toBe('50000.00');
    expect(horizon30?.nominalConsolidatedMad).toBe('71700.00');
  });
});
