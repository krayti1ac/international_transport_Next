import crypto from 'crypto';

export interface SignatureIntegrityPayload {
  tripOrderId: number;
  recipientName: string;
  signedAt: string;
  latitude?: number | null;
  longitude?: number | null;
  signatureUrl: string;
}

export interface IntegrityCertificate {
  hash: string;
  algorithm: 'SHA256-HMAC';
  timestamp: string;
  verified: boolean;
}

export function generateDeliverySignatureHash(
  payload: SignatureIntegrityPayload,
  signingKey?: string
): string {
  const secret = signingKey || process.env.PDF_SIGNING_KEY || 'trans-bodanon-secure-key-default';
  const latStr =
    payload.latitude !== undefined && payload.latitude !== null && !isNaN(Number(payload.latitude))
      ? Number(payload.latitude).toFixed(6)
      : 'N/A';
  const lngStr =
    payload.longitude !== undefined && payload.longitude !== null && !isNaN(Number(payload.longitude))
      ? Number(payload.longitude).toFixed(6)
      : 'N/A';

  const canonicalString = [
    `TRIP:${payload.tripOrderId}`,
    `RECIPIENT:${payload.recipientName?.trim().toUpperCase() || 'UNKNOWN'}`,
    `DATE:${payload.signedAt}`,
    `GPS:${latStr},${lngStr}`,
    `SIG:${payload.signatureUrl || ''}`,
  ].join('|');

  return crypto.createHmac('sha256', secret).update(canonicalString).digest('hex');
}

export function verifyDeliverySignatureIntegrity(
  payload: SignatureIntegrityPayload,
  providedHash: string,
  signingKey?: string
): boolean {
  if (!providedHash || typeof providedHash !== 'string') return false;
  try {
    const expectedHash = generateDeliverySignatureHash(payload, signingKey);
    const bufExpected = Buffer.from(expectedHash, 'hex');
    const bufProvided = Buffer.from(providedHash, 'hex');
    if (bufExpected.length === 0 || bufExpected.length !== bufProvided.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufExpected, bufProvided);
  } catch {
    return false;
  }
}
