'use server';

import { createClient } from '@/lib/supabase/server';
import { validateRows, type ImportRow, type ValidationOptions } from '@/lib/excel-importer';
import { validateICE, validateMoroccanPlate, validateEmail, validatePhone } from '@/lib/validators/morocco-business';
import { sanitizeNumeric } from '@/lib/data-sanitizer';
import { FIELD_ALIASES } from '@/lib/bulk-import';
import Decimal from 'decimal.js';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

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
    if (userId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId.trim());
      if (isUuid) {
        const { data } = await supabase.from('users').select('company_id').eq('id', userId).single();
        if (data?.company_id) return data.company_id;
      }
    }
    if (process.env.DEFAULT_COMPANY_ID) {
      const parsed = parseInt(process.env.DEFAULT_COMPANY_ID, 10);
      if (!isNaN(parsed)) return parsed;
    }
    const { data: company } = await supabase.from('companies').select('id').order('id', { ascending: true }).limit(1).maybeSingle();
    return company?.id || 1;
  } catch {
    return 1;
  }
};

const inferClientCountry = (city: string, explicitCountry?: unknown): string => {
  if (explicitCountry && typeof explicitCountry === 'string' && explicitCountry.trim()) {
    return explicitCountry.trim().toUpperCase();
  }
  const lower = city.toLowerCase().trim();
  if (lower.includes('dakar') || lower.includes('senegal')) return 'SN';
  if (lower.includes('nouadhibou') || lower.includes('nouakchott') || lower.includes('mauritani')) return 'MR';
  if (lower.includes('perpignan') || lower.includes('paris') || lower.includes('france')) return 'FR';
  if (lower.includes('valencia') || lower.includes('madrid') || lower.includes('spain') || lower.includes('espagne')) return 'ES';
  return 'MA';
};

