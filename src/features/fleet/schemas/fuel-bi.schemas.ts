import { z } from 'zod';

export const filterFuelBiSchema = z.object({
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  truckId: z.number().optional().nullable(),
  driverId: z.number().optional().nullable(),
  corridorCode: z.string().optional().nullable(),
});

export type FilterFuelBiInput = z.infer<typeof filterFuelBiSchema>;

