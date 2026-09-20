'use server';

import { createClient } from '@/lib/supabase/server';
import { validateRows, type ImportRow, type ValidationOptions } from '@/lib/excel-importer';
import { validateICE, validateMoroccanPlate, validateEmail, validatePhone } from '@/lib/validators/morocco-business';
import { sanitizeNumeric } from '@/lib/data-sanitizer';
import { FIELD_ALIASES } from '@/lib/bulk-import';

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

const sharedHeaderAliases: ValidationOptions['headerAliases'] = FIELD_ALIASES;

const clientRequired = ['name', 'phone', 'ice'];
const clientValidators: ValidationOptions['fieldValidators'] = {
  ice: validateICE,
  phone: validatePhone,
  email: validateEmail,
};

const truckValidators: ValidationOptions['fieldValidators'] = {
  plate_number: validateMoroccanPlate,
};

const driverValidators: ValidationOptions['fieldValidators'] = {
  phone: validatePhone,
};

const providerValidators: ValidationOptions['fieldValidators'] = {
  ice: validateICE,
  phone: validatePhone,
  email: validateEmail,
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
    headerAliases: sharedHeaderAliases,
  });

  if (validation.validRows.length === 0) {
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
    currency: String(row.currency || 'MAD').toUpperCase(),
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
    failed: validation.invalidRows.length,
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
    success: validation.invalidRows.length === 0,
    imported: count || payload.length,
    failed: validation.invalidRows.length,
    errors: validation.invalidRows.map((r) => ({ row: r.row, message: r.errors.join('، ') })),
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
    headerAliases: sharedHeaderAliases,
  });

  if (validation.validRows.length === 0) {
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
    status: String(row.status || 'نشط').trim() || 'نشط',
    current_location: String(row.address || row.city || '').trim() || null,
    weight_capacity: sanitizeNumeric(row.weight_capacity, 0),
    fuel_consumption_rate: sanitizeNumeric(row.fuel_consumption_rate, 36),
  }));

  const { error, count } = await supabase.from('trucks').insert(payload).select('id');

  await logAudit(supabase, 'bulk_import_trucks', 'trucks', {
    totalRows: rows.length,
    imported: count || payload.length,
    failed: validation.invalidRows.length,
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
    success: validation.invalidRows.length === 0,
    imported: count || payload.length,
    failed: validation.invalidRows.length,
    errors: validation.invalidRows.map((r) => ({ row: r.row, message: r.errors.join('، ') })),
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
    headerAliases: sharedHeaderAliases,
  });

  if (validation.validRows.length === 0) {
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
    status: String(row.status || 'نشط').trim() || 'نشط',
  }));

  const { error, count } = await supabase.from('trailers').insert(payload).select('id');

  await logAudit(supabase, 'bulk_import_trailers', 'trailers', {
    totalRows: rows.length,
    imported: count || payload.length,
    failed: validation.invalidRows.length,
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
    success: validation.invalidRows.length === 0,
    imported: count || payload.length,
    failed: validation.invalidRows.length,
    errors: validation.invalidRows.map((r) => ({ row: r.row, message: r.errors.join('، ') })),
  };
};