const resolveClientEmail = (name: string, explicitEmail?: unknown): string => {
  if (explicitEmail && typeof explicitEmail === 'string' && explicitEmail.trim()) {
    return explicitEmail.trim().toLowerCase();
  }
  const lookup: Record<string, string> = {
    'agri-export nord sarl': 'contact@agri-export-nord.ma',
    'berry med tanger': 'logistics@berrymed.com',
    'frigo atlantic agadir': 'expeditions@frigoatlantic.ma',
    'maroc primeurs souss': 'export@maroc-primeurs.ma',
    'dakar logistics hub sn': 'contact@dakar-logistics.sn',
    'mauritania fish trading': 'sales@mauritania-fish.mr',
    'euro-primeurs logistics': 'reception@europrimeurs-stcharles.fr',
    'iberia logistica valencia': 'trafico@iberia-logistica.es',
    'comptoir sahara transit': 'transit@sahara-transit.ma',
    'casablanca textile export': 'export@casablanca-textile.ma',
  };
  const key = name.toLowerCase().trim();
  if (lookup[key]) return lookup[key];
  const slug = key.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `contact@${slug || 'client'}.com`;
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

  const payload = validation.validRows.map((row) => {
    const rawName = String(row.name || '').trim();
    const city = String(row.city || '').trim();
    const country = inferClientCountry(city, row.shipping_country || row.country);
    const email = resolveClientEmail(rawName, row.email);
    const clientType = (String(row.client_type || 'export').trim().toLowerCase() === 'import' ? 'import' : 'export') as 'export' | 'import';

    return {
      company_id: companyId,
      name: rawName,
      company_name: String(row.company_name || rawName).trim(),
      phone: String(row.phone || '').trim(),
      email,
      address: String(row.address || '').trim(),
      city,
      ice: String(row.ice || '').trim(),
      client_type: clientType,
      is_active: String(row.is_active || row.status || 'نشط').toLowerCase() !== 'غير نشط',
      invoice_with_tva: true,
      currency: String(row.currency || 'MAD').toUpperCase(),
      shipping_country: country,
      billing_country: country,
      shipping_city: city,
      billing_city: city,
      shipping_address_line1: String(row.address || '').trim(),
      billing_address_line1: String(row.address || '').trim(),
    };
  });

  // فحص الكيانات الموجودة مسبقاً لضمان عدم التكرار (Idempotent Upsert)
  const existingIces = payload.map((p) => p.ice).filter(Boolean);
  const { data: existingClients } = await supabase
    .from('clients')
    .select('id, ice')
    .eq('company_id', companyId)
    .in('ice', existingIces);

  const existingMap = new Map((existingClients || []).map((c) => [c.ice, c.id]));
  const toInsert = payload.filter((p) => !existingMap.has(p.ice));
  const toUpdate = payload.filter((p) => existingMap.has(p.ice));

  let totalProcessed = 0;
  if (toInsert.length > 0) {
    const { error: insErr, count: insCount } = await supabase.from('clients').insert(toInsert).select('id');
    if (insErr) {
      return {
        success: false,
        imported: 0,
        failed: payload.length,
        errors: [{ row: 0, message: insErr.message }],
      };
    }
    totalProcessed += insCount || toInsert.length;
  }

  for (const item of toUpdate) {
    const existingId = existingMap.get(item.ice);
    if (existingId) {
      await supabase.from('clients').update(item).eq('id', existingId);
      totalProcessed++;
    }
  }

  await logAudit(supabase, 'bulk_import_clients', 'clients', {
    totalRows: rows.length,
    imported: totalProcessed,
    failed: validation.invalidRows.length,
  });

  return {
    success: validation.invalidRows.length === 0,
    imported: totalProcessed,
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
    status: String(row.status || 'active').trim() || 'active',
    current_location: String(row.address || row.city || '').trim() || null,
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
    type: String(row.model || row.type || 'Frigo').trim(),
    status: String(row.status || 'active').trim() || 'active',
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

  const payload = validation.validRows.map((row) => {
    const rawVisa = row.visa_number ? String(row.visa_number).trim() : '';
    const rawAfrVisa = row.african_visa_number ? String(row.african_visa_number).trim() : '';
    const combinedVisa = [rawVisa, rawAfrVisa ? `AFR: ${rawAfrVisa}` : ''].filter(Boolean).join(' | ');

    return {
      company_id: companyId,
      name: String(row.name || '').trim(),
      phone: String(row.phone || '').trim(),
      license: String(row.license || '').trim(),
      base_salary: sanitizeNumeric(row.base_salary, 0),
      bonus_percentage: sanitizeNumeric(row.bonus_percentage, 0),
      status: String(row.status || 'active').trim() || 'active',
      visa_number: combinedVisa || null,
      visa_expiry_date: row.visa_expiry_date ? String(row.visa_expiry_date).trim() : (combinedVisa ? '2027-12-31' : null),
      has_valid_visa: Boolean(rawVisa || rawAfrVisa),
    };
  });

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

  // جلب كافة الصناديق لتحديد الصندوق الأنسب لكل معاملة بدقة
  const { data: allBoxes } = await supabase
    .from('cash_boxes')
    .select('id, code, label')
    .eq('company_id', companyId);

  const resolveCashBoxId = (row: ImportRow): number | null => {
    if (row.cash_box_id) return Number(row.cash_box_id);
    const ref = String(row.reference || '').toUpperCase();
    const desc = String(row.description || '').toLowerCase();

    // 1. مطابقة عهدة معبر الكركارات
    if (ref.includes('CSH-GRG') || desc.includes('كركارات') || desc.includes('guerguerat')) {
      const box = allBoxes?.find((b) => b.code === 'caisse_guerguerat');
      if (box) return box.id;
    }
    // 2. مطابقة عهدة ميناء طنجة المتوسط
    if (ref.includes('CSH-PTM') || desc.includes('ميناء طنجة') || desc.includes('tanger med')) {
      const box = allBoxes?.find((b) => b.code === 'caisse_port_tm');
      if (box) return box.id;
    }
    // 3. مطابقة صندوق الصرف الأوروبي
    if (ref.includes('CSH-EUR') || desc.includes('صرف') || desc.includes('caisse eur')) {
      const box = allBoxes?.find((b) => b.code === 'caisse_eur');
      if (box) return box.id;
    }
    // 4. مطابقة الصندوق الرئيسي بطنجة
    if (ref.includes('CSH-TNG') || desc.includes('الرئيسي') || desc.includes('tanger bureau')) {
      const box = allBoxes?.find((b) => b.code === 'caisse_principale' || b.code === 'secretary_cash');
      if (box) return box.id;
    }
    // 5. مطابقة الحسابات البنكية بالعملة الصعبة (EUR)
    if (ref.includes('AWB-EUR') || desc.includes('eur')) {
      const box = allBoxes?.find((b) => b.code === 'bank_europe');
      if (box) return box.id;
    }
    // 6. مطابقة الحسابات البنكية بالدرهم (MAD)
    if (ref.includes('AWB-MAD') || ref.includes('BP-MAD') || desc.includes('bank') || desc.includes('بنك')) {
      const box = allBoxes?.find((b) => b.code === 'bank_morocco');
      if (box) return box.id;
    }

    return allBoxes?.[0]?.id || null;
  };

  const payload = validation.validRows.map((row) => {
    const dec = new Decimal(sanitizeNumeric(row.amount, 0));
    const rawType = String(row.type || 'capital_injection').trim().toLowerCase();
    const txType = (rawType === 'deposit' || rawType === 'إيداع' || rawType === 'opening' || rawType === 'opening_balance')
      ? 'capital_injection'
      : rawType;

    return {
      company_id: companyId,
      cash_box_id: resolveCashBoxId(row),
      type: txType,
      amount: dec.toNumber(),
      currency: String(row.currency || 'MAD').toUpperCase(),
      description: String(row.description || 'رصيد افتتاحي تأسيسي').trim(),
      reference: row.reference ? String(row.reference).trim() : null,
      created_at: String(row.created_at || row.departure_date || new Date().toISOString()),
      reconciliation_status: 'reconciled',
    };
  });

  // فحص المعاملات الموجودة مسبقاً بنفس المرجع لضمان عدم التكرار (Idempotent Upsert)
  const existingRefs = payload.map((p) => p.reference).filter(Boolean) as string[];
  const { data: existingTxs } = await supabase
    .from('treasury_transactions')
    .select('id, reference')
    .eq('company_id', companyId)
    .in('reference', existingRefs);

  const existingMap = new Map((existingTxs || []).map((t) => [t.reference, t.id]));
  const toInsert = payload.filter((p) => !p.reference || !existingMap.has(p.reference));
  const toUpdate = payload.filter((p) => p.reference && existingMap.has(p.reference));

  let totalProcessed = 0;
  if (toInsert.length > 0) {
    const { error: insErr, count: insCount } = await supabase.from('treasury_transactions').insert(toInsert).select('id');
    if (insErr) {
      return {
        success: false,
        imported: 0,
        failed: payload.length,
        errors: [{ row: 0, message: insErr.message }],
      };
    }
    totalProcessed += insCount || toInsert.length;
  }

  for (const item of toUpdate) {
    const existingId = existingMap.get(item.reference!);
    if (existingId) {
      await supabase.from('treasury_transactions').update(item).eq('id', existingId);
      totalProcessed++;
    }
  }

  await logAudit(supabase, 'bulk_import_treasury', 'treasury_transactions', {
    totalRows: rows.length,
    imported: totalProcessed,
    failed: validation.invalidRows.length,
  });

  return {
    success: validation.invalidRows.length === 0,
    imported: totalProcessed,
    failed: validation.invalidRows.length,
    errors: validation.invalidRows.map((r) => ({ row: r.row, message: r.errors.join('، ') })),
  };
};
