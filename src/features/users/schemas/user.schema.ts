import { z } from 'zod';

export const userRoleSchema = z.enum(['super_admin', 'admin', 'secretary', 'driver']);

export const createUserSchema = z.object({
  name: z.string().min(2, 'الاسم يجب أن يحتوي على حرفين على الأقل'),
  email: z.string().min(1, 'البريد الإلكتروني أو اسم المستخدم مطلوب'),
  role: userRoleSchema,
  password: z.string().min(6, 'كلمة المرور يجب أن لا تقل عن 6 أحرف'),
  preferred_language: z.enum(['ar', 'fr', 'es']).optional().default('ar'),
  company_id: z.number().optional(),
  avatar_url: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});

export const updateUserSchema = z.object({
  id: z.string().min(1, 'معرف المستخدم مطلوب'),
  name: z.string().min(2, 'الاسم يجب أن يحتوي على حرفين على الأقل'),
  email: z.string().min(1, 'البريد الإلكتروني أو اسم المستخدم مطلوب').optional(),
  role: userRoleSchema,
  password: z.string().min(6, 'كلمة المرور يجب أن لا تقل عن 6 أحرف').optional().or(z.literal('')),
  preferred_language: z.enum(['ar', 'fr', 'es']).optional(),
  company_id: z.number().optional(),
  avatar_url: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});

export const signupDriverSchema = z
  .object({
    name: z.string().trim().min(2, 'الاسم مطلوب ويجب أن يحتوي على حرفين على الأقل'),
    email: z.string().trim().email('البريد الإلكتروني غير صالح'),
    password: z.string().min(6, 'كلمة المرور يجب أن لا تقل عن 6 أحرف'),
    confirmPassword: z.string().min(6, 'تأكيد كلمة المرور مطلوب'),
    deviceId: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'كلمة المرور وتأكيدها غير متطابقين',
    path: ['confirmPassword'],
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type SignupDriverInput = z.infer<typeof signupDriverSchema>;

