import { z } from 'zod';

export const recordTireInspectionSchema = z.object({
  tire_id: z.string().uuid('معرف الإطار غير صالح'),
  tread_depth_mm: z.number().min(0.5, 'عمق المداس لا يمكن أن يقل عن 0.5 مم').max(30.0, 'عمق المداس كبير جداً'),
  pressure_bar: z.number().min(3.0, 'الضغط منخفض جداً').max(15.0, 'الضغط مرتفع جداً'),
  temperature_c: z.number().min(-20.0).max(150.0),
  current_km: z.number().int().min(0, 'الكيلومترات يجب أن تكون موجبة'),
  notes: z.string().optional(),
});

export const rotateTireSchema = z.object({
  tire_id_1: z.string().uuid('معرف الإطار الأول مطلوب'),
  tire_id_2: z.string().uuid('معرف الإطار الثاني مطلوب'),
  reason: z.string().min(3, 'يرجى توضيح سبب تدوير الإطارات'),
});

export const mountTireSchema = z.object({
  serial_number: z.string().min(3, 'الرقم التسلسلي مطلوب'),
  brand: z.string().min(2, 'العلامة التجارية مطلوبة'),
  model: z.string().optional().nullable(),
  size: z.string().min(3).default('315/80R22.5'),
  vehicle_type: z.enum(['truck', 'trailer']).default('truck'),
  truck_id: z.number().optional().nullable(),
  trailer_id: z.number().optional().nullable(),
  axle_position: z.string().min(2, 'موضع المحور مطلوب'),
  initial_tread_depth_mm: z.number().min(5).max(25).default(16.0),
  purchase_cost_mad: z.number().min(100).default(4500.0),
  installed_km: z.number().min(0).default(0),
});

export const filterFleetTiresSchema = z.object({
  vehicle_type: z.enum(['all', 'truck', 'trailer']).default('all'),
  truck_id: z.number().optional(),
  trailer_id: z.number().optional(),
  status: z.enum(['all', 'mounted', 'in_stock', 'scrapped', 'retreaded']).default('mounted'),
  condition: z.enum(['all', 'optimal', 'good', 'warning', 'critical', 'legal_limit']).default('all'),
});

export type RecordTireInspectionInput = z.infer<typeof recordTireInspectionSchema>;
export type RotateTireInput = z.infer<typeof rotateTireSchema>;
export type MountTireInput = z.input<typeof mountTireSchema>;
export type FilterFleetTiresInput = z.input<typeof filterFleetTiresSchema>;
