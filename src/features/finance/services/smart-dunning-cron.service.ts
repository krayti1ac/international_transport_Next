import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppCloudMessage } from '@/lib/whatsapp';
import { sendTelegramAlert } from '@/lib/telegram';
import { sendDomainEmail } from '@/lib/email-smtp';
import { recordAuditLog } from '@/lib/audit.server';
import { SmartDunningCashFlowService } from './smart-dunning-cashflow.service';
import type {
  HistoricalSettledInvoiceInput,
  MultiTenantDunningCronResult,
  OpenReceivableInput,
  TenantDunningCronSummary,
} from '../types/smart-dunning-cashflow.types';

export interface InjectedTenantDunningPayload {
  companyId: number;
  companyName: string;
  telegramChatId?: string | null;
  settledInvoices: HistoricalSettledInvoiceInput[];
  openReceivables: OpenReceivableInput[];
}

function getSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * محرك التحصيل المجدول متعدد المستأجرين (Multi-Tenant Cron Dunning Worker):
 * يعمل بحلقة تكرارية معزولة لكل شركة نشطة (Multi-Tenant Loop) لضمان عدم تداخل الذمم المالية
 * أو رسائل المطالبات بين الشركات المستأجرة، مع تحديد العملاء المجمدة حجوزاتهم آلياً.
 */
