/**
 * Trans Bodanon TMS — Payment Gateway & Digital Settlement Types
 * Multi-Gateway Architecture: Stripe (International & SEPA) + CMI (Morocco Interbank)
 */

export type PaymentGateway = 'stripe' | 'cmi' | 'multi' | 'bank_transfer';

export type PaymentLinkStatus = 'active' | 'paid' | 'expired' | 'cancelled';

export type PaymentCurrency = 'MAD' | 'EUR' | 'USD' | 'GBP' | 'MRU' | 'XOF';

export interface GatewayFeeStructure {
  gateway: PaymentGateway;
  currency: PaymentCurrency;
  percentageRate: string; // e.g., "1.50" for 1.5%
  fixedFee: string;       // e.g., "2.50" MAD or "0.25" EUR
  tvaRateOnFee: string;   // e.g., "10.00" for 10% TVA on Moroccan bank fees or "0.00"
}

export interface GatewayFeeCalculation {
  gateway: PaymentGateway;
  currency: PaymentCurrency;
  grossAmount: string;
  gatewayFeePercentage: string;
  gatewayFeeFixed: string;
  gatewayFeeSubtotal: string;
  gatewayFeeTva: string;
  totalGatewayFee: string;
  netSettlementAmount: string;
}

export interface PaymentLink {
  id: string | number;
  companyId?: number;
  invoiceId: number;
  invoiceNumber: string;
  clientId: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  token: string;
  gateway: PaymentGateway;
  status: PaymentLinkStatus;
  currency: PaymentCurrency;
  amount: string;
  paidAmount: string;
  gatewayFeeAmount: string;
  netSettledAmount: string;
  stripePaymentLinkUrl?: string;
  stripeSessionId?: string;
  cmiOrderId?: string;
  cmiHash?: string;
  payUrl: string;
  expiresAt: string;
  paidAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentLinkInput {
  invoiceId: number;
  invoiceNumber: string;
  clientId: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  amount: string | number;
  currency?: PaymentCurrency;
  gateway?: PaymentGateway;
  expiresInDays?: number;
  metadata?: Record<string, unknown>;
}

export interface CmiPaymentFormData {
  clientid: string;
  amount: string;
  okUrl: string;
  failUrl: string;
  TranType: 'PreAuth' | 'Auth';
  callbackUrl: string;
  shopurl: string;
  currency: string; // '504' for MAD in ISO 4217, or 'MAD'
  rnd: string;
  storetype: '3D_PAY_HOSTING';
  hashAlgorithm: 'ver3';
  lang: 'ar' | 'fr' | 'es' | 'en';
  refreshtime: '5';
  BillToName: string;
  BillToCompany: string;
  email: string;
  tel: string;
  oid: string; // Order ID (Invoice Number or Link Token)
  HASH: string; // Computed HMAC-SHA512
  gatewayPostUrl: string;
}

export interface StripeCheckoutResult {
  sessionId: string;
  paymentUrl: string;
  expiresAt: string;
}

export interface PaymentConfirmationResult {
  success: boolean;
  paymentLinkId: string | number;
  invoiceId: number;
  invoiceNumber: string;
  paidAmount: string;
  currency: PaymentCurrency;
  gateway: PaymentGateway;
  transactionReference: string;
  feeDeducted: string;
  netDeposited: string;
  isFullyPaid: boolean;
  auditLogId?: number;
  error?: string;
}
