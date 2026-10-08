/**
 * Trans Bodanon TMS — Charter External e-POD Magic Link & Cryptographic Seal Engine
 * Generates expiring HMAC-SHA256 signed access tokens for subcontractor drivers
 * and seals external delivery signatures into forensic non-repudiation records.
 */

import crypto from 'crypto';
import type { ExternalEpodSubmissionInput, ExternalEpodResult } from '../types/charter.types';

const DEFAULT_EPOD_SECRET = 'trans-bodanon-charter-magic-token-key-2026';
const TOKEN_EXPIRATION_HOURS = 72; // 3 days validity for international road freight

export interface EpodTokenPayload {
  orderNumber: string;
  carrierId: string | number;
  driverPhone: string;
  expiresAt: number; // Unix epoch ms
  nonce: string;
}

/**
 * Base64Url encode/decode helpers
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Generates an expiring HMAC-SHA256 signed token and magic link URL
 */
export function generateEpodMagicToken(params: {
  orderNumber: string;
  carrierId: string | number;
  driverPhone: string;
  expiresInHours?: number;
  baseUrl?: string;
  secretKey?: string;
}): {
  token: string;
  magicLinkUrl: string;
  expiresAtIso: string;
} {
  const secret = params.secretKey || process.env.CHARTER_EPOD_SIGNING_SECRET || DEFAULT_EPOD_SECRET;
  const hours = params.expiresInHours || TOKEN_EXPIRATION_HOURS;
  const expiresAt = Date.now() + hours * 60 * 60 * 1000;
  const nonce = crypto.randomBytes(8).toString('hex');

  const payload: EpodTokenPayload = {
    orderNumber: params.orderNumber,
    carrierId: params.carrierId,
    driverPhone: params.driverPhone,
    expiresAt,
    nonce,
  };

  const serializedPayload = JSON.stringify(payload);
  const encodedPayload = base64UrlEncode(serializedPayload);

  // HMAC-SHA256 Signature
  const signature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('hex');

  const token = `${encodedPayload}.${signature}`;

  const base =
    params.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://transbodanon.com';
  const magicLinkUrl = `${base}/charter/epod?token=${encodeURIComponent(token)}`;

  return {
    token,
    magicLinkUrl,
    expiresAtIso: new Date(expiresAt).toISOString(),
  };
}

/**
 * Validates token signature and checks expiration
 */
export function verifyEpodMagicToken(
  token: string,
  secretKey?: string
): {
  isValid: boolean;
  payload?: EpodTokenPayload;
  error?: string;
} {
  if (!token || !token.includes('.')) {
    return { isValid: false, error: 'رمز الدخول غير صالح أو تالف' };
  }

  const [encodedPayload, providedSignature] = token.split('.');
  const secret = secretKey || process.env.CHARTER_EPOD_SIGNING_SECRET || DEFAULT_EPOD_SECRET;

  // Re-verify HMAC signature
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('hex');

  if (expectedSignature !== providedSignature) {
    return { isValid: false, error: 'توقيع رمز الوصول غير معتمد أو تم التلاعب به' };
  }

  try {
    const rawPayload = base64UrlDecode(encodedPayload);
    const payload: EpodTokenPayload = JSON.parse(rawPayload);

    if (Date.now() > payload.expiresAt) {
      return {
        isValid: false,
        payload,
        error: `انتهت صلاحية رابط التسليم في ${new Date(payload.expiresAt).toLocaleDateString()}`,
      };
    }

    return {
      isValid: true,
      payload,
    };
  } catch (err) {
    return { isValid: false, error: 'تعذر فك حمولة رمز الوصول' };
  }
}

/**
 * Seals external e-POD submission with an immutable HMAC-SHA256 seal
 */
export function sealExternalEpodSubmission(
  submission: ExternalEpodSubmissionInput,
  secretKey?: string
): {
  hmacSeal: string;
  signatureDigest: string;
  timestamp: string;
} {
  const secret = secretKey || process.env.CHARTER_EPOD_SIGNING_SECRET || DEFAULT_EPOD_SECRET;
  const timestamp = new Date().toISOString();

  // Signature Digest
  const sigHash = crypto
    .createHash('sha256')
    .update(submission.signatureBase64 || 'NO_SIGNATURE')
    .digest('hex');

  const latStr = (submission.latitude || 0).toFixed(6);
  const lngStr = (submission.longitude || 0).toFixed(6);

  const canonical = [
    submission.orderNumber,
    submission.receiverName.trim().toUpperCase(),
    timestamp,
    latStr,
    lngStr,
    sigHash,
  ].join('|');

  const hmacSeal = crypto
    .createHmac('sha256', secret)
    .update(canonical)
    .digest('hex');

  return {
    hmacSeal,
    signatureDigest: sigHash,
    timestamp,
  };
}

