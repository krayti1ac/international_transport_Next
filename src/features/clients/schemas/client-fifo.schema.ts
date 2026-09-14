import { z } from 'zod';

export const FifoPaymentSchema = z.object({
  clientId: z.number().int().positive({ message: 'معرف العميل غير صالح' }),
  amount: z.number().positive({ message: 'يجب أن يكون المبلغ أكبر من الصفر' }),
  currency: z.enum(['MAD', 'EUR']).default('MAD'),
  paymentMethod: z.enum(['bank_transfer', 'check', 'cash']).default('bank_transfer'),
  destinationType: z.enum(['bank', 'cashbox']),
  destinationId: z.number().int().positive({ message: 'يرجى اختيار حساب أو صندوق الإيداع' }),
  reference: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export type FifoPaymentInput = z.infer<typeof FifoPaymentSchema>;

