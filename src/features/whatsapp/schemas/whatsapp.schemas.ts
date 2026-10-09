import { z } from 'zod';

export const phoneSchema = z.string().min(6, 'رقم الهاتف قصير جداً').max(20, 'رقم الهاتف طويل جداً');

export const sendWhatsAppTextSchema = z.object({
  to: phoneSchema,
  message: z.string().min(1, 'نص الرسالة مطلوب').max(4096, 'نص الرسالة يتجاوز الحد المسموح'),
  clientId: z.number().optional(),
});

export const sendInteractiveButtonsSchema = z.object({
  to: phoneSchema,
  body: z.string().min(1, 'محتوى الرسالة مطلوب').max(1024, 'نص الرسالة يتجاوز 1024 حرفاً'),
  headerText: z.string().max(60, 'العنوان لا يجب أن يتجاوز 60 حرفاً').optional(),
  footerText: z.string().max(60, 'التذييل لا يجب أن يتجاوز 60 حرفاً').optional(),
  buttons: z
    .array(
      z.object({
        id: z.string().min(1).max(256),
        title: z.string().min(1).max(20, 'عنوان الزر لا يجب أن يتجاوز 20 حرفاً'),
      })
    )
    .min(1, 'يجب توفير زر واحد على الأقل')
    .max(3, 'الحد الأقصى هو 3 أزرار'),
});

export const sendInteractiveListSchema = z.object({
  to: phoneSchema,
  body: z.string().min(1).max(1024),
  buttonText: z.string().min(1).max(20),
  headerText: z.string().max(60).optional(),
  footerText: z.string().max(60).optional(),
  sections: z
    .array(
      z.object({
        title: z.string().min(1).max(24),
        rows: z
          .array(
            z.object({
              id: z.string().min(1).max(200),
              title: z.string().min(1).max(24),
              description: z.string().max(72).optional(),
            })
          )
          .min(1)
          .max(10),
      })
    )
    .min(1)
    .max(10),
});

export const triggerAutomatedTripDispatchSchema = z.object({
  tripId: z.number().positive(),
  sendToClient: z.boolean().default(true),
  sendToDriver: z.boolean().default(true),
  customNote: z.string().optional(),
});

export const triggerAutomatedInvoiceReminderSchema = z.object({
  invoiceId: z.number().positive(),
  includePaymentLink: z.boolean().default(true),
  customMessage: z.string().optional(),
});

export const simulateWebhookEventSchema = z.object({
  fromPhone: phoneSchema,
  messageType: z.enum(['text', 'interactive_button', 'interactive_list', 'location']),
  textBody: z.string().optional(),
  buttonId: z.string().optional(),
  buttonTitle: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

