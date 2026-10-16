/**
 * Trans Bodanon TMS — Smart Dunning, Payment Velocity Index (PVI) & Multi-Currency Cash Flow Radar Types
 * Track D: Proactive Receivables Collection, Aging Buckets, PVI-Adjusted 30/60/90-Day Cash Flow,
 * and Trilingual Multi-Channel Escalation (WhatsApp Cloud API & Institutional SMTP)
 */

export type PaymentBehaviorTier =
  | 'prompt_payer'         // PVI <= 0.85 (يسدد مبكراً قبل الأجل التعاقدي)
  | 'on_time'              // 0.85 < PVI <= 1.05 (ملتزم بالأجل التعاقدي)
  | 'slow_payer'           // 1.05 < PVI <= 1.35 (بطيء السداد / يحتاج تذكيراً استباقياً)
  | 'high_risk_delinquent';// PVI > 1.35 (مماطل عالي المخاطر / تعثر في السداد)

export type AgingBucketKey =
  | 'current'              // غير مستحقة بعد (<= 0 يوم تأخير)
  | 'days_1_30'            // متأخرة 1 إلى 30 يوماً
  | 'days_31_60'           // متأخرة 31 إلى 60 يوماً
  | 'days_61_90'           // متأخرة 61 إلى 90 يوماً
  | 'days_over_90';        // متأخرة أكثر من 90 يوماً

export type DunningEscalationStage =
  | 'gentle_reminder'              // تذكير ودي استباقي (قبل الاستحقاق أو تأخير <= 7 أيام)
  | 'overdue_notice_1'             // إشعار مطالبة أول (تأخير 8 إلى 30 يوماً)
  | 'overdue_notice_2'             // إشعار مطالبة ثانٍ حازم (تأخير 31 إلى 60 يوماً)
  | 'final_legal_mise_en_demeure'; // إنذار قانوني نهائي (Mise en Demeure > 60 يوماً)

export type CashFlowHorizonKey = '0_30_days' | '31_60_days' | '61_90_days';

export interface HistoricalSettledInvoiceInput {
  invoiceId: string | number;
  clientId: number;
  issueDate: string;          // YYYY-MM-DD
  dueDate?: string;           // YYYY-MM-DD
  settledDate: string;        // YYYY-MM-DD
  agreedTermsDays?: number;   // Default 30 if not specified
  amount: number | string;
  currency: 'MAD' | 'EUR';
}

export interface OpenReceivableInput {
  id: string | number;
  documentNumber: string;
  documentType: 'invoice' | 'lcn_bill';
  clientId: number;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  preferredLocale?: 'ar' | 'fr' | 'es';
  issueDate: string;          // YYYY-MM-DD
  contractualDueDate: string; // YYYY-MM-DD
  agreedTermsDays?: number;
  currency: 'MAD' | 'EUR';
  totalAmount: number | string;
  paidAmount?: number | string;
  exchangeRateEurToMad?: number | string;
}

export interface ClientPviProfile {
  clientId: number;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  preferredLocale: 'ar' | 'fr' | 'es';
  agreedPaymentTermsDays: number;
  averageActualDaysToPay: string;
  pviScore: string;                 // e.g. '0.82', '1.00', '1.45'
  behaviorTier: PaymentBehaviorTier;
  settledInvoicesCount: number;
  openReceivablesMad: string;
  openReceivablesEur: string;
  totalExposureConsolidatedMad: string;
  overdueConsolidatedMad: string;
  maxDaysOverdue: number;
  recommendedEscalationStage: DunningEscalationStage;
}

export interface PviAdjustedReceivableItem {
  id: string;
  documentNumber: string;
  documentType: 'invoice' | 'lcn_bill';
  clientId: number;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  preferredLocale: 'ar' | 'fr' | 'es';
  issueDate: string;
  contractualDueDate: string;
  agreedTermsDays: number;
  clientPviScore: string;
  behaviorTier: PaymentBehaviorTier;
  pviAdjustedExpectedDate: string;  // تاريخ التحصيل الواقعي المعدل بمؤشر PVI
  daysOverdue: number;              // موجب = متأخر، 0 أو سالب = غير مستحق بعد
  agingBucket: AgingBucketKey;
  escalationStage: DunningEscalationStage;
  currency: 'MAD' | 'EUR';
  totalAmount: string;
  paidAmount: string;
  remainingAmount: string;
  remainingAmountConsolidatedMad: string;
}

