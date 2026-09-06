import { z } from 'zod';

export const userRoleSchema = z.enum(['admin', 'secretary', 'driver']);

export const createUserSchema = z.object({
  name: z.string().min(2, 'الاسم يجب أن يحتوي على حرفين على الأقل'),
  email: z.string().email('صيغة البريد الإلكتروني غير صحيحة'),
  role: userRoleSchema,
  password: z.string().min(6, 'كلمة المرور يجب أن لا تقل عن 6 أحرف'),
  preferred_language: z.enum(['ar', 'fr']).optional().default('ar'),
});

export const updateUserSchema = z.object({
  id: z.string().min(1, 'معرف المستخدم مطلوب'),
  name: z.string().min(2, 'الاسم يجب أن يحتوي على حرفين على الأقل'),
  role: userRoleSchema,
  password: z.string().min(6, 'كلمة المرور يجب أن لا تقل عن 6 أحرف').optional().or(z.literal('')),
  preferred_language: z.enum(['ar', 'fr']).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

