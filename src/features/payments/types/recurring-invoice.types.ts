/**
 * Trans Bodanon TMS — Automated Recurring Invoices Types
 * Long-Term Commercial Contracts & Periodic Transport Billing Engine
 */

import type { PaymentCurrency, PaymentGateway } from './payment-gateway.types';

export type RecurringFrequency =
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'annually';

export type RecurringScheduleStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled';

export interface RecurringScheduleItem {
  description: string;
  descriptionFr?: string;
  descriptionAr?: string;
  descriptionEs?: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
}

export interface RecurringInvoiceSchedule {
  id: string | number;
  companyId?: number;
  clientId: string;
  clientName?: string;
  title: string;
  frequency: RecurringFrequency;
  currency: PaymentCurrency;
  amountHt: string;
  tvaRate: string;
  tvaAmount: string;
  totalAmountTtc: string;
  isArticle92Exempt: boolean;
  startDate: string;
  endDate?: string;
  nextIssueDate: string;
  lastIssuedDate?: string;
  billingDayOfMonth: number;
  autoSendEmail: boolean;
  autoSendWhatsapp: boolean;
  autoGeneratePaymentLink: boolean;
  preferredGateway: PaymentGateway;
  status: RecurringScheduleStatus;
  totalCyclesCompleted: number;
  maxCycles?: number;
  itemsBreakdown: RecurringScheduleItem[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRecurringScheduleInput {
  clientId: string;
  title: string;
  frequency: RecurringFrequency;
  currency?: PaymentCurrency;
  amountHt: string | number;
  tvaRate?: string | number;
  isArticle92Exempt?: boolean;
  startDate: string;
  endDate?: string;
  billingDayOfMonth?: number;
  autoSendEmail?: boolean;
  autoSendWhatsapp?: boolean;
  autoGeneratePaymentLink?: boolean;
  preferredGateway?: PaymentGateway;
  maxCycles?: number;
  itemsBreakdown?: RecurringScheduleItem[];
  metadata?: Record<string, unknown>;
}

export interface GeneratedRecurringInvoice {
  invoiceId: number;
  invoiceNumber: string;
  scheduleId: string | number;
  amountTtc: string;
  currency: PaymentCurrency;
  issueDate: string;
  dueDate: string;
  paymentLinkUrl?: string;
  dgiSha256Digest?: string;
}

export interface ProcessRecurringRunResult {
  timestamp: string;
  schedulesChecked: number;
  schedulesDue: number;
  invoicesGenerated: GeneratedRecurringInvoice[];
  errors: {
    scheduleId: string | number;
    error: string;
  }[];
}
