'use server';

/**
 * Trans Bodanon TMS — Commercial Bills, Promissory Notes & LCN Server Actions
 * Orchestrates portfolio lifecycle, bank remittance, FIFO invoice settlement, and bouncing.
 */

import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import { processFIFOPayment } from '@/lib/fifo-payment';
import Decimal from 'decimal.js';
import {
  createCommercialBillSchema,
  remitCommercialBillSchema,
  clearCommercialBillSchema,
  bounceCommercialBillSchema,
  type CreateCommercialBillInput,
  type RemitCommercialBillInput,
  type ClearCommercialBillInput,
  type BounceCommercialBillInput,
  type CommercialBill,
  type CommercialBillsSummary,
  type BillStatus,
} from '../types/commercial-bills.types';
import { calculatePortfolioSummary } from './commercial-bills-calc.service';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// In-memory fallback store for offline resiliency and unit tests
const billsStore = new Map<string, CommercialBill>();

export async function clearCommercialBillsCache(): Promise<void> {
  billsStore.clear();
}

/**
 * Server Action: Fetches all commercial bills with optional status/search filters
 */
export async function fetchCommercialBillsAction(filter?: {
  status?: BillStatus;
  clientId?: number;
  search?: string;
}): Promise<{
  success: boolean;
  data: CommercialBill[];
  error?: string;
}> {
  try {
    try {
      const supabase = await createClient();
      let query = supabase
        .from('commercial_bills')
        .select('*')
        .order('due_date', { ascending: true });

      if (filter?.status) {
        query = query.eq('status', filter.status);
      }
      if (filter?.clientId) {
        query = query.eq('client_id', filter.clientId);
      }

      const { data: dbData, error: dbError } = await query;
      if (!dbError && dbData && dbData.length > 0) {
        const mapped: CommercialBill[] = dbData.map((d: any) => ({
          id: d.id,
          companyId: d.company_id,
          billType: d.bill_type,
          billNumber: d.bill_number,
          clientId: d.client_id,
          clientName: d.client_name,
          issuerName: d.issuer_name,
          drawerBankName: d.drawer_bank_name,
          drawerBankRib: d.drawer_bank_rib,
          faceValue: Number(d.face_value || 0),
          currency: d.currency || 'MAD',
          issueDate: d.issue_date,
          dueDate: d.due_date,
          status: d.status,
          remittanceDate: d.remittance_date,
          remittanceBankAccountId: d.remittance_bank_account_id,
          remittanceReference: d.remittance_reference,
          clearedDate: d.cleared_date,
          clearedAmount: d.cleared_amount ? Number(d.cleared_amount) : null,
          discountFee: Number(d.discount_fee || 0),
          bounceReason: d.bounce_reason,
          bounceDate: d.bounce_date,
          bounceFee: Number(d.bounce_fee || 0),
          treasuryTransactionId: d.treasury_transaction_id,
          allocatedInvoiceIds: Array.isArray(d.allocated_invoice_ids) ? d.allocated_invoice_ids : [],
          imageUrl: d.image_url,
          notes: d.notes,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }));

        mapped.forEach((b) => billsStore.set(b.id, b));
        let results = mapped;
        if (filter?.search) {
          const s = filter.search.toLowerCase();
          results = results.filter(
            (b) =>
              b.billNumber.toLowerCase().includes(s) ||
              b.clientName.toLowerCase().includes(s) ||
              (b.drawerBankName && b.drawerBankName.toLowerCase().includes(s))
          );
        }
        return { success: true, data: results };
      }
    } catch (dbErr) {
      console.warn('[fetchCommercialBillsAction DB Fallback]:', dbErr);
    }

    let all = Array.from(billsStore.values());
    if (filter?.status) {
      all = all.filter((b) => b.status === filter.status);
    }
    if (filter?.clientId) {
      all = all.filter((b) => b.clientId === filter.clientId);
    }
    if (filter?.search) {
      const s = filter.search.toLowerCase();
      all = all.filter(
        (b) =>
          b.billNumber.toLowerCase().includes(s) ||
          b.clientName.toLowerCase().includes(s) ||
          (b.drawerBankName && b.drawerBankName.toLowerCase().includes(s))
      );
    }

    // Sort by due date ascending
    all.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    return { success: true, data: all };
  } catch (err) {
    console.error('[fetchCommercialBillsAction Error]:', err);
    return {
      success: false,
      data: [],
      error: err instanceof Error ? err.message : 'Failed to fetch commercial bills',
    };
  }
}

/**
 * Server Action: Registers a new check, promissory note, or LCN into portfolio
 */