export const importDriversAction = async (rows: ImportRow[]): Promise<BulkImportResponse> => {
  const supabase = await createClient();
  const companyId = await resolveCompanyId(supabase);
  if (!companyId) {
    return { success: false, imported: 0, failed: rows.length, errors: [{ row: 0, message: 'تعذر تحديد معرف الشركة من الجلسة الحالية.' }] };
  }

  const validation = validateRows(rows, {
    requiredFields: ['name', 'phone', 'license'],
    fieldValidators: driverValidators,
    headerAliases: sharedHeaderAliases,
  });

  if (validation.validRows.length === 0) {
    await logAudit(supabase, 'bulk_import_drivers_failed', 'drivers', {
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
    license: String(row.license || '').trim(),
    base_salary: sanitizeNumeric(row.base_salary, 0),
    bonus_percentage: sanitizeNumeric(row.bonus_percentage, 0),
    status: String(row.status || 'active').trim() || 'active',
    visa_type: String(row.visa_type || 'schengen').trim(),
    visa_number: row.visa_number ? String(row.visa_number).trim() : null,
    african_visa_number: row.african_visa_number ? String(row.african_visa_number).trim() : null,
    has_valid_visa: Boolean(row.visa_number || row.african_visa_number),
  }));

  const { error, count } = await supabase.from('drivers').insert(payload).select('id');

  await logAudit(supabase, 'bulk_import_drivers', 'drivers', {
    totalRows: rows.length,
    imported: count || payload.length,
    failed: validation.invalidRows.length,
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
    success: validation.invalidRows.length === 0,
    imported: count || payload.length,
    failed: validation.invalidRows.length,
    errors: validation.invalidRows.map((r) => ({ row: r.row, message: r.errors.join('، ') })),
  };
};

export const importTripsAction = async (rows: ImportRow[]): Promise<BulkImportResponse> => {
  const supabase = await createClient();
  const companyId = await resolveCompanyId(supabase);
  if (!companyId) {
    return { success: false, imported: 0, failed: rows.length, errors: [{ row: 0, message: 'تعذر تحديد معرف الشركة من الجلسة الحالية.' }] };
  }

  const validation = validateRows(rows, {
    requiredFields: ['departure_date', 'price'],
    headerAliases: sharedHeaderAliases,
  });

  if (validation.validRows.length === 0) {
    await logAudit(supabase, 'bulk_import_trips_failed', 'trip_orders', {
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

  // مطابقة الكيانات المترابطة بالاسم أو اللوحة
  const [clientsRes, trucksRes, driversRes] = await Promise.all([
    supabase.from('clients').select('id, name').eq('company_id', companyId),
    supabase.from('trucks').select('id, plate_number').eq('company_id', companyId),
    supabase.from('drivers').select('id, name').eq('company_id', companyId),
  ]);

  const clientsMap = new Map((clientsRes.data || []).map(c => [c.name.trim().toLowerCase(), c.id]));
  const trucksMap = new Map((trucksRes.data || []).map(t => [t.plate_number.trim().toLowerCase().replace(/[\s_-]+/g, '-'), t.id]));
  const driversMap = new Map((driversRes.data || []).map(d => [d.name.trim().toLowerCase(), d.id]));

  const payload = validation.validRows.map((row) => {
    const rawClient = String(row.client_name || row.name || '').trim().toLowerCase();
    const rawPlate = String(row.truck_plate || row.plate_number || '').trim().toLowerCase().replace(/[\s_-]+/g, '-');
    const rawDriver = String(row.driver_name || '').trim().toLowerCase();

    return {
      company_id: companyId,
      route: String(row.route || 'طنجة -> أوروبا').trim(),
      departure_date: String(row.departure_date || new Date().toISOString().split('T')[0]).trim(),
      price: sanitizeNumeric(row.price, 0),
      status: String(row.status || 'completed').trim(),
      cmr_number: row.cmr_number ? String(row.cmr_number).trim() : null,
      client_id: clientsMap.get(rawClient) || null,
      truck_id: trucksMap.get(rawPlate) || null,
      driver_id: driversMap.get(rawDriver) || null,
    };
  });

  const { error, count } = await supabase.from('trip_orders').insert(payload).select('id');

  await logAudit(supabase, 'bulk_import_trips', 'trip_orders', {
    totalRows: rows.length,
    imported: count || payload.length,
    failed: validation.invalidRows.length,
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
    success: validation.invalidRows.length === 0,
    imported: count || payload.length,
    failed: validation.invalidRows.length,
    errors: validation.invalidRows.map((r) => ({ row: r.row, message: r.errors.join('، ') })),
  };
};

export const importProvidersAction = async (rows: ImportRow[]): Promise<BulkImportResponse> => {
  const supabase = await createClient();
  const companyId = await resolveCompanyId(supabase);
  if (!companyId) {
    return { success: false, imported: 0, failed: rows.length, errors: [{ row: 0, message: 'تعذر تحديد معرف الشركة من الجلسة الحالية.' }] };
  }

  const validation = validateRows(rows, {
    requiredFields: ['name', 'type'],
    fieldValidators: providerValidators,
    headerAliases: sharedHeaderAliases,
  });

  if (validation.validRows.length === 0) {
    await logAudit(supabase, 'bulk_import_providers_failed', 'providers', {
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
    type: String(row.type || 'other').trim(),
    phone: row.phone ? String(row.phone).trim() : null,
    city: row.city ? String(row.city).trim() : null,
    address: row.address ? String(row.address).trim() : null,
    ice: row.ice ? String(row.ice).trim() : null,
    email: row.email ? String(row.email).trim() : null,
    is_active: true,
  }));

  const { error, count } = await supabase.from('providers').insert(payload).select('id');

  await logAudit(supabase, 'bulk_import_providers', 'providers', {
    totalRows: rows.length,
    imported: count || payload.length,
    failed: validation.invalidRows.length,
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
    success: validation.invalidRows.length === 0,
    imported: count || payload.length,
    failed: validation.invalidRows.length,
    errors: validation.invalidRows.map((r) => ({ row: r.row, message: r.errors.join('، ') })),
  };
};

export const importTreasuryAction = async (rows: ImportRow[]): Promise<BulkImportResponse> => {
  const supabase = await createClient();
  const companyId = await resolveCompanyId(supabase);
  if (!companyId) {
    return { success: false, imported: 0, failed: rows.length, errors: [{ row: 0, message: 'تعذر تحديد معرف الشركة من الجلسة الحالية.' }] };
  }

  const validation = validateRows(rows, {
    requiredFields: ['type', 'amount', 'currency'],
    headerAliases: sharedHeaderAliases,
  });

  if (validation.validRows.length === 0) {
    await logAudit(supabase, 'bulk_import_treasury_failed', 'treasury_transactions', {
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

  // الحصول على الصندوق الافتراضي للشركة
  const { data: defaultBox } = await supabase
    .from('cash_boxes')
    .select('id')
    .eq('company_id', companyId)
    .limit(1)
    .maybeSingle();

  const payload = validation.validRows.map((row) => ({
    company_id: companyId,
    cash_box_id: defaultBox?.id || null,
    type: String(row.type || 'deposit').trim(),
    amount: sanitizeNumeric(row.amount, 0),
    currency: String(row.currency || 'MAD').toUpperCase(),
    description: String(row.description || 'رصيد افتتاحي تأسيسي').trim(),
    reference: row.reference ? String(row.reference).trim() : null,
    created_at: String(row.created_at || row.departure_date || new Date().toISOString()),
    reconciliation_status: 'reconciled',
  }));

  const { error, count } = await supabase.from('treasury_transactions').insert(payload).select('id');

  await logAudit(supabase, 'bulk_import_treasury', 'treasury_transactions', {
    totalRows: rows.length,
    imported: count || payload.length,
    failed: validation.invalidRows.length,
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
    success: validation.invalidRows.length === 0,
    imported: count || payload.length,
    failed: validation.invalidRows.length,
    errors: validation.invalidRows.map((r) => ({ row: r.row, message: r.errors.join('، ') })),
  };
};
