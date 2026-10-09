import crypto from 'node:crypto';
import QRCode from 'qrcode';

const SIGNING_SECRET =
  process.env.CLEARANCE_SIGNING_KEY ||
  process.env.PDF_SIGNING_KEY ||
  'trans-bodanon-clearance-secret-v1-2026';

export interface ClearanceHashPayload {
  statementId: number;
  driverId: number;
  statementNumber: string;
  netPayoutMad: number;
  periodStart: string;
  periodEnd: string;
}

export class ClearanceCryptoService {
  /**
   * توليد ختم تحقق تشفيري رقمي HMAC-SHA256 لمنع تزوير كشف إبراء الذمة
   */
  public static generateSecurityHash(payload: ClearanceHashPayload): string {
    const rawData = [
      payload.statementId,
      payload.driverId,
      payload.statementNumber.trim(),
      Number(payload.netPayoutMad).toFixed(2),
      payload.periodStart,
      payload.periodEnd,
    ].join('|');

    return crypto
      .createHmac('sha256', SIGNING_SECRET)
      .update(rawData)
      .digest('hex');
  }

  /**
   * التحقق من صحة الختم الرقمي للكشف ومطابقته للبيانات الأصلية
   */
  public static verifySecurityHash(
    payload: ClearanceHashPayload,
    candidateHash: string
  ): boolean {
    if (!candidateHash || candidateHash.length !== 64) {
      return false;
    }

    try {
      const expectedHash = this.generateSecurityHash(payload);
      return crypto.timingSafeEqual(
        Buffer.from(expectedHash, 'hex'),
        Buffer.from(candidateHash, 'hex')
      );
    } catch {
      return false;
    }
  }

  /**
   * توليد صورة رمز الاستجابة السريعة QR Code بصيغة Data URI (Base64 PNG)
   */
  public static async generateQrCodeDataUri(verificationUrl: string): Promise<string> {
    try {
      return await QRCode.toDataURL(verificationUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 140,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
    } catch (err) {
      console.warn('Failed to generate clearance QR code:', err);
      return '';
    }
  }
}
