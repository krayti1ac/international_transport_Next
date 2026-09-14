'use server';

import { createClient } from '@/lib/supabase/server';
import { validateRows, type ImportRow, type ValidationOptions } from '@/lib/excel-importer';
import { validateICE, validateMoroccanPlate, validateEmail, validatePhone } from '@/lib/excel-importer';

export interface BulkImportResponse {
  success: boolean;
  imported: number;
  failed: number;
  errors: { row: number; message: string }[];
  auditLogId?: string;
}

const logAudit = async (supabase: Awaited<ReturnType<typeof createClient>>, action: string, entity: string, metadata: Record<string, unknown>) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const payload = {
      action,
      entity,
      metadata,
      user_id: session?.user?.id || null,
      created_at: new Date().toISOString(),
    };
    await supabase.from('audit_logs').insert(payload);
  } catch {
    // ignore audit logging failures
  }
};

const baseClientAliases: ValidationOptions['headerAliases'] = {
  name: ['اسم', 'nom', 'nombre', 'client', 'العميل'],
  phone: ['هاتف', 'tel', 'téléphone', 'phone', 'الهاتف'],
  email: ['بريد', 'email', 'e-mail', 'mail', 'البريد'],
  address: ['عنوان', 'adresse', 'address', 'العنوان'],
  city: ['مدينة', 'ville', 'city', 'المدينة'],
  ice: ['ice', 'رقم ice', 'رقم التسجيل', 'رقم التعريف'],
  plate_number: ['لوحة', 'plate', 'matricule', 'plaque', 'لوحة رقم'],
  model: ['طراز', 'model', 'موديل', 'النوع'],
  status: ['حالة', 'statut', 'status', 'الحالة'],
  client_type: ['نوع العميل', 'client_type', 'type client', 'نوع'],
};

const clientRequired = ['name', 'phone', 'ice'];
const clientValidators: ValidationOptions['fieldValidators'] = {
  ice: validateICE,
  phone: validatePhone,
  email: validateEmail,
};

const truckValidators: ValidationOptions['fieldValidators'] = {
  plate_number: validateMoroccanPlate,
};

const resolveCompanyId = async (supabase: Awaited<ReturnType<typeof createClient>>): Promise<number | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId.trim());
    if (!isUuid) return null;
    const { data } = await supabase.from('users').select('company_id').eq('id', userId).single();
    return data?.company_id || null;
  } catch {
    return null;
  }
};

export const importClientsAction = async (rows: ImportRow[]): Promise<BulkImportResponse> => {
  const supabase = await createClient();
  const companyId = await resolveCompanyId(supabase);
  if (!companyId) {
    return { success: false, imported: 0, failed: rows.length, errors: [{ row: 0, message: 'تعذر تحديد معرف الشركة من الجلسة الحالية.' }] };
  }
  const validation = validateRows(rows, {
    requiredFields: clientRequired,
    fieldValidators: { ...clientValidators, email: validateEmail },
    headerAliases: { ...baseClientAliases },
  });

  if (validation.invalidRows.length > 0) {
    await logAudit(supabase, 'bulk_import_clients_failed', 'clients', {
      totalRows: rows.length,
      failedRows: validation.invalidRows.length,
    });
    return {
      success: false,
      imported: 0,
      failed: validation.invalidRows.length,
      errors: validation.invalidRows.map((r) => ({ row: r.row, message: r.errors.join('، ') })),
    };
  }

  const payload = validation.validRows.map((row) => ({
    company_id: companyId,
    name: String(row.name || '').trim(),
    phone: String(row.phone || '').trim(),
    email: String(row.email || '').trim(),
    address: String(row.address || '').trim(),
    city: String(row.city || '').trim(),
    ice: String(row.ice || '').trim(),
    is_active: String(row.is_active || row.status || 'نشط').toLowerCase() !== 'غير نشط',
    invoice_with_tva: true,
    currency: 'MAD',
    shipping_country: 'MA',
    billing_country: 'MA',
    shipping_city: String(row.city || '').trim(),
    billing_city: String(row.city || '').trim(),
    shipping_address_line1: String(row.address || '').trim(),
    billing_address_line1: String(row.address || '').trim(),
  }));

  const { error, count } = await supabase.from('clients').insert(payload).select('id');

  await logAudit(supabase, 'bulk_import_clients', 'clients', {
    totalRows: rows.length,
    imported: count || payload.length,
    failed: 0,
  });

  if (error) {
    return {
      success: false,
      imported: 0,
      failed: payload.length,
      errors: [{ row: 0, message: error.message }],
    };
  }

  return {
    success: true,
    imported: count || payload.length,
    failed: 0,
    errors: [],
  };
};

