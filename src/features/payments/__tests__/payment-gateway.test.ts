/**
 * Trans Bodanon TMS — Payment Gateway & Digital Settlement Tests
 * Tests Stripe, CMI, Multi-Gateway fee calculations, tokens, and Decimal.js precision.
 */

import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  calculateGatewayFees,
  generateCmiSignature,
  buildCmiPaymentPayload,
  generatePaymentLinkToken,
  verifyPaymentLinkToken,
  buildPaymentLinkRecord,
  DEFAULT_GATEWAY_FEES,
} from '../services/payment-gateway.service';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

describe('Trans Bodanon TMS — Payment Gateway Engine (Stripe & CMI)', () => {
  // ---------------------------------------------------------------------------
  // 1. Gateway Fee Calculations with Decimal.js
  // ---------------------------------------------------------------------------
  describe('1. Gateway Fee Calculations (Decimal.js Non-Float Precision)', () => {
    it('accurately calculates Stripe EU fees without floating point drift', () => {
      // 4,423.96 EUR gross amount
      const gross = '4423.96';
      const feeCalc = calculateGatewayFees({
        amount: gross,
        gateway: 'stripe',
        currency: 'EUR',
      });

      // Expected Stripe: (4423.96 * 0.014) + 0.25 = 61.93544 + 0.25 = 62.18544 ≈ 62.19 EUR
      const expectedPercentage = new Decimal(gross)
        .times(new Decimal(DEFAULT_GATEWAY_FEES.stripe.percentageRate).dividedBy(100));
      const expectedSubtotal = expectedPercentage.plus(new Decimal(DEFAULT_GATEWAY_FEES.stripe.fixedFee));
      const expectedNet = new Decimal(gross).minus(expectedSubtotal);

      expect(new Decimal(feeCalc.gatewayFeePercentage).equals(new Decimal(expectedPercentage.toFixed(2)))).toBe(true);
      expect(new Decimal(feeCalc.totalGatewayFee).equals(new Decimal(expectedSubtotal.toFixed(2)))).toBe(true);
      expect(new Decimal(feeCalc.netSettlementAmount).equals(new Decimal(expectedNet.toFixed(2)))).toBe(true);
      expect(feeCalc.currency).toBe('EUR');
    });

    it('accurately calculates CMI Moroccan fees with 10% banking VAT', () => {
      // 48,000.00 MAD invoice
      const gross = '48000.00';
      const feeCalc = calculateGatewayFees({
        amount: gross,
        gateway: 'cmi',
        currency: 'MAD',
      });

      // CMI percentage: 48,000 * 1.25% = 600.00 MAD
      // 10% VAT on banking commission: 600 * 0.10 = 60.00 MAD
      // Total CMI deduction: 660.00 MAD
      // Net deposit: 48,000 - 660 = 47,340.00 MAD
      expect(feeCalc.gatewayFeeSubtotal).toBe('600.00');
      expect(feeCalc.gatewayFeeTva).toBe('60.00');
      expect(feeCalc.totalGatewayFee).toBe('660.00');
      expect(feeCalc.netSettlementAmount).toBe('47340.00');
      expect(feeCalc.currency).toBe('MAD');
    });

    it('charges zero gateway fees for direct bank transfers (RIB)', () => {
      const gross = '48000.00';
      const feeCalc = calculateGatewayFees({
        amount: gross,
        gateway: 'bank_transfer',
        currency: 'MAD',
      });

      expect(feeCalc.totalGatewayFee).toBe('0.00');
      expect(feeCalc.netSettlementAmount).toBe('48000.00');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. CMI Signature Generation & Form Payload
  // ---------------------------------------------------------------------------
  describe('2. Moroccan CMI HMAC-SHA512 Signature & Form Builder', () => {
    it('generates consistent, deterministic HMAC-SHA512 hashes for CMI', () => {
      const params = {
        clientid: '600000000',
        amount: '48000.00',
        oid: 'FA-2026-0273',
        okUrl: 'https://transbodanon.com/api/webhooks/payments/cmi?status=ok',
        failUrl: 'https://transbodanon.com/api/webhooks/payments/cmi?status=fail',
      };
      const storeKey = 'SECRET_TEST_STORE_KEY_123';

      const sig1 = generateCmiSignature(params, storeKey);
      const sig2 = generateCmiSignature(params, storeKey);

      expect(sig1).toBe(sig2);
      expect(typeof sig1).toBe('string');
      expect(sig1.length).toBeGreaterThan(40);
    });

    it('builds a complete CMI payment form payload with 3D Secure parameters', () => {
      const payload = buildCmiPaymentPayload({
        amount: '48000.00',
        orderId: 'FA-2026-0273',
        clientName: 'DIDO PRO SARL',
        clientEmail: 'comptabilite@didopro.ma',
        clientPhone: '0522998877',
        baseUrl: 'https://transbodanon.com',
        lang: 'ar',
      });

      expect(payload.clientid).toBeDefined();
      expect(payload.amount).toBe('48000.00');
      expect(payload.currency).toBe('504'); // MAD ISO code
      expect(payload.HASH).toBeDefined();
      expect(payload.TranType).toBe('Auth');
      expect(payload.storetype).toBe('3D_PAY_HOSTING');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Cryptographic Token Generation & Verification
  // ---------------------------------------------------------------------------
  describe('3. Payment Link Cryptographic Tokens & Security Guard', () => {
    it('generates and verifies valid payment link tokens', () => {
      const { token, expiresAtIso } = generatePaymentLinkToken({
        invoiceId: 273,
        invoiceNumber: 'FA-2026-0273',
        amount: '48000.00',
        currency: 'MAD',
        expiresInDays: 30,
      });

      expect(token).toContain('.');
      expect(new Date(expiresAtIso).getTime()).toBeGreaterThan(Date.now());

      const verified = verifyPaymentLinkToken(token);
      expect(verified.isValid).toBe(true);
      expect(verified.payload?.invoiceId).toBe(273);
      expect(verified.payload?.invoiceNumber).toBe('FA-2026-0273');
      expect(verified.payload?.amount).toBe('48000.00');
      expect(verified.payload?.currency).toBe('MAD');
    });

    it('rejects tampered payment tokens', () => {
      const { token } = generatePaymentLinkToken({
        invoiceId: 273,
        invoiceNumber: 'FA-2026-0273',
        amount: '48000.00',
        currency: 'MAD',
      });

      // Tamper signature portion
      const [payload, sig] = token.split('.');
      const tamperedToken = `${payload}.${sig.endsWith('0') ? sig.slice(0, -1) + '1' : sig.slice(0, -1) + '0'}`;

      const verified = verifyPaymentLinkToken(tamperedToken);
      expect(verified.isValid).toBe(false);
      expect(verified.error).toContain('توقيع');
    });

    it('rejects expired payment tokens', () => {
      // Token expired 2 days ago
      const { token } = generatePaymentLinkToken({
        invoiceId: 273,
        invoiceNumber: 'FA-2026-0273',
        amount: '48000.00',
        currency: 'MAD',
        expiresInDays: -2,
      });

      const verified = verifyPaymentLinkToken(token);
      expect(verified.isValid).toBe(false);
      expect(verified.error).toContain('منتهي الصلاحية');
    });

    it('builds complete PaymentLink object with payUrl and projected fees', () => {
      const plk = buildPaymentLinkRecord({
        invoiceId: 166,
        invoiceNumber: 'FA-2026-0273',
        clientId: '93',
        clientName: 'DIDO PRO',
        amount: '48000.00',
        currency: 'MAD',
        gateway: 'cmi',
      });

      expect(plk.invoiceNumber).toBe('FA-2026-0273');
      expect(plk.payUrl).toContain('/pay/');
      expect(plk.gateway).toBe('cmi');
      expect(plk.status).toBe('active');
      expect(plk.gatewayFeeAmount).toBe('660.00');
      expect(plk.netSettledAmount).toBe('47340.00');
    });
  });
});

