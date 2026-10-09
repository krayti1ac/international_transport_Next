/**
 * Trans Bodanon TMS — Financial PDF & Excel Export Types
 * Official Clearance Statements & Executive Trip P&L Audit Export Models
 */

import type { DriverSettlementStatement, FiscalPeriodSummary } from './fiscal-settlements.types';

export interface CompanyHeaderLegalInfo {
  name: string;
  ice: string;
  rc: string;
  patente: string;
  ifNumber: string;
  address: string;
  phone: string;
  email: string;
  logoUrl?: string | null;
  currency: string;
}

export interface DriverIdentityExport {
  driverId: number;
  name: string;
  cin?: string;
  passportNumber?: string;
  driverLicenseNumber?: string;
  matricule?: string;
  phone?: string;
  truckPlate?: string;
}

export interface ClearanceSheetExportContext {
  company: CompanyHeaderLegalInfo;
  driver: DriverIdentityExport;
  statement: DriverSettlementStatement;
  locale: 'ar' | 'fr' | 'es';
  verificationUrl: string;
  verificationHash: string;
  issuedAt: string;
  qrCodeDataUri?: string;
}

export interface DetailedTripExportItem {
  id: number;
  cmrNumber: string;
  route: string;
  departureDate: string;
  driverName: string;
  truckPlate: string;
  revenue: number;
  fuelCost: number;
  tollsCost: number;
  ferryCost: number;
  customsCost: number;
  driverCost: number;
  otherCost: number;
  totalCosts: number;
  grossProfit: number;
  profitMarginPct: number;
  tier: 'exceptional' | 'healthy' | 'tight' | 'loss';
  isClosed: boolean;
}

export interface TripPnlExcelContext {
  fiscalPeriod: string; // e.g. '2026-10'
  company: CompanyHeaderLegalInfo;
  trips: DetailedTripExportItem[];
  summary: FiscalPeriodSummary;
  locale: 'ar' | 'fr' | 'es';
  generatedAt: string;
}

export interface ExportFileResult {
  success: boolean;
  fileName?: string;
  mimeType?: string;
  base64Data?: string;
  htmlContent?: string;
  verificationHash?: string;
  error?: string;
}
