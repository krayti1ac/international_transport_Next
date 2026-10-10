'use server';

/**
 * Trans Bodanon TMS — Insurance Claim Dossier & e-POD Dispatch Server Actions
 * Standards: ATP Treaty / INCOTERMS 2020 / EU GDP Guidelines (2013/C 343/01)
 */

import {
  dispatchInsuranceClaimSchema,
  type DispatchInsuranceClaimInput,
  type InsuranceDispatchResult,
} from '../types/insurance-dispatch.types';
import {
  dispatchInsuranceClaimDossier,
  getInsuranceDispatchHistory,
} from './insurance-dossier-dispatcher.service';

export async function dispatchInsuranceClaimAction(
  rawInput: DispatchInsuranceClaimInput
): Promise<{
  success: boolean;
  data?: InsuranceDispatchResult;
  error?: string;
}> {
  try {
    const parsed = dispatchInsuranceClaimSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
      };
    }

    const result = await dispatchInsuranceClaimDossier(parsed.data);

    if (!result.success) {
      return {
        success: false,
        data: result,
        error: result.errorMessage || 'Dispatch failed on selected channel(s)',
      };
    }

    return {
      success: true,
      data: result,
    };
  } catch (err) {
    console.error('[dispatchInsuranceClaimAction Error]:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown server error during dispatch',
    };
  }
}

export async function getInsuranceDispatchHistoryAction(
  claimReference: string
): Promise<{
  success: boolean;
  data: InsuranceDispatchResult[];
  error?: string;
}> {
  try {
    if (!claimReference) {
      return { success: false, data: [], error: 'Claim reference is required' };
    }
    const history = await getInsuranceDispatchHistory(claimReference);
    return { success: true, data: history };
  } catch (err) {
    console.error('[getInsuranceDispatchHistoryAction Error]:', err);
    return {
      success: false,
      data: [],
      error: err instanceof Error ? err.message : 'Failed to retrieve dispatch history',
    };
  }
}

