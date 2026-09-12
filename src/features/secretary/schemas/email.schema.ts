import { z } from 'zod';

export const sendSecretaryEmailSchema = z.object({
  to: z.string().email('البريد الإلكتروني للجهة المستلمة غير صالح'),
  subject: z.string().min(1, 'موضوع البريد مطلوب').max(200, 'موضوع البريد طويل جداً'),
  body: z.string().min(1, 'نص الرسالة مطلوب'),
  tripId: z.number().int().positive().nullable().optional(),
});

export type SendSecretaryEmailInput = z.infer<typeof sendSecretaryEmailSchema>;

export const markEmailReadSchema = z.object({
  id: z.number().int().positive(),
  isRead: z.boolean(),
});

export const linkEmailTripSchema = z.object({
  emailId: z.number().int().positive(),
  tripId: z.number().int().positive().nullable(),
});

