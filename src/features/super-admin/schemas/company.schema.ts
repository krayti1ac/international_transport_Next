import { z } from 'zod';

export const createCompanySchema = z.object({
  name: z.string().trim().min(2, 'اسم الشركة مطلوب ويجب أن يحتوي على حرفين على الأقل'),
  ice: z.string().trim().optional().nullable(),
  currency: z.string().min(1, 'العملة الافتراضية مطلوبة').default('MAD'),
  subscription_cost: z.coerce.number().min(0, 'تكلفة الاشتراك يجب أن تكون صفراً أو أكثر').default(0),
  subscription_start_date: z.string().optional().nullable(),
  subscription_end_date: z.string().optional().nullable(),
  max_devices: z.coerce.number().int().min(1, 'الحد الأدنى للأجهزة هو جهاز واحد').default(5),
  email_domain: z.string().trim().optional().nullable(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

export const updateCompanySchema = z.object({
  id: z.number().int().positive('معرف الشركة غير صالح'),
  name: z.string().trim().min(2, 'اسم الشركة مطلوب ويجب أن يحتوي على حرفين على الأقل'),
  ice: z.string().trim().optional().nullable(),
  currency: z.string().min(1, 'العملة الافتراضية مطلوبة').default('MAD'),
  subscription_cost: z.coerce.number().min(0, 'تكلفة الاشتراك يجب أن تكون صفراً أو أكثر').default(0),
  subscription_start_date: z.string().optional().nullable(),
  subscription_end_date: z.string().optional().nullable(),
  max_devices: z.coerce.number().int().min(1, 'الحد الأدنى للأجهزة هو جهاز واحد').default(5),
  email_domain: z.string().trim().optional().nullable(),
  is_active: z.boolean().optional(),
});

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

