/**
 * Trans Bodanon TMS — Bulk Wire Transfer & Banking Protocols Types
 * ISO 20022 Pain.001.001.03 Credit Transfer & Moroccan Interbank Virement / LCN Engine
 */

export type BulkPaymentMethod = 'sepa_credit_transfer' | 'moroccan_lcn_virement' | 'standard_wire';

export type BulkBatchStatus = 'draft' | 'generated' | 'exported' | 'executed' | 'cancelled';

export type BulkFormatType = 'pain_001_001_03' | 'moroccan_lcn_virement' | 'csv_banking';

export type TransferRecipientType = 'driver' | 'supplier' | 'carrier' | 'partner';

export type TransferItemStatus = 'pending' | 'included' | 'executed' | 'rejected';

export type TransferValidationStatus = 'valid' | 'warning' | 'invalid';

export interface BulkTransferBatch {
  id: number;
  company_id: number;
  batch_reference: string;
  payment_method: BulkPaymentMethod;
  source_bank_account_id?: number | null;
  currency: string;
  total_amount: number;
  transactions_count: number;
  status: BulkBatchStatus;
  execution_date: string;
  format_type: BulkFormatType;
  file_content?: string | null;
  file_name?: string | null;
  generated_by?: string | null;
  generated_at?: string | null;
  exported_at?: string | null;
  executed_at?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  items?: BulkTransferItem[];
}

export interface BulkTransferItem {
  id: number;
  batch_id: number;
  company_id: number;
  recipient_type: TransferRecipientType;
  recipient_id?: number | null;
  recipient_name: string;
  bank_name?: string | null;
  bank_account_rib?: string | null;
  bank_account_iban?: string | null;
  bank_bic_swift?: string | null;
  amount: number;
  currency: string;
  settlement_statement_id?: number | null;
  end_to_end_id: string;
  remittance_information?: string | null;
  status: TransferItemStatus;
  rejection_reason?: string | null;
  validation_status: TransferValidationStatus;
  validation_errors: string[];
  created_at: string;
  updated_at: string;
}

export interface RibValidationResult {
  isValid: boolean;
  bankCode?: string;
  branchCode?: string;
  accountNumber?: string;
  checkKey?: string;
  calculatedKey?: string;
  error?: string;
  bankName?: string;
}

export interface IbanValidationResult {
  isValid: boolean;
  countryCode?: string;
  checkDigits?: string;
  bban?: string;
  error?: string;
}

export interface BicValidationResult {
  isValid: boolean;
  bankCode?: string;
  countryCode?: string;
  locationCode?: string;
  branchCode?: string;
  error?: string;
}

export interface SepaTransferItemInput {
  recipientName: string;
  bankIban: string;
  bankBic?: string;
  amount: number | string;
  endToEndId: string;
  remittanceInformation: string;
  recipientId?: number;
  settlementStatementId?: number;
}

export interface SepaPain001Options {
  initiatorName: string;
  debtorName: string;
  debtorIban: string;
  debtorBic: string;
  batchReference: string;
  executionDate: string;
  currency?: string;
  items: SepaTransferItemInput[];
}

export interface MoroccanLcnTransferItemInput {
  recipientName: string;
  bankRib: string;
  amount: number | string;
  endToEndId: string;
  remittanceInformation: string;
  recipientId?: number;
  settlementStatementId?: number;
}

export interface MoroccanLcnOptions {
  companyName: string;
  companyIce?: string;
  sourceRib: string;
  batchReference: string;
  executionDate: string;
  items: MoroccanLcnTransferItemInput[];
}

export interface GeneratedTransferFile {
  fileName: string;
  fileContent: string;
  formatType: BulkFormatType;
  mimeType: string;
  transactionsCount: number;
  totalAmount: number;
  currency: string;
  checksumSha256?: string;
}

export interface EligibleSettlementForTransfer {
  statement_id: number;
  statement_number: string;
  driver_id: number;
  driver_name: string;
  driver_phone?: string;
  driver_license?: string;
  net_payout_mad: number;
  period_start: string;
  period_end: string;
  status: string;
  bank_name?: string | null;
  bank_rib?: string | null;
  bank_iban?: string | null;
  bank_bic?: string | null;
  is_rib_valid: boolean;
  is_iban_valid: boolean;
  validation_errors: string[];
}
