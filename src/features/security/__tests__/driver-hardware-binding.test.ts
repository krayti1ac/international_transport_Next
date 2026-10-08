import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  generateCryptographicChallenge,
  computeDeviceFingerprint,
  parseClientDataJSON,
  parseAuthenticatorData,
  formatPublicKeyToPem,
  verifyAssertionSignature,
  generateBiometricHmacStamp,
  verifyDriverBiometricAssertion,
  base64UrlEncode,
} from '../services/webauthn-challenge.service';

describe('Driver Hardware Binding & WebAuthn Biometric Security Engine', () => {
  describe('1. Cryptographic Challenge & Device Fingerprinting', () => {
    it('generates a 32-byte Base64URL cryptographic challenge nonce', () => {
      const challenge1 = generateCryptographicChallenge(32);
      const challenge2 = generateCryptographicChallenge(32);

      expect(challenge1).toBeDefined();
      expect(typeof challenge1).toBe('string');
      expect(challenge1.length).toBeGreaterThanOrEqual(40);
      expect(challenge1).not.toBe(challenge2); // Nonce uniqueness
      expect(challenge1).not.toContain('+');
      expect(challenge1).not.toContain('/');
      expect(challenge1).not.toContain('=');
    });

    it('computes a consistent deterministic SHA-256 hardware device fingerprint', () => {
      const fp1 = computeDeviceFingerprint({
        driverId: 105,
        hardwareUuid: 'hw-samsung-s24-ultra-7788',
        platform: 'Android 14',
        userAgent: 'TransBodanonPWA/1.0',
      });

      const fp2 = computeDeviceFingerprint({
        driverId: 105,
        hardwareUuid: 'hw-samsung-s24-ultra-7788',
        platform: 'Android 14',
        userAgent: 'TransBodanonPWA/1.0',
      });

      const fpOther = computeDeviceFingerprint({
        driverId: 106,
        hardwareUuid: 'hw-iphone-15-pro-9900',
        platform: 'iOS 18',
        userAgent: 'TransBodanonPWA/1.0',
      });

      expect(fp1).toBe(fp2);
      expect(fp1).toHaveLength(64); // SHA-256 hex string
      expect(fp1).not.toBe(fpOther);
    });
  });

  describe('2. ClientDataJSON & AuthenticatorData Parsing', () => {
    it('parses valid clientDataJSON correctly', () => {
      const mockClientData = {
        type: 'webauthn.get',
        challenge: 'W4kU-mockChallenge12345',
        origin: 'https://transbodanon.com',
      };
      const b64Url = base64UrlEncode(Buffer.from(JSON.stringify(mockClientData), 'utf8'));

      const parsed = parseClientDataJSON(b64Url);
      expect(parsed.type).toBe('webauthn.get');
      expect(parsed.challenge).toBe('W4kU-mockChallenge12345');
      expect(parsed.origin).toBe('https://transbodanon.com');
    });

    it('parses authenticatorData buffer and extracts User Present & User Verified flags', () => {
      // Construct 37-byte buffer:
      // 0-31: 32 bytes rpIdHash
      // 32: flags (0x01 = UP, 0x04 = UV => 0x05)
      // 33-36: signCount (42)
      const buf = Buffer.alloc(37);
      crypto.randomBytes(32).copy(buf, 0);
      buf[32] = 0x01 | 0x04; // User Present (0x01) and User Verified Biometric (0x04)
      buf.writeUInt32BE(42, 33); // Counter = 42

      const b64Url = base64UrlEncode(buf);
      const parsed = parseAuthenticatorData(b64Url);

      expect(parsed.userPresent).toBe(true);
      expect(parsed.userVerified).toBe(true);
      expect(parsed.signCount).toBe(42);
      expect(parsed.flags).toBe(0x05);
    });

    it('throws error when authenticatorData buffer is truncated', () => {
      const truncatedBuf = Buffer.alloc(20);
      const b64Url = base64UrlEncode(truncatedBuf);
      expect(() => parseAuthenticatorData(b64Url)).toThrow();
    });
  });

  describe('3. Cryptographic Digital Signature & Biometric Assertion Verification', () => {
    // Generate real ECDSA P-256 Keypair for tests
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const challenge = generateCryptographicChallenge(32);
    const mockClientData = {
      type: 'webauthn.get',
      challenge,
      origin: 'https://transbodanon.com',
    };
    const clientDataJSONBase64 = base64UrlEncode(Buffer.from(JSON.stringify(mockClientData), 'utf8'));

    // Construct AuthenticatorData with UP and UV flags
    const authDataBuf = Buffer.alloc(37);
    crypto.createHash('sha256').update('transbodanon.com').digest().copy(authDataBuf, 0);
    authDataBuf[32] = 0x01 | 0x04; // UP + UV
    authDataBuf.writeUInt32BE(100, 33); // SignCount = 100
    const authenticatorDataBase64 = base64UrlEncode(authDataBuf);

    // Sign payload using privateKey
    const clientDataHash = crypto.createHash('sha256').update(Buffer.from(JSON.stringify(mockClientData))).digest();
    const payloadToSign = Buffer.concat([authDataBuf, clientDataHash]);
    const signer = crypto.createSign('sha256');
    signer.update(payloadToSign);
    const rawSignature = signer.sign(privateKey);
    const signatureBase64 = base64UrlEncode(rawSignature);

    it('verifies valid assertion signature against driver public key', () => {
      const isValid = verifyAssertionSignature({
        authenticatorDataBase64,
        clientDataJSONBase64,
        signatureBase64,
        publicKeyPem: publicKey,
      });

      expect(isValid).toBe(true);
    });

    it('rejects tampered signature', () => {
      const tamperedSig = base64UrlEncode(crypto.randomBytes(64));
      const isValid = verifyAssertionSignature({
        authenticatorDataBase64,
        clientDataJSONBase64,
        signatureBase64: tamperedSig,
        publicKeyPem: publicKey,
      });

      expect(isValid).toBe(false);
    });

    it('executes full verifyDriverBiometricAssertion and produces Biometric e-POD stamp', () => {
      const result = verifyDriverBiometricAssertion({
        expectedChallenge: challenge,
        clientDataJSONBase64,
        authenticatorDataBase64,
        signatureBase64,
        storedPublicKey: publicKey,
        storedCounter: 50,
        driverId: 77,
        driverName: 'الحسين البودانوني',
        credentialId: 'cred-hw-driver-77',
        deviceFingerprint: 'hw-fp-device-77',
        deviceName: 'Samsung Galaxy XCover Pro',
        deviceType: 'android_biometric',
        purpose: 'epod_signature',
        targetReference: 'TRIP-272-ORDER-1082',
        requireUserVerification: true,
      });

      expect(result.verified).toBe(true);
      expect(result.newCounter).toBe(100);
      expect(result.biometricStamp).toBeDefined();

      const stamp = result.biometricStamp!;
      expect(stamp.isBiometricallyVerified).toBe(true);
      expect(stamp.driverId).toBe(77);
      expect(stamp.credentialId).toBe('cred-hw-driver-77');
      expect(stamp.purpose).toBe('epod_signature');
      expect(stamp.targetReference).toBe('TRIP-272-ORDER-1082');
      expect(stamp.biometricHmacStamp).toHaveLength(64); // HMAC-SHA256 hex
    });

    it('detects and blocks replay attacks when signCount <= storedCounter', () => {
      const replayResult = verifyDriverBiometricAssertion({
        expectedChallenge: challenge,
        clientDataJSONBase64,
        authenticatorDataBase64,
        signatureBase64,
        storedPublicKey: publicKey,
        storedCounter: 150, // Stored is 150, incoming is 100 => REPLAY!
        driverId: 77,
        credentialId: 'cred-hw-driver-77',
        deviceFingerprint: 'hw-fp-device-77',
        deviceName: 'Samsung Galaxy XCover Pro',
      });

      expect(replayResult.verified).toBe(false);
      expect(replayResult.error).toContain('Replay attack');
    });

    it('rejects assertion when challenge does not match expected challenge', () => {
      const mismatchResult = verifyDriverBiometricAssertion({
        expectedChallenge: 'DIFFERENT_UNEXPECTED_CHALLENGE',
        clientDataJSONBase64,
        authenticatorDataBase64,
        signatureBase64,
        storedPublicKey: publicKey,
        storedCounter: 50,
        driverId: 77,
        credentialId: 'cred-hw-driver-77',
        deviceFingerprint: 'hw-fp-device-77',
        deviceName: 'Samsung Galaxy XCover Pro',
      });

      expect(mismatchResult.verified).toBe(false);
      expect(mismatchResult.error).toContain('Challenge mismatch');
    });

    it('rejects assertion when User Verified (UV) flag is missing if required', () => {
      // Construct authData with UP=1 but UV=0
      const noUvBuf = Buffer.alloc(37);
      crypto.createHash('sha256').update('transbodanon.com').digest().copy(noUvBuf, 0);
      noUvBuf[32] = 0x01; // Only UP, UV is 0
      noUvBuf.writeUInt32BE(105, 33);

      const noUvAuthDataB64 = base64UrlEncode(noUvBuf);
      const noUvPayload = Buffer.concat([noUvBuf, clientDataHash]);
      const s = crypto.createSign('sha256');
      s.update(noUvPayload);
      const noUvSig = base64UrlEncode(s.sign(privateKey));

      const result = verifyDriverBiometricAssertion({
        expectedChallenge: challenge,
        clientDataJSONBase64,
        authenticatorDataBase64: noUvAuthDataB64,
        signatureBase64: noUvSig,
        storedPublicKey: publicKey,
        storedCounter: 50,
        driverId: 77,
        credentialId: 'cred-hw-driver-77',
        deviceFingerprint: 'hw-fp-device-77',
        deviceName: 'Samsung Galaxy XCover Pro',
        requireUserVerification: true,
      });

      expect(result.verified).toBe(false);
      expect(result.error).toContain('Biometric verification required');
    });
  });

  describe('4. Biometric e-POD HMAC-SHA256 Stamp Generation', () => {
    it('generates consistent HMAC-SHA256 stamp for identical proof parameters', () => {
      const stamp1 = generateBiometricHmacStamp({
        credentialId: 'cred-9988',
        driverId: 42,
        targetReference: 'CMR-1082-DELIVERY',
        timestamp: '2026-10-08T12:00:00Z',
        deviceFingerprint: 'fingerprint-hw-42',
        secret: 'test-sovereign-secret',
      });

      const stamp2 = generateBiometricHmacStamp({
        credentialId: 'cred-9988',
        driverId: 42,
        targetReference: 'CMR-1082-DELIVERY',
        timestamp: '2026-10-08T12:00:00Z',
        deviceFingerprint: 'fingerprint-hw-42',
        secret: 'test-sovereign-secret',
      });

      expect(stamp1).toBe(stamp2);
      expect(stamp1).toHaveLength(64);
    });
  });
});
