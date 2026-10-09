/**
 * Trans Bodanon TMS — Payment Gateway & Digital Settlement Engine
 * Stripe (International/SEPA) & CMI (Morocco Interbank) Multi-Gateway Logic
 * Strictly adheres to Decimal.js financial and mathematical precision rules.
 */

import Decimal from 'decimal.js';
import crypto from 'crypto';
import type {
  PaymentGateway,
  PaymentCurrency,
  GatewayFeeCalculation,
  GatewayFeeStructure,
  CmiPaymentFormData,
  CreatePaymentLinkInput,
  PaymentLink,
} from '../types/payment-gateway.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// Default fee structures (Configurable via environment variables)
export const DEFAULT_GATEWAY_FEES: Record<PaymentGateway, GatewayFeeStructure> = {
  stripe: {
    gateway: 'stripe',
    currency: 'EUR',
    percentageRate: '1.40', // 1.4% standard EU card rate
    fixedFee: '0.25',       // 0.25 EUR fixed per transaction
    tvaRateOnFee: '0.00',
  },
  cmi: {
    gateway: 'cmi',
    currency: 'MAD',
    percentageRate: '1.25', // 1.25% standard CMI merchant rate
    fixedFee: '0.00',
    tvaRateOnFee: '10.00',  // 10% VAT on banking services in Morocco
  },
  multi: {
    gateway: 'multi',
    currency: 'MAD',
    percentageRate: '1.40',
    fixedFee: '0.00',
    tvaRateOnFee: '0.00',
  },
  bank_transfer: {
    gateway: 'bank_transfer',
    currency: 'MAD',
    percentageRate: '0.00',
    fixedFee: '0.00',
    tvaRateOnFee: '0.00',
  },
};

const DEFAULT_PAYMENT_SIGNING_SECRET =
  process.env.PAYMENT_LINK_SIGNING_SECRET || 'trans-bodanon-payment-link-secret-key-2026';

const DEFAULT_CMI_STORE_KEY =
  process.env.CMI_STORE_KEY || 'TRANS_BODANON_CMI_STORE_KEY_TEST_2026';

const DEFAULT_CMI_CLIENT_ID =
  process.env.CMI_CLIENT_ID || '600000000';

/**
 * 1. Calculates gateway commissions, financial VAT on fees, and net settlement
 * Strictly calculated with Decimal.js to prevent decimal drift.
 */
export function calculateGatewayFees(params: {
  amount: number | string | InstanceType<typeof Decimal>;
  gateway: PaymentGateway;
  currency?: PaymentCurrency;
  customFeeStructure?: Partial<GatewayFeeStructure>;
}): GatewayFeeCalculation {
  const gross = new Decimal(params.amount);
  const structure = {
    ...DEFAULT_GATEWAY_FEES[params.gateway],
    ...params.customFeeStructure,
  };

  const ratePct = new Decimal(structure.percentageRate);
  const fixed = new Decimal(structure.fixedFee);
  const tvaRate = new Decimal(structure.tvaRateOnFee);

  // Fee subtotal = (gross * ratePct / 100) + fixed
  const percentageFee = gross.times(ratePct.dividedBy(100));
  const feeSubtotal = percentageFee.plus(fixed);

  // VAT on banking commission = feeSubtotal * (tvaRate / 100)
  const feeTva = feeSubtotal.times(tvaRate.dividedBy(100));

  // Total Gateway Deduction = feeSubtotal + feeTva
  const totalFee = feeSubtotal.plus(feeTva);

  // Net deposit = gross - totalFee (ensuring not negative)
  const net = Decimal.max(0, gross.minus(totalFee));

  return {
    gateway: params.gateway,
    currency: params.currency || structure.currency,
    grossAmount: gross.toFixed(2),
    gatewayFeePercentage: percentageFee.toFixed(2),
    gatewayFeeFixed: fixed.toFixed(2),
    gatewayFeeSubtotal: feeSubtotal.toFixed(2),
    gatewayFeeTva: feeTva.toFixed(2),
    totalGatewayFee: totalFee.toFixed(2),
    netSettlementAmount: net.toFixed(2),
  };
}

/**
 * 2. Generates HMAC-SHA512 hash required by CMI (Centre Monétique Interbancaire Maroc)
 * Parameters are sorted and concatenated according to CMI Ver3 specs.
 */
export function generateCmiSignature(
  params: Record<string, string>,
  storeKey: string = DEFAULT_CMI_STORE_KEY
): string {
  // Sort keys alphabetically (ignoring case) as required by CMI v3
  const sortedKeys = Object.keys(params)
    .filter((k) => k.toUpperCase() !== 'HASH' && k.toUpperCase() !== 'ENCODING')
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const plainText = sortedKeys
    .map((key) => params[key]?.trim() || '')
    .join('|')
    .concat(`|${storeKey}`);

  return crypto
    .createHash('sha512')
    .update(plainText, 'utf8')
    .digest('base64');
}

/**
 * 3. Builds CMI payment form parameters ready for submission to CMI gateway
 */
