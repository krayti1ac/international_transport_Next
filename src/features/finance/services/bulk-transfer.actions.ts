'use server';

import Decimal from 'decimal.js';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import {
  cancelBatchSchema,
  createBulkBatchSchema,
  executeBatchSchema,
  type CancelBatchInput,
  type CreateBulkBatchInput,
  type ExecuteBatchInput,
} from '../schemas/bulk-transfer.schemas';
import { BulkTransferGeneratorService } from './bulk-transfer-generator.service';
import type {
  BulkTransferBatch,
  EligibleSettlementForTransfer,
  GeneratedTransferFile,
} from '../types/bulk-transfer.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

interface DriverBankRecord {
  id: number;
  name: string;
  phone?: string | null;
  license?: string | null;
  bank_name?: string | null;
  bank_rib?: string | null;
  bank_iban?: string | null;
  bank_bic?: string | null;
}

/**
 * جلب بيانات كشوفات التسوية المعتمدة والمؤهلة للتحويل البنكي المجمع
 */
export async function getEligibleSettlementsForTransferAction(): Promise<{
  success: boolean;
  data?: EligibleSettlementForTransfer[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // 1. استعلام الكشوفات المعتمدة أو المدققة
    const { data: statements, error: stmtsError } = await supabase
      .from('driver_settlement_statements')
      .select('*')
      .in('status', ['approved', 'audited'])
      .order('period_start', { ascending: false });

    if (stmtsError) {
      return { success: false, error: stmtsError.message };
    }

    if (!statements || statements.length === 0) {
      return { success: true, data: [] };
    }

    // 2. استعلام بيانات السائقين بما فيها الحسابات البنكية
    const driverIds = Array.from(new Set(statements.map((s) => s.driver_id)));
    const { data: drivers, error: drvError } = await supabase
      .from('drivers')
      .select('id, name, phone, license, bank_name, bank_rib, bank_iban, bank_bic')
      .in('id', driverIds);

    if (drvError) {
      return { success: false, error: drvError.message };
    }

    const driverMap = new Map<number, DriverBankRecord>();
    for (const d of (drivers as DriverBankRecord[]) || []) {
      driverMap.set(d.id, d);
    }

    // 3. التحقق الحسابي والمصرفي من سلامة أرقام الحسابات
    const eligibleList: EligibleSettlementForTransfer[] = [];

    for (const stmt of statements) {
      const netPayoutDec = new Decimal(stmt.net_payout_mad || 0);
      if (netPayoutDec.lessThanOrEqualTo(0)) {
        continue; // تجاهل الكشوفات الصفرية أو السالبة
      }

      const driver = driverMap.get(stmt.driver_id);
      const bankRib = driver?.bank_rib || '';
      const bankIban = driver?.bank_iban || '';
      const bankBic = driver?.bank_bic || '';

      const ribVal = BulkTransferGeneratorService.validateMoroccanRib(bankRib);
      const ibanVal = BulkTransferGeneratorService.validateIban(bankIban);

      const validationErrors: string[] = [];
      if (!bankRib && !bankIban) {
        validationErrors.push('لا يوجد حساب بنكي مسجل للسائق (RIB أو IBAN)');
      }
      if (bankRib && !ribVal.isValid && ribVal.error) {
        validationErrors.push(`RIB: ${ribVal.error}`);
      }
      if (bankIban && !ibanVal.isValid && ibanVal.error) {
        validationErrors.push(`IBAN: ${ibanVal.error}`);
      }

      eligibleList.push({
        statement_id: stmt.id,
        statement_number: stmt.statement_number,
        driver_id: stmt.driver_id,
        driver_name: driver?.name || `سائق #${stmt.driver_id}`,
        driver_phone: driver?.phone || undefined,
        driver_license: driver?.license || undefined,
        net_payout_mad: netPayoutDec.toNumber(),
        period_start: stmt.period_start,
        period_end: stmt.period_end,
        status: stmt.status,
        bank_name: driver?.bank_name || ribVal.bankName,
        bank_rib: bankRib || null,
        bank_iban: bankIban || null,
        bank_bic: bankBic || null,
        is_rib_valid: ribVal.isValid,
        is_iban_valid: ibanVal.isValid,
        validation_errors: validationErrors,
      });
    }

    return { success: true, data: eligibleList };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'خطأ غير متوقع أثناء جلب الكشوفات';
    return { success: false, error: errorMsg };
  }
}

/**
 * إنشاء دفعة تحويلات بنكية مجمعة وتوليد ملف التحويل المصرفي (SEPA XML أو LCN Flat/CSV)
 */