export const importTrucksAction = async (rows: ImportRow[]): Promise<BulkImportResponse> => {
  const supabase = await createClient();
  const companyId = await resolveCompanyId(supabase);
  if (!companyId) {
    return { success: false, imported: 0, failed: rows.length, errors: [{ row: 0, message: 'تعذر تحديد معرف الشركة من الجلسة الحالية.' }] };
  }
  const validation = validateRows(rows, {
    requiredFields: ['plate_number', 'model'],
    fieldValidators: truckValidators,
    headerAliases: { ...baseClientAliases },
  });

  if (validation.invalidRows.length > 0) {
    await logAudit(supabase, 'bulk_import_trucks_failed', 'trucks', {
      totalRows: rows.length,
      failedRows: validation.invalidRows.length,
    });
    return {
      success: false,
      imported: 0,
      failed: validation.invalidRows.length,
      errors: validation.invalidRows.map((r) => ({ row: r.row, message: r.errors.join('، ') })),
    };
  }

  const payload = validation.validRows.map((row) => ({
    company_id: companyId,
    plate_number: String(row.plate_number || '').trim(),
    model: String(row.model || '').trim(),
    status: String(row.status || row.client_type || 'نشط').trim() || 'نشط',
    current_location: String(row.address || '').trim() || null,
  }));

  const { error, count } = await supabase.from('trucks').insert(payload).select('id');

  await logAudit(supabase, 'bulk_import_trucks', 'trucks', {
    totalRows: rows.length,
    imported: count || payload.length,
    failed: 0,
  });

  if (error) {
    return {
      success: false,
      imported: 0,
      failed: payload.length,
      errors: [{ row: 0, message: error.message }],
    };
  }

  return {
    success: true,
    imported: count || payload.length,
    failed: 0,
    errors: [],
  };
};

export const importTrailersAction = async (rows: ImportRow[]): Promise<BulkImportResponse> => {
  const supabase = await createClient();
  const companyId = await resolveCompanyId(supabase);
  if (!companyId) {
    return { success: false, imported: 0, failed: rows.length, errors: [{ row: 0, message: 'تعذر تحديد معرف الشركة من الجلسة الحالية.' }] };
  }
  const validation = validateRows(rows, {
    requiredFields: ['plate_number', 'model'],
    fieldValidators: truckValidators,
    headerAliases: { ...baseClientAliases },
  });

  if (validation.invalidRows.length > 0) {
    await logAudit(supabase, 'bulk_import_trailers_failed', 'trailers', {
      totalRows: rows.length,
      failedRows: validation.invalidRows.length,
    });
    return {
      success: false,
      imported: 0,
      failed: validation.invalidRows.length,
      errors: validation.invalidRows.map((r) => ({ row: r.row, message: r.errors.join('، ') })),
    };
  }

  const payload = validation.validRows.map((row) => ({
    company_id: companyId,
    plate_number: String(row.plate_number || '').trim(),
    model: String(row.model || '').trim(),
    status: String(row.status || row.client_type || 'نشط').trim() || 'نشط',
  }));

  const { error, count } = await supabase.from('trailers').insert(payload).select('id');

  await logAudit(supabase, 'bulk_import_trailers', 'trailers', {
    totalRows: rows.length,
    imported: count || payload.length,
    failed: 0,
  });

  if (error) {
    return {
      success: false,
      imported: 0,
      failed: payload.length,
      errors: [{ row: 0, message: error.message }],
    };
  }

  return {
    success: true,
    imported: count || payload.length,
    failed: 0,
    errors: [],
  };
};
