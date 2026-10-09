import { z } from 'zod';

export const freezeFrameDataSchema = z.object({
  engine_rpm: z.number().optional(),
  coolant_temp_c: z.number().optional(),
  oil_pressure_kpa: z.number().optional(),
  vehicle_speed_kmh: z.number().optional(),
  fuel_rail_pressure_bar: z.number().optional(),
  intake_air_temp_c: z.number().optional(),
  battery_voltage: z.number().optional(),
  def_adblue_level_pct: z.number().optional(),
  ambient_temp_c: z.number().optional(),
  engine_load_pct: z.number().optional(),
});

export const ingestDtcFaultSchema = z.object({
  truck_id: z.number().int().positive('معرف الشاحنة مطلوب'),
  driver_id: z.string().uuid().optional().nullable(),
  trip_id: z.number().int().positive().optional().nullable(),
  dtc_code: z.string().min(3, 'رمز العطل قصير جداً').max(20),
  dtc_standard: z.enum(['SAE_J1939', 'SAE_J2012', 'OBD_II']).default('SAE_J1939'),
  mil_status: z.boolean().default(false),
  gps_latitude: z.number().optional().nullable(),
  gps_longitude: z.number().optional().nullable(),
  location_name: z.string().optional().nullable(),
  target_corridor: z.enum(['MA-ES-FR', 'MA-MR-SN', 'DOMESTIC', 'ALL']).default('DOMESTIC'),
  freeze_frame: freezeFrameDataSchema.optional(),
});

export const filterObdRadarSchema = z.object({
  truck_id: z.number().optional(),
  severity: z.enum(['critical', 'moderate', 'minor', 'informational', 'all']).default('all'),
  status: z.enum(['active', 'investigating', 'resolved', 'ignored', 'all']).default('all'),
  corridor: z.string().default('ALL'),
});

export const resolveDtcFaultSchema = z.object({
  event_id: z.string().uuid('معرف الواقعة غير صالح'),
  resolution_notes: z.string().min(3, 'يرجى إدخال ملاحظات معالجة العطل'),
  create_maintenance_schedule: z.boolean().default(false),
});

export const scheduleFromRecommendationSchema = z.object({
  recommendation_id: z.string().uuid('معرف التوصية غير صالح'),
  scheduled_date: z.string().min(10, 'التاريخ المجدول مطلوب'),
});

export type IngestDtcFaultInput = z.input<typeof ingestDtcFaultSchema>;
export type FilterObdRadarInput = z.input<typeof filterObdRadarSchema>;
export type ResolveDtcFaultInput = z.infer<typeof resolveDtcFaultSchema>;
export type ScheduleFromRecommendationInput = z.infer<typeof scheduleFromRecommendationSchema>;
