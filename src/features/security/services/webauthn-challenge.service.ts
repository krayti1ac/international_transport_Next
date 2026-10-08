import crypto from 'crypto';
import type {
  BiometricDeviceType,
  BiometricEpodStamp,
  ChallengePurpose,
  VerificationResult,
} from '../types/webauthn-device.types';

// Default Relying Party ID for Trans Bodanon TMS
export const DEFAULT_RP_ID = process.env.NEXT_PUBLIC_APP_DOMAIN || 'transbodanon.com';
export const DEFAULT_RP_NAME = 'Trans Bodanon TMS International';

/**
 * Base64URL encoding/decoding helpers
 */
export function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64url');
}

export function base64UrlDecode(str: string): Buffer {
  return Buffer.from(str, 'base64url');
}

/**
 * Generate a cryptographically secure 32-byte WebAuthn challenge nonce
 */
export function generateCryptographicChallenge(bytesLength: number = 32): string {
  return base64UrlEncode(crypto.randomBytes(bytesLength));
}

/**
 * Generate device hardware fingerprint from device attributes
 */
export function computeDeviceFingerprint(params: {
  userAgent?: string;
  platform?: string;
  hardwareUuid?: string;
  driverId: number;
}): string {
  const seed = [
    params.driverId,
    params.hardwareUuid || '',
    params.platform || '',
    params.userAgent || '',
  ].join('|');
  return crypto.createHash('sha256').update(seed).digest('hex');
}

/**
 * Parse clientDataJSON from WebAuthn client response
 */
export interface ParsedClientData {
  type: string;
  challenge: string;
  origin: string;
  crossOrigin?: boolean;
}

export function parseClientDataJSON(clientDataJSONBase64: string): ParsedClientData {
  const jsonString = base64UrlDecode(clientDataJSONBase64).toString('utf8');
  return JSON.parse(jsonString) as ParsedClientData;
}

/**
 * Parse authenticatorData buffer
 */
export interface ParsedAuthenticatorData {
  rpIdHash: Buffer;
  flags: number;
  userPresent: boolean;
  userVerified: boolean;
  attestationDataIncluded: boolean;
  extensionDataIncluded: boolean;
  signCount: number;
  aaguid?: string;
  credentialId?: string;
}

export function parseAuthenticatorData(authenticatorDataBase64: string): ParsedAuthenticatorData {
  const buffer = base64UrlDecode(authenticatorDataBase64);

  if (buffer.length < 37) {
    throw new Error('بيانات الموثق (AuthenticatorData) غير صالحة: الطول أقل من 37 بايت');
  }

  const rpIdHash = buffer.subarray(0, 32);
  const flags = buffer[32];
  const signCount = buffer.readUInt32BE(33);

  const userPresent = (flags & 0x01) !== 0;
  const userVerified = (flags & 0x04) !== 0;
  const attestationDataIncluded = (flags & 0x40) !== 0;
  const extensionDataIncluded = (flags & 0x80) !== 0;

  let aaguid: string | undefined;
  let credentialId: string | undefined;

  if (attestationDataIncluded && buffer.length >= 55) {
    const aaguidBuf = buffer.subarray(37, 53);
    aaguid = aaguidBuf.toString('hex');
    const credIdLen = buffer.readUInt16BE(53);
    if (buffer.length >= 55 + credIdLen) {
      credentialId = base64UrlEncode(buffer.subarray(55, 55 + credIdLen));
    }
  }

  return {
    rpIdHash,
    flags,
    userPresent,
    userVerified,
    attestationDataIncluded,
    extensionDataIncluded,
    signCount,
    aaguid,
    credentialId,
  };
}

/**
 * Convert DER / SPKI or Raw EC Key to PEM format if not already PEM
 */
export function formatPublicKeyToPem(key: string, algorithm: number = -7): string {
  if (key.includes('-----BEGIN PUBLIC KEY-----')) {
    return key;
  }

  // If provided as Base64/Base64url without headers, wrap it into standard PEM
  const base64Key = Buffer.from(key, key.includes('-') || key.includes('_') ? 'base64url' : 'base64').toString('base64');
  return `-----BEGIN PUBLIC KEY-----\n${base64Key.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`;
}

/**
 * Verify cryptographic digital signature for WebAuthn assertion
 * Signed data is: authenticatorData || SHA-256(clientDataJSON)
 */
export function verifyAssertionSignature(params: {
  authenticatorDataBase64: string;
  clientDataJSONBase64: string;
  signatureBase64: string;
  publicKeyPem: string;
  algorithm?: number;
}): boolean {
  const { authenticatorDataBase64, clientDataJSONBase64, signatureBase64, publicKeyPem } = params;

  try {
    const authDataBuf = base64UrlDecode(authenticatorDataBase64);
    const clientDataBuf = base64UrlDecode(clientDataJSONBase64);
    const clientDataHash = crypto.createHash('sha256').update(clientDataBuf).digest();

    // The signature payload is authData concatenated with clientDataHash
    const signedPayload = Buffer.concat([authDataBuf, clientDataHash]);
    const signatureBuf = base64UrlDecode(signatureBase64);

    const verifier = crypto.createVerify('sha256');
    verifier.update(signedPayload);

    return verifier.verify(publicKeyPem, signatureBuf);
  } catch {
    return false;
  }
}