export async function createBulkTransferBatchAction(
  rawInput: CreateBulkBatchInput
): Promise<{
  success: boolean;
  batch?: BulkTransferBatch;
  generatedFile?: GeneratedTransferFile;
  error?: string;
}> {
  try {
    const input = createBulkBatchSchema.parse(rawInput);
    const supabase = await createClient();

    // 1. جلب بيانات المستخدم والشركة
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let companyId: number = 1;
    let companyName = 'ترانس بودانون الدولية';
    let companyIce = '001598765432198';

    if (user) {
      const { data: userProfile } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single();
      if (userProfile?.company_id) {
        companyId = Number(userProfile.company_id);
      }
    }

    const { data: companyRecord } = await supabase
      .from('companies')
      .select('id, name, ice')
      .eq('id', companyId)
      .single();

    if (companyRecord) {
      companyName = companyRecord.name;
      companyIce = companyRecord.ice || companyIce;
    }

    // 2. جلب بيانات الكشوفات المحددة
    const { data: statements, error: stmtsErr } = await supabase
      .from('driver_settlement_statements')
      .select('*')
      .in('id', input.statementIds);

    if (stmtsErr || !statements || statements.length === 0) {
      return { success: false, error: 'لم يتم العثور على أي كشوفات تسوية صالحة من الكشوفات المحددة' };
    }

    // 3. جلب بيانات السائقين
    const driverIds = Array.from(new Set(statements.map((s) => s.driver_id)));
    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, name, bank_name, bank_rib, bank_iban, bank_bic')
      .in('id', driverIds);

    const driverMap = new Map<number, DriverBankRecord>();
    for (const d of (drivers as DriverBankRecord[]) || []) {
      driverMap.set(d.id, d);
    }

    // 4. إنشاء المعاملات الفردية واحتساب الإجمالي بدقة Decimal.js
    let totalBatchSum = new Decimal(0);
    const itemsData: Array<{
      recipientName: string;
      recipientId: number;
      bankName?: string;
      bankRib?: string;
      bankIban?: string;
      bankBic?: string;
      amount: InstanceType<typeof Decimal>;
      settlementStatementId: number;
      endToEndId: string;
      remittanceInformation: string;
      validationStatus: 'valid' | 'warning' | 'invalid';
      validationErrors: string[];
    }> = [];

    const dateCompact = input.executionDate.replace(/-/g, '');
    const prefix = input.paymentMethod === 'sepa_credit_transfer' ? 'SEPA' : 'LCN';
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const batchReference = `${prefix}-${dateCompact}-${randomSuffix}`;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const driver = driverMap.get(stmt.driver_id);
      const amountDec = new Decimal(stmt.net_payout_mad || 0);

      if (amountDec.lessThanOrEqualTo(0)) {
        continue;
      }

      totalBatchSum = totalBatchSum.plus(amountDec);

      const driverName = driver?.name || `سائق #${stmt.driver_id}`;
      const endToEndId = `TRF-${dateCompact}-${stmt.driver_id}-${i + 1}`;
      const remittance = `Paiement Salaire ${stmt.period_start} Ref ${stmt.statement_number}`;

      const bankRib = driver?.bank_rib || '';
      const bankIban = driver?.bank_iban || '';
      const bankBic = driver?.bank_bic || '';

      const ribVal = BulkTransferGeneratorService.validateMoroccanRib(bankRib);
      const ibanVal = BulkTransferGeneratorService.validateIban(bankIban);

      const errors: string[] = [];
      let status: 'valid' | 'warning' | 'invalid' = 'valid';

      if (input.paymentMethod === 'sepa_credit_transfer') {
        if (!ibanVal.isValid) {
          errors.push(ibanVal.error || 'رقم IBAN غير صالح');
          status = 'invalid';
        }
      } else {
        if (!ribVal.isValid) {
          errors.push(ribVal.error || 'رقم الحساب البنكي المغربي RIB غير صالح');
          status = 'invalid';
        }
      }

      itemsData.push({
        recipientName: driverName,
        recipientId: stmt.driver_id,
        bankName: driver?.bank_name || ribVal.bankName,
        bankRib: bankRib || undefined,
        bankIban: bankIban || undefined,
        bankBic: bankBic || undefined,
        amount: amountDec,
        settlementStatementId: stmt.id,
        endToEndId,
        remittanceInformation: remittance,
        validationStatus: status,
        validationErrors: errors,
      });
    }

    if (itemsData.length === 0) {
      return { success: false, error: 'لا توجد أي مبالغ مستحقة قابلة للصرف ضمن الكشوفات المحددة' };
    }

    // 5. توليد الملف المصرفي المناسب
    let generatedFile: GeneratedTransferFile;

    if (input.formatType === 'pain_001_001_03') {
      generatedFile = BulkTransferGeneratorService.generateSepaPain001Xml({
        initiatorName: companyName,
        debtorName: companyName,
        debtorIban: input.debtorIban || 'MA64007780000012345678901209',
        debtorBic: input.debtorBic || 'BCPOMAMC',
        batchReference,
        executionDate: input.executionDate,
        currency: input.currency || 'EUR',
        items: itemsData.map((it) => ({
          recipientName: it.recipientName,
          bankIban: it.bankIban || '',
          bankBic: it.bankBic,
          amount: it.amount.toNumber(),
          endToEndId: it.endToEndId,
          remittanceInformation: it.remittanceInformation,
          recipientId: it.recipientId,
          settlementStatementId: it.settlementStatementId,
        })),
      });
    } else if (input.formatType === 'moroccan_lcn_virement') {
      generatedFile = BulkTransferGeneratorService.generateMoroccanLcnFlatFile({
        companyName,
        companyIce,
        sourceRib: input.sourceRib || '007780000012345678901209',
        batchReference,
        executionDate: input.executionDate,
        items: itemsData.map((it) => ({
          recipientName: it.recipientName,
          bankRib: it.bankRib || '',
          amount: it.amount.toNumber(),
          endToEndId: it.endToEndId,
          remittanceInformation: it.remittanceInformation,
          recipientId: it.recipientId,
          settlementStatementId: it.settlementStatementId,
        })),
      });
    } else {
      // csv_banking
      generatedFile = BulkTransferGeneratorService.generateMoroccanBankingCsv({
        companyName,
        companyIce,
        sourceRib: input.sourceRib || '007780000012345678901209',
        batchReference,
        executionDate: input.executionDate,
        items: itemsData.map((it) => ({
          recipientName: it.recipientName,
          bankRib: it.bankRib || '',
          amount: it.amount.toNumber(),
          endToEndId: it.endToEndId,
          remittanceInformation: it.remittanceInformation,
          recipientId: it.recipientId,
          settlementStatementId: it.settlementStatementId,
        })),
      });
    }

    // 6. حفظ الدفعة في قاعدة البيانات
    const { data: batchRecord, error: batchErr } = await supabase
      .from('bulk_transfer_batches')
      .insert({
        company_id: companyId,
        batch_reference: batchReference,
        payment_method: input.paymentMethod,
        source_bank_account_id: input.sourceBankAccountId || null,
        currency: input.currency,
        total_amount: totalBatchSum.toNumber(),
        transactions_count: itemsData.length,
        status: 'generated',
        execution_date: input.executionDate,
        format_type: input.formatType,
        file_content: generatedFile.fileContent,
        file_name: generatedFile.fileName,
        generated_by: user?.id || null,
        generated_at: new Date().toISOString(),
        notes: input.notes || null,
        metadata: {
          checksumSha256: generatedFile.checksumSha256,
          companyIce,
        },
      })
      .select('*')
      .single();

    if (batchErr || !batchRecord) {
      return { success: false, error: batchErr?.message || 'فشل حفظ دفعة التحويل البنكي' };
    }

    // 7. حفظ بنود المعاملات الفردية
    const itemsToInsert = itemsData.map((it) => ({
      batch_id: batchRecord.id,
      company_id: companyId,
      recipient_type: 'driver' as const,
      recipient_id: it.recipientId,
      recipient_name: it.recipientName,
      bank_name: it.bankName || null,
      bank_account_rib: it.bankRib || null,
      bank_account_iban: it.bankIban || null,
      bank_bic_swift: it.bankBic || null,
      amount: it.amount.toNumber(),
      currency: input.currency,
      settlement_statement_id: it.settlementStatementId,
      end_to_end_id: it.endToEndId,
      remittance_information: it.remittanceInformation,
      status: 'included' as const,
      validation_status: it.validationStatus,
      validation_errors: it.validationErrors,
    }));

    const { error: itemsInsertErr } = await supabase
      .from('bulk_transfer_items')
      .insert(itemsToInsert);

    if (itemsInsertErr) {
      console.warn('Items insert warning:', itemsInsertErr);
    }

    // 8. تسجيل في سجل التدقيق المحاسبي
    await recordAuditLog({
      actionType: 'create',
      entityId: String(batchRecord.id),
      entityType: 'bulk_transfer_batch',
      newData: {
        batchReference,
        transactionsCount: itemsData.length,
        totalAmount: totalBatchSum.toNumber(),
        formatType: input.formatType,
        currency: input.currency,
        checksum: generatedFile.checksumSha256,
      },
    });

    revalidatePath('/driver-settlements');
    return {
      success: true,
      batch: batchRecord,
      generatedFile,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'فشل إنشاء دفعة التحويل البنكي';
    return { success: false, error: errorMsg };
  }
}

