import { z } from 'zod';
import Decimal from 'decimal.js';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export const saveDriverSchema = z.object({
  id: z.number().optional(),
  name: z.string().trim().min(2, 'الاسم يجب أن يحتوي على حرفين على الأقل'),
  phone: z.string().trim().min(5, 'رقم الهاتف مطلوب'),
  license: z.string().trim().min(2, 'رقم رخصة السياقة مطلوب'),
  base_salary: z
    .union([z.number(), z.string()])
    .transform((val) => new Decimal(val || 0).toNumber())
    .default(0),
  bonus_percentage: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => new Decimal(val || 0).toNumber())
    .default(0),
  status: z.string().default('active'),
  default_truck_id: z.number().nullable().optional(),
  visa_number: z.string().trim().nullable().optional(),
  visa_expiry_date: z.string().nullable().optional(),
  has_valid_visa: z.boolean().optional(),
  photo_url: z.string().nullable().optional(),
  // User account options
  create_user_account: z.boolean().optional().default(true),
  username: z.string().trim().optional(),
  password: z.string().min(6, 'كلمة المرور يجب أن لا تقل عن 6 أحرف').optional().or(z.literal('')),
});

export type SaveDriverInput = z.infer<typeof saveDriverSchema>;

