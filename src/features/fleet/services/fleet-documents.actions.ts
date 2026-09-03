'use server';

import { createClient } from '@/lib/supabase/server';
import Decimal from 'decimal.js';
import { revalidatePath } from 'next/cache';
import type { FleetDocument, FleetDocumentRenewal, TreasuryTransaction } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

import {
  type FleetMatrixRow,
  CORE_DOC_TYPES,
  DOCUMENT_TYPE_LABELS,
} from './fleet-documents.constants';

export type { FleetMatrixRow };

function computeDocStatus(expiryDate?: string | null): {
  status_computed: 'safe' | 'warning' | 'expired' | 'missing';
  days_until_expiry: number;
} {
  if (!expiryDate) {
    return { status_computed: 'missing', days_until_expiry: 9999 };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const diffTime = expiry.getTime() - today.getTime();
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return { status_computed: 'expired', days_until_expiry: days };
  }
  if (days <= 30) {
    return { status_computed: 'warning', days_until_expiry: days };
  }
  return { status_computed: 'safe', days_until_expiry: days };
}

/**
 * 1. Fetch Fleet Documents (Trucks / Trailers / Drivers)
 */
export async function getFleetDocuments(params?: {
  entityType?: string;
  entityId?: number;
  showArchived?: boolean;
}): Promise<{ success: boolean; data: FleetDocument[]; error?: string }> {
  try {
    const supabase = await createClient();
    let query = supabase.from('fleet_documents').select('*');

    if (params?.entityType) {
      query = query.eq('entity_type', params.entityType);
    }
    if (params?.entityId) {
      query = query.eq('entity_id', params.entityId);
    }
    if (!params?.showArchived) {
      query = query.eq('is_archived', false);
    }

    const { data: rawDocs, error } = await query.order('expiry_date', { ascending: true, nullsFirst: false });

    if (error) throw error;

    // Fetch related trucks and trailers for plate enrichment
    const [trucksRes, trailersRes, driversRes] = await Promise.all([
      supabase.from('trucks').select('id, plate_number, model, status'),
      supabase.from('trailers').select('id, plate_number, model, status'),
      supabase.from('drivers').select('id, name, phone, status'),
    ]);

    const truckMap = new Map((trucksRes.data || []).map((t) => [t.id, t]));
    const trailerMap = new Map((trailersRes.data || []).map((tr) => [tr.id, tr]));
    const driverMap = new Map((driversRes.data || []).map((d) => [d.id, d]));

    const enrichedDocs: FleetDocument[] = (rawDocs || []).map((doc) => {
      const { status_computed, days_until_expiry } = computeDocStatus(doc.expiry_date);
      return {
        ...doc,
        status_computed,
        days_until_expiry,
        truck: doc.entity_type === 'truck' ? truckMap.get(doc.entity_id) : undefined,
        trailer: doc.entity_type === 'trailer' ? trailerMap.get(doc.entity_id) : undefined,
        driver: doc.entity_type === 'driver' ? driverMap.get(doc.entity_id) : undefined,
      };
    });

    return { success: true, data: enrichedDocs };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'فشل في جلب وثائق الأسطول';
    return { success: false, data: [], error: msg };
  }
}

/**
 * 2. Fetch Expiring Fleet Documents for Dashboard Alerts Radar
 */
