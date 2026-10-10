'use server';

/**
 * Trans Bodanon TMS — Reefer Cargo Insurance Claim Server Actions
 * Standards: ATP Treaty / INCOTERMS 2020 / EU GDP Guidelines (2013/C 343/01)
 */

import {
  calculateDepreciationSchema,
  createInsuranceClaimSchema,
  queryReeferClaimsSchema,
  updateClaimStatusSchema,
  type CalculateDepreciationInput,
  type CargoDepreciationResult,
  type CreateInsuranceClaimInput,
  type QueryReeferClaimsInput,
  type ReeferCargoInsuranceClaim,
  type UpdateClaimStatusInput,
} from '../types/reefer-claim-settlement.types';
import { CargoLossAssessmentService } from './cargo-loss-assessment.service';

export interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Calculates real-time depreciation and net indemnity estimate without persisting
 */
export async function calculateCargoLossEstimateAction(
  rawInput: CalculateDepreciationInput
): Promise<ActionResponse<CargoDepreciationResult>> {
  try {
    const parsed = calculateDepreciationSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(', '),
      };
    }

    const result = CargoLossAssessmentService.calculateDepreciation(parsed.data);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[calculateCargoLossEstimateAction] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate cargo loss estimate',
    };
  }
}

/**
 * Creates and registers a new reefer cargo insurance claim dossier
 */
export async function createInsuranceClaimAction(
  rawInput: CreateInsuranceClaimInput
): Promise<ActionResponse<ReeferCargoInsuranceClaim>> {
  try {
    const parsed = createInsuranceClaimSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(', '),
      };
    }

    const claim = await CargoLossAssessmentService.processInsuranceClaim(parsed.data);

    return {
      success: true,
      data: claim,
    };
  } catch (error) {
    console.error('[createInsuranceClaimAction] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create insurance claim',
    };
  }
}

/**
 * Updates status of an existing claim (e.g. approve, settle, credit note issuance)
 */
export async function updateClaimStatusAction(
  rawInput: UpdateClaimStatusInput
): Promise<ActionResponse<ReeferCargoInsuranceClaim>> {
  try {
    const parsed = updateClaimStatusSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(', '),
      };
    }

    const claim = await CargoLossAssessmentService.updateClaimStatus(parsed.data);

    return {
      success: true,
      data: claim,
    };
  } catch (error) {
    console.error('[updateClaimStatusAction] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update claim status',
    };
  }
}

/**
 * Queries cargo insurance claims with summary stats
 */
export async function fetchReeferClaimsAction(
  rawQuery?: Partial<QueryReeferClaimsInput>
): Promise<ActionResponse<{ items: ReeferCargoInsuranceClaim[]; totalCount: number }>> {
  try {
    const parsed = queryReeferClaimsSchema.safeParse(rawQuery || {});
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(', '),
      };
    }

    const result = await CargoLossAssessmentService.queryClaims(parsed.data);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[fetchReeferClaimsAction] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch insurance claims',
    };
  }
}

