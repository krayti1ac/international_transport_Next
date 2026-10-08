/**
 * Trans Bodanon TMS — Cryptographic Tax Seal & Anti-Fraud Engine
 * Generates SHA-256 Fiscal Digest, HMAC digital signature, and DGI-compliant QR payload.
 * Strictly adheres to Moroccan DGI e-invoicing security standards.
 */

import crypto from 'crypto';
import QRCode from 'qrcode';
import Decimal from 'decimal.js';
import type { CryptographicTaxSeal } from '../types/einvoice.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const DEFAULT_FISCAL_SECRET = 'trans-bodanon-dgi-fiscal-seal-secret-key-2026';

export const DGI_ARTICLE_92_NOTICE = {
  ar: 'إعفاء كلي من الضريبة على القيمة المضافة طبقاً للمادة 92-I-10° من المدونة العامة للضرائب (النقل الدولي للبضائع)',
  fr: "Exonération totale de la TVA en vertu de l'Article 92-I-10° du Code Général des Impôts (Transport International de Marchandises)",
  es: 'Exención total del IVA según el Artículo 92-I-10° del Código General de Impuestos (Transporte Internacional de Mercancías)',
};

export interface CanonicalInvoicePayload {
  invoiceId: number;
  invoiceNumber: string;
  sellerIce: string;
  buyerIce: string;
  issueTimestamp: string;
  currency: string;
  totalHt: string;
  totalTva: string;
  totalTtc: string;
  isArticle92Exempt?: boolean;
}

/**
 * Normalizes invoice financial and legal attributes into a canonical deterministic string.
 * Any single character change in amounts or ICE alters the resulting hash.
 */
export function buildCanonicalInvoiceString(payload: CanonicalInvoicePayload): string {
  // Normalize amounts using Decimal to prevent whitespace or float variance
  const ht = new Decimal(payload.totalHt || '0').toFixed(2);
  const tva = new Decimal(payload.totalTva || '0').toFixed(2);
  const ttc = new Decimal(payload.totalTtc || '0').toFixed(2);
  const currency = (payload.currency || 'MAD').toUpperCase().trim();
  const sellerIce = (payload.sellerIce || '').trim();
  const buyerIce = (payload.buyerIce || '').trim();
  const invoiceNum = (payload.invoiceNumber || '').trim().toUpperCase();
  const timestamp = (payload.issueTimestamp || '').trim();
  const exemptFlag = payload.isArticle92Exempt !== false ? 'EXEMPT_CGI_92_I_10' : 'STANDARD_TAX';

  return `DGI-V1|${sellerIce}|${buyerIce}|${invoiceNum}|${timestamp}|${currency}|${ht}|${tva}|${ttc}|${exemptFlag}`;
}

/**
 * Computes the SHA-256 hex digest of the canonical invoice string.
 */
export function generateSha256Digest(canonicalString: string): string {
  return crypto.createHash('sha256').update(canonicalString, 'utf8').digest('hex');
}

/**
 * Signs the SHA-256 digest using HMAC-SHA256 with the company's fiscal private signing key.
 */
export function generateHmacSignature(sha256Digest: string, secretKey?: string): string {
  const secret = secretKey || process.env.DGI_FISCAL_SIGNING_SECRET || DEFAULT_FISCAL_SECRET;
  return crypto.createHmac('sha256', secret).update(sha256Digest, 'utf8').digest('hex');
}

/**
 * Formats the standardized DGI QR Code raw string payload.
 * Format: DGI|SELLER_ICE|BUYER_ICE|INVOICE_NUM|TIMESTAMP|HT|TVA|TTC|CURRENCY|STATUS|DIGEST_PREFIX
 */
export function buildDgiQrPayload(
  payload: CanonicalInvoicePayload,
  sha256Digest: string
): string {
  const ht = new Decimal(payload.totalHt || '0').toFixed(2);
  const tva = new Decimal(payload.totalTva || '0').toFixed(2);
  const ttc = new Decimal(payload.totalTtc || '0').toFixed(2);
  const currency = (payload.currency || 'MAD').toUpperCase();

  return [
    'DGI',
    payload.sellerIce,
    payload.buyerIce,
    payload.invoiceNumber,
    payload.issueTimestamp,
    ht,
    tva,
    ttc,
    currency,
    payload.isArticle92Exempt !== false ? 'ART92_EXEMPT' : 'TAXABLE',
    sha256Digest.substring(0, 16), // Security fingerprint
  ].join('|');
}

/**
 * Generates the full Cryptographic Tax Seal including QR Code Data URI.
 */
export async function generateCryptographicTaxSeal(
  payload: CanonicalInvoicePayload,
  options?: {
    secretKey?: string;
    baseUrl?: string;
  }
): Promise<CryptographicTaxSeal> {
  const canonicalString = buildCanonicalInvoiceString(payload);
  const sha256Digest = generateSha256Digest(canonicalString);
  const hmacSignature = generateHmacSignature(sha256Digest, options?.secretKey);
  const qrPayloadRaw = buildDgiQrPayload(payload, sha256Digest);

  // Generate crisp Base64 PNG QR Code
  let qrCodeDataUri = '';
  try {
    qrCodeDataUri = await QRCode.toDataURL(qrPayloadRaw, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 256,
      color: {
        dark: '#0f172a', // Slate-900
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('[CryptographicTaxSeal] Failed to generate QR Code:', err);
    qrCodeDataUri = '';
  }

  const baseUrl = options?.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://transbodanon.com';
  const verificationUrl = `${baseUrl}/portal/invoices?verify=${encodeURIComponent(
    payload.invoiceNumber
  )}&seal=${encodeURIComponent(sha256Digest.substring(0, 16))}`;

  return {
    invoiceId: payload.invoiceId,
    invoiceNumber: payload.invoiceNumber,
    sellerIce: payload.sellerIce,
    buyerIce: payload.buyerIce,
    issueTimestamp: payload.issueTimestamp,
    currency: payload.currency,
    totalHt: new Decimal(payload.totalHt || '0').toFixed(2),
    totalTva: new Decimal(payload.totalTva || '0').toFixed(2),
    totalTtc: new Decimal(payload.totalTtc || '0').toFixed(2),
    sha256Digest,
    hmacSignature,
    qrPayloadRaw,
    qrCodeDataUri,
    verificationUrl,
    isArticle92Exempt: payload.isArticle92Exempt !== false,
    legalNoticeAr: DGI_ARTICLE_92_NOTICE.ar,
    legalNoticeFr: DGI_ARTICLE_92_NOTICE.fr,
    legalNoticeEs: DGI_ARTICLE_92_NOTICE.es,
  };
}

/**
 * Cryptographic forensic verification: detects any unauthorized tampering or alteration of invoice amounts.
 */
export function verifyTaxSealIntegrity(
  currentPayload: CanonicalInvoicePayload,
  sealedSha256: string,
  sealedHmac?: string,
  secretKey?: string
): {
  isValid: boolean;
  computedSha256: string;
  tamperedFields: string[];
} {
  const currentCanonical = buildCanonicalInvoiceString(currentPayload);
  const currentDigest = generateSha256Digest(currentCanonical);

  const tamperedFields: string[] = [];

  if (currentDigest !== sealedSha256) {
    tamperedFields.push('amounts_or_identifiers_mismatch');
  }

  if (sealedHmac) {
    const expectedHmac = generateHmacSignature(currentDigest, secretKey);
    if (expectedHmac !== sealedHmac) {
      tamperedFields.push('digital_signature_invalid');
    }
  }

  return {
    isValid: tamperedFields.length === 0,
    computedSha256: currentDigest,
    tamperedFields,
  };
}

