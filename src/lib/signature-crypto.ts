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
  const canonicalString = [
    `TRIP:${payload.tripOrderId}`,
    `RECIPIENT:${payload.recipientName.trim().toUpperCase()}`,
    `DATE:${payload.signedAt}`,
    `GPS:${payload.latitude?.toFixed(6) ?? 'N/A'},${payload.longitude?.toFixed(6) ?? 'N/A'}`,
    `SIG:${payload.signatureUrl}`,
  ].join('|');

  return crypto.createHmac('sha256', secret).update(canonicalString).digest('hex');
}

export function verifyDeliverySignatureIntegrity(
  payload: SignatureIntegrityPayload,
  providedHash: string,
  signingKey?: string
): boolean {
  const expectedHash = generateDeliverySignatureHash(payload, signingKey);
  return crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(providedHash));
}
