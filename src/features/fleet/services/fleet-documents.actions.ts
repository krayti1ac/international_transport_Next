'use server';

import { createClient } from '@/lib/supabase/server';
import Decimal from 'decimal.js';
import { revalidatePath } from 'next/cache';
import type { FleetDocument, FleetDocumentRenewal, TreasuryTransaction, DocumentCategory } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

import {
  type FleetMatrixRow,
  CORE_DOC_TYPES,
  DOCUMENT_TYPE_LABELS,
  DEFAULT_DOCUMENT_CATEGORIES,
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

export const getFleetDocRenewalHistory = getDocumentRenewalHistory;

/**
 * Quick Instant Renew directly (+365 days) without modal
 */
export async function quickRenewDocumentDirectly(
  docId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: doc, error: fetchErr } = await supabase
      .from('fleet_documents')
      .select('*')
      .eq('id', docId)
      .single();

    if (fetchErr || !doc) {
      return { success: false, error: 'الوثيقة غير موجودة' };
    }

    const baseDate = doc.expiry_date ? new Date(doc.expiry_date) : new Date();
    const now = new Date();
    const targetDate = baseDate < now ? now : baseDate;
    const nextYear = new Date(targetDate);
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const newExpiry = nextYear.toISOString().split('T')[0];

    const prevExpiry = doc.expiry_date;

    const { error: updateErr } = await supabase
      .from('fleet_documents')
      .update({
        previous_expiry_date: prevExpiry,
        expiry_date: newExpiry,
        updated_at: new Date().toISOString(),
      })
      .eq('id', docId);

    if (updateErr) throw updateErr;

    // Record audit trail in fleet_document_renewals
    await supabase.from('fleet_document_renewals').insert({
      fleet_document_id: docId,
      document_id: docId,
      previous_expiry_date: prevExpiry,
      new_expiry_date: newExpiry,
      cost: 0,
      renewal_cost: 0,
      currency: doc.currency || 'MAD',
      document_type: doc.doc_type || doc.document_type || 'other',
      notes: 'تجديد سريع فوري (+365 يوم)',
    });

    revalidatePath('/fleet');
    revalidatePath('/fleet/documents');
    revalidatePath('/documents');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'فشل في التجديد السريع';
    return { success: false, error: msg };
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

/**
 * 9. Get Dynamic Document Categories with Usage Enrichment
 */
export async function getDocumentCategories(options?: {
  activeOnly?: boolean;
  vehicleType?: 'truck' | 'trailer';
}): Promise<{ success: boolean; data: DocumentCategory[]; error?: string }> {
  try {
    const supabase = await createClient();
    let query = supabase.from('document_categories').select('*');

    if (options?.activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data: dbCategories, error } = await query.order('id', { ascending: true });

    let categories: DocumentCategory[] = [];

    if (error || !dbCategories || dbCategories.length === 0) {
      // If table is empty or error, fallback to DEFAULT_DOCUMENT_CATEGORIES
      categories = DEFAULT_DOCUMENT_CATEGORIES.map((cat) => ({
        id: cat.id,
        name: cat.name,
        name_fr: cat.name_fr,
        applicable_to: cat.applicable_to,
        is_active: cat.is_active,
        created_at: new Date().toISOString(),
        usage_count: 0,
      }));
    } else {
      categories = dbCategories.map((c) => ({
        id: c.id,
        name: c.name,
        name_fr: c.name_fr || null,
        applicable_to: (c.applicable_to as 'both' | 'truck' | 'trailer') || 'both',
        is_active: c.is_active ?? true,
        created_at: c.created_at || new Date().toISOString(),
        updated_at: c.updated_at,
        usage_count: 0,
      }));
    }

    // Filter by vehicle type if specified
    if (options?.vehicleType) {
      categories = categories.filter(
        (c) => c.applicable_to === 'both' || c.applicable_to === options.vehicleType
      );
    }

    // Enrich with usage count from fleet_documents (supports both document_type and legacy doc_type)
    const { data: fleetDocs } = await supabase.from('fleet_documents').select('document_type, doc_type');
    if (fleetDocs && fleetDocs.length > 0) {
      const usageMap = new Map<string, number>();
      for (const doc of fleetDocs) {
        const raw = (doc.document_type || doc.doc_type || '').trim().toLowerCase();
        if (raw) {
          usageMap.set(raw, (usageMap.get(raw) || 0) + 1);
          const noStar = raw.replace(/^\*/, '').trim();
          if (noStar !== raw) {
            usageMap.set(noStar, (usageMap.get(noStar) || 0) + 1);
          }
        }
      }

      categories = categories.map((cat) => {
        const catNameLower = cat.name.trim().toLowerCase();
        const catNameClean = catNameLower.replace(/^\*/, '').trim();
        let count = (usageMap.get(catNameLower) || 0) || (usageMap.get(catNameClean) || 0);
        // Also check if any English or legacy aliases map to this category
        for (const [key, val] of Object.entries(DOCUMENT_TYPE_LABELS)) {
          if (
            val.label_ar.trim().toLowerCase() === catNameLower ||
            val.label_ar.trim().toLowerCase() === catNameClean ||
            (cat.name_fr && val.label_fr.trim().toLowerCase() === cat.name_fr.trim().toLowerCase())
          ) {
            const aliasUsage = usageMap.get(key.toLowerCase());
            if (aliasUsage) count += aliasUsage;
          }
        }
        return {
          ...cat,
          usage_count: count,
        };
      });
    }

    return { success: true, data: categories };
  } catch (err: unknown) {
    const msg =
      (err as { message?: string })?.message ||
      (err instanceof Error ? err.message : 'فشل في جلب أنواع الوثائق');
    return { success: false, data: [], error: msg };
  }
}

/**
 * 10. Check if a Document Category is in use in fleet_documents or renewals
 */
export async function checkDocumentCategoryUsage(
  categoryIdOrName: number | string
): Promise<{ inUse: boolean; count: number; error?: string }> {
  try {
    const supabase = await createClient();
    let categoryName = '';

    if (typeof categoryIdOrName === 'number') {
      const { data: cat } = await supabase
        .from('document_categories')
        .select('name')
        .eq('id', categoryIdOrName)
        .maybeSingle();
      if (cat) {
        categoryName = cat.name;
      }
    } else {
      categoryName = categoryIdOrName;
    }

    if (!categoryName) {
      return { inUse: false, count: 0 };
    }

    const cleanName = categoryName.replace(/^\*/, '').trim();

    // Check in fleet_documents (both document_type and legacy doc_type)
    const { count: docsCount, error: docErr } = await supabase
      .from('fleet_documents')
      .select('id', { count: 'exact' })
      .or(
        `document_type.eq.${categoryName},document_type.eq.${cleanName},doc_type.eq.${categoryName},doc_type.eq.${cleanName}`
      );

    if (docErr) throw docErr;

    // Check in renewals
    const { count: renewalsCount, error: renErr } = await supabase
      .from('fleet_document_renewals')
      .select('id', { count: 'exact' })
      .or(
        `document_type.eq.${categoryName},document_type.eq.${cleanName}`
      );

    if (renErr) throw renErr;

    const totalCount = (docsCount || 0) + (renewalsCount || 0);
    return { inUse: totalCount > 0, count: totalCount };
  } catch (err: unknown) {
    const msg =
      (err as { message?: string })?.message ||
      (err instanceof Error ? err.message : 'فشل في فحص ارتباط نوع الوثيقة');
    return { inUse: false, count: 0, error: msg };
  }
}

/**
 * 11. Save or Create a Document Category
 */
export async function saveDocumentCategory(payload: {
  id?: number;
  name: string;
  name_fr?: string;
  applicable_to: 'both' | 'truck' | 'trailer';
  is_active: boolean;
}): Promise<{ success: boolean; data?: DocumentCategory; error?: string }> {
  try {
    const trimmedName = payload.name.trim();
    if (!trimmedName) {
      return { success: false, error: 'يرجى إدخال اسم نوع الوثيقة' };
    }

    const supabase = await createClient();
    const row = {
      name: trimmedName,
      name_fr: payload.name_fr?.trim() || null,
      applicable_to: payload.applicable_to,
      is_active: payload.is_active,
      updated_at: new Date().toISOString(),
    };

    let result: DocumentCategory;

    if (payload.id) {
      const { data, error } = await supabase
        .from('document_categories')
        .update(row)
        .eq('id', payload.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('document_categories')
        .insert({
          ...row,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    revalidatePath('/fleet');
    revalidatePath('/fleet/documents');
    revalidatePath('/documents');
    revalidatePath('/settings');

    return { success: true, data: result };
  } catch (err: unknown) {
    const pgError = err as { code?: string; message?: string; details?: string };
    if (pgError?.code === '23505') {
      return { success: false, error: 'نوع الوثيقة بهذا الاسم موجود مسبقاً' };
    }
    const msg =
      pgError?.message ||
      (err instanceof Error ? err.message : 'فشل في حفظ نوع الوثيقة');
    return { success: false, error: msg };
  }
}

/**
 * 12. Toggle Document Category Active Status
 */
export async function toggleDocumentCategoryStatus(
  id: number,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('document_categories')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    revalidatePath('/fleet');
    revalidatePath('/fleet/documents');
    revalidatePath('/documents');
    revalidatePath('/settings');

    return { success: true };
  } catch (err: unknown) {
    const msg =
      (err as { message?: string })?.message ||
      (err instanceof Error ? err.message : 'فشل في تحديث حالة نوع الوثيقة');
    return { success: false, error: msg };
  }
}

/**
 * 13. Conditionally Delete Document Category (Blocked if linked to fleet_documents or renewals)
 */
export async function deleteDocumentCategory(
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Fetch the category to get its name
    const { data: cat, error: fetchErr } = await supabase
      .from('document_categories')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !cat) {
      return { success: false, error: 'نوع الوثيقة غير موجود أو تم حذفه مسبقاً' };
    }

    // Check usage in fleet_documents & renewals
    const usageRes = await checkDocumentCategoryUsage(cat.name);
    if (usageRes.inUse && usageRes.count > 0) {
      return {
        success: false,
        error: `لا يمكن حذف هذا النوع ("${cat.name}") لوجود ${usageRes.count} وثيقة مسجلة مرتبطة به في النظام. يمكنك إلغاء تفعيله بدلاً من حذفه حتى لا يظهر في القوائم الجديدة مع الحفاظ على سلامة سجلات الأسطول.`,
      };
    }

    // Safe to delete
    const { error: deleteErr } = await supabase
      .from('document_categories')
      .delete()
      .eq('id', id);

    if (deleteErr) throw deleteErr;

    revalidatePath('/fleet');
    revalidatePath('/fleet/documents');
    revalidatePath('/documents');
    revalidatePath('/settings');

    return { success: true };
  } catch (err: unknown) {
    const msg =
      (err as { message?: string })?.message ||
      (err instanceof Error ? err.message : 'فشل في حذف نوع الوثيقة');
    return { success: false, error: msg };
  }
}

