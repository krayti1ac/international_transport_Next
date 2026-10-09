/**
 * Trans Bodanon TMS — Reefer Official PDF & CSV Export Types (EN 12830 / GDP)
 */

import type {
  ColdChainAuditEvaluation,
  ReeferExcursionIncident,
  ReeferTelemetryLog,
  TripReeferMonitoringProfile,
} from './reefer-compliance.types';
import type { CompanyHeaderLegalInfo } from '@/features/finance/types/financial-export.types';

export interface ReeferTripExportContext {
  tripId: string | number;
  cmrNumber?: string;
  routeName?: string;
  originCity?: string;
  destinationCity?: string;
  truckPlate?: string;
  trailerPlate?: string;
  driverName?: string;
  clientName?: string;
}

export interface ReeferReportExportContext {
  company: CompanyHeaderLegalInfo;
  trip: ReeferTripExportContext;
  profile: TripReeferMonitoringProfile;
  evaluation: ColdChainAuditEvaluation;
  logs: ReeferTelemetryLog[];
  incidents: ReeferExcursionIncident[];
  locale: 'ar' | 'fr' | 'es';
  issuedAt: string;
  verificationHash: string;
  verificationUrl: string;
}

export interface ReeferExportFileResult {
  success: boolean;
  fileName?: string;
  fileContent?: string;
  mimeType?: string;
  verificationHash?: string;
  verificationUrl?: string;
  error?: string;
}

