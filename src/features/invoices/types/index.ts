import type { Invoice, Client, TripOrder } from '@/types/database';

export interface TripInvoiceBreakdown {
  baseFreight: string;
  ferryCost: string;
  customsAndPortFees: string;
  totalHt: string;
  tvaRate: string;
  tvaAmount: string;
  totalTtc: string;
  currency: string;
  isTaxExempt: boolean;
  taxExemptionClause?: string;
  mrn?: string;
  scelleNumbers?: string[];
  ferryBooking?: string;
  cmrNumber?: string;
  clientIce?: string;
}

export interface AutoInvoiceOptions {
  forceRecreate?: boolean;
  triggerEvent?: 'customs_cleared' | 'customs_export' | 'delivered' | 'manual';
  paymentDueDays?: number; // default 30
  actorUserId?: string;
}

export interface AutoInvoiceResult {
  success: boolean;
  invoice?: Invoice;
  alreadyExisted?: boolean;
  error?: string;
  paymentLink?: string;
  notificationSent?: boolean;
  details?: TripInvoiceBreakdown;
}

export * from './einvoice.types';
