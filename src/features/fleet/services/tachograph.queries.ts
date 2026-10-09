/**
 * Trans Bodanon TMS — Tachograph React Query Keys & Hooks
 */

export const tachographKeys = {
  all: ['tachograph'] as const,
  radar: () => [...tachographKeys.all, 'radar'] as const,
  radarFiltered: (status?: string, search?: string) =>
    [...tachographKeys.radar(), { status, search }] as const,
  driverRadar: (driverId: number) => [...tachographKeys.all, 'driver', driverId] as const,
  driverLogs: (driverId: number) => [...tachographKeys.all, 'logs', driverId] as const,
};