export async function createCommercialBillAction(
  rawInput: CreateCommercialBillInput
): Promise<{
  success: boolean;
  data?: CommercialBill;
  error?: string;
}> {
  try {
    const parsed = createCommercialBillSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
      };
    }

    const input = parsed.data;
    const billId = `bill-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const nowIso = new Date().toISOString();

    const newBill: CommercialBill = {
      id: billId,
      billType: input.billType,
      billNumber: input.billNumber,
      clientId: input.clientId || null,
      clientName: input.clientName,
      issuerName: input.issuerName || input.clientName,
      drawerBankName: input.drawerBankName || null,
      drawerBankRib: input.drawerBankRib || null,
      faceValue: input.faceValue,
      currency: input.currency,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      status: 'in_portfolio',
      discountFee: 0,
      bounceFee: 0,
      allocatedInvoiceIds: [],
      notes: input.notes || null,
      imageUrl: input.imageUrl || null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    billsStore.set(billId, newBill);

    try {
      const supabase = await createClient();
      const { data: dbData, error: dbError } = await supabase
        .from('commercial_bills')
        .insert({
          bill_type: newBill.billType,
          bill_number: newBill.billNumber,
          client_id: newBill.clientId,
          client_name: newBill.clientName,
          issuer_name: newBill.issuerName,
          drawer_bank_name: newBill.drawerBankName,
          drawer_bank_rib: newBill.drawerBankRib,
          face_value: newBill.faceValue,
          currency: newBill.currency,
          issue_date: newBill.issueDate,
          due_date: newBill.dueDate,
          status: newBill.status,
          notes: newBill.notes,
          image_url: newBill.imageUrl,
        })
        .select('id')
        .maybeSingle();

      if (dbData?.id) {
        newBill.id = dbData.id;
        billsStore.set(dbData.id, newBill);
      }

      await recordAuditLog({
        entityType: 'commercial_bills',
        entityId: newBill.id,
        actionType: 'create',
        newData: {
          billType: newBill.billType,
          billNumber: newBill.billNumber,
          clientName: newBill.clientName,
          faceValue: newBill.faceValue,
          dueDate: newBill.dueDate,
        },
      });

      return { success: true, data: newBill };
    } catch (dbErr) {
      console.warn('[createCommercialBillAction DB Fallback]:', dbErr);
    }

    return { success: true, data: newBill };
  } catch (err) {
    console.error('[createCommercialBillAction Error]:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create commercial bill',
    };
  }
}

/**
 * Server Action: Remits a commercial bill to bank (for collection or discount)
 */
export async function remitCommercialBillAction(
  rawInput: RemitCommercialBillInput
): Promise<{
  success: boolean;
  data?: CommercialBill;
  error?: string;
}> {
  try {
    const parsed = remitCommercialBillSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
      };
    }

    const input = parsed.data;
    const bill = billsStore.get(input.billId);
    const newStatus: BillStatus =
      input.operationType === 'discount' ? 'discounted' : 'remitted_for_collection';

    if (bill) {
      bill.status = newStatus;
      bill.remittanceDate = input.remittanceDate;
      bill.remittanceBankAccountId = input.bankAccountId || null;
      bill.remittanceReference = input.remittanceReference;
      bill.discountFee = input.discountFee || 0;
      bill.updatedAt = new Date().toISOString();
      billsStore.set(bill.id, bill);
    }

    try {
      const supabase = await createClient();
      await supabase
        .from('commercial_bills')
        .update({
          status: newStatus,
          remittance_date: input.remittanceDate,
          remittance_bank_account_id: input.bankAccountId || null,
          remittance_reference: input.remittanceReference,
          discount_fee: input.discountFee || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.billId);

      await recordAuditLog({
        entityType: 'commercial_bills',
        entityId: input.billId,
        actionType: 'update',
        newData: {
          status: newStatus,
          operationType: input.operationType,
          remittanceReference: input.remittanceReference,
        },
      });
    } catch (dbErr) {
      console.warn('[remitCommercialBillAction DB Fallback]:', dbErr);
    }

    return { success: true, data: bill };
  } catch (err) {
    console.error('[remitCommercialBillAction Error]:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remit commercial bill',
    };
  }
}

/**
 * Server Action: Clears a commercial bill, deposits into treasury, and triggers FIFO settlement
 */
export async function clearCommercialBillAction(
  rawInput: ClearCommercialBillInput
): Promise<{
  success: boolean;
  data?: CommercialBill;
  allocatedInvoices?: number[];
  error?: string;
}> {
  try {
    const parsed = clearCommercialBillSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
      };
    }

    const input = parsed.data;
    const bill = billsStore.get(input.billId);
    if (!bill) {
      return { success: false, error: 'Commercial bill not found' };
    }

    const clearedAmount = input.clearedAmount || bill.faceValue;
    bill.status = 'cleared';
    bill.clearedDate = input.clearedDate;
    bill.clearedAmount = clearedAmount;
    bill.updatedAt = new Date().toISOString();

    let allocatedInvoiceIds: number[] = [];

    // Execute FIFO payment allocation and Treasury deposit
    try {
      const supabase = await createClient();

      if (input.triggerFifoAllocation && bill.clientId) {
        const fifoRes = await processFIFOPayment(supabase, {
          clientId: bill.clientId,
          amount: clearedAmount,
          currency: bill.currency,
          paymentMethod: bill.billType === 'cheque' ? 'check' : 'bank_transfer',
          reference: `${bill.billType.toUpperCase()} #${bill.billNumber}`,
          bankAccountId: input.bankAccountId || bill.remittanceBankAccountId || undefined,
          notes: `Paiement via ${bill.billType} #${bill.billNumber} encaissé le ${input.clearedDate}`,
        });

        if (fifoRes.success && fifoRes.allocations) {
          allocatedInvoiceIds = fifoRes.allocations.map((a) => a.invoiceId);
          bill.allocatedInvoiceIds = allocatedInvoiceIds;
        }
      }

      // Record treasury deposit transaction
      const { data: txData } = await supabase
        .from('treasury_transactions')
        .insert({
          type: 'deposit',
          amount: clearedAmount,
          currency: bill.currency,
          destination_type: 'bank',
          destination_id: input.bankAccountId || bill.remittanceBankAccountId || null,
          description: `Encaissement ${bill.billType === 'cheque' ? 'Chèque' : 'LCN'} ${bill.billNumber} (${bill.clientName})`,
          reference: bill.billNumber,
          date: input.clearedDate,
        })
        .select('id')
        .maybeSingle();

      if (txData?.id) {
        bill.treasuryTransactionId = txData.id;
      }

      await supabase
        .from('commercial_bills')
        .update({
          status: 'cleared',
          cleared_date: input.clearedDate,
          cleared_amount: clearedAmount,
          allocated_invoice_ids: allocatedInvoiceIds,
          treasury_transaction_id: bill.treasuryTransactionId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.billId);

      await recordAuditLog({
        entityType: 'commercial_bills',
        entityId: input.billId,
        actionType: 'update',
        newData: {
          status: 'cleared',
          clearedAmount,
          allocatedInvoicesCount: allocatedInvoiceIds.length,
        },
      });
    } catch (dbErr) {
      console.warn('[clearCommercialBillAction DB Fallback]:', dbErr);
    }

    billsStore.set(bill.id, bill);

    return {
      success: true,
      data: bill,
      allocatedInvoices: allocatedInvoiceIds,
    };
  } catch (err) {
    console.error('[clearCommercialBillAction Error]:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to clear commercial bill',
    };
  }
}

