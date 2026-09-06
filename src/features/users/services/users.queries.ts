'use client';

import { useQuery } from '@tanstack/react-query';
import { getUsersAction } from './users.actions';
import { DEFAULT_USERS, fallbackArray } from '@/lib/default-data';
import type { User } from '@/types/database';

export const usersKeys = {
  all: ['users'] as const,
  list: () => [...usersKeys.all, 'list'] as const,
};

export function useUsersQuery() {
  return useQuery<User[]>({
    queryKey: usersKeys.list(),
    queryFn: async () => {
      const res = await getUsersAction();
      if (!res.success || !res.data || res.data.length === 0) {
        return DEFAULT_USERS;
      }
      return fallbackArray(res.data, DEFAULT_USERS);
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

