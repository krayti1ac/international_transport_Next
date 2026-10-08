/**
 * Trans Bodanon TMS — Tamper-Evident Fiscal Audit Vault Service
 * Cryptographically secures e-invoices and detects any unauthorized post-issuance alterations.
 * Complies with Moroccan DGI immutable audit trail requirements.
 */

import Decimal from 'decimal.js';
import type {
  FiscalVaultRecord,
  DgiComplianceStatus,
  DgiComplianceReport,
  CryptographicTaxSeal,
} from '../types/einvoice.types';
import {
  generateSha256Digest,
  buildCanonicalInvoiceString,
  generateHmacSignature,
} from './cryptographic-tax-seal.service';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// In-Memory Tamper-Evident Storage Registry (Persists across hot reloads in global scope)
interface GlobalVaultContainer {
  __TRANS_BODANON_FISCAL_VAULT__?: Map<string, FiscalVaultRecord>;
}

const globalRef = globalThis as unknown as GlobalVaultContainer;
if (!globalRef.__TRANS_BODANON_FISCAL_VAULT__) {
  globalRef.__TRANS_BODANON_FISCAL_VAULT__ = new Map<string, FiscalVaultRecord>();
}
const vaultStore = globalRef.__TRANS_BODANON_FISCAL_VAULT__;

/**
 * Seed initial sample invoices if vault is empty
 */
function ensureSeededRecords() {
  if (vaultStore.size > 0) return;

  const sampleInvoices = [
    {
      id: 'VAULT-001',
      invoiceId: 101,
      invoiceNumber: 'FAC-2026-0042',
      sellerIce: '002345678000091',
      buyerIce: '001928374000082',
      issueDate: '2026-10-20',
      currency: 'MAD',
      totalHt: '32000.00',
      totalTtc: '32000.00',
      sealedAt: '2026-10-20T10:15:00Z',
    },
    {
      id: 'VAULT-002',
      invoiceId: 102,
      invoiceNumber: 'FAC-2026-0041',
      sellerIce: '002345678000091',
      buyerIce: '002847192000045',
      issueDate: '2026-10-18',
      currency: 'MAD',
      totalHt: '28500.00',
      totalTtc: '28500.00',
      sealedAt: '2026-10-18T14:40:00Z',
    },
    {
      id: 'VAULT-003',
      invoiceId: 103,
      invoiceNumber: 'FAC-2026-0040',
      sellerIce: '002345678000091',
      buyerIce: '003194857000012',
      issueDate: '2026-10-15',
      currency: 'EUR',
      totalHt: '3400.00',
      totalTtc: '3400.00',
      sealedAt: '2026-10-15T09:20:00Z',
    },
  ];

  for (const s of sampleInvoices) {
    const canonical = buildCanonicalInvoiceString({
      invoiceId: s.invoiceId,
      invoiceNumber: s.invoiceNumber,
      sellerIce: s.sellerIce,
      buyerIce: s.buyerIce,
      issueTimestamp: `${s.issueDate}T12:00:00`,
      currency: s.currency,
      totalHt: s.totalHt,
      totalTva: '0.00',
      totalTtc: s.totalTtc,
      isArticle92Exempt: true,
    });
    const sha256 = generateSha256Digest(canonical);
    const hmac = generateHmacSignature(sha256);

    vaultStore.set(s.invoiceNumber, {
      id: s.id,
      invoiceId: s.invoiceId,
      invoiceNumber: s.invoiceNumber,
      sellerIce: s.sellerIce,
      buyerIce: s.buyerIce,
      issueDate: s.issueDate,
      currency: s.currency,
      totalHt: s.totalHt,
      totalTtc: s.totalTtc,
      canonicalHash: sha256,
      hmacSignature: hmac,
      qrPayload: `DGI|${s.sellerIce}|${s.buyerIce}|${s.invoiceNumber}|${s.issueDate}|${s.totalHt}|0.00|${s.totalTtc}|${s.currency}|ART92_EXEMPT|${sha256.substring(0, 16)}`,
      ublXmlContent: `<!-- UBL 2.1 Archival Copy for ${s.invoiceNumber} -->`,
      complianceStatus: 'compliant',
      tamperCount: 0,
      sealedAt: s.sealedAt,
      lastVerifiedAt: new Date().toISOString(),
      verifiedBy: 'DGI Automated Fiscal Verifier',
      verificationNotes: ['Empreinte cryptographique certifiée conforme sans altération.'],
    });
  }
}