export async function processMultiTenantSmartDunningCron(options?: {
  referenceDate?: string;
  exchangeRateEurToMad?: string;
  dryRun?: boolean;
  injectedTenants?: InjectedTenantDunningPayload[];
}): Promise<MultiTenantDunningCronResult> {
  const referenceDate =
    options?.referenceDate || new Date().toISOString().slice(0, 10);
  const exchangeRateEurToMad = options?.exchangeRateEurToMad || '10.85';
  const dryRun = Boolean(options?.dryRun);

  const result: MultiTenantDunningCronResult = {
    success: true,
    referenceDate,
    totalTenantsProcessed: 0,
    totalReceivablesEvaluated: 0,
    totalDunningDispatched: 0,
    totalLegalEscalations: 0,
    frozenClientIds: [],
    tenantSummaries: [],
    errors: [],
  };

  let tenantsToProcess: InjectedTenantDunningPayload[] = [];

  if (options?.injectedTenants && options.injectedTenants.length > 0) {
    tenantsToProcess = options.injectedTenants;
  } else {
    const supabase = getSupabaseServiceClient();
    if (supabase) {
      const { data: companiesRows } = await supabase
        .from('companies')
        .select('id, name, is_active, telegram_chat_id')
        .order('id', { ascending: true });

      const activeCompanies = Array.isArray(companiesRows) && companiesRows.length > 0
        ? companiesRows.filter((c) => c.is_active !== false)
        : [{ id: 1, name: 'Trans Bodanon International', telegram_chat_id: '-100192837465' }];

      for (const company of activeCompanies) {
        const companyId = Number(company.id);
        const companyName = String(company.name || `Company #${companyId}`);
        const companyTelegramChatId = (company as { telegram_chat_id?: string | null }).telegram_chat_id || null;

        try {
          const [clientsRes, invoicesRes, lcnRes] = await Promise.all([
            supabase
              .from('clients')
              .select('id, name, phone, email')
              .eq('company_id', companyId),
            supabase
              .from('invoices')
              .select(
                'id, invoice_number, client_id, issue_date, due_date, total_amount, paid_amount, currency, status, updated_at'
              )
              .eq('company_id', companyId)
              .limit(250),
            supabase
              .from('commercial_bills')
              .select(
                'id, bill_number, client_id, drawer_name, issue_date, maturity_date, amount, currency, status'
              )
              .eq('company_id', companyId)
              .in('status', [
                'portfolio',
                'remitted_for_collection',
                'remitted_for_discount',
                'bounced_unpaid',
              ])
              .limit(150),
          ]);

          const clientMap = new Map<
            number,
            { name: string; phone?: string; email?: string }
          >();
          if (Array.isArray(clientsRes.data)) {
            for (const c of clientsRes.data) {
              clientMap.set(Number(c.id), {
                name: String(c.name || `Client #${c.id}`),
                phone: c.phone ? String(c.phone) : undefined,
                email: c.email ? String(c.email) : undefined,
              });
            }
          }

          const settledInvoices: HistoricalSettledInvoiceInput[] = [];
          const openReceivables: OpenReceivableInput[] = [];

          if (Array.isArray(invoicesRes.data)) {
            for (const inv of invoicesRes.data) {
              const clientId = Number(inv.client_id || 0);
              const clientMeta = clientMap.get(clientId);
              const issueDate = inv.issue_date
                ? String(inv.issue_date).slice(0, 10)
                : SmartDunningCashFlowService.addDaysUtc(referenceDate, -30);
              const dueDate = inv.due_date
                ? String(inv.due_date).slice(0, 10)
                : SmartDunningCashFlowService.addDaysUtc(issueDate, 30);
              const currency =
                String(inv.currency || 'MAD').toUpperCase() === 'EUR' ? 'EUR' : 'MAD';

              if (inv.status === 'paid') {
                const settledDate = inv.updated_at
                  ? String(inv.updated_at).slice(0, 10)
                  : dueDate;
                settledInvoices.push({
                  invoiceId: inv.id,
                  clientId,
                  issueDate,
                  dueDate,
                  settledDate,
                  agreedTermsDays: Math.max(
                    1,
                    SmartDunningCashFlowService.diffDaysUtc(issueDate, dueDate)
                  ),
                  amount: String(inv.total_amount ?? '0'),
                  currency,
                });
              } else if (inv.status !== 'cancelled') {
                openReceivables.push({
                  id: `INV-${inv.id}`,
                  documentNumber: String(inv.invoice_number || `INV-${inv.id}`),
                  documentType: 'invoice',
                  clientId,
                  clientName: clientMeta?.name || `Client #${clientId}`,
                  clientPhone: clientMeta?.phone,
                  clientEmail: clientMeta?.email,
                  preferredLocale: currency === 'EUR' ? 'fr' : 'ar',
                  issueDate,
                  contractualDueDate: dueDate,
                  agreedTermsDays: Math.max(
                    1,
                    SmartDunningCashFlowService.diffDaysUtc(issueDate, dueDate)
                  ),
                  currency,
                  totalAmount: String(inv.total_amount ?? '0'),
                  paidAmount: String(inv.paid_amount ?? '0'),
                });
              }
            }
          }

          if (Array.isArray(lcnRes.data)) {
            for (const bill of lcnRes.data) {
              const clientId = Number(bill.client_id || 0);
              const clientMeta = clientMap.get(clientId);
              const issueDate = bill.issue_date
                ? String(bill.issue_date).slice(0, 10)
                : SmartDunningCashFlowService.addDaysUtc(referenceDate, -20);
              const maturityDate = bill.maturity_date
                ? String(bill.maturity_date).slice(0, 10)
                : SmartDunningCashFlowService.addDaysUtc(issueDate, 30);
              const currency =
                String(bill.currency || 'MAD').toUpperCase() === 'EUR' ? 'EUR' : 'MAD';

              openReceivables.push({
                id: `LCN-${bill.id}`,
                documentNumber: String(bill.bill_number || `LCN-${bill.id}`),
                documentType: 'lcn_bill',
                clientId,
                clientName:
                  clientMeta?.name ||
                  (bill.drawer_name ? String(bill.drawer_name) : `Client #${clientId}`),
                clientPhone: clientMeta?.phone,
                clientEmail: clientMeta?.email,
                preferredLocale: 'fr',
                issueDate,
                contractualDueDate: maturityDate,
                agreedTermsDays: Math.max(
                  1,
                  SmartDunningCashFlowService.diffDaysUtc(issueDate, maturityDate)
                ),
                currency,
                totalAmount: String(bill.amount ?? '0'),
                paidAmount: '0',
              });
            }
          }

          tenantsToProcess.push({
            companyId,
            companyName,
            telegramChatId: companyTelegramChatId,
            settledInvoices,
            openReceivables,
          });
        } catch (err) {
          result.errors.push({
            companyId,
            error: err instanceof Error ? err.message : 'Tenant query failed',
          });
        }
      }
    }
  }

  const frozenSet = new Set<number>();

  // Execute isolated Multi-Tenant Dunning Loop
  for (const tenant of tenantsToProcess) {
    result.totalTenantsProcessed += 1;

    const dashboard = SmartDunningCashFlowService.buildSmartDunningDashboard({
      referenceDate,
      exchangeRateEurToMad,
      historicalSettledInvoices: tenant.settledInvoices,
      openReceivables: tenant.openReceivables,
    });

    let tenantDispatched = 0;
    let tenantLegalCount = 0;
    const tenantFrozenSet = new Set<number>();

    for (const item of dashboard.receivables) {
      result.totalReceivablesEvaluated += 1;

      if (
        item.escalationStage === 'final_legal_mise_en_demeure' &&
        item.daysOverdue > 0
      ) {
        tenantLegalCount += 1;
        tenantFrozenSet.add(item.clientId);
        frozenSet.add(item.clientId);
      }

      const shouldSend = SmartDunningCashFlowService.shouldDispatchScheduledDunning(
        item.daysOverdue,
        item.escalationStage
      );

      if (!shouldSend) continue;

      tenantDispatched += 1;
      result.totalDunningDispatched += 1;

      if (!dryRun) {
        const { subject, bodyText, htmlBody } =
          SmartDunningCashFlowService.buildTrilingualDunningMessage({
            locale: item.preferredLocale || 'fr',
            clientName: item.clientName,
            documentNumber: item.documentNumber,
            remainingAmount: item.remainingAmount,
            currency: item.currency,
            contractualDueDate: item.contractualDueDate,
            daysOverdue: item.daysOverdue,
            escalationStage: item.escalationStage,
          });

        if (item.clientPhone) {
          await sendWhatsAppCloudMessage({
            to: item.clientPhone,
            message: bodyText,
            auditEntity: {
              type: 'smart_dunning_cron',
              id: `${tenant.companyId}:${item.id}`,
            },
          }).catch(() => {});
        }

        if (item.clientEmail) {
          await sendDomainEmail({
            to: item.clientEmail,
            subject,
            html: htmlBody,
            text: bodyText,
            companyId: tenant.companyId,
          }).catch(() => {});
        }

        const targetTelegramChat =
          tenant.telegramChatId || process.env.TELEGRAM_DEFAULT_CHAT_ID;
        if (targetTelegramChat && process.env.TELEGRAM_BOT_TOKEN) {
          const siteUrl =
            process.env.NEXT_PUBLIC_APP_URL || 'https://app.transbodanon.ma';
          const tgDunningHtml =
            `💳 <b>إشعار تحصيل ومطالبة مالية (${item.escalationStage}) | ${tenant.companyName}</b>\n\n` +
            `• <b>العميل:</b> ${item.clientName}\n` +
            `• <b>الوثيقة:</b> <code>${item.documentNumber}</code>\n` +
            `• <b>المبلغ المتبقي:</b> <b>${item.remainingAmount} ${item.currency}</b>\n` +
            `• <b>أيام التأخير:</b> ${item.daysOverdue} يوم`;

          await sendTelegramAlert({
            chatId: targetTelegramChat,
            message: tgDunningHtml,
            inlineButtons: [
              [
                {
                  text: '📊 رادار التحصيل والـ PVI',
                  url: `${siteUrl}/finance`,
                },
              ],
            ],
            auditEntity: {
              type: 'smart_dunning_cron',
              id: `${tenant.companyId}:${item.id}`,
            },
          }).catch(() => {});
        }

        await recordAuditLog({
          entityType: 'smart_dunning_cron',
          entityId: `${tenant.companyId}:${item.id}`,
          actionType: 'whatsapp_notification',
          reason: `[Cron Multi-Tenant #${tenant.companyId}] إشعار مطالبة (${item.escalationStage}) للوثيقة ${item.documentNumber}`,
          newData: {
            companyId: tenant.companyId,
            companyName: tenant.companyName,
            clientId: item.clientId,
            documentNumber: item.documentNumber,
            escalationStage: item.escalationStage,
            daysOverdue: item.daysOverdue,
            remainingAmount: item.remainingAmount,
            currency: item.currency,
          },
        }).catch(() => {});
      }
    }

    result.totalLegalEscalations += tenantLegalCount;

    const tenantSummary: TenantDunningCronSummary = {
      companyId: tenant.companyId,
      companyName: tenant.companyName,
      receivablesEvaluated: dashboard.receivables.length,
      dunningDispatched: tenantDispatched,
      legalEscalationsCount: tenantLegalCount,
      frozenClientIds: Array.from(tenantFrozenSet),
      totalOverdueConsolidatedMad: dashboard.totalOverdueConsolidatedMad,
    };

    result.tenantSummaries.push(tenantSummary);
  }

  result.frozenClientIds = Array.from(frozenSet);
  return result;
}

