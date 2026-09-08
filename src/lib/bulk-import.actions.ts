'use server';

import { createClient } from '@/lib/supabase/server';
import { recordAuditLog } from '@/lib/audit.server';
import type { ImportedClient, ImportedTruck } from '@/lib/excel-importer';

export async function bulkInsertClients(clients: ImportedClient[]) {
  const supabase = await createClient();

  const mappedClients = clients.map((c) => ({
    name: c.name,
    ice: c.ice_number || '',
    phone: c.contact_number || '',
    address: c.address || '',
    currency: c.currency || 'MAD',
    client_type: c.client_type === 'both' ? 'export' : c.client_type,
    is_active: true,
  }));

  const { data, error } = await supabase.from('clients').insert(mappedClients).select('id');

  if (error) {
    console.error('Bulk Insert Clients Error:', error);
    throw new Error(error.message);
  }

  // توثيق العملية أمنياً
  await recordAuditLog({
    entityType: 'clients',
    entityId: 'bulk_import',
    actionType: 'create',
    reason: `استيراد جماعي لعدد ${clients.length} عميل عبر ملف Excel`,
  });

  return { success: true, insertedCount: data.length };
}

export async function bulkInsertTrucks(trucks: ImportedTruck[]) {
  const supabase = await createClient();

  const mappedTrucks = trucks.map((t) => ({
    plate_number: t.plate_number,
    model: t.model || t.brand || 'Tracteur Routier',
    status: t.status || 'active',
  }));

  const { data, error } = await supabase.from('trucks').insert(mappedTrucks).select('id');

  if (error) {
    console.error('Bulk Insert Trucks Error:', error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    entityType: 'trucks',
    entityId: 'bulk_import',
    actionType: 'create',
    reason: `استيراد جماعي لعدد ${trucks.length} شاحنة عبر ملف Excel`,
  });

  return { success: true, insertedCount: data.length };
}

export async function bulkInsertTrailers(trailers: { plate_number: string; model?: string; status?: string }[]) {
  const supabase = await createClient();

  const mappedTrailers = trailers.map((t) => ({
    plate_number: t.plate_number,
    model: t.model || 'Remorque Frigo',
    status: t.status || 'active',
  }));

  const { data, error } = await supabase.from('trailers').insert(mappedTrailers).select('id');

  if (error) {
    console.error('Bulk Insert Trailers Error:', error);
    throw new Error(error.message);
  }

  await recordAuditLog({
    entityType: 'trailers',
    entityId: 'bulk_import',
    actionType: 'create',
    reason: `استيراد جماعي لعدد ${trailers.length} مقطورة عبر ملف Excel`,
  });

  return { success: true, insertedCount: data.length };
}

