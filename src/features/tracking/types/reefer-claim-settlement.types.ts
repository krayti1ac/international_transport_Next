/**
 * Trans Bodanon TMS — Reefer Cargo Loss & Insurance Claim Settlement Engine Types
 * Standards: ATP Treaty / INCOTERMS 2020 / EU GDP Guidelines (2013/C 343/01)
 */

import { z } from 'zod';
import type { CargoCategory } from './multi-temp.types';

export type { CargoCategory };

export type ClaimStatus =
  | 'draft'
  | 'under_review'
  | 'approved_by_insurer'
  | 'settled'
  | 'rejected';

export type SettlementType = 'credit_note' | 'cash_payout' | 'insurance_wire';

export interface ReeferClaimSettlementLine {
  id: string;
  claimId: string;
  itemDescription: string;
  affectedQuantity: number;
  unitOfMeasure: string; // 'kg' | 'pallet' | 'box' | 'ton'
  unitValue: number;
  depreciationPct: number;
  lineLossAmount: number;
  createdAt?: string;
}

export interface ReeferCargoInsuranceClaim {
  id: string;
  claimReference: string;
  annexId?: string | null;
  tripId: number;
  tripNumber: string;
  truckPlate: string;
  driverName: string;
  cargoCategory: CargoCategory;
  insuredCargoValue: number;
  currency: string;
  depreciationRatePct: number;
  grossLossAmount: number;
  deductibleAmount: number;
  netIndemnityAmount: number;
  insurerName: string;
  policyNumber: string;
  claimStatus: ClaimStatus;
  settlementType: SettlementType;
  creditNoteNumber?: string | null;
  claimDossierHash: string; // HMAC-SHA256 seal
  lines: ReeferClaimSettlementLine[];
  settledAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CargoDepreciationResult {
  depreciationRatePct: number;
  isTotalLoss: boolean;
  grossLossAmount: number;
  deductibleAmount: number;
  netIndemnityAmount: number;
  explanation: string;
}

export const calculateDepreciationSchema = z.object({
  cargoCategory: z.enum([
    'deep_frozen',
    'fresh_produce',
    'pharma_cold',
    'meat_chilled',
  ]).default('fresh_produce'),
  durationMinutes: z.number().min(0),
  tempRiseDeltaC: z.number().min(0),
  maxAllowedTempC: z.number(),
  tempAtCloseC: z.number(),
  mktElevationC: z.number().min(0).default(0),
  insuredCargoValue: z.number().min(0),
  deductibleAmount: z.number().min(0).default(0),
});

export type CalculateDepreciationInput = z.input<typeof calculateDepreciationSchema>;

export const createInsuranceClaimSchema = z.object({
  tripId: z.number().int().positive(),
  tripNumber: z.string().min(1),
  truckPlate: z.string().min(1),
  driverName: z.string().min(1),
  annexId: z.string().optional().nullable(),
  cargoCategory: z.enum([
    'deep_frozen',
    'fresh_produce',
    'pharma_cold',
    'meat_chilled',
  ]).default('fresh_produce'),
  insuredCargoValue: z.number().positive(),
  currency: z.string().default('MAD'),
  deductibleAmount: z.number().min(0).default(5000),
  durationMinutes: z.number().min(0),
  tempRiseDeltaC: z.number().min(0),
  maxAllowedTempC: z.number(),
  tempAtCloseC: z.number(),
  mktElevationC: z.number().min(0).default(0),
  insurerName: z.string().default('Allianz Maroc / RMA Watanya'),
  policyNumber: z.string().default('POL-FRIGO-2026-TANGIER'),
  settlementType: z.enum(['credit_note', 'cash_payout', 'insurance_wire']).default('credit_note'),
  lines: z.array(
    z.object({
      itemDescription: z.string().min(1),
      affectedQuantity: z.number().positive(),
      unitOfMeasure: z.string().default('kg'),
      unitValue: z.number().positive(),
      depreciationPct: z.number().min(0).max(100),
    })
  ).optional().default([]),
  notes: z.string().optional(),
});

export type CreateInsuranceClaimInput = z.input<typeof createInsuranceClaimSchema>;

export const updateClaimStatusSchema = z.object({
  claimId: z.string().min(1),
  status: z.enum(['draft', 'under_review', 'approved_by_insurer', 'settled', 'rejected']),
  creditNoteNumber: z.string().optional(),
  notes: z.string().optional(),
});

export type UpdateClaimStatusInput = z.infer<typeof updateClaimStatusSchema>;

export const queryReeferClaimsSchema = z.object({
  tripId: z.number().int().positive().optional(),
  status: z.enum(['draft', 'under_review', 'approved_by_insurer', 'settled', 'rejected']).optional(),
  cargoCategory: z.enum(['deep_frozen', 'fresh_produce', 'pharma_cold', 'meat_chilled']).optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export type QueryReeferClaimsInput = z.infer<typeof queryReeferClaimsSchema>;

