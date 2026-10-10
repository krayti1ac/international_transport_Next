'use server';

/**
 * Trans Bodanon TMS — Dock Thermal Loss & e-POD Incident Annex Server Actions
 * Standards: EU GDP (2013/C 343/01) / EN 12830 / ATP Agreement (FRC)
 */

import {
  attachThermalAnnexToEpodSchema,
  logDockDoorCycleSchema,
  queryDockThermalLossSchema,
  type AttachThermalAnnexToEpodInput,
  type EpodColdChainIncidentAnnex,
  type LogDockDoorCycleInput,
  type QueryDockThermalLossInput,
} from '../types/thermal-loss-tracker.types';
import { DockThermalLossService } from './dock-thermal-loss.service';

export interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Logs a dock door open/close cycle, computes thermal loss metrics, and creates the e-POD Incident Annex
 */
export async function logDockDoorCycleAction(
  rawInput: LogDockDoorCycleInput
): Promise<ActionResponse<EpodColdChainIncidentAnnex>> {
  try {
    const parsed = logDockDoorCycleSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(', '),
      };
    }

    const annex = await DockThermalLossService.processDockDoorCycle(parsed.data);

    return {
      success: true,
      data: annex,
    };
  } catch (error) {
    console.error('[logDockDoorCycleAction] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to log dock door cycle',
    };
  }
}

/**
 * Attaches receiver and driver digital signatures to an existing Thermal Incident Annex
 */
export async function attachThermalAnnexToEpodAction(
  rawInput: AttachThermalAnnexToEpodInput
): Promise<ActionResponse<EpodColdChainIncidentAnnex>> {
  try {
    const parsed = attachThermalAnnexToEpodSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(', '),
      };
    }

    const annex = await DockThermalLossService.attachSignaturesToAnnex(parsed.data);

    return {
      success: true,
      data: annex,
    };
  } catch (error) {
    console.error('[attachThermalAnnexToEpodAction] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to attach thermal annex to e-POD',
    };
  }
}

/**
 * Queries recorded dock thermal loss annexes
 */
export async function queryDockThermalLossAnnexesAction(
  rawQuery?: Partial<QueryDockThermalLossInput>
): Promise<ActionResponse<{ items: EpodColdChainIncidentAnnex[]; totalCount: number }>> {
  try {
    const parsed = queryDockThermalLossSchema.safeParse(rawQuery || {});
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(', '),
      };
    }

    const result = await DockThermalLossService.queryAnnexes(parsed.data);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('[queryDockThermalLossAnnexesAction] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to query thermal annexes',
    };
  }
}