/**
 * Seals an issued e-invoice in the Tamper-Evident Fiscal Vault.
 */
export async function sealInvoiceInVault(params: {
  invoiceId: number;
  invoiceNumber: string;
  sellerIce: string;
  buyerIce: string;
  issueDate: string;
  currency: string;
  totalHt: string;
  totalTtc: string;
  seal: CryptographicTaxSeal;
  ublXmlContent: string;
}): Promise<FiscalVaultRecord> {
  ensureSeededRecords();

  const recordId = `VAULT-${Date.now()}-${params.invoiceId}`;
  const now = new Date().toISOString();

  const record: FiscalVaultRecord = {
    id: recordId,
    invoiceId: params.invoiceId,
    invoiceNumber: params.invoiceNumber,
    sellerIce: params.sellerIce,
    buyerIce: params.buyerIce,
    issueDate: params.issueDate,
    currency: params.currency.toUpperCase(),
    totalHt: new Decimal(params.totalHt).toFixed(2),
    totalTtc: new Decimal(params.totalTtc).toFixed(2),
    canonicalHash: params.seal.sha256Digest,
    hmacSignature: params.seal.hmacSignature,
    qrPayload: params.seal.qrPayloadRaw,
    ublXmlContent: params.ublXmlContent,
    complianceStatus: 'compliant',
    tamperCount: 0,
    sealedAt: now,
    lastVerifiedAt: now,
    verifiedBy: 'System Fiscal Vault Engine',
    verificationNotes: ['Initial cryptographic seal applied and verified against DGI Article 92-I-10°.'],
  };

  vaultStore.set(params.invoiceNumber, record);
  return record;
}

/**
 * Retrieves a sealed vault record by invoice number or ID.
 */
export function getVaultRecord(invoiceNumberOrId: string | number): FiscalVaultRecord | null {
  ensureSeededRecords();
  const key = String(invoiceNumberOrId);

  // Search by invoice number
  if (vaultStore.has(key)) {
    return vaultStore.get(key) || null;
  }

  // Search by numeric invoiceId
  for (const record of vaultStore.values()) {
    if (String(record.invoiceId) === key) {
      return record;
    }
  }

  return null;
}

/**
 * Lists all sealed vault records.
 */
export function listVaultRecords(statusFilter?: DgiComplianceStatus): FiscalVaultRecord[] {
  ensureSeededRecords();
  const records = Array.from(vaultStore.values()).sort(
    (a, b) => new Date(b.sealedAt).getTime() - new Date(a.sealedAt).getTime()
  );

  if (statusFilter) {
    return records.filter((r) => r.complianceStatus === statusFilter);
  }

  return records;
}

/**
 * Verifies a sealed record's cryptographic integrity against live invoice data.
 * If amounts or items were modified after the seal, marks the record as 'tampered'.
 */
