/**
 * Trans Bodanon TMS — ESG Carbon React Query Keys & Fetchers
 */

import { getTripCarbonAuditAction } from './carbon-audit.actions';
import type { TripCarbonAudit } from '@/types/database';

export const esgCarbonKeys = {
  all: ['esg_carbon'] as const,
  audits: () => [...esgCarbonKeys.all, 'audits'] as const,
  byTrip: (tripId: number) => [...esgCarbonKeys.audits(), tripId] as const,
};

export async function fetchTripCarbonAudit(tripId: number): Promise<TripCarbonAudit | null> {
  const res = await getTripCarbonAuditAction(tripId);
  if (!res.success || !res.audit) {
    return null;
  }
  return res.audit as unknown as TripCarbonAudit;
}

