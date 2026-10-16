/**
 * Trans Bodanon TMS — Smart Dunning, Payment Velocity Index (PVI) & Multi-Currency Cash Flow Service
 * Track D: Strict Decimal.js Engine for PVI Scoring, Aging Buckets, PVI-Adjusted 30/60/90-Day Cash Flow,
 * and Trilingual Escalation Templates (AR / FR / ES)
 */

import Decimal from 'decimal.js';
import type {
  AgingBucketKey,
  AgingBucketSummary,
  BookingFreezeGuardEvaluation,
  CashFlowHorizonPoint,
  ClientPviProfile,
  DunningEscalationStage,
  HistoricalSettledInvoiceInput,
  OpenReceivableInput,
  PaymentBehaviorTier,
  PviAdjustedReceivableItem,
  SmartDunningDashboardData,
} from '../types/smart-dunning-cashflow.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export class SmartDunningCashFlowService {
  /**
   * حساب عدد الأيام بين تاريخين بصيغة YYYY-MM-DD بتوقيت UTC الموحد
   */
  public static diffDaysUtc(startDateIso: string, endDateIso: string): number {
    const startClean = (startDateIso || '').split('T')[0];
    const endClean = (endDateIso || '').split('T')[0];
    const startMs = Date.parse(`${startClean}T00:00:00.000Z`);
    const endMs = Date.parse(`${endClean}T00:00:00.000Z`);
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 0;
    return Math.round((endMs - startMs) / 86400000);
  }

  /**
   * إضافة عدد أيام إلى تاريخ بصيغة YYYY-MM-DD بتوقيت UTC الموحد
   */
  public static addDaysUtc(baseDateIso: string, daysToAdd: number): string {
    const clean = (baseDateIso || '').split('T')[0];
    const baseMs = Date.parse(`${clean}T00:00:00.000Z`);
    if (Number.isNaN(baseMs)) return clean;
    const targetDate = new Date(baseMs + daysToAdd * 86400000);
    return targetDate.toISOString().split('T')[0];
  }

  /**
   * حساب مؤشر سرعة السداد (PVI = Actual Days to Pay / Agreed Payment Terms) بدقة Decimal.js
   */
  public static calculatePviRatio(
    actualDaysToPay: number | string,
    agreedPaymentTermsDays: number | string = 30
  ): string {
    const termsDec = Decimal.max(1, new Decimal(agreedPaymentTermsDays || 30));
    const actualDec = Decimal.max(1, new Decimal(actualDaysToPay || termsDec));
    return actualDec.dividedBy(termsDec).toFixed(2);
  }

  /**
   * تصنيف سلوك الدفع للعميل بناءً على مؤشر PVI
   */
  public static classifyBehaviorTier(pviScore: number | string): PaymentBehaviorTier {
    const pviDec = new Decimal(pviScore || '1.00');
    if (pviDec.lessThanOrEqualTo('0.85')) return 'prompt_payer';
    if (pviDec.lessThanOrEqualTo('1.05')) return 'on_time';
    if (pviDec.lessThanOrEqualTo('1.35')) return 'slow_payer';
    return 'high_risk_delinquent';
  }

  /**
   * تصنيف شريحة عمر الدين (Aging Bucket) بناءً على أيام التأخير
   */
  public static classifyAgingBucket(daysOverdue: number): AgingBucketKey {
    if (daysOverdue <= 0) return 'current';
    if (daysOverdue <= 30) return 'days_1_30';
    if (daysOverdue <= 60) return 'days_31_60';
    if (daysOverdue <= 90) return 'days_61_90';
    return 'days_over_90';
  }

  /**
   * تحديد مستوى التصعيد الآلي للمطالبة المالية (Dunning Escalation Stage)
   */
  public static determineEscalationStage(
    daysOverdue: number,
    behaviorTier: PaymentBehaviorTier
  ): DunningEscalationStage {
    if (daysOverdue > 60 || (daysOverdue > 45 && behaviorTier === 'high_risk_delinquent')) {
      return 'final_legal_mise_en_demeure';
    }
    if (daysOverdue > 30) {
      return 'overdue_notice_2';
    }
    if (daysOverdue > 7) {
      return 'overdue_notice_1';
    }
    return 'gentle_reminder';
  }

  /**
   * حساب التاريخ الواقعي المتوقع للتحصيل المعدل بمؤشر سرعة السداد (PVI-Adjusted Expected Date)
   * Expected Days = Agreed Payment Terms * Client PVI
   */
  public static calculatePviAdjustedDate(params: {
    issueDate: string;
    agreedTermsDays: number;
    clientPviScore: number | string;
  }): string {
    const termsDec = Decimal.max(1, new Decimal(params.agreedTermsDays || 30));
    const pviDec = Decimal.max('0.20', new Decimal(params.clientPviScore || '1.00'));
    const adjustedDays = termsDec
      .times(pviDec)
      .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
      .toNumber();
    return this.addDaysUtc(params.issueDate, adjustedDays);
  }

  /**
   * حساب متوسط مؤشر سرعة السداد (PVI) للعميل من سجل فواتيره المسددة تاريخياً
   */
  public static evaluateClientHistoricalPvi(
    settledInvoices: HistoricalSettledInvoiceInput[],
    defaultAgreedTermsDays = 30
  ): {
    averageActualDaysToPay: string;
    pviScore: string;
    behaviorTier: PaymentBehaviorTier;
    settledCount: number;
  } {
    if (!settledInvoices || settledInvoices.length === 0) {
      return {
        averageActualDaysToPay: new Decimal(defaultAgreedTermsDays).toFixed(1),
        pviScore: '1.00',
        behaviorTier: 'on_time',
        settledCount: 0,
      };
    }

    let totalActualDaysDec = new Decimal(0);
    let totalAgreedDaysDec = new Decimal(0);

    for (const inv of settledInvoices) {
      const agreed = inv.agreedTermsDays || defaultAgreedTermsDays;
      const actualDays = Math.max(1, this.diffDaysUtc(inv.issueDate, inv.settledDate));
      totalActualDaysDec = totalActualDaysDec.plus(new Decimal(actualDays));
      totalAgreedDaysDec = totalAgreedDaysDec.plus(new Decimal(agreed));
    }

    const countDec = new Decimal(settledInvoices.length);
    const avgActualDec = totalActualDaysDec.dividedBy(countDec);
    const pviDec = totalActualDaysDec.dividedBy(totalAgreedDaysDec);
    const pviStr = pviDec.toFixed(2);

    return {
      averageActualDaysToPay: avgActualDec.toFixed(1),
      pviScore: pviStr,
      behaviorTier: this.classifyBehaviorTier(pviStr),
      settledCount: settledInvoices.length,
    };
  }

  /**
   * بناء رسائل المطالبة المالية ثلاثية اللغات (AR / FR / ES) حسب مستوى التصعيد
   */
  public static buildTrilingualDunningMessage(params: {
    locale: 'ar' | 'fr' | 'es';
    clientName: string;
    documentNumber: string;
    remainingAmount: string;
    currency: 'MAD' | 'EUR';
    contractualDueDate: string;
    daysOverdue: number;
    escalationStage: DunningEscalationStage;
  }): { subject: string; bodyText: string; htmlBody: string } {
    const {
      locale,
      clientName,
      documentNumber,
      remainingAmount,
      currency,
      contractualDueDate,
      daysOverdue,
      escalationStage,
    } = params;

    let subject = '';
    let bodyText = '';

    if (locale === 'fr') {
      if (escalationStage === 'final_legal_mise_en_demeure') {
        subject = `[MISE EN DEMEURE] Facture échue #${documentNumber} (${daysOverdue}j de retard) - Trans Bodanon`;
        bodyText = `Madame, Monsieur (${clientName}),\n\nSauf erreur ou omission de notre part, la facture N° ${documentNumber} d'un montant restant dû de ${remainingAmount} ${currency} (échéance du ${contractualDueDate}, soit ${daysOverdue} jours de retard) demeure impayée.\n\nLa présente vaut DERNIÈRE MISE EN DEMEURE avant transmission du dossier à notre service contentieux sous 48 heures.\n\nDirection Financière — Trans Bodanon TMS`;
      } else if (escalationStage === 'overdue_notice_2') {
        subject = `[2ème RELANCE URGENTE] Échéance dépassée #${documentNumber} - Trans Bodanon`;
        bodyText = `Bonjour ${clientName},\n\nNous vous relançons concernant la facture N° ${documentNumber} d'un solde de ${remainingAmount} ${currency}, échue depuis le ${contractualDueDate} (${daysOverdue} jours de retard). Merci de procéder au virement bancaire dans les plus brefs délais.\n\nService Recouvrement — Trans Bodanon TMS`;
      } else if (escalationStage === 'overdue_notice_1') {
        subject = `[Relance Échéance] Facture #${documentNumber} (${remainingAmount} ${currency}) - Trans Bodanon`;
        bodyText = `Bonjour ${clientName},\n\nNous vous rappelons aimablement que la facture N° ${documentNumber} d'un montant de ${remainingAmount} ${currency} est arrivée à échéance le ${contractualDueDate}. Merci de nous confirmer la date de règlement.\n\nCordialement,\nTrans Bodanon TMS`;
      } else {
        subject = `[Avis d'Échéance Préventif] Facture #${documentNumber} - Trans Bodanon`;
        bodyText = `Bonjour ${clientName},\n\nCeci est un rappel courtois concernant votre facture N° ${documentNumber} (${remainingAmount} ${currency}) dont l'échéance est fixée au ${contractualDueDate}.\n\nMerci pour votre confiance — Trans Bodanon TMS`;
      }
    } else if (locale === 'es') {
      if (escalationStage === 'final_legal_mise_en_demeure') {
        subject = `[REQUERIMIENTO LEGAL DE PAGO] Factura vencida #${documentNumber} (${daysOverdue}d) - Trans Bodanon`;
        bodyText = `Estimados Sres. (${clientName}),\n\nLe notificamos formalmente que la factura N° ${documentNumber} por un importe pendiente de ${remainingAmount} ${currency} (vencimiento ${contractualDueDate}, ${daysOverdue} días de mora) continúa impagada.\n\nEste aviso constituye un REQUERIMIENTO PREVIO A VÍA JUDICIAL si no se recibe el abono en un plazo de 48 horas.\n\nDepartamento Financiero — Trans Bodanon TMS`;
      } else if (escalationStage === 'overdue_notice_2') {
        subject = `[2º AVISO DE VENCIMIENTO] Factura pendiente #${documentNumber} - Trans Bodanon`;
        bodyText = `Estimado/a ${clientName},\n\nLe recordamos con carácter urgente que la factura N° ${documentNumber} por ${remainingAmount} ${currency} venció el ${contractualDueDate} (${daysOverdue} días de retraso). Rogamos tramiten la transferencia a la mayor brevedad.\n\nDepartamento de Cobros — Trans Bodanon TMS`;
      } else if (escalationStage === 'overdue_notice_1') {
        subject = `[Recordatorio de Pago] Factura #${documentNumber} (${remainingAmount} ${currency}) - Trans Bodanon`;
        bodyText = `Hola ${clientName},\n\nLe recordamos amablemente que la factura N° ${documentNumber} por importe de ${remainingAmount} ${currency} venció el ${contractualDueDate}. Agradeceríamos confirmación de la fecha de pago.\n\nAtentamente,\nTrans Bodanon TMS`;
      } else {
        subject = `[Aviso Preventivo de Vencimiento] Factura #${documentNumber} - Trans Bodanon`;
        bodyText = `Hola ${clientName},\n\nRecordatorio preventivo sobre su factura N° ${documentNumber} (${remainingAmount} ${currency}) con fecha de vencimiento ${contractualDueDate}.\n\nGracias por su colaboración — Trans Bodanon TMS`;
      }
    } else {
      if (escalationStage === 'final_legal_mise_en_demeure') {
        subject = `[إنذار قانوني نهائي بالأداء - Mise en Demeure] فاتورة متأخرة رقم #${documentNumber} - Trans Bodanon`;
        bodyText = `السادة المحترمون شركة ${clientName}،\n\nنحيطكم علماً بأن الفاتورة رقم ${documentNumber} البالغ رصيدها المتبقي ${remainingAmount} ${currency} (تاريخ الاستحقاق: ${contractualDueDate} — متأخرة بـ ${daysOverdue} يوماً) لم تتم تسويتها بعد.\n\nيُعد هذا الإشعار إنذاراً قانونياً نهائياً قبل إحالة الملف إلى المسطرة القضائية خلال 48 ساعة.\n\nالإدارة المالية — Trans Bodanon TMS`;
      } else if (escalationStage === 'overdue_notice_2') {
        subject = `[إشعار مطالبة ثانٍ عاجل] تجاوز أجل سداد الفاتورة #${documentNumber} - Trans Bodanon`;
        bodyText = `السادة شركة ${clientName}،\n\nنذكركم بضرورة تسوية الفاتورة رقم ${documentNumber} بقيمة ${remainingAmount} ${currency} المستحقة بتاريخ ${contractualDueDate} (تأخير ${daysOverdue} يوماً). يرجى تزويدنا بنسخة أمر التحويل البنكي في أقرب الآجال.\n\nمصلحة التحصيل والخزينة — Trans Bodanon TMS`;
      } else if (escalationStage === 'overdue_notice_1') {
        subject = `[تذكير بموعد السداد] الفاتورة رقم #${documentNumber} (${remainingAmount} ${currency}) - Trans Bodanon`;
        bodyText = `مرحباً ${clientName}،\n\nنود تذكيركم بأن الفاتورة رقم ${documentNumber} بمبلغ ${remainingAmount} ${currency} قد حل أجل استحقاقها بتاريخ ${contractualDueDate}. نرجو تأكيد تاريخ التحويل المتوقع.\n\nمع خالص التقدير،\nTrans Bodanon TMS`;
      } else {
        subject = `[تذكير استباقي بالاستحقاق] الفاتورة رقم #${documentNumber} - Trans Bodanon`;
        bodyText = `مرحباً ${clientName}،\n\nتذكير ودي استباقي بخصوص الفاتورة رقم ${documentNumber} (${remainingAmount} ${currency}) المستحقة بتاريخ ${contractualDueDate}.\n\nشكراً لثقتكم — Trans Bodanon TMS`;
      }
    }

    const htmlBody = `<div style="font-family:sans-serif;line-height:1.6;padding:16px;border:1px solid #e2e8f0;border-radius:12px;">
      <h3 style="margin-top:0;color:#1e293b;">${subject}</h3>
      <p style="white-space:pre-line;color:#334155;">${bodyText}</p>
    </div>`;

    return { subject, bodyText, htmlBody };
  }

  /**
   * بناء لوحة تحكم التحصيل الاستباقي ورادار التدفقات النقدية لـ 30/60/90 يوماً (PVI & Multi-Currency Cash Flow Radar)
   */
  public static buildSmartDunningDashboard(params: {
    referenceDate: string; // YYYY-MM-DD
    exchangeRateEurToMad?: number | string;
    historicalSettledInvoices: HistoricalSettledInvoiceInput[];
    openReceivables: OpenReceivableInput[];
  }): SmartDunningDashboardData {
    const refDate = (params.referenceDate || new Date().toISOString()).split('T')[0];
    const fxDec = Decimal.max(1, new Decimal(params.exchangeRateEurToMad || '10.85'));

    // 1. Group historical settled invoices by clientId to compute PVI per client
    const histByClient = new Map<number, HistoricalSettledInvoiceInput[]>();
    for (const h of params.historicalSettledInvoices) {
      const list = histByClient.get(h.clientId) || [];
      list.push(h);
      histByClient.set(h.clientId, list);
    }

    const clientPviCache = new Map<
      number,
      {
        averageActualDaysToPay: string;
        pviScore: string;
        behaviorTier: PaymentBehaviorTier;
        settledCount: number;
      }
    >();

    for (const [clientId, list] of histByClient.entries()) {
      clientPviCache.set(clientId, this.evaluateClientHistoricalPvi(list, 30));
    }

    // 2. Evaluate all open receivables (Invoices + LCN Commercial Bills)
    const evaluatedReceivables: PviAdjustedReceivableItem[] = [];
    let totalOpenMadDec = new Decimal(0);
    let totalOpenEurDec = new Decimal(0);
    let totalConsolidatedMadDec = new Decimal(0);
    let totalOverdueConsolidatedMadDec = new Decimal(0);

    // Aging bucket accumulators
    const agingAccum = new Map<
      AgingBucketKey,
      {
        count: number;
        madDec: InstanceType<typeof Decimal>;
        eurDec: InstanceType<typeof Decimal>;
        consolidatedMadDec: InstanceType<typeof Decimal>;
      }
    >([
      [
        'current',
        {
          count: 0,
          madDec: new Decimal(0),
          eurDec: new Decimal(0),
          consolidatedMadDec: new Decimal(0),
        },
      ],
      [
        'days_1_30',
        {
          count: 0,
          madDec: new Decimal(0),
          eurDec: new Decimal(0),
          consolidatedMadDec: new Decimal(0),
        },
      ],
      [
        'days_31_60',
        {
          count: 0,
          madDec: new Decimal(0),
          eurDec: new Decimal(0),
          consolidatedMadDec: new Decimal(0),
        },
      ],
      [
        'days_61_90',
        {
          count: 0,
          madDec: new Decimal(0),
          eurDec: new Decimal(0),
          consolidatedMadDec: new Decimal(0),
        },
      ],
      [
        'days_over_90',
        {
          count: 0,
          madDec: new Decimal(0),
          eurDec: new Decimal(0),
          consolidatedMadDec: new Decimal(0),
        },
      ],
    ]);

    // Client profile accumulators
    const clientAccum = new Map<
      number,
      {
        clientId: number;
        clientName: string;
        clientPhone?: string;
        clientEmail?: string;
        preferredLocale: 'ar' | 'fr' | 'es';
        agreedTermsDays: number;
        openMadDec: InstanceType<typeof Decimal>;
        openEurDec: InstanceType<typeof Decimal>;
        consolidatedMadDec: InstanceType<typeof Decimal>;
        overdueMadDec: InstanceType<typeof Decimal>;
        maxDaysOverdue: number;
      }
    >();

    for (const item of params.openReceivables) {
      const totalDec = Decimal.max(0, new Decimal(item.totalAmount || 0));
      const paidDec = Decimal.max(0, new Decimal(item.paidAmount || 0));
      const remDec = Decimal.max(0, totalDec.minus(paidDec));
      if (remDec.lessThanOrEqualTo(0)) continue;

      const itemFxDec =
        item.currency === 'EUR'
          ? new Decimal(item.exchangeRateEurToMad || fxDec)
          : new Decimal(1);
      const remConsolidatedMadDec = remDec.times(itemFxDec);

      if (item.currency === 'EUR') {
        totalOpenEurDec = totalOpenEurDec.plus(remDec);
      } else {
        totalOpenMadDec = totalOpenMadDec.plus(remDec);
      }
      totalConsolidatedMadDec = totalConsolidatedMadDec.plus(remConsolidatedMadDec);

      const agreedTerms =
        item.agreedTermsDays ||
        Math.max(15, this.diffDaysUtc(item.issueDate, item.contractualDueDate));

      const clientHist = clientPviCache.get(item.clientId) || {
        averageActualDaysToPay: new Decimal(agreedTerms).toFixed(1),
        pviScore: '1.00',
        behaviorTier: 'on_time' as PaymentBehaviorTier,
        settledCount: 0,
      };

      const pviAdjustedExpectedDate = this.calculatePviAdjustedDate({
        issueDate: item.issueDate,
        agreedTermsDays: agreedTerms,
        clientPviScore: clientHist.pviScore,
      });

      const daysOverdue = this.diffDaysUtc(item.contractualDueDate, refDate);
      const agingBucket = this.classifyAgingBucket(daysOverdue);
      const escalationStage = this.determineEscalationStage(daysOverdue, clientHist.behaviorTier);

      if (daysOverdue > 0) {
        totalOverdueConsolidatedMadDec = totalOverdueConsolidatedMadDec.plus(
          remConsolidatedMadDec
        );
      }

      // Update Aging Bucket
      const bucketEntry = agingAccum.get(agingBucket)!;
      bucketEntry.count += 1;
      if (item.currency === 'EUR') {
        bucketEntry.eurDec = bucketEntry.eurDec.plus(remDec);
      } else {
        bucketEntry.madDec = bucketEntry.madDec.plus(remDec);
      }
      bucketEntry.consolidatedMadDec = bucketEntry.consolidatedMadDec.plus(
        remConsolidatedMadDec
      );

      // Update Client Accumulator
      const cEntry = clientAccum.get(item.clientId) || {
        clientId: item.clientId,
        clientName: item.clientName,
        clientPhone: item.clientPhone,
        clientEmail: item.clientEmail,
        preferredLocale: item.preferredLocale || 'fr',
        agreedTermsDays: agreedTerms,
        openMadDec: new Decimal(0),
        openEurDec: new Decimal(0),
        consolidatedMadDec: new Decimal(0),
        overdueMadDec: new Decimal(0),
        maxDaysOverdue: 0,
      };

      if (item.currency === 'EUR') {
        cEntry.openEurDec = cEntry.openEurDec.plus(remDec);
      } else {
        cEntry.openMadDec = cEntry.openMadDec.plus(remDec);
      }
      cEntry.consolidatedMadDec = cEntry.consolidatedMadDec.plus(remConsolidatedMadDec);
      if (daysOverdue > 0) {
        cEntry.overdueMadDec = cEntry.overdueMadDec.plus(remConsolidatedMadDec);
      }
      if (daysOverdue > cEntry.maxDaysOverdue) {
        cEntry.maxDaysOverdue = daysOverdue;
      }
      clientAccum.set(item.clientId, cEntry);

      evaluatedReceivables.push({
        id: String(item.id),
        documentNumber: item.documentNumber,
        documentType: item.documentType,
        clientId: item.clientId,
        clientName: item.clientName,
        clientPhone: item.clientPhone,
        clientEmail: item.clientEmail,
        preferredLocale: item.preferredLocale || 'fr',
        issueDate: item.issueDate,
        contractualDueDate: item.contractualDueDate,
        agreedTermsDays: agreedTerms,
        clientPviScore: clientHist.pviScore,
        behaviorTier: clientHist.behaviorTier,
        pviAdjustedExpectedDate,
        daysOverdue,
        agingBucket,
        escalationStage,
        currency: item.currency,
        totalAmount: totalDec.toFixed(2),
        paidAmount: paidDec.toFixed(2),
        remainingAmount: remDec.toFixed(2),
        remainingAmountConsolidatedMad: remConsolidatedMadDec.toFixed(2),
      });
    }

    // 3. Build Aging Buckets Summary
    const bucketLabels: Record<
      AgingBucketKey,
      { ar: string; fr: string; es: string }
    > = {
      current: {
        ar: 'غير مستحقة (Current)',
        fr: 'Non échues (Current)',
        es: 'Corriente (No vencido)',
      },
      days_1_30: {
        ar: '1 - 30 يوم تأخير',
        fr: '1 - 30 jours de retard',
        es: '1 - 30 días de mora',
      },
      days_31_60: {
        ar: '31 - 60 يوم تأخير',
        fr: '31 - 60 jours de retard',
        es: '31 - 60 días de mora',
      },
      days_61_90: {
        ar: '61 - 90 يوم تأخير',
        fr: '61 - 90 jours de retard',
        es: '61 - 90 días de mora',
      },
      days_over_90: {
        ar: '+90 يوم (ديون حرجة)',
        fr: '+90 jours (Contentieux)',
        es: '+90 días (Morosidad crítica)',
      },
    };

    const agingBuckets: AgingBucketSummary[] = [];
    for (const [key, val] of agingAccum.entries()) {
      const shareDec = totalConsolidatedMadDec.greaterThan(0)
        ? val.consolidatedMadDec.dividedBy(totalConsolidatedMadDec).times(100)
        : new Decimal(0);
      agingBuckets.push({
        bucket: key,
        labelAr: bucketLabels[key].ar,
        labelFr: bucketLabels[key].fr,
        labelEs: bucketLabels[key].es,
        documentsCount: val.count,
        amountMad: val.madDec.toFixed(2),
        amountEur: val.eurDec.toFixed(2),
        consolidatedMad: val.consolidatedMadDec.toFixed(2),
        sharePct: shareDec.toFixed(2),
      });
    }

    // 4. Build 30 / 60 / 90-Day Cash Flow Horizon Projections (Nominal vs. PVI-Adjusted)
    const horizonDefs: Array<{
      key: '0_30_days' | '31_60_days' | '61_90_days';
      label: string;
      minDays: number;
      maxDays: number;
    }> = [
      { key: '0_30_days', label: '0 - 30 Days', minDays: -365, maxDays: 30 },
      { key: '31_60_days', label: '31 - 60 Days', minDays: 31, maxDays: 60 },
      { key: '61_90_days', label: '61 - 90 Days', minDays: 61, maxDays: 180 },
    ];

    const cashFlowHorizons: CashFlowHorizonPoint[] = horizonDefs.map((h) => {
      let nomMad = new Decimal(0);
      let nomEur = new Decimal(0);
      let nomConsMad = new Decimal(0);
      let pviMad = new Decimal(0);
      let pviEur = new Decimal(0);
      let pviConsMad = new Decimal(0);
      let lcnMad = new Decimal(0);

      for (const rec of evaluatedReceivables) {
        const remDec = new Decimal(rec.remainingAmount);
        const consMadDec = new Decimal(rec.remainingAmountConsolidatedMad);

        // Nominal placement based on contractualDueDate relative to referenceDate
        const daysToContractual = this.diffDaysUtc(refDate, rec.contractualDueDate);
        if (daysToContractual >= h.minDays && daysToContractual <= h.maxDays) {
          if (rec.currency === 'EUR') nomEur = nomEur.plus(remDec);
          else nomMad = nomMad.plus(remDec);
          nomConsMad = nomConsMad.plus(consMadDec);
        }

        // PVI-Adjusted placement based on pviAdjustedExpectedDate relative to referenceDate
        // If already past pviAdjustedExpectedDate, place in 0_30_days if gentle/notice_1, or 31_60_days if high_risk_delinquent
        const rawDaysToPvi = this.diffDaysUtc(refDate, rec.pviAdjustedExpectedDate);
        const effectiveDaysToPvi =
          rawDaysToPvi < 0
            ? rec.behaviorTier === 'high_risk_delinquent'
              ? 45
              : 15
            : rawDaysToPvi;

        if (effectiveDaysToPvi >= h.minDays && effectiveDaysToPvi <= h.maxDays) {
          if (rec.currency === 'EUR') pviEur = pviEur.plus(remDec);
          else pviMad = pviMad.plus(remDec);
          pviConsMad = pviConsMad.plus(consMadDec);

          if (rec.documentType === 'lcn_bill') {
            lcnMad = lcnMad.plus(consMadDec);
          }
        }
      }

      return {
        horizonKey: h.key,
        label: h.label,
        nominalInflowMad: nomMad.toFixed(2),
        nominalInflowEur: nomEur.toFixed(2),
        nominalConsolidatedMad: nomConsMad.toFixed(2),
        pviAdjustedInflowMad: pviMad.toFixed(2),
        pviAdjustedInflowEur: pviEur.toFixed(2),
        pviAdjustedConsolidatedMad: pviConsMad.toFixed(2),
        lcnExpectedMad: lcnMad.toFixed(2),
      };
    });

    // 5. Build Client PVI Profiles
    const clientProfiles: ClientPviProfile[] = [];
    let pviSumDec = new Decimal(0);
    let highRiskClientsCount = 0;

    for (const [clientId, cVal] of clientAccum.entries()) {
      const hist = clientPviCache.get(clientId) || {
        averageActualDaysToPay: new Decimal(cVal.agreedTermsDays).toFixed(1),
        pviScore: '1.00',
        behaviorTier: 'on_time' as PaymentBehaviorTier,
        settledCount: 0,
      };

      pviSumDec = pviSumDec.plus(new Decimal(hist.pviScore));
      if (hist.behaviorTier === 'high_risk_delinquent') {
        highRiskClientsCount += 1;
      }

      clientProfiles.push({
        clientId,
        clientName: cVal.clientName,
        clientPhone: cVal.clientPhone,
        clientEmail: cVal.clientEmail,
        preferredLocale: cVal.preferredLocale,
        agreedPaymentTermsDays: cVal.agreedTermsDays,
        averageActualDaysToPay: hist.averageActualDaysToPay,
        pviScore: hist.pviScore,
        behaviorTier: hist.behaviorTier,
        settledInvoicesCount: hist.settledCount,
        openReceivablesMad: cVal.openMadDec.toFixed(2),
        openReceivablesEur: cVal.openEurDec.toFixed(2),
        totalExposureConsolidatedMad: cVal.consolidatedMadDec.toFixed(2),
        overdueConsolidatedMad: cVal.overdueMadDec.toFixed(2),
        maxDaysOverdue: cVal.maxDaysOverdue,
        recommendedEscalationStage: this.determineEscalationStage(
          cVal.maxDaysOverdue,
          hist.behaviorTier
        ),
      });
    }

    clientProfiles.sort((a, b) =>
      new Decimal(b.totalExposureConsolidatedMad)
        .minus(new Decimal(a.totalExposureConsolidatedMad))
        .toNumber()
    );

    const fleetAvgPviDec =
      clientProfiles.length > 0
        ? pviSumDec.dividedBy(new Decimal(clientProfiles.length))
        : new Decimal('1.00');

    return {
      referenceDate: refDate,
      exchangeRateEurToMad: fxDec.toFixed(4),
      totalOpenMad: totalOpenMadDec.toFixed(2),
      totalOpenEur: totalOpenEurDec.toFixed(2),
      totalConsolidatedReceivablesMad: totalConsolidatedMadDec.toFixed(2),
      totalOverdueConsolidatedMad: totalOverdueConsolidatedMadDec.toFixed(2),
      fleetAveragePvi: fleetAvgPviDec.toFixed(2),
      expected30DaysPviMad: cashFlowHorizons[0].pviAdjustedConsolidatedMad,
      expected60DaysPviMad: cashFlowHorizons[1].pviAdjustedConsolidatedMad,
      expected90DaysPviMad: cashFlowHorizons[2].pviAdjustedConsolidatedMad,
      highRiskClientsCount,
      agingBuckets,
      cashFlowHorizons,
      clientProfiles,
      receivables: evaluatedReceivables.sort((a, b) => b.daysOverdue - a.daysOverdue),
    };
  }

  /**
   * التحقق مما إذا كانت الوثيقة تستحق إرسال إشعار آلي مجدول في دورة الـ Cron اليومية
   */
  public static shouldDispatchScheduledDunning(
    daysOverdue: number,
    escalationStage: DunningEscalationStage
  ): boolean {
    if (daysOverdue === -3 || daysOverdue === 0) return true;
    if (daysOverdue === 7 || daysOverdue === 15 || daysOverdue === 21) return true;
    if (daysOverdue === 31 || daysOverdue === 45) return true;
    if (
      escalationStage === 'final_legal_mise_en_demeure' &&
      (daysOverdue === 46 || daysOverdue === 61 || daysOverdue === 75 || daysOverdue === 90 || (daysOverdue > 60 && daysOverdue % 15 === 0))
    ) {
      return true;
    }
    return false;
  }

  /**
   * حارس تجميد الحجوزات التلقائي (Booking Freeze Guard):
   * يفحص ما إذا كان العميل قد دخل في المرحلة الرابعة من التصعيد (final_legal_mise_en_demeure)
   * ويمنع تمرير حجوزات شحن جديدة لحين تسوية الذمة المالية أو وجود استثناء إداري موثق.
   */
  public static evaluateClientBookingFreezeGuard(params: {
    clientId: number;
    clientName: string;
    referenceDate: string;
    exchangeRateEurToMad?: number | string;
    historicalSettledInvoices: HistoricalSettledInvoiceInput[];
    openReceivables: OpenReceivableInput[];
    hasActiveAdminOverride?: boolean;
  }): BookingFreezeGuardEvaluation {
    const clientOpen = params.openReceivables.filter((r) => r.clientId === params.clientId);
    const clientHist = params.historicalSettledInvoices.filter(
      (h) => h.clientId === params.clientId
    );

    const dashboard = this.buildSmartDunningDashboard({
      referenceDate: params.referenceDate,
      exchangeRateEurToMad: params.exchangeRateEurToMad || '10.85',
      historicalSettledInvoices: clientHist,
      openReceivables: clientOpen,
    });

    const profile = dashboard.clientProfiles.find((p) => p.clientId === params.clientId);
    const pviScore = profile?.pviScore || '1.00';
    const behaviorTier = profile?.behaviorTier || 'on_time';
    const overdueConsolidatedMad = profile?.overdueConsolidatedMad || '0.00';
    const maxDaysOverdue = profile?.maxDaysOverdue || 0;

    const legalReceivables = dashboard.receivables.filter(
      (r) =>
        r.clientId === params.clientId &&
        r.escalationStage === 'final_legal_mise_en_demeure' &&
        r.daysOverdue > 0
    );

    const blockingDocuments = legalReceivables.map((r) => r.documentNumber);
    const hasLegalBlock = blockingDocuments.length > 0;
    const overrideApplied = Boolean(params.hasActiveAdminOverride && hasLegalBlock);
    const isFrozen = hasLegalBlock && !overrideApplied;

    const escalationStage: DunningEscalationStage = hasLegalBlock
      ? 'final_legal_mise_en_demeure'
      : profile?.recommendedEscalationStage || 'gentle_reminder';

    const docsStr = blockingDocuments.join(', ');

    const reasonAr = isFrozen
      ? `تم تجميد طلبات الحجز آلياً للعميل (${params.clientName}) بسبب دخول الوثائق [${docsStr}] في مرحلة الإنذار القانوني النهائي (Mise en Demeure — متأخرات بقيمة ${overdueConsolidatedMad} MAD / مؤشر PVI ${pviScore}x). يرجى تسوية الذمة المالية أو طلب استثناء إداري موثق.`
      : overrideApplied
      ? `تم السماح بالحجز بموجب استثناء إداري موثق للعميل (${params.clientName}).`
      : 'الوضعية الائتمانية للعميل سليمة ومسموح بالحجز.';

    const reasonFr = isFrozen
      ? `Réservations gelées automatiquement pour le client (${params.clientName}) suite au passage des titres [${docsStr}] en Mise en Demeure (Arriérés : ${overdueConsolidatedMad} MAD / PVI ${pviScore}x). Veuillez régulariser le solde ou solliciter une dérogation administrative.`
      : overrideApplied
      ? `Réservation autorisée sous dérogation administrative auditée pour (${params.clientName}).`
      : 'Situation financière conforme — Réservation autorisée.';

    const reasonEs = isFrozen
      ? `Reservas bloqueadas automáticamente para el cliente (${params.clientName}) debido a que los documentos [${docsStr}] se encuentran en Requerimiento Legal / Mise en Demeure (Deuda vencida: ${overdueConsolidatedMad} MAD / PVI ${pviScore}x). Regularice el saldo o solicite una autorización administrativa.`
      : overrideApplied
      ? `Reserva autorizada mediante excepción administrativa auditada para (${params.clientName}).`
      : 'Situación crediticia conforme — Reserva autorizada.';

    return {
      clientId: params.clientId,
      clientName: params.clientName,
      isFrozen,
      overrideApplied,
      clientPviScore: pviScore,
      behaviorTier,
      escalationStage,
      blockingDocuments,
      overdueConsolidatedMad,
      maxDaysOverdue,
      reasonAr,
      reasonFr,
      reasonEs,
    };
  }
}


