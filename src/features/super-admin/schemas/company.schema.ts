import { z } from 'zod';

export const mailProviderEnum = z.enum(['cpanel', 'hostinger', 'ovh', 'custom']);
export type MailProvider = z.infer<typeof mailProviderEnum>;

export const createCompanySchema = z.object({
  name: z.string().trim().min(2, 'اسم الشركة مطلوب ويجب أن يحتوي على حرفين على الأقل'),
  ice: z.string().trim().optional().nullable(),
  currency: z.string().min(1, 'العملة الافتراضية مطلوبة').default('MAD'),
  subscription_cost: z.coerce.number().min(0, 'تكلفة الاشتراك يجب أن تكون صفراً أو أكثر').default(0),
  subscription_start_date: z.string().optional().nullable(),
  subscription_end_date: z.string().optional().nullable(),
  max_devices: z.coerce.number().int().min(1, 'الحد الأدنى للأجهزة هو جهاز واحد').default(5),
  email_domain: z
    .string()
    .trim()
    .transform((val) => val.replace(/^@+/, ''))
    .refine((val) => val.length >= 3, 'نطاق البريد الإلكتروني للمؤسسة مطلوب (مثال: domain.com)')
    .refine(
      (val) => /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val),
      'صيغة نطاق البريد غير صالحة، يجب أن ينتهي بنطاق مثل .com أو .ma'
    ),
  mail_provider: mailProviderEnum.default('cpanel').optional(),
  smtp_host: z.string().trim().optional().nullable(),
  smtp_port: z.coerce.number().int().min(1).max(65535).default(465).optional().nullable(),
  imap_host: z.string().trim().optional().nullable(),
  imap_port: z.coerce.number().int().min(1).max(65535).default(993).optional().nullable(),
  email_user: z.string().trim().optional().nullable(),
  email_password: z.string().trim().optional().nullable(),
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
  email_domain: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val ? val.replace(/^@+/, '') : val))
    .refine(
      (val) => !val || /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val),
      'صيغة نطاق البريد غير صالحة، يجب أن ينتهي بنطاق مثل .com أو .ma'
    ),
  is_active: z.boolean().optional(),
  mail_provider: mailProviderEnum.optional(),
  smtp_host: z.string().trim().optional().nullable(),
  smtp_port: z.coerce.number().int().min(1).max(65535).optional().nullable(),
  imap_host: z.string().trim().optional().nullable(),
  imap_port: z.coerce.number().int().min(1).max(65535).optional().nullable(),
  email_user: z.string().trim().optional().nullable(),
  email_password: z.string().trim().optional().nullable(),
});

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

export const testEmailConnectionSchema = z.object({
  companyId: z.number().int().positive().optional().nullable(),
  mail_provider: mailProviderEnum.default('cpanel'),
  smtp_host: z.string().trim().min(1, 'عنوان خادم SMTP مطلوب'),
  smtp_port: z.coerce.number().int().min(1).max(65535).default(465),
  imap_host: z.string().trim().optional().nullable(),
  imap_port: z.coerce.number().int().min(1).max(65535).default(993).optional().nullable(),
  email_user: z.string().trim().min(1, 'البريد الإلكتروني مطلوب'),
  email_password: z.string().trim().optional().nullable(),
});

export type TestEmailConnectionInput = z.infer<typeof testEmailConnectionSchema>;

export const updateCompanyEmailSettingsSchema = z.object({
  companyId: z.number().int().positive('معرف الشركة مطلوب'),
  mail_provider: mailProviderEnum.default('cpanel'),
  smtp_host: z.string().trim().optional().nullable(),
  smtp_port: z.coerce.number().int().min(1).max(65535).default(465).optional().nullable(),
  imap_host: z.string().trim().optional().nullable(),
  imap_port: z.coerce.number().int().min(1).max(65535).default(993).optional().nullable(),
  email_user: z.string().trim().optional().nullable(),
  email_password: z.string().trim().optional().nullable(),
});

export type UpdateCompanyEmailSettingsInput = z.infer<typeof updateCompanyEmailSettingsSchema>;