/**
 * Server Action: Marks a bill as bounced/unpaid, records fees, and flags client debt
 */
export async function bounceCommercialBillAction(
  rawInput: BounceCommercialBillInput
): Promise<{
  success: boolean;
  data?: CommercialBill;
  error?: string;
}> {
  try {
    const parsed = bounceCommercialBillSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
      };
    }

    const input = parsed.data;
    const bill = billsStore.get(input.billId);
    if (!bill) {
      return { success: false, error: 'Commercial bill not found' };
    }

    bill.status = 'bounced_unpaid';
    bill.bounceDate = input.bounceDate;
    bill.bounceReason = input.bounceReason;
    bill.bounceFee = input.bounceFee;
    bill.updatedAt = new Date().toISOString();

    try {
      const supabase = await createClient();

      // Record rejection fee as an operating expense in treasury if bounceFee > 0
      if (input.bounceFee > 0) {
        await supabase.from('treasury_transactions').insert({
          type: 'expense',
          amount: input.bounceFee,
          currency: bill.currency,
          destination_type: 'bank',
          destination_id: bill.remittanceBankAccountId || null,
          description: `Frais rejet bancaire ${bill.billType} #${bill.billNumber} (${input.bounceReason})`,
          reference: `REJET-${bill.billNumber}`,
          date: input.bounceDate,
        });
      }

      await supabase
        .from('commercial_bills')
        .update({
          status: 'bounced_unpaid',
          bounce_date: input.bounceDate,
          bounce_reason: input.bounceReason,
          bounce_fee: input.bounceFee,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.billId);

      await recordAuditLog({
        entityType: 'commercial_bills',
        entityId: input.billId,
        actionType: 'update',
        newData: {
          status: 'bounced_unpaid',
          reason: input.bounceReason,
          bounceFee: input.bounceFee,
        },
      });
    } catch (dbErr) {
      console.warn('[bounceCommercialBillAction DB Fallback]:', dbErr);
    }

    billsStore.set(bill.id, bill);

    return { success: true, data: bill };
  } catch (err) {
    console.error('[bounceCommercialBillAction Error]:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to record bounced bill',
    };
  }
}

/**
 * Server Action: Computes live summary KPIs across commercial bills portfolio
 */
export async function getCommercialBillsSummaryAction(): Promise<{
  success: boolean;
  data: CommercialBillsSummary;
  error?: string;
}> {
  try {
    const res = await fetchCommercialBillsAction();
    const bills = res.data || [];
    const summary = calculatePortfolioSummary(bills);
    return { success: true, data: summary };
  } catch (err) {
    console.error('[getCommercialBillsSummaryAction Error]:', err);
    return {
      success: false,
      data: calculatePortfolioSummary([]),
      error: err instanceof Error ? err.message : 'Failed to compute bills summary',
    };
  }
}