export async function getExpiringFleetDocs(
  daysThreshold = 30
): Promise<{ success: boolean; data: FleetDocument[]; count: number; error?: string }> {
  try {
    const res = await getFleetDocuments({ showArchived: false });
    if (!res.success) throw new Error(res.error);

    const expiring = res.data.filter(
      (doc) => doc.status_computed === 'expired' || (doc.status_computed === 'warning' && (doc.days_until_expiry ?? 999) <= daysThreshold)
    );

    return { success: true, data: expiring, count: expiring.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'فشل في جلب تنبيهات الوثائق';
    return { success: false, data: [], count: 0, error: msg };
  }
}

/**
 * 3. Quick Renewal Server Action with Treasury & Audit Trail Link
 */
export async function renewFleetDocument(input: {
  docId: number;
  newExpiryDate: string;
  cost?: number;
  currency?: string;
  cashBoxCode?: string;
  cashBoxId?: number;
  bankAccountId?: number;
  notes?: string;
}): Promise<{ success: boolean; renewalId?: number; error?: string }> {
  try {
    const supabase = await createClient();
    const { docId, newExpiryDate, cost = 0, currency = 'MAD', cashBoxCode, cashBoxId, bankAccountId, notes } = input;

    // Fetch existing document
    const { data: document, error: fetchError } = await supabase
      .from('fleet_documents')
      .select('*')
      .eq('id', docId)
      .single();

    if (fetchError || !document) {
      return { success: false, error: 'الوثيقة غير موجودة' };
    }

    const previousExpiryDate = document.expiry_date;
    const renewalCost = new Decimal(cost || 0);

    // 1. Update fleet_documents
    const { error: updateError } = await supabase
      .from('fleet_documents')
      .update({
        previous_expiry_date: previousExpiryDate,
        expiry_date: newExpiryDate,
        cost: parseFloat(renewalCost.toFixed(2)),
        currency: currency,
        notes: notes || document.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', docId);

    if (updateError) throw updateError;

    // 2. Insert into fleet_document_renewals audit trail
    const { data: renewalRecord, error: renewalError } = await supabase
      .from('fleet_document_renewals')
      .insert({
        fleet_document_id: docId,
        document_id: docId,
        previous_expiry_date: previousExpiryDate,
        new_expiry_date: newExpiryDate,
        renewal_cost: parseFloat(renewalCost.toFixed(2)),
        cost: parseFloat(renewalCost.toFixed(2)),
        currency: currency,
        document_type: document.document_type,
        notes: notes || `تجديد سريع للوثيقة إلى ${newExpiryDate}`,
      })
      .select('id')
      .single();

    if (renewalError) throw renewalError;

    // 3. If cost > 0, record treasury transaction
    if (renewalCost.greaterThan(0)) {
      let vehiclePlate = `مركبة #${document.entity_id}`;
      if (document.entity_type === 'truck') {
        const { data: t } = await supabase.from('trucks').select('plate_number').eq('id', document.entity_id).single();
        if (t?.plate_number) vehiclePlate = `شاحنة [${t.plate_number}]`;
      } else if (document.entity_type === 'trailer') {
        const { data: tr } = await supabase.from('trailers').select('plate_number').eq('id', document.entity_id).single();
        if (tr?.plate_number) vehiclePlate = `مقطورة [${tr.plate_number}]`;
      }

      const docLabel = DOCUMENT_TYPE_LABELS[document.document_type]?.label_ar || document.document_type;

      // Resolve cash box if code provided
      let resolvedCashBoxId = cashBoxId;
      if (!resolvedCashBoxId && cashBoxCode) {
        const { data: cb } = await supabase.from('cash_boxes').select('id').eq('code', cashBoxCode).single();
        if (cb) resolvedCashBoxId = cb.id;
      }

      // Default to office cash box if none found
      if (!resolvedCashBoxId && !bankAccountId) {
        const { data: defaultCb } = await supabase.from('cash_boxes').select('id').limit(1).single();
        if (defaultCb) resolvedCashBoxId = defaultCb.id;
      }

      const treasuryPayload: Partial<TreasuryTransaction> = {
        type: 'office_expense',
        amount: parseFloat(renewalCost.toFixed(2)),
        currency: currency,
        cash_box_id: resolvedCashBoxId,
        bank_account_id: bankAccountId,
        description: `تجديد وثيقة: ${docLabel} - ${vehiclePlate}`,
        reference: `DOC-RENEW-${docId}-${Date.now()}`,
        reconciliation_status: 'pending',
      };

      const { error: txError } = await supabase.from('treasury_transactions').insert(treasuryPayload);
      if (txError) {
        console.error('Treasury transaction insert error:', txError);
      }
    }

    revalidatePath('/fleet');
    revalidatePath('/fleet/documents');
    revalidatePath('/documents');
    revalidatePath('/dashboard');
    revalidatePath('/executive-dashboard');

    return { success: true, renewalId: renewalRecord?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء تجديد الوثيقة';
    return { success: false, error: msg };
  }
}

/**
 * 4. Toggle Document Archive State (Active vs Archived)
 */
export async function archiveFleetDocument(
  docId: number,
  isArchived: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('fleet_documents')
      .update({ is_archived: isArchived, updated_at: new Date().toISOString() })
      .eq('id', docId);

    if (error) throw error;

    revalidatePath('/fleet');
    revalidatePath('/fleet/documents');
    revalidatePath('/documents');
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'فشل في أرشفة الوثيقة';
    return { success: false, error: msg };
  }
}

/**
 * 5. Fetch Renewal History Audit Trail for a Document
 */
export async function getDocumentRenewalHistory(
  docId: number
): Promise<{ success: boolean; data: FleetDocumentRenewal[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('fleet_document_renewals')
      .select('*')
      .or(`fleet_document_id.eq.${docId},document_id.eq.${docId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'فشل في جلب سجل التجديدات';
    return { success: false, data: [], error: msg };
  }
}

/**
 * 6. Save or Create a Fleet Document
 */
export async function saveFleetDocument(input: {
  id?: number;
  entityType: 'truck' | 'trailer' | 'driver';
  entityId: number;
  documentType: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  cost?: number;
  currency?: string;
  fileUrl?: string;
  notes?: string;
}): Promise<{ success: boolean; data?: FleetDocument; error?: string }> {
  try {
    const supabase = await createClient();
    const costDec = new Decimal(input.cost || 0);

    const payload = {
      entity_type: input.entityType,
      entity_id: input.entityId,
      document_type: input.documentType,
      document_number: input.documentNumber || null,
      issue_date: input.issueDate || null,
      expiry_date: input.expiryDate || null,
      cost: parseFloat(costDec.toFixed(2)),
      currency: input.currency || 'MAD',
      file_url: input.fileUrl || null,
      notes: input.notes || null,
      is_archived: false,
      updated_at: new Date().toISOString(),
    };

    let resultDoc: FleetDocument;

    if (input.id) {
      const { data, error } = await supabase
        .from('fleet_documents')
        .update(payload)
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw error;
      resultDoc = data;
    } else {
      const { data, error } = await supabase
        .from('fleet_documents')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      resultDoc = data;
    }

    revalidatePath('/fleet');
    revalidatePath('/fleet/documents');
    revalidatePath('/documents');
    return { success: true, data: resultDoc };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'فشل في حفظ الوثيقة';
    return { success: false, error: msg };
  }
}

/**
 * 7. Delete Fleet Document
 */
export async function deleteFleetDocument(docId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('fleet_documents').delete().eq('id', docId);
    if (error) throw error;

    revalidatePath('/fleet');
    revalidatePath('/fleet/documents');
    revalidatePath('/documents');
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'فشل في حذف الوثيقة';
    return { success: false, error: msg };
  }
}

/**
 * 8. Comprehensive Fleet Matrix Data (Trucks + Trailers x Key Document Types)
 */
export async function getFleetMatrixData(): Promise<{
  success: boolean;
  rows: FleetMatrixRow[];
  stats: {
    totalVehicles: number;
    safeVehicles: number;
    warningVehicles: number;
    expiredVehicles: number;
    missingDocsCount: number;
  };
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const [trucksRes, trailersRes, docsRes] = await Promise.all([
      supabase.from('trucks').select('*').order('plate_number', { ascending: true }),
      supabase.from('trailers').select('*').order('plate_number', { ascending: true }),
      supabase.from('fleet_documents').select('*').eq('is_archived', false),
    ]);

    if (trucksRes.error) throw trucksRes.error;
    if (trailersRes.error) throw trailersRes.error;
    if (docsRes.error) throw docsRes.error;

    const docsByEntityKey = new Map<string, Record<string, FleetDocument>>();

    (docsRes.data || []).forEach((rawDoc) => {
      const { status_computed, days_until_expiry } = computeDocStatus(rawDoc.expiry_date);
      const enriched: FleetDocument = {
        ...rawDoc,
        status_computed,
        days_until_expiry,
      };
      const key = `${rawDoc.entity_type}-${rawDoc.entity_id}`;
      if (!docsByEntityKey.has(key)) {
        docsByEntityKey.set(key, {});
      }
      docsByEntityKey.get(key)![rawDoc.document_type] = enriched;
    });

    const rows: FleetMatrixRow[] = [];
    let safeCount = 0;
    let warningCount = 0;
    let expiredCount = 0;
    let missingDocsTotal = 0;

    // 1. Process Trucks
    (trucksRes.data || []).forEach((t) => {
      const key = `truck-${t.id}`;
      const docMap = docsByEntityKey.get(key) || {};

      let hasExpired = false;
      let hasWarning = false;
      let urgentCount = 0;

      CORE_DOC_TYPES.forEach((docType) => {
        const doc = docMap[docType];
        if (!doc) {
          missingDocsTotal += 1;
        } else if (doc.status_computed === 'expired') {
          hasExpired = true;
          urgentCount += 1;
        } else if (doc.status_computed === 'warning') {
          hasWarning = true;
          urgentCount += 1;
        }
      });

      const overall_status: FleetMatrixRow['overall_status'] = hasExpired
        ? 'expired'
        : hasWarning
        ? 'warning'
        : 'safe';

      if (overall_status === 'expired') expiredCount++;
      else if (overall_status === 'warning') warningCount++;
      else safeCount++;

      rows.push({
        entity_id: t.id,
        entity_type: 'truck',
        plate_number: t.plate_number,
        model: t.model || 'شاحنة نقل دولي',
        status: t.status || 'active',
        is_active: t.status !== 'inactive' && t.status !== 'archived',
        documents: docMap,
        overall_status,
        urgent_count: urgentCount,
      });
    });

    // 2. Process Trailers
    (trailersRes.data || []).forEach((tr) => {
      const key = `trailer-${tr.id}`;
      const docMap = docsByEntityKey.get(key) || {};

      let hasExpired = false;
      let hasWarning = false;
      let urgentCount = 0;

      // Relevant trailer doc types (insurance, tech inspection, grey card, atp)
      const trailerDocTypes = ['insurance', 'technical_inspection', 'grey_card', 'atp_certificate'];
      trailerDocTypes.forEach((docType) => {
        const doc = docMap[docType];
        if (!doc) {
          missingDocsTotal += 1;
        } else if (doc.status_computed === 'expired') {
          hasExpired = true;
          urgentCount += 1;
        } else if (doc.status_computed === 'warning') {
          hasWarning = true;
          urgentCount += 1;
        }
      });

      const overall_status: FleetMatrixRow['overall_status'] = hasExpired
        ? 'expired'
        : hasWarning
        ? 'warning'
        : 'safe';

      if (overall_status === 'expired') expiredCount++;
      else if (overall_status === 'warning') warningCount++;
      else safeCount++;

      rows.push({
        entity_id: tr.id,
        entity_type: 'trailer',
        plate_number: tr.plate_number,
        model: tr.model || 'مقطورة تبريد / نقل',
        status: tr.status || 'active',
        is_active: tr.status !== 'inactive' && tr.status !== 'archived',
        documents: docMap,
        overall_status,
        urgent_count: urgentCount,
      });
    });

    return {
      success: true,
      rows,
      stats: {
        totalVehicles: rows.length,
        safeVehicles: safeCount,
        warningVehicles: warningCount,
        expiredVehicles: expiredCount,
        missingDocsCount: missingDocsTotal,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'فشل في جلب مصفوفة وثائق الأسطول';
    return {
      success: false,
      rows: [],
      stats: { totalVehicles: 0, safeVehicles: 0, warningVehicles: 0, expiredVehicles: 0, missingDocsCount: 0 },
      error: msg,
    };
  }
}

