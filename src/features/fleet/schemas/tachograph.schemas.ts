/**
 * Trans Bodanon TMS — Tachograph Zod Schemas
 * Input validation for EU Regulation (EC) 561/2006 tachograph logging and radar queries.
 */

import { z } from 'zod';

export const tachographActivityTypeSchema = z.enum(['drive', 'rest', 'work', 'available']);

export const tachographRadarStatusSchema = z.enum(['compliant', 'warning', 'critical_urgency', 'violation']);

export const logDriverActivitySchema = z.object({
  driver_id: z.number().int().positive({ message: 'Driver ID is required' }),
  trip_id: z.number().int().positive().nullable().optional(),
  truck_id: z.number().int().positive().nullable().optional(),
  activity_type: tachographActivityTypeSchema,
  start_time: z.string().min(1, { message: 'Start time is required' }),
  end_time: z.string().nullable().optional(),
  duration_minutes: z.number().int().nonnegative().optional(),
  start_odometer: z.number().nonnegative().nullable().optional(),
  end_odometer: z.number().nonnegative().nullable().optional(),
  start_location: z.string().nullable().optional(),
  end_location: z.string().nullable().optional(),
  country_code: z.string().min(2).max(4).default('MA'),
  card_insertion_status: z.enum(['inserted', 'manual_entry', 'withdrawn']).default('inserted'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const tachographRadarFilterSchema = z.object({
  radar_status: z.enum(['all', 'compliant', 'warning', 'critical_urgency', 'violation']).default('all'),
  search: z.string().optional(),
});

export type LogDriverActivityInput = z.infer<typeof logDriverActivitySchema>;
export type TachographRadarFilterInput = z.infer<typeof tachographRadarFilterSchema>;

