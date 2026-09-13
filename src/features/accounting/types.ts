export type AccountingSoftware = 'sage100' | 'odoo' | 'standard_csv';

export interface JournalEntryLine {
  date: string; // YYYY-MM-DD
  journalCode: 'VT' | 'AC' | 'BQ' | 'CA' | 'OD'; // Ventes, Achats, Banque, Caisse, Opérations Diverses
  accountNumber: string; // e.g. 34210000
  auxiliaryAccount?: string; // ICE or Partner Code
  documentRef: string; // Invoice No, CMR No, Receipt No
  label: string; // Description
  debit: number;
  credit: number;
  currency: string;
  currencyAmount?: number;
  exchangeRate?: number;
}

export interface AccountingExportFilter {
  startDate: string;
  endDate: string;
  journalTypes: ('sales' | 'purchases' | 'treasury' | 'forex')[];
  software: AccountingSoftware;
}

export interface AccountingExportResult {
  success: boolean;
  filename: string;
  content: string;
  mimeType: string;
  totalEntries: number;
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  error?: string;
}

