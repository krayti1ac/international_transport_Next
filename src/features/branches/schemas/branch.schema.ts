import { z } from 'zod';

export const branchSchema = z.object({
  name: z.string().min(2, 'اسم الفرع يجب أن يحتوي على حرفين على الأقل').max(150),
  code: z
    .string()
    .min(2, 'رمز الفرع يجب ألا يقل عن حرفين')
    .max(50)
    .regex(/^[A-Za-z0-9_-]+$/, 'رمز الفرع يجب أن يحتوي فقط على حروف إنجليزية، أرقام، أو شرطات')
    .transform((val) => val.toUpperCase()),
  country: z.enum(['MA', 'ES', 'FR']).default('MA'),
  city: z.string().min(2, 'المدينة مطلوبة').max(100),
  address: z.string().max(300).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email('صيغة البريد الإلكتروني غير صالحة').optional().nullable().or(z.literal('')),
  is_headquarters: z.boolean().default(false),
  is_active: z.boolean().default(true),
  default_cash_box_id: z.number().optional().nullable(),
});

export type BranchFormData = z.infer<typeof branchSchema>;

