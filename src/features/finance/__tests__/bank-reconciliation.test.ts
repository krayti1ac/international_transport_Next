import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  parseSwiftMt940,
  parseCamt053Xml,
  parseBankStatementUnified,
  parseSwfDate,
  parseDecimalAmount,
} from '../services/bank-statement-parser.service';
import {
  calculateForexDifferential,
  calculateAdvancedMatchScore,
  reconcileStatementCore,
  normalizeReference,
} from '../services/bank-auto-reconciler.service';
import type { ParsedStatementTransaction } from '../types/bank-statement.types';

describe('AI MT940 & CAMT.053 Banking Reconciliation Engine', () => {
  describe('1. SWIFT MT940 Parser Engine', () => {
    const sampleMt940Attijariwafa = `
:20:TR20261008001
:25:007780000123456789012345
:28C:00142/001
:60F:C261001MAD150000,00
:61:2610051005CR45000,50NTRFNONREF//INV-FA-2026-0042
:86:VIR SEPA EXPORT ATLAS TRANS BODANON ICE 001548239000045 REF FA-2026-0042 CMR 1082
:61:2610061006D12500,25NCHQ123456//
:86:CHEQUE EMIS PAIEMENT GASOIL AFRIQUIA STATION GUERGUERAT
:61:2610071007CR18200,00NTRFCLT-AGADIR//TRIP-272
:86:VIREMENT RECU COOP SOUSS MARAICHERS / CMR 1099
:62F:C261008MAD200700,25
-}`;

    it('parses SWIFT date YYMMDD correctly to ISO YYYY-MM-DD', () => {
      expect(parseSwfDate('261008')).toBe('2026-10-08');
      expect(parseSwfDate('250101')).toBe('2025-01-01');
    });

    it('parses decimal amounts safely with comma separator', () => {
      const dec1 = parseDecimalAmount('45000,50');
      expect(dec1.toFixed(2)).toBe('45000.50');

      const dec2 = parseDecimalAmount('12 500,25');
      expect(dec2.toFixed(2)).toBe('12500.25');
    });

    it('extracts account identification, statement reference, and balances from MT940', () => {
      const parsed = parseSwiftMt940(sampleMt940Attijariwafa);

      expect(parsed.success).toBe(true);
      expect(parsed.format).toBe('mt940');
      expect(parsed.statementReference).toBe('TR20261008001');
      expect(parsed.accountIdentification).toBe('007780000123456789012345');
      expect(parsed.statementNumber).toBe('00142/001');
      expect(parsed.currency).toBe('MAD');

      expect(parsed.openingBalance).toBeDefined();
      expect(parsed.openingBalance?.amount).toBe('150000.00');
      expect(parsed.openingBalance?.type).toBe('credit');
      expect(parsed.openingBalance?.date).toBe('2026-10-01');

      expect(parsed.closingBalance).toBeDefined();
      expect(parsed.closingBalance?.amount).toBe('200700.25');
      expect(parsed.closingBalance?.type).toBe('credit');
      expect(parsed.closingBalance?.date).toBe('2026-10-08');
    });

    it('parses statement lines :61: and narrative :86: with exact totals', () => {
      const parsed = parseSwiftMt940(sampleMt940Attijariwafa);

      expect(parsed.rows.length).toBe(3);

      // Line 1: Credit 45000.50
      const tx1 = parsed.rows[0];
      expect(tx1.amount).toBe(45000.5);
      expect(tx1.amountDecimal).toBe('45000.50');
      expect(tx1.reference).toBe('FA-2026-0042');
      expect(tx1.partnerIce).toBe('001548239000045');
      expect(tx1.remittanceInfo).toContain('ATLAS TRANS BODANON');

      // Line 2: Debit -12500.25
      const tx2 = parsed.rows[1];
      expect(tx2.amount).toBe(-12500.25);
      expect(tx2.amountDecimal).toBe('-12500.25');
      expect(tx2.description).toContain('AFRIQUIA STATION GUERGUERAT');

      // Line 3: Credit 18200.00
      const tx3 = parsed.rows[2];
      expect(tx3.amount).toBe(18200);
      expect(tx3.amountDecimal).toBe('18200.00');

      // Totals check with Decimal.js
      expect(parsed.totalCredit).toBe('63200.50'); // 45000.50 + 18200.00
      expect(parsed.totalDebit).toBe('12500.25');
    });
  });

  describe('2. ISO 20022 CAMT.053 XML Parser Engine', () => {
    const sampleCamt053Xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt>
    <GrpHdr>
      <MsgId>MSG-CAMT-2026-10-08</MsgId>
      <CreDtTm>2026-10-08T09:30:00Z</CreDtTm>
    </GrpHdr>
    <Stmt>
      <Id>STMT-2026-092</Id>
      <Acct>
        <Id>
          <IBAN>ES7621000418450200051332</IBAN>
        </Id>
        <Ccy>EUR</Ccy>
      </Acct>
      <Bal>
        <Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="EUR">25400.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Dt><Dt>2026-10-01</Dt></Dt>
      </Bal>
      <Bal>
        <Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="EUR">31800.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Dt><Dt>2026-10-08</Dt></Dt>
      </Bal>
      <Ntry>
        <Amt Ccy="EUR">4800.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2026-10-07</Dt></BookgDt>
        <ValDt><Dt>2026-10-07</Dt></ValDt>
        <NtryDtls>
          <TxDtls>
            <Refs>
              <EndToEndId>FA-2026-0088</EndToEndId>
              <AcctSvcrRef>SAN-TX-9901</AcctSvcrRef>
            </Refs>
            <RltdPties>
              <Dbtr><Nm>AGRICOLA DEL SUR SL</Nm></Dbtr>
            </RltdPties>
            <RmtInf>
              <Ustrd>PAGO FACTURA FA-2026-0088 TRANSPORTE INTERNACIONAL AGADIR-MADRID</Ustrd>
            </RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
      <Ntry>
        <Amt Ccy="EUR">1600.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2026-10-08</Dt></BookgDt>
        <ValDt><Dt>2026-10-08</Dt></ValDt>
        <NtryDtls>
          <TxDtls>
            <Refs>
              <EndToEndId>FA-2026-0091</EndToEndId>
            </Refs>
            <RmtInf>
              <Ustrd>FA-2026-0091 CMR 1075 CITRICOS</Ustrd>
            </RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

    it('parses CAMT.053 XML statement header, balances, and entries', () => {
      const parsed = parseCamt053Xml(sampleCamt053Xml);

      expect(parsed.success).toBe(true);
      expect(parsed.format).toBe('camt053');
      expect(parsed.accountIdentification).toBe('ES7621000418450200051332');
      expect(parsed.currency).toBe('EUR');
      expect(parsed.openingBalance?.amount).toBe('25400.00');
      expect(parsed.closingBalance?.amount).toBe('31800.00');

      expect(parsed.rows.length).toBe(2);

      const entry1 = parsed.rows[0];
      expect(entry1.amount).toBe(4800.0);
      expect(entry1.amountDecimal).toBe('4800.00');
      expect(entry1.currency).toBe('EUR');
      expect(entry1.reference).toBe('FA-2026-0088');
      expect(entry1.endToEndId).toBe('FA-2026-0088');
      expect(entry1.description).toContain('AGRICOLA DEL SUR SL');

      expect(parsed.totalCredit).toBe('6400.00');
      expect(parsed.totalDebit).toBe('0.00');
    });

    it('unified dispatcher automatically identifies CAMT.053 XML files', () => {
      const unified = parseBankStatementUnified(sampleCamt053Xml, 'releve_sepa_octobre.camt');
      expect(unified.format).toBe('camt053');
      expect(unified.rows.length).toBe(2);
    });
  });

  describe('3. Decimal.js Foreign Exchange (Forex) Differential Engine', () => {
    it('calculates zero forex differential when currencies match', () => {
      const forex = calculateForexDifferential({
        invoiceCurrency: 'MAD',
        settledCurrency: 'MAD',
        invoiceAmount: '45000.00',
        settledAmount: '45000.00',
      });

      expect(forex.hasForex).toBe(false);
      expect(forex.forexDifference).toBe('0.00');
      expect(forex.forexType).toBe('neutral');
    });

    it('calculates Forex Gain (Gain de change) with strict Decimal precision', () => {
      // European export invoice: 3,000.00 EUR at rate 10.85 = 32,550.00 MAD expected
      // Bank received in MAD = 32,800.00 MAD
      // Gain = +250.00 MAD
      const forex = calculateForexDifferential({
        invoiceCurrency: 'EUR',
        settledCurrency: 'MAD',
        invoiceAmount: '3000.00',
        settledAmount: '32800.00',
        invoiceExchangeRate: '10.85',
      });

      expect(forex.hasForex).toBe(true);
      expect(forex.forexType).toBe('gain');
      expect(forex.expectedSettlementInBankCurrency).toBe('32550.00');
      expect(forex.forexDifference).toBe('250.00');
      expect(forex.forexGainLossAmount).toBe('250.00');
      expect(forex.accountingAdvice).toContain('Gain de change');
      expect(forex.accountingAdvice).toContain('7331');
    });

    it('calculates Forex Loss (Perte de change) with strict Decimal precision', () => {
      // European export invoice: 2,500.00 EUR at rate 10.90 = 27,250.00 MAD expected
      // Bank received in MAD = 27,100.00 MAD
      // Loss = -150.00 MAD
      const forex = calculateForexDifferential({
        invoiceCurrency: 'EUR',
        settledCurrency: 'MAD',
        invoiceAmount: '2500.00',
        settledAmount: '27100.00',
        invoiceExchangeRate: '10.90',
      });

      expect(forex.hasForex).toBe(true);
      expect(forex.forexType).toBe('loss');
      expect(forex.expectedSettlementInBankCurrency).toBe('27250.00');
      expect(forex.forexDifference).toBe('-150.00');
      expect(forex.forexGainLossAmount).toBe('150.00');
      expect(forex.accountingAdvice).toContain('Perte de change');
      expect(forex.accountingAdvice).toContain('6331');
    });
  });

  describe('4. Smart Auto-Reconciler Multi-Heuristic Scoring', () => {
    it('awards high score for exact amount, date proximity, reference, and ICE', () => {
      const bankTx: ParsedStatementTransaction = {
        id: 'TX-01',
        statementType: 'mt940',
        date: '2026-10-08',
        amount: 45000,
        amountDecimal: '45000.00',
        currency: 'MAD',
        reference: 'FA-2026-0042',
        description: 'Virement Atlas ICE 001548239000045 FA-2026-0042',
        partnerIce: '001548239000045',
      };

      const { score, breakdown } = calculateAdvancedMatchScore({
        bankRow: bankTx,
        systemDate: '2026-10-08',
        systemAmount: 45000,
        systemCurrency: 'MAD',
        systemRef: 'FA-2026-0042',
        partnerIdentifiers: ['Atlas Export', '001548239000045'],
      });

      expect(breakdown.amountScore).toBe(40);
      expect(breakdown.dateScore).toBe(20);
      expect(breakdown.referenceScore).toBe(25);
      expect(breakdown.partnerScore).toBe(15);
      expect(score).toBe(100);
    });

    it('normalizes references cleanly across formats', () => {
      expect(normalizeReference('FA-2026-0042')).toBe('FA20260042');
      expect(normalizeReference('CMR / 1082')).toBe('CMR1082');
    });

    it('executes full core reconciliation with invoices and treasury transactions', () => {
      const statementTransactions: ParsedStatementTransaction[] = [
        {
          id: 'STMT-01',
          statementType: 'mt940',
          date: '2026-10-08',
          amount: 45000,
          amountDecimal: '45000.00',
          currency: 'MAD',
          reference: 'FA-2026-0042',
          description: 'VIREMENT ATLAS EXP FA-2026-0042',
        },
        {
          id: 'STMT-02',
          statementType: 'mt940',
          date: '2026-10-07',
          amount: -3500,
          amountDecimal: '-3500.00',
          currency: 'MAD',
          reference: 'CHQ-7788',
          description: 'CHEQUE ENTRETIEN GARAGE AGADIR',
        },
        {
          id: 'STMT-03',
          statementType: 'camt053',
          date: '2026-10-08',
          amount: 32800,
          amountDecimal: '32800.00',
          currency: 'MAD',
          reference: 'FA-2026-EUR-10',
          description: 'VIR SEPA CLIENT MADRID FA-2026-EUR-10',
        },
      ];

      const invoices = [
        {
          id: 101,
          invoice_number: 'FA-2026-0042',
          total_amount: 45000,
          paid_amount: 0,
          currency: 'MAD',
          issue_date: '2026-10-07',
          client: { name: 'Atlas Exp', ice: '001548239000045' },
        },
        {
          id: 102,
          invoice_number: 'FA-2026-EUR-10',
          total_amount: 3000,
          paid_amount: 0,
          currency: 'EUR',
          issue_date: '2026-10-07',
          exchange_rate: 10.85,
          client: { name: 'Client Madrid' },
        },
      ];

      const treasuryTransactions = [
        {
          id: 501,
          amount: -3500,
          currency: 'MAD',
          type: 'expense',
          description: 'CHEQUE ENTRETIEN GARAGE AGADIR',
          reference: 'CHQ-7788',
          transaction_date: '2026-10-07',
        },
      ];

      const result = reconcileStatementCore({
        statementTransactions,
        systemTransactions: treasuryTransactions,
        invoices,
      });

      expect(result.success).toBe(true);
      expect(result.matched.length).toBe(3);
      expect(result.highConfidenceCount).toBeGreaterThanOrEqual(2);

      // Verify Treasury match
      const treasuryMatch = result.matched.find((m) => m.matchType === 'treasury_transaction');
      expect(treasuryMatch).toBeDefined();
      expect(treasuryMatch?.treasuryTransaction?.id).toBe(501);

      // Verify Invoice match 1 (MAD exact)
      const invMatch1 = result.matched.find((m) => m.invoice?.id === 101);
      expect(invMatch1).toBeDefined();
      expect(invMatch1?.confidence).toBe('high');

      // Verify Invoice match 2 (EUR cross-currency with Forex Gain)
      const invMatch2 = result.matched.find((m) => m.invoice?.id === 102);
      expect(invMatch2).toBeDefined();
      expect(invMatch2?.forex?.hasForex).toBe(true);
      expect(invMatch2?.forex?.forexType).toBe('gain');
      expect(invMatch2?.forex?.forexGainLossAmount).toBe('250.00');

      // Check aggregate metrics
      expect(result.forexGainCount).toBe(1);
      expect(result.totalForexImpact).toBe('250.00');
      expect(result.unmatchedBankRows.length).toBe(0);
    });
  });
});
