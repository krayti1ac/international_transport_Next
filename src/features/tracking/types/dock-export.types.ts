/**
 * Trans Bodanon TMS — Monthly Dock Arrivals & Cold-Chain Compliance Export Types
 * Standards: EN 12830 / ATP Treaty (FRC / FRA) / EU GDP Guidelines 2013/C 343/01
 */

import { z } from 'zod';
import type { DockArrivalDispatchItem } from './dock-dispatch-audit.types';

export const monthlyDockExportSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'صيغة الشهر يجب أن تكون YYYY-MM (مثال: 2026-10)'),
  zoneName: z.string().trim().optional(),
  compartmentCode: z.enum(['ALL', 'C1', 'C2', 'C3']).default('ALL').optional(),
  dispatchStatus: z.enum(['ALL', 'delivered', 'sent', 'cooldown_skipped', 'simulated', 'failed']).default('ALL').optional(),
  locale: z.enum(['ar', 'fr', 'es']).default('ar').optional(),
  format: z.enum(['excel', 'pdf']).default('excel'),
});

export type MonthlyDockExportFilter = z.infer<typeof monthlyDockExportSchema>;

export interface MonthlyCompartmentKpi {
  code: string;
  name: string;
  category: string;
  totalArrivals: number;
  compliantCount: number;
  warningCount: number;
  breachedCount: number;
  avgMktTempC: number;
  complianceRatePct: number;
}

export interface MonthlyDockSummaryKpi {
  month: string;
  reportPeriodName: string;
  totalArrivals: number;
  totalDispatches: number;
  successfulDispatches: number;
  cooldownProtected: number;
  overallComplianceRatePct: number;
  avgMktTempC: number;
  topDocks: { zoneName: string; count: number }[];
  compartmentsBreakdown: {
    C1: MonthlyCompartmentKpi;
    C2: MonthlyCompartmentKpi;
    C3: MonthlyCompartmentKpi;
  };
}

export interface MonthlyDockReportContext {
  company: {
    name: string;
    ice?: string;
    address?: string;
    phone?: string;
    email?: string;
    licenseAtp?: string;
  };
  filter: MonthlyDockExportFilter;
  summary: MonthlyDockSummaryKpi;
  arrivals: DockArrivalDispatchItem[];
  verificationHash: string;
  verificationUrl: string;
  generatedAt: string;
  generatedBy: string;
  locale: 'ar' | 'fr' | 'es';
}

export interface DockExportResult {
  success: boolean;
  format: 'excel' | 'pdf';
  filename: string;
  mimeType: string;
  content: string; // XML spreadsheet or printable HTML
  verificationHash: string;
  verificationUrl: string;
  error?: string;
}

