export type AccountingSoftware = 'sage100' | 'odoo' | 'ciel' | 'standard_csv';

export type AccountingReportType =
  | 'journal'
  | 'tva_art92'
  | 'dum_customs'
  | 'corridor_pnl';

export type InternationalCorridorType =
  | 'european_maritime'
  | 'african_overland'
  | 'domestic';

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

export type TaxExemptionCode =
  | 'ART_92_I_38_CGI'
  | 'ART_92_I_19_CGI'
  | 'STANDARD_TAXABLE'
  | 'EXEMPT_OTHER';

export interface TaxDeclarationLine {
  invoiceNumber: string;
  issueDate: string;
  clientName: string;
  clientIce: string;
  clientIf?: string; // Identifiant Fiscal
  dumNumber?: string; // Déclaration Unique de Marchandises
  cmrNumber?: string;
  corridor: InternationalCorridorType;
  amountHtMAD: number;
  tvaRate: number; // 0, 14, 20
  tvaAmountMAD: number;
  amountTtcMAD: number;
  taxExemptionCode: TaxExemptionCode;
  taxExemptionLabel: string;
  paymentStatus: string;
  paymentMethod?: string;
  paymentRef?: string;
}

export interface DumCustomsAuditLine {
  dumNumber: string;
  mrn?: string;
  tripId: number;
  invoiceNumber: string;
  clientName: string;
  clientIce: string;
  corridor: InternationalCorridorType;
  customsOffice: string; // MA003100 Tanger Med, MA004900 Guerguerat, ES001100 Algeciras
  weightKg: number;
  declaredGoods: string;
  invoiceAmountMAD: number;
  submissionDate: string;
  status: string; // cleared, registered, transit
}

export interface CorridorProfitabilityLine {
  corridor: InternationalCorridorType;
  corridorName: string;
  totalTrips: number;
  revenueMAD: number;
  fuelCostMAD: number;
  ferryTransitCostMAD: number; // Ferry, Triptik, Almeria transit, Guerguerat pass
  driverAllowancesMAD: number;
  maintenanceCostMAD: number;
  totalOperatingCostMAD: number;
  grossMarginMAD: number;
  grossMarginPercent: number; // 0 - 100%
  currency: 'MAD';
}

export interface AccountingExportFilter {
  startDate: string;
  endDate: string;
  reportType?: AccountingReportType;
  journalTypes: ('sales' | 'purchases' | 'treasury' | 'forex')[];
  software: AccountingSoftware;
  corridorFilter?: 'all' | InternationalCorridorType;
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

export interface TaxComplianceSummary {
  periodStart: string;
  periodEnd: string;
  totalInvoicesCount: number;
  totalTurnoverHtMAD: number;
  exemptTurnoverArt92MAD: number;
  taxableTurnoverMAD: number;
  totalTvaCollectedMAD: number;
  totalDumsTracked: number;
  exemptionRatio: number; // Percentage (e.g. 95.5%)
  lines: TaxDeclarationLine[];
}

export interface CorridorPnlSummary {
  periodStart: string;
  periodEnd: string;
  totalTripsCount: number;
  totalRevenueMAD: number;
  totalOperatingCostsMAD: number;
  netMarginMAD: number;
  overallMarginPercent: number;
  corridors: CorridorProfitabilityLine[];
}

export interface PreClosingAuditResult {
  canClose: boolean;
  fiscalYearId: number;
  fiscalYearName: string;
  startDate: string;
  endDate: string;
  unpaidInvoicesCount: number;
  unpaidInvoicesTotalMAD: number;
  activeTripsCount: number;
  unreconciledTransactionsCount: number;
  closingBalanceMAD: number;
  closingBalanceEUR: number;
}

export interface FiscalYearClosingParams {
  fiscalYearId: number;
  nextYearName: string;
  nextStartDate: string;
  nextEndDate: string;
}

export interface FiscalYearClosingResult {
  success: boolean;
  nextFiscalYearId?: number;
  error?: string;
}
