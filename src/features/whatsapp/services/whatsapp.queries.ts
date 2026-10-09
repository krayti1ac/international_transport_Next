/**
 * Trans Bodanon TMS — WhatsApp React Query Keys & Fetchers
 */

import { getWhatsAppMessageLogsAction } from './whatsapp.actions';
import type { WhatsAppMessageLog } from '@/types/database';

export const whatsappKeys = {
  all: ['whatsapp'] as const,
  logs: () => [...whatsappKeys.all, 'logs'] as const,
};

export async function fetchWhatsAppLogs(limit: number = 25): Promise<WhatsAppMessageLog[]> {
  const result = await getWhatsAppMessageLogsAction(limit);
  if (!result.success || !result.logs) {
    return [];
  }
  return result.logs as unknown as WhatsAppMessageLog[];
}

