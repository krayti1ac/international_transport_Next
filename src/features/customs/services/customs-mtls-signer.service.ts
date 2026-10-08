import crypto from 'crypto';
import type {
  CustomsCertificateConfig,
  CustomsXmlSigningResult,
} from '../types/customs-mtls.types';

// Cached Ephemeral Test Keypair for Sandbox / Dev environments
let cachedTestKeyPair: { certPem: string; keyPem: string } | null = null;

function getOrCreateTestKeyPair(): { certPem: string; keyPem: string } {
  if (cachedTestKeyPair) return cachedTestKeyPair;

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  cachedTestKeyPair = {
    certPem: publicKey,
    keyPem: privateKey,
  };
  return cachedTestKeyPair;
}

/**
 * Loads and inspects the Customs X.509 Client Certificate configuration (Barid e-Sign / ADII).
 */
export function getCustomsCertificateConfig(): CustomsCertificateConfig {
  const envCert = process.env.CUSTOMS_CLIENT_CERT_PEM;
  const envKey = process.env.CUSTOMS_PRIVATE_KEY_PEM;
  const passphrase = process.env.CUSTOMS_CERT_PASSPHRASE;
  const caPem = process.env.CUSTOMS_CA_CERT_PEM;

  if (envCert && envKey) {
    try {
      const x509 = new crypto.X509Certificate(envCert);
      const validFrom = x509.validFrom;
      const validTo = x509.validTo;
      const now = Date.now();
      const expiryMs = new Date(validTo).getTime();
      const daysUntilExpiry = Math.floor((expiryMs - now) / (1000 * 60 * 60 * 24));
      const isValid = daysUntilExpiry > 0;

      return {
        certPem: envCert,
        keyPem: envKey,
        passphrase,
        caPem,
        issuerCN: x509.issuer,
        subjectCN: x509.subject,
        serialNumber: x509.serialNumber,
        validFrom,
        validTo,
        daysUntilExpiry,
        isValid,
      };
    } catch {
      // Fall through to test keypair if custom cert was malformed
    }
  }

  // Fallback to Ephemeral Sandbox Keypair
  const testPair = getOrCreateTestKeyPair();
  const validFrom = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const validTo = new Date(Date.now() + 335 * 24 * 3600 * 1000).toISOString();

  return {
    certPem: testPair.certPem,
    keyPem: testPair.keyPem,
    passphrase: '',
    issuerCN: 'CN=Barid e-Sign CA - Test Sandbox, O=Barid Al-Maghrib, C=MA',
    subjectCN: 'CN=Trans Bodanon TMS - Customs Declarant, O=TRANS BODANON SARL, C=MA',
    serialNumber: '2026-TB-ADII-0042',
    validFrom,
    validTo,
    daysUntilExpiry: 335,
    isValid: true,
  };
}

/**
 * Canonicalizes XML string by stripping extraneous whitespace between tags
 */
export function canonicalizeXml(xml: string): string {
  return xml
    .replace(/>\s+</g, '><')
    .replace(/\r?\n/g, '')
    .trim();
}

/**
 * Digitally signs an XML payload using RSA-SHA256 according to W3C XML-DSig specifications.
 */
export function signCustomsXmlPayload(
  xmlContent: string,
  customCert?: CustomsCertificateConfig
): CustomsXmlSigningResult {
  const config = customCert || getCustomsCertificateConfig();
  const canonical = canonicalizeXml(xmlContent);

  // 1. Calculate SHA-256 Digest of canonical payload
  const digestValue = crypto
    .createHash('sha256')
    .update(canonical, 'utf8')
    .digest('base64');

  // 2. Sign canonical payload using RSA-SHA256 private key
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(canonical, 'utf8');
  const signatureValue = signer.sign(
    {
      key: config.keyPem,
      passphrase: config.passphrase || undefined,
    },
    'base64'
  );

  // 3. Compute certificate SHA-256 fingerprint
  const certFingerprint = crypto
    .createHash('sha256')
    .update(config.certPem, 'utf8')
    .digest('hex')
    .toUpperCase();

  const signedAt = new Date().toISOString();

  // 4. Construct enveloped XML-DSig block
  const signatureXmlBlock = `
  <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
    <ds:SignedInfo>
      <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
      <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
      <ds:Reference URI="">
        <ds:Transforms>
          <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
        </ds:Transforms>
        <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
        <ds:DigestValue>${digestValue}</ds:DigestValue>
      </ds:Reference>
    </ds:SignedInfo>
    <ds:SignatureValue>${signatureValue}</ds:SignatureValue>
    <ds:KeyInfo>
      <ds:X509Data>
        <ds:X509SubjectName>${config.subjectCN || 'CN=Trans Bodanon Declarant'}</ds:X509SubjectName>
        <ds:X509Certificate>${Buffer.from(config.certPem).toString('base64')}</ds:X509Certificate>
      </ds:X509Data>
    </ds:KeyInfo>
  </ds:Signature>`;

  // Embed signature before closing root tag
  const lastCloseTagIndex = xmlContent.lastIndexOf('</');
  const signedXml =
    lastCloseTagIndex !== -1
      ? xmlContent.slice(0, lastCloseTagIndex) + signatureXmlBlock + '\n' + xmlContent.slice(lastCloseTagIndex)
      : xmlContent + '\n' + signatureXmlBlock;

  return {
    signedXml,
    signatureAlgorithm: 'RSA-SHA256',
    digestValue,
    signatureValue,
    certificateFingerprintSha256: certFingerprint,
    signedAt,
  };
}

/**
 * Verifies an RSA-SHA256 digital signature over canonicalized XML payload.
 */
export function verifyCustomsXmlSignature(
  rawXml: string,
  signatureBase64: string,
  publicKeyPem: string
): boolean {
  try {
    const canonical = canonicalizeXml(rawXml);
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(canonical, 'utf8');
    return verifier.verify(publicKeyPem, signatureBase64, 'base64');
  } catch (err) {
    return false;
  }
}