/**
 * جلب قائمة الدفعات المصرفية المسجلة
 */
export async function getBulkTransferBatchesAction(): Promise<{
  success: boolean;
  data?: BulkTransferBatch[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data: batches, error } = await supabase
      .from('bulk_transfer_batches')
      .select('*, items:bulk_transfer_items(*)')
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: batches as BulkTransferBatch[] };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'فشل جلب دفعات التحويلات';
    return { success: false, error: errorMsg };
  }
}

/**
 * تنفيذ واعتماد الدفعة المصرفية وتحديث حالات الكشوفات إلى 'settled'
 */
export async function executeBulkTransferBatchAction(
  rawInput: ExecuteBatchInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const input = executeBatchSchema.parse(rawInput);
    const supabase = await createClient();

    // 1. جلب الدفعة وبنودها
    const { data: batch, error: batchErr } = await supabase
      .from('bulk_transfer_batches')
      .select('*, items:bulk_transfer_items(*)')
      .eq('id', input.batchId)
      .single();

    if (batchErr || !batch) {
      return { success: false, error: 'تعذر العثور على الدفعة المصرفية المطلوبة' };
    }

    if (batch.status === 'executed') {
      return { success: false, error: 'الدفعة المصرفية معتمدة ومنفذة مسبقاً' };
    }

    const nowIso = new Date().toISOString();

    // 2. تحديث الدفعة
    const { error: updateBatchErr } = await supabase
      .from('bulk_transfer_batches')
      .update({
        status: 'executed',
        executed_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', batch.id);

    if (updateBatchErr) {
      return { success: false, error: updateBatchErr.message };
    }

    // 3. تحديث بنود الدفعة
    await supabase
      .from('bulk_transfer_items')
      .update({
        status: 'executed',
        updated_at: nowIso,
      })
      .eq('batch_id', batch.id);

    // 4. تحديث كشوفات تسوية السائقين المرتبطة إلى 'settled'
    const statementIds = (batch.items || [])
      .map((it: { settlement_statement_id?: number | null }) => it.settlement_statement_id)
      .filter((id: number | null | undefined): id is number => typeof id === 'number' && id > 0);

    if (statementIds.length > 0) {
      await supabase
        .from('driver_settlement_statements')
        .update({
          status: 'settled',
          settled_at: nowIso,
          updated_at: nowIso,
        })
        .in('id', statementIds);
    }

    // 5. تسجيل في سجل التدقيق
    await recordAuditLog({
      actionType: 'update',
      entityId: String(batch.id),
      entityType: 'bulk_transfer_batch',
      newData: {
        status: 'executed',
        batchReference: batch.batch_reference,
        statementIdsCount: statementIds.length,
        totalAmount: batch.total_amount,
      },
    });

    revalidatePath('/driver-settlements');
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'فشل تنفيذ الدفعة المصرفية';
    return { success: false, error: errorMsg };
  }
}

/**
 * إلغاء دفعة تحويل بنكي
 */
export async function cancelBulkTransferBatchAction(
  rawInput: CancelBatchInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const input = cancelBatchSchema.parse(rawInput);
    const supabase = await createClient();

    const { data: batch, error: batchErr } = await supabase
      .from('bulk_transfer_batches')
      .select('id, status')
      .eq('id', input.batchId)
      .single();

    if (batchErr || !batch) {
      return { success: false, error: 'الدفعة المصرفية غير موجودة' };
    }

    if (batch.status === 'executed') {
      return { success: false, error: 'لا يمكن إلغاء دفعة تم تنفيذها بالكامل' };
    }

    const nowIso = new Date().toISOString();

    await supabase
      .from('bulk_transfer_batches')
      .update({
        status: 'cancelled',
        notes: input.reason || null,
        updated_at: nowIso,
      })
      .eq('id', batch.id);

    await recordAuditLog({
      actionType: 'update',
      entityId: String(batch.id),
      entityType: 'bulk_transfer_batch',
      reason: input.reason,
      newData: { status: 'cancelled' },
    });

    revalidatePath('/driver-settlements');
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'فشل إلغاء الدفعة';
    return { success: false, error: errorMsg };
  }
}