export interface AgingBucketSummary {
  bucket: AgingBucketKey;
  labelAr: string;
  labelFr: string;
  labelEs: string;
  documentsCount: number;
  amountMad: string;
  amountEur: string;
  consolidatedMad: string;
  sharePct: string;
}

export interface CashFlowHorizonPoint {
  horizonKey: CashFlowHorizonKey;
  label: string;
  nominalInflowMad: string;         // التدفق الاسمي حسب تاريخ الاستحقاق التعاقدي (MAD)
  nominalInflowEur: string;         // التدفق الاسمي حسب تاريخ الاستحقاق التعاقدي (EUR)
  nominalConsolidatedMad: string;   // الإجمالي الاسمي الموحد بالدرهم
  pviAdjustedInflowMad: string;     // التدفق الواقعي المعدل بمؤشر سرعة السداد PVI (MAD)
  pviAdjustedInflowEur: string;     // التدفق الواقعي المعدل بمؤشر سرعة السداد PVI (EUR)
  pviAdjustedConsolidatedMad: string;// الإجمالي الواقعي المرجح بـ PVI بالدرهم
  lcnExpectedMad: string;           // حصة الأوراق التجارية (LCN) المستحقة خلال الأفق
}

export interface SmartDunningDashboardData {
  referenceDate: string;
  exchangeRateEurToMad: string;
  totalOpenMad: string;
  totalOpenEur: string;
  totalConsolidatedReceivablesMad: string;
  totalOverdueConsolidatedMad: string;
  fleetAveragePvi: string;
  expected30DaysPviMad: string;
  expected60DaysPviMad: string;
  expected90DaysPviMad: string;
  highRiskClientsCount: number;
  agingBuckets: AgingBucketSummary[];
  cashFlowHorizons: CashFlowHorizonPoint[];
  clientProfiles: ClientPviProfile[];
  receivables: PviAdjustedReceivableItem[];
}

export interface TriggerSmartDunningInput {
  receivableId: string;
  documentNumber: string;
  clientId: number;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  locale: 'ar' | 'fr' | 'es';
  escalationStage: DunningEscalationStage;
  remainingAmount: string;
  currency: 'MAD' | 'EUR';
  contractualDueDate: string;
  daysOverdue: number;
  channels: Array<'whatsapp' | 'email'>;
}

export interface TriggerSmartDunningResult {
  success: boolean;
  receivableId: string;
  escalationStage: DunningEscalationStage;
  whatsappDispatched: boolean;
  emailDispatched: boolean;
  generatedSubject?: string;
  generatedMessage?: string;
  error?: string;
}

export interface BookingFreezeGuardEvaluation {
  clientId: number;
  clientName: string;
  isFrozen: boolean;
  overrideApplied: boolean;
  clientPviScore: string;
  behaviorTier: PaymentBehaviorTier;
  escalationStage: DunningEscalationStage;
  blockingDocuments: string[];
  overdueConsolidatedMad: string;
  maxDaysOverdue: number;
  reasonAr: string;
  reasonFr: string;
  reasonEs: string;
}

export interface TenantDunningCronSummary {
  companyId: number;
  companyName: string;
  receivablesEvaluated: number;
  dunningDispatched: number;
  legalEscalationsCount: number;
  frozenClientIds: number[];
  totalOverdueConsolidatedMad: string;
}

export interface MultiTenantDunningCronResult {
  success: boolean;
  referenceDate: string;
  totalTenantsProcessed: number;
  totalReceivablesEvaluated: number;
  totalDunningDispatched: number;
  totalLegalEscalations: number;
  frozenClientIds: number[];
  tenantSummaries: TenantDunningCronSummary[];
  errors: Array<{ companyId: number; receivableId?: string; error: string }>;
}


