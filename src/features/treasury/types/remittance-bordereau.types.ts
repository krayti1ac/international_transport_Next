import { z } from 'zod';
import type { BillType } from './commercial-bills.types';

export type BordereauType = 'encaissement' | 'escompte';

export interface BordereauBillItem {
  id: string;
  billNumber: string;
  billType: BillType;
  clientName: string;
  issuerName?: string | null;
  drawerBankName: string;
  drawerBankRib: string;
  issueDate: string;
  dueDate: string;
  faceValue: number;
  daysToMaturity?: number;
  estimatedAgios?: number;
}

export interface BordereauCompanyHeader {
  name: string;
  ice?: string | null;
  rc?: string | null;
  ifNum?: string | null;
  tp?: string | null;
  address?: string | null;
  phone?: string | null;
}

export interface RemittanceBordereau {
  id: string;
  bordereauNumber: string;
  bordereauType: BordereauType;
  bankAccountId: number;
  bankAccountName: string;
  bankName: string;
  bankRib: string;
  totalFaceValue: number;
  billsCount: number;
  estimatedAgios: number;
  estimatedVat: number;
  estimatedNetProceeds: number;
  discountRate?: number;
  bankCommission?: number;
  remittanceDate: string;
  securityHash: string;
  qrCodeData?: string;
  bills: BordereauBillItem[];
  companyInfo?: BordereauCompanyHeader;
  notes?: string | null;
  createdAt: string;
}

export const generateBordereauSchema = z.object({
  bordereauType: z.enum(['encaissement', 'escompte']),
  bankAccountId: z.number().int().positive('حساب بنكي مطلوب'),
  billIds: z.array(z.string().uuid()).min(1, 'يجب تحديد ورقة تجارية واحدة على الأقل'),
  discountRate: z.number().min(0, 'معدل الخصم يجب أن يكون موجباً').optional().default(0),
  bankCommission: z.number().min(0, 'العمولة يجب أن تكون موجبة').optional().default(0),
  remittanceDate: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export type GenerateBordereauInput = z.input<typeof generateBordereauSchema>;