export function buildCmiPaymentPayload(params: {
  amount: number | string;
  orderId: string;
  clientName: string;
  clientCompany?: string;
  clientEmail: string;
  clientPhone: string;
  baseUrl: string;
  lang?: 'ar' | 'fr' | 'es' | 'en';
  storeKey?: string;
  clientId?: string;
}): CmiPaymentFormData {
  const storeKey = params.storeKey || DEFAULT_CMI_STORE_KEY;
  const clientId = params.clientId || DEFAULT_CMI_CLIENT_ID;
  const amountStr = new Decimal(params.amount).toFixed(2);
  const rnd = crypto.randomBytes(8).toString('hex');
  const lang = params.lang || 'fr';

  const rawFields: Record<string, string> = {
    clientid: clientId,
    amount: amountStr,
    okUrl: `${params.baseUrl}/api/webhooks/payments/cmi?status=ok`,
    failUrl: `${params.baseUrl}/api/webhooks/payments/cmi?status=fail`,
    TranType: 'Auth',
    callbackUrl: `${params.baseUrl}/api/webhooks/payments/cmi`,
    shopurl: `${params.baseUrl}/pay`,
    currency: '504', // ISO 4217 code for MAD (Moroccan Dirham)
    rnd,
    storetype: '3D_PAY_HOSTING',
    hashAlgorithm: 'ver3',
    lang,
    refreshtime: '5',
    BillToName: params.clientName,
    BillToCompany: params.clientCompany || params.clientName,
    email: params.clientEmail,
    tel: params.clientPhone,
    oid: params.orderId,
  };

  const hash = generateCmiSignature(rawFields, storeKey);

  return {
    ...rawFields,
    HASH: hash,
    gatewayPostUrl: process.env.CMI_GATEWAY_URL || 'https://testpayment.cmi.co.ma/fim/est3Dgate',
  } as CmiPaymentFormData;
}

/**
 * 4. Generates an expiring cryptographic payment token
 */
export function generatePaymentLinkToken(params: {
  invoiceId: number;
  invoiceNumber: string;
  amount: string;
  currency: string;
  expiresInDays?: number;
  secretKey?: string;
}): {
  token: string;
  expiresAtIso: string;
} {
  const secret = params.secretKey || DEFAULT_PAYMENT_SIGNING_SECRET;
  const days = params.expiresInDays || 30;
  const expiresAtMs = Date.now() + days * 24 * 60 * 60 * 1000;
  const nonce = crypto.randomBytes(8).toString('hex');

  const payload = {
    invId: params.invoiceId,
    invNum: params.invoiceNumber,
    amt: new Decimal(params.amount).toFixed(2),
    ccy: params.currency.toUpperCase(),
    exp: expiresAtMs,
    rnd: nonce,
  };

  const payloadStr = JSON.stringify(payload);
  const encodedPayload = Buffer.from(payloadStr).toString('base64url');

  const signature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('hex');

  const token = `${encodedPayload}.${signature}`;

  return {
    token,
    expiresAtIso: new Date(expiresAtMs).toISOString(),
  };
}

/**
 * 5. Verifies and decodes a payment token
 */
export function verifyPaymentLinkToken(
  token: string,
  secretKey: string = DEFAULT_PAYMENT_SIGNING_SECRET
): {
  isValid: boolean;
  payload?: {
    invoiceId: number;
    invoiceNumber: string;
    amount: string;
    currency: string;
    expiresAtMs: number;
  };
  error?: string;
} {
  if (!token || !token.includes('.')) {
    return { isValid: false, error: 'رمز الرابط غير صالح' };
  }

  const [encodedPayload, providedSig] = token.split('.');

  const expectedSig = crypto
    .createHmac('sha256', secretKey)
    .update(encodedPayload)
    .digest('hex');

  if (expectedSig !== providedSig) {
    return { isValid: false, error: 'توقيع الرابط غير معتمد أو تم التلاعب به' };
  }

  try {
    const raw = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);

    if (Date.now() > parsed.exp) {
      return { isValid: false, error: 'رابط السداد منتهي الصلاحية' };
    }

    return {
      isValid: true,
      payload: {
        invoiceId: parsed.invId,
        invoiceNumber: parsed.invNum,
        amount: parsed.amt,
        currency: parsed.ccy,
        expiresAtMs: parsed.exp,
      },
    };
  } catch {
    return { isValid: false, error: 'فشل فك تشفير بيانات الرابط' };
  }
}

/**
 * 6. Builds Full Payment Link Object
 */
export function buildPaymentLinkRecord(
  input: CreatePaymentLinkInput,
  options?: {
    baseUrl?: string;
    secretKey?: string;
  }
): PaymentLink {
  const baseUrl =
    options?.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://transbodanon.com';
  const currency = input.currency || 'MAD';
  const amountDec = new Decimal(input.amount);
  const amountStr = amountDec.toFixed(2);
  const gateway = input.gateway || 'multi';

  const { token, expiresAtIso } = generatePaymentLinkToken({
    invoiceId: input.invoiceId,
    invoiceNumber: input.invoiceNumber,
    amount: amountStr,
    currency,
    expiresInDays: input.expiresInDays || 30,
    secretKey: options?.secretKey,
  });

  const payUrl = `${baseUrl}/pay/${encodeURIComponent(token)}`;

  // Projected gateway fee
  const feeCalc = calculateGatewayFees({
    amount: amountDec,
    gateway,
    currency,
  });

  return {
    id: `plk_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    invoiceId: input.invoiceId,
    invoiceNumber: input.invoiceNumber,
    clientId: input.clientId,
    clientName: input.clientName,
    clientEmail: input.clientEmail,
    clientPhone: input.clientPhone,
    token,
    gateway,
    status: 'active',
    currency,
    amount: amountStr,
    paidAmount: '0.00',
    gatewayFeeAmount: feeCalc.totalGatewayFee,
    netSettledAmount: feeCalc.netSettlementAmount,
    payUrl,
    expiresAt: expiresAtIso,
    metadata: input.metadata || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
