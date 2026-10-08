/**
 * WebAuthn / FIDO2 Hardware Binding & Biometric Security Types
 * Trans Bodanon TMS — Sovereign Fleet & Driver Verification Architecture
 */

export type AuthenticatorAttachment = 'platform' | 'cross-platform';

export type UserVerificationRequirement = 'required' | 'preferred' | 'discouraged';

export type AttestationConveyancePreference = 'none' | 'indirect' | 'direct' | 'enterprise';

export type BiometricDeviceType = 
  | 'touch_id' 
  | 'face_id' 
  | 'android_biometric' 
  | 'yubikey' 
  | 'windows_hello'
  | 'other';

export type DriverDeviceBindingStatus = 
  | 'pending_verification' 
  | 'bound_active' 
  | 'revoked' 
  | 'lost_stolen';

export type ChallengePurpose = 
  | 'registration' 
  | 'authentication' 
  | 'epod_signature' 
  | 'fuel_receipt' 
  | 'trip_stage';

export interface DriverBoundDevice {
  id: number;
  company_id?: number | null;
  driver_id: number;
  user_id?: string | null;
  credential_id: string; // Base64URL string
  public_key: string; // PEM or COSE Base64URL string
  algorithm: number; // -7 (ES256), -257 (RS256)
  counter: number; // Sign counter for replay prevention
  device_fingerprint: string; // Hardware UUID / platform client hash
  device_name: string;
  device_type: BiometricDeviceType;
  aaguid?: string | null;
  authenticator_attachment: AuthenticatorAttachment;
  status: DriverDeviceBindingStatus;
  attestation_format?: string | null;
  registered_at: string;
  last_used_at: string;
  revoked_at?: string | null;
  revocation_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DriverAuthChallenge {
  id: string; // UUID
  driver_id: number;
  user_id?: string | null;
  challenge: string; // 32 bytes Base64URL
  purpose: ChallengePurpose;
  payload?: Record<string, unknown> | null;
  expires_at: string;
  is_used: boolean;
  created_at: string;
}

/**
 * Registration options sent to client (navigator.credentials.create)
 */
export interface WebAuthnRegistrationOptions {
  challenge: string;
  rp: {
    name: string;
    id?: string;
  };
  user: {
    id: string; // Base64URL string of driver id / uuid
    name: string;
    displayName: string;
  };
  pubKeyCredParams: Array<{
    type: 'public-key';
    alg: number; // -7 (ES256), -257 (RS256)
  }>;
  authenticatorSelection?: {
    authenticatorAttachment?: AuthenticatorAttachment;
    userVerification?: UserVerificationRequirement;
    requireResidentKey?: boolean;
  };
  timeout?: number; // Milliseconds (default 60000)
  attestation?: AttestationConveyancePreference;
}

/**
 * Registration response from client (PublicKeyCredential from navigator.credentials.create)
 */
export interface WebAuthnRegistrationResponse {
  id: string; // Credential ID (Base64URL)
  rawId: string;
  type: 'public-key';
  response: {
    clientDataJSON: string; // Base64URL
    attestationObject: string; // Base64URL
    publicKey?: string; // PEM or SPKI Base64URL if extracted by client helper
    transports?: string[];
  };
  deviceFingerprint: string;
  deviceName: string;
  deviceType?: BiometricDeviceType;
}

/**
 * Authentication options sent to client (navigator.credentials.get)
 */
export interface WebAuthnAuthenticationOptions {
  challenge: string;
  timeout?: number;
  rpId?: string;
  allowCredentials: Array<{
    id: string;
    type: 'public-key';
    transports?: string[];
  }>;
  userVerification?: UserVerificationRequirement;
  purpose: ChallengePurpose;
  metadata?: Record<string, unknown>;
}

/**
 * Authentication response from client (PublicKeyCredential from navigator.credentials.get)
 */
export interface WebAuthnAuthenticationResponse {
  id: string; // Credential ID
  rawId: string;
  type: 'public-key';
  response: {
    clientDataJSON: string; // Base64URL
    authenticatorData: string; // Base64URL
    signature: string; // Base64URL
    userHandle?: string | null;
  };
  deviceFingerprint?: string;
}

/**
 * Cryptographic Biometric Proof Stamp for e-POD and checkpoint signing
 */
export interface BiometricEpodStamp {
  isBiometricallyVerified: boolean;
  credentialId: string;
  driverId: number;
  driverName?: string;
  deviceFingerprint: string;
  deviceName: string;
  deviceType: BiometricDeviceType;
  authTimestamp: string;
  purpose: ChallengePurpose;
  targetReference?: string; // e.g. order_id, trip_id, CMR number
  biometricHmacStamp: string; // Cryptographic HMAC-SHA256 signature
}

export interface VerificationResult {
  verified: boolean;
  error?: string;
  biometricStamp?: BiometricEpodStamp;
  newCounter?: number;
}
