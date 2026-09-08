import { z } from 'zod';

export const createCompanySchema = z.object({
  name: z.string().trim().min(2, 'اسم الشركة مطلوب ويجب أن يحتوي على حرفين على الأقل'),
  ice: z.string().trim().optional().nullable(),
  currency: z.string().min(1, 'العملة الافتراضية مطلوبة').default('MAD'),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

