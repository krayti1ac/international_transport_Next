/**
 * Trans Bodanon TMS — Dock Thermal Heatmap & Excursion Risk Radar Types
 * Regulatory Standards: EU GDP (2013/C 343/01) / EN 12830 / ATP Treaty (FRC)
 */

import { z } from 'zod';

export type DockRiskLevel = 'safe' | 'monitored' | 'critical';

export type DockWatchStatus = 'normal' | 'monitored' | 'blacklisted';

export interface DockThermalMetrics {
  totalArrivals: number;
  excursionCount: number;
  excursionFrequencyPercent: number; // calculated via Decimal.js
  avgUnloadingMins: number; // calculated via Decimal.js
  peakDeviationC: number; // max positive deviation in °C
  avgThermalShockDeltaC: number; // T_dock - T_setpoint
  dviScore: number; // Dock Vulnerability Index: 0.00 to 100.00
}

export interface CompartmentThermalImpact {
  compartment: 'C1' | 'C2' | 'C3';
  cargoTypeKey: string;
  setpointTempC: number;
  avgExcursionTempC: number;
  riskProbability: 'low' | 'moderate' | 'high';
}

export interface DockRiskCluster {
  dockId: string;
  dockName: string;
  facilityOrPort: string;
  city: string;
  countryCode: string; // 'MA' | 'ES' | 'FR' | etc.
  coordinates: {
    lat: number;
    lng: number;
  };
  riskLevel: DockRiskLevel;
  watchStatus: DockWatchStatus;
  metrics: DockThermalMetrics;
  intensityWeight: number; // 0.00 to 1.00 for heatmap rendering
  compartmentImpacts: CompartmentThermalImpact[];
  recommendedProtocols: string[];
  lastArrivalTimestamp: string;
  flaggedReason?: string | null;
}

export interface DockHeatmapSummaryKpi {
  totalDocksAnalyzed: number;
  criticalHotspotsCount: number;
  monitoredDocksCount: number;
  safeDocksCount: number;
  overallAverageDvi: number;
  worstDviDock: {
    dockId: string;
    dockName: string;
    dviScore: number;
  } | null;
  coldChainPreservationPercent: number;
}

export const dockRiskQuerySchema = z.object({
  minDvi: z.number().min(0).max(100).optional(),
  riskLevel: z.enum(['all', 'safe', 'monitored', 'critical']).default('all'),
  countryCode: z.string().optional(),
  search: z.string().optional(),
});

export type DockRiskQueryFilter = z.infer<typeof dockRiskQuerySchema>;

export const flagDockSchema = z.object({
  dockId: z.string().min(1, 'Dock ID is required'),
  watchStatus: z.enum(['normal', 'monitored', 'blacklisted']),
  reason: z.string().min(3, 'Reason must be at least 3 characters'),
});

export type FlagDockInput = z.infer<typeof flagDockSchema>;