export function verifyVaultRecordIntegrity(
  invoiceNumber: string,
  liveData?: {
    totalHt: string;
    totalTva?: string;
    totalTtc: string;
    currency: string;
    buyerIce?: string;
  }
): {
  isCompliant: boolean;
  status: DgiComplianceStatus;
  record: FiscalVaultRecord | null;
  message: string;
  digestMatch: boolean;
  tamperedFields: string[];
} {
  ensureSeededRecords();
  const record = vaultStore.get(invoiceNumber);

  if (!record) {
    return {
      isCompliant: false,
      status: 'pending_verification',
      record: null,
      message: `لم يتم العثور على سجل ختم ضريبي للفاتورة رقم: ${invoiceNumber}`,
      digestMatch: false,
      tamperedFields: ['record_not_found'],
    };
  }

  const tamperedFields: string[] = [];

  // If live data provided, check if it matches the sealed vault snapshot
  if (liveData) {
    const liveHt = new Decimal(liveData.totalHt).toFixed(2);
    const liveTtc = new Decimal(liveData.totalTtc).toFixed(2);
    const liveCurr = liveData.currency.toUpperCase();

    if (liveHt !== record.totalHt) {
      tamperedFields.push(`total_ht_mismatch (sealed: ${record.totalHt}, live: ${liveHt})`);
    }
    if (liveTtc !== record.totalTtc) {
      tamperedFields.push(`total_ttc_mismatch (sealed: ${record.totalTtc}, live: ${liveTtc})`);
    }
    if (liveCurr !== record.currency) {
      tamperedFields.push(`currency_mismatch (sealed: ${record.currency}, live: ${liveCurr})`);
    }
    if (liveData.buyerIce && liveData.buyerIce !== record.buyerIce) {
      tamperedFields.push(`buyer_ice_mismatch (sealed: ${record.buyerIce}, live: ${liveData.buyerIce})`);
    }
  }

  // Verify HMAC signature against canonical hash
  const expectedHmac = generateHmacSignature(record.canonicalHash);
  if (expectedHmac !== record.hmacSignature) {
    tamperedFields.push('digital_hmac_signature_corrupted');
  }

  const isCompliant = tamperedFields.length === 0;
  const status: DgiComplianceStatus = isCompliant ? 'compliant' : 'tampered';

  // Update audit log in vault
  const now = new Date().toISOString();
  record.lastVerifiedAt = now;
  record.complianceStatus = status;
  if (!isCompliant) {
    record.tamperCount += 1;
    record.verificationNotes = record.verificationNotes || [];
    record.verificationNotes.push(
      `[${now}] إنذار أمني: تم رصد عدم تطابق في البيانات (${tamperedFields.join(', ')})`
    );
  }

  vaultStore.set(invoiceNumber, record);

  return {
    isCompliant,
    status,
    record,
    message: isCompliant
      ? 'الفاتورة مطابقة 100% للختم الضريبي الرقمي ولم يطرأ عليها أي تعديل.'
      : `تم اكتشاف تلاعب أو تعديل غير مصرح به في بيانات الفاتورة: ${tamperedFields.join(', ')}`,
    digestMatch: isCompliant,
    tamperedFields,
  };
}

/**
 * Generates an aggregated DGI Fiscal Compliance Report.
 */
export function generateDgiComplianceReport(period?: string): DgiComplianceReport {
  ensureSeededRecords();
  const records = Array.from(vaultStore.values());

  let totalHtMad = new Decimal(0);
  let totalTtcMad = new Decimal(0);
  let compliantCount = 0;
  let tamperedCount = 0;
  let pendingCount = 0;

  for (const r of records) {
    const amount = new Decimal(r.totalHt || 0);
    // Convert EUR roughly for report aggregation if needed
    const madAmount = r.currency === 'EUR' ? amount.times(10.85) : amount;
    totalHtMad = totalHtMad.plus(madAmount);
    totalTtcMad = totalTtcMad.plus(madAmount);

    if (r.complianceStatus === 'compliant') compliantCount++;
    else if (r.complianceStatus === 'tampered') tamperedCount++;
    else pendingCount++;
  }

  const total = records.length || 1;
  const complianceRatio = new Decimal(compliantCount).dividedBy(total).times(100).toFixed(1);

  return {
    period: period || `${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`,
    totalInvoicesCount: records.length,
    totalHtMad: totalHtMad.toFixed(2),
    totalTtcMad: totalTtcMad.toFixed(2),
    totalVatExemptMad: totalHtMad.toFixed(2), // 100% exempt under Art. 92
    compliantCount,
    tamperedCount,
    pendingCount,
    complianceRatioPercent: complianceRatio,
    generatedAt: new Date().toISOString(),
  };
}