/**
 * Generate HMAC-SHA256 Biometric Stamp for e-POD and checkpoint confirmation
 */
export function generateBiometricHmacStamp(params: {
  credentialId: string;
  driverId: number;
  targetReference: string;
  timestamp: string;
  deviceFingerprint: string;
  secret?: string;
}): string {
  const secretKey = params.secret || process.env.GPS_WEBHOOK_SECRET || 'transbodanon_sovereign_epod_secret_2026';
  const data = [
    params.credentialId,
    params.driverId,
    params.targetReference,
    params.timestamp,
    params.deviceFingerprint,
  ].join('::');

  return crypto.createHmac('sha256', secretKey).update(data).digest('hex');
}

/**
 * Full Driver Biometric Verification Engine
 */
export function verifyDriverBiometricAssertion(params: {
  expectedChallenge: string;
  clientDataJSONBase64: string;
  authenticatorDataBase64: string;
  signatureBase64: string;
  storedPublicKey: string;
  storedCounter: number;
  driverId: number;
  driverName?: string;
  credentialId: string;
  deviceFingerprint: string;
  deviceName: string;
  deviceType?: BiometricDeviceType;
  purpose?: ChallengePurpose;
  targetReference?: string;
  requireUserVerification?: boolean;
}): VerificationResult {
  const {
    expectedChallenge,
    clientDataJSONBase64,
    authenticatorDataBase64,
    signatureBase64,
    storedPublicKey,
    storedCounter,
    driverId,
    driverName = 'سائق معتمد',
    credentialId,
    deviceFingerprint,
    deviceName,
    deviceType = 'android_biometric',
    purpose = 'authentication',
    targetReference,
    requireUserVerification = true,
  } = params;

  // 1. Parse and verify clientDataJSON
  let clientData: ParsedClientData;
  try {
    clientData = parseClientDataJSON(clientDataJSONBase64);
  } catch {
    return { verified: false, error: 'فشل في قراءة بيانات العميل (Invalid clientDataJSON)' };
  }

  // Verify challenge matches expected challenge
  if (clientData.challenge !== expectedChallenge) {
    return {
      verified: false,
      error: 'فشل التحقق: رمز التحدي لا يتطابق مع التحدي المنشأ من الخادم (Challenge mismatch)',
    };
  }

  // Verify operation type is webauthn.get
  if (clientData.type !== 'webauthn.get' && clientData.type !== 'payment.get') {
    return {
      verified: false,
      error: `نوع العملية غير صالح: ${clientData.type} (متوقع webauthn.get)`,
    };
  }

  // 2. Parse authenticatorData
  let authData: ParsedAuthenticatorData;
  try {
    authData = parseAuthenticatorData(authenticatorDataBase64);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل قراءة بيانات الموثق';
    return { verified: false, error: msg };
  }

  // Verify User Present (UP)
  if (!authData.userPresent) {
    return {
      verified: false,
      error: 'فشل التحقق: لم يتم التحقق من الوجود الفعلي للمستخدم (User not present)',
    };
  }

  // Verify User Verified (UV - Biometric Confirmation passed)
  if (requireUserVerification && !authData.userVerified) {
    return {
      verified: false,
      error: 'فشل التحقق: لم يتم تقديم البصمة الحيوية المطلوبة (Biometric verification required)',
    };
  }

  // 3. Counter Replay Attack Protection
  // If stored counter is non-zero, new counter must be greater than stored counter
  if (storedCounter > 0 && authData.signCount > 0 && authData.signCount <= storedCounter) {
    return {
      verified: false,
      error: 'تحذير أمني خطير: تم رصد محاولة تكرار أو استنساخ الاعتمادية (Replay attack detected)',
    };
  }

  // 4. Verify Digital Signature
  const pem = formatPublicKeyToPem(storedPublicKey);
  const isValidSignature = verifyAssertionSignature({
    authenticatorDataBase64,
    clientDataJSONBase64,
    signatureBase64,
    publicKeyPem: pem,
  });

  if (!isValidSignature) {
    return {
      verified: false,
      error: 'فشل التحقق الرقمي: توقيع الموثق غير متطابق مع المفتاح العام المسجل للجهاز',
    };
  }

  // 5. Generate Cryptographic Biometric Stamp for e-POD / Audit
  const nowIso = new Date().toISOString();
  const stamp = generateBiometricHmacStamp({
    credentialId,
    driverId,
    targetReference: targetReference || `${purpose}-${nowIso}`,
    timestamp: nowIso,
    deviceFingerprint,
  });

  const biometricStamp: BiometricEpodStamp = {
    isBiometricallyVerified: true,
    credentialId,
    driverId,
    driverName,
    deviceFingerprint,
    deviceName,
    deviceType,
    authTimestamp: nowIso,
    purpose,
    targetReference,
    biometricHmacStamp: stamp,
  };

  return {
    verified: true,
    newCounter: authData.signCount > 0 ? authData.signCount : storedCounter + 1,
    biometricStamp,
  };
}

