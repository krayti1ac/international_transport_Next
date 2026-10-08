/**
 * Trans Bodanon TMS — E-Invoicing & DGI Tax Compliance Data Contracts
 * Universal Business Language (UBL 2.1) & Moroccan DGI Compliance Specifications
 * Strictly compliant with Article 92-I-10° du Code Général des Impôts (CGI).
 */

export type DgiComplianceStatus = 'compliant' | 'tampered' | 'pending_verification';

export interface EInvoiceParty {
  companyName: string;
  ice: string; // Identifiant Commun de l'Entreprise (15 digits)
  identifiantFiscal?: string; // IF (8 digits)
  registreCommerce?: string; // RC (e.g. 10452 Tanger)
  cnss?: string; // CNSS affiliation number
  taxScheme: 'VAT' | 'EXEMPT';
  address: string;
  city: string;
  postalCode?: string;
  countryCode: string; // MA, ES, FR, SN, MR
  phone?: string;
  email?: string;
}

export interface EInvoiceItem {
  lineNumber: number;
  description: string;
  descriptionFr: string;
  descriptionAr: string;
  descriptionEs: string;
  quantity: string;
  unitCode: 'C62' | 'KGM' | 'LTR' | 'HUR' | 'E48'; // C62=Unit/Service, KGM=Kilograms
  unitPrice: string;
  lineTotal: string;
  taxCategoryCode: 'E' | 'S'; // 'E' = Exempt (CGI 92-I-10°), 'S' = Standard
  taxRatePercent: string; // '0.00' or '20.00'
  taxAmount: string; // '0.00'
  exemptionReasonCode?: string; // 'CGI-92-I-10'
  exemptionReasonText?: string;
  cmrReference?: string;
  dumReference?: string;
}

export interface EInvoiceTotals {
  lineExtensionAmount: string; // Net sum of lines HT
  taxExclusiveAmount: string;  // Total HT
  taxInclusiveAmount: string;  // Total TTC
  taxTotalAmount: string;      // Total TVA (strictly 0.00 for Art 92)
  paidAmount: string;
  payableAmount: string;       // Remaining due
  currency: string;            // MAD, EUR, USD, MRU, XOF
}

export interface CryptographicTaxSeal {
  invoiceId: number;
  invoiceNumber: string;
  sellerIce: string;
  buyerIce: string;
  issueTimestamp: string;
  currency: string;
  totalHt: string;
  totalTva: string;
  totalTtc: string;
  sha256Digest: string;       // SHA-256 Digest of canonical payload
  hmacSignature: string;      // HMAC-SHA256 signature
  qrPayloadRaw: string;       // Raw text encoded in QR code
  qrCodeDataUri: string;      // Data URI image (image/png)
  verificationUrl: string;
  isArticle92Exempt: boolean;
  legalNoticeAr: string;
  legalNoticeFr: string;
  legalNoticeEs: string;
}

export interface FiscalVaultRecord {
  id: string;
  invoiceId: number;
  invoiceNumber: string;
  sellerIce: string;
  buyerIce: string;
  issueDate: string;
  currency: string;
  totalHt: string;
  totalTtc: string;
  canonicalHash: string;
  hmacSignature: string;
  qrPayload: string;
  ublXmlContent: string;
  complianceStatus: DgiComplianceStatus;
  tamperCount: number;
  sealedAt: string;
  lastVerifiedAt?: string;
  verifiedBy?: string;
  verificationNotes?: string[];
}

export interface EInvoiceDocument {
  ublVersion: '2.1';
  customizationId: string;
  profileId: string;
  invoiceNumber: string;
  issueDate: string;
  issueTime: string;
  dueDate: string;
  invoiceTypeCode: '380'; // Commercial Invoice
  documentCurrencyCode: string;
  orderReference?: string; // Trip Order / CMR
  despatchDocumentReference?: string; // DUM / Phyto
  supplier: EInvoiceParty;
  customer: EInvoiceParty;
  paymentMeansCode: '30' | '10' | '42'; // 30=Credit Transfer, 10=Cash, 42=Payment to bank account
  paymentIbanRib?: string;
  paymentBankName?: string;
  items: EInvoiceItem[];
  totals: EInvoiceTotals;
  seal: CryptographicTaxSeal;
  xmlContent: string;
}

export interface DgiComplianceReport {
  period: string;
  totalInvoicesCount: number;
  totalHtMad: string;
  totalTtcMad: string;
  totalVatExemptMad: string;
  compliantCount: number;
  tamperedCount: number;
  pendingCount: number;
  complianceRatioPercent: string;
  generatedAt: string;
}

