import { useQuery } from '@tanstack/react-query';
import { getEmailMessagesAction } from './email.actions';
import type { EmailFilterParams, EmailMessage } from '../types/email.types';

export const emailKeys = {
  all: ['email_messages'] as const,
  lists: () => [...emailKeys.all, 'list'] as const,
  list: (filters?: EmailFilterParams) => [...emailKeys.lists(), filters] as const,
};

export function useEmailMessages(filters?: EmailFilterParams) {
  return useQuery<EmailMessage[], Error>({
    queryKey: emailKeys.list(filters),
    queryFn: async () => {
      const res = await getEmailMessagesAction(filters);
      if (!res.success) {
        throw new Error(res.error || 'فشل في جلب الرسائل');
      }
      return res.data || [];
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Periodic refresh every 1 minute
  });
}

