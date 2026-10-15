/**
 * Trans Bodanon TMS — Groupage Split-Billing & Cost Allocation Types
 * Precision: Strict Decimal.js computations on multi-consignment P&L and shared operating costs.
 */

import { z } from 'zod';

export type CostAllocationMode = 'chargeable_weight' | 'ldm';

export interface TripOperatingCosts {
  fuelCost: number;
  ferryCost: number;
  tollsCost: number;
  customsCost: number;
  driverCost: number;
  totalSharedCost: number;
  currency: string;
}

export interface ConsignmentAllocationItem {
  consignmentId: string;
  consignmentReference: string;
  clientId?: number | string | null;
  clientName: string;
  cargoDescription: string;
  revenue: number;
  chargeableWeightKg: number;
  ldmMeters: number;
  shareRatioPct: number;
  allocatedCost: number;
  netMargin: number;
  profitMarginPct: number;
  isProfitable: boolean;
  invoiceId?: number | null;
  invoiceNumber?: string | null;
  invoicedAt?: string | null;
  isInvoiced: boolean;
  currency: string;
}

export interface GroupageTripPnlSummary {
  tripId: number;
  allocationMode: CostAllocationMode;
  operatingCosts: TripOperatingCosts;
  totalRevenue: number;
  totalAllocatedCost: number;
  totalNetProfit: number;
  overallProfitMarginPct: number;
  isProfitable: boolean;
  consignmentsCount: number;
  invoicedCount: number;
  currency: string;
  items: ConsignmentAllocationItem[];
  allocatedAt: string;
}

export const allocateGroupageCostsSchema = z.object({
  tripId: z.number().int().positive({ message: 'Valid trip ID is required' }),
  allocationMode: z.enum(['chargeable_weight', 'ldm']).default('chargeable_weight'),
  fuelCost: z.number().min(0).optional(),
  ferryCost: z.number().min(0).optional(),
  tollsCost: z.number().min(0).optional(),
  customsCost: z.number().min(0).optional(),
  driverCost: z.number().min(0).optional(),
});

export type AllocateGroupageCostsInput = z.input<typeof allocateGroupageCostsSchema>;

export const generateConsignmentInvoicesSchema = z.object({
  tripId: z.number().int().positive({ message: 'Valid trip ID is required' }),
  consignmentIds: z.array(z.string().min(1)).optional(),
  paymentDueDays: z.number().int().positive().optional().default(30),
  forceRecreate: z.boolean().optional().default(false),
});

export type GenerateConsignmentInvoicesInput = z.input<typeof generateConsignmentInvoicesSchema>;


