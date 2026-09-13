'use server';

import { createClient } from '@/lib/supabase/server';
import Decimal from 'decimal.js';
import type { Client, TripOrder, Invoice, DeliverySignature, Truck, Driver } from '@/types/database';
import { DEFAULT_CLIENTS, DEFAULT_TRIPS, DEFAULT_INVOICES } from '@/lib/default-data';
import type { ClientPortalData, PortalLookupResult, PortalTripItem } from '../types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export async function getClientPortalDataAction(identifier: {
  clientId?: number;
  ice?: string;
  cmrNumber?: string;
}): Promise<PortalLookupResult> {
  try {
    const supabase = await createClient();

    let targetClient: Client | null = null;
    let targetTripIdFromCmr: number | null = null;

    // 1. إذا كان البحث برقم وثيقة الشحن CMR
    if (identifier.cmrNumber) {
      const cleanCmr = identifier.cmrNumber.trim().toUpperCase();
      const { data: tripByCmr } = await supabase
        .from('trip_orders')
        .select('*')
        .or(`cmr_number.ilike.%${cleanCmr}%,cmr_export_number.ilike.%${cleanCmr}%,cmr_import_number.ilike.%${cleanCmr}%`)
        .maybeSingle();

      if (tripByCmr) {
        targetTripIdFromCmr = tripByCmr.id;
        const targetClientId = tripByCmr.client_id || tripByCmr.client_import_id;
        if (targetClientId) {
          const { data: cData } = await supabase
            .from('clients')
            .select('*')
            .eq('id', targetClientId)
            .maybeSingle();
          if (cData) targetClient = cData;
        }
      } else {
        // فحص البيانات الافتراضية للـ CMR
        const defaultMatch = DEFAULT_TRIPS.find(
          (t) =>
            t.cmr_number?.toUpperCase().includes(cleanCmr) ||
            t.cmr_export_number?.toUpperCase().includes(cleanCmr) ||
            `CMR-${t.id}`.toUpperCase().includes(cleanCmr)
        );
        if (defaultMatch) {
          targetTripIdFromCmr = defaultMatch.id;
          const cId = defaultMatch.client_id || defaultMatch.client_import_id;
          targetClient = DEFAULT_CLIENTS.find((c) => c.id === cId) || DEFAULT_CLIENTS[0];
        }
      }
    }

    // 2. إذا كان البحث برقم التعريف الموحد للمقاولة (ICE)
    if (!targetClient && identifier.ice) {
      const cleanIce = identifier.ice.trim();
      const { data: clientByIce } = await supabase
        .from('clients')
        .select('*')
        .eq('ice', cleanIce)
        .maybeSingle();

      if (clientByIce) {
        targetClient = clientByIce;
      } else {
        targetClient = DEFAULT_CLIENTS.find((c) => c.ice === cleanIce) || null;
      }
    }

    // 3. إذا كان البحث بمعرف العميل المباشر (ID)
    if (!targetClient && identifier.clientId) {
      const { data: clientById } = await supabase
        .from('clients')
        .select('*')
        .eq('id', identifier.clientId)
        .maybeSingle();

      if (clientById) {
        targetClient = clientById;
      } else {
        targetClient = DEFAULT_CLIENTS.find((c) => c.id === identifier.clientId) || null;
      }
    }

    // إذا لم يتطابق أي عميل، استخدام أول عميل افتراضي لتجربة الاستعراض السلس
    if (!targetClient) {
      targetClient = DEFAULT_CLIENTS[0];
    }

    const clientId = targetClient.id;

    // 4. جلب الرحلات المباشرة (Point-to-Point) المرتبطة بالعميل (تصدير أو استيراد)
    const { data: dbTrips } = await supabase
      .from('trip_orders')
      .select('*')
      .or(`client_id.eq.${clientId},client_import_id.eq.${clientId}`)
      .order('departure_date', { ascending: false });

    let tripsSource: TripOrder[] = dbTrips && dbTrips.length > 0 ? dbTrips : [];

    if (tripsSource.length === 0) {
      tripsSource = DEFAULT_TRIPS.filter(
        (t) => t.client_id === clientId || t.client_import_id === clientId
      );
      if (tripsSource.length === 0) {
        tripsSource = DEFAULT_TRIPS.slice(0, 3);
      }
    }

    const tripIds = tripsSource.map((t) => t.id);

    // 5. جلب إثباتات التسليم (e-POD)، الشاحنات، والسائقين للرحلات
    const [signaturesRes, trucksRes, driversRes] = await Promise.all([
      tripIds.length > 0
        ? supabase.from('delivery_signatures').select('*').in('trip_order_id', tripIds)
        : Promise.resolve({ data: [] }),
      supabase.from('trucks').select('*'),
      supabase.from('drivers').select('*'),
    ]);

    const signaturesMap = new Map<number, DeliverySignature>();
    (signaturesRes.data || []).forEach((sig: DeliverySignature) => {
      signaturesMap.set(sig.trip_order_id, sig);
    });

    const trucksMap = new Map<number, Truck>();
    (trucksRes.data || []).forEach((trk: Truck) => {
      trucksMap.set(trk.id, trk);
    });

    const driversMap = new Map<number, Driver>();
    (driversRes.data || []).forEach((drv: Driver) => {
      driversMap.set(drv.id, drv);
    });

    const enrichedTrips: PortalTripItem[] = tripsSource.map((trip) => {
      return {
        ...trip,
        truck: trip.truck_id ? trucksMap.get(trip.truck_id) || null : null,
        driver: trip.driver_id ? driversMap.get(trip.driver_id) || null : null,
        deliveryProof: signaturesMap.get(trip.id) || null,
      };
    });

    // 6. جلب الفواتير الخاصة بالعميل
    const { data: dbInvoices } = await supabase
      .from('invoices')
      .select('*')
      .or(`client_id.eq.${clientId},client_id.eq.${String(clientId)}`)
      .order('issue_date', { ascending: false });

    let invoicesSource: Invoice[] = dbInvoices && dbInvoices.length > 0 ? dbInvoices : [];
    if (invoicesSource.length === 0) {
      invoicesSource = DEFAULT_INVOICES.filter(
        (inv) => inv.client_id === String(clientId) || inv.client_id === String(targetClient?.name)
      );
      if (invoicesSource.length === 0 && DEFAULT_INVOICES.length > 0) {
        invoicesSource = DEFAULT_INVOICES.slice(0, 3).map((inv) => ({
          ...inv,
          client_id: String(clientId),
        }));
      }
    }

    // 7. الحسابات المالية الدقيقة عبر Decimal.js حصراً
    let totalInvoicedDec = new Decimal(0);
    let totalPaidDec = new Decimal(0);

    for (const inv of invoicesSource) {
      const invTotal = new Decimal(inv.ttc_amount || inv.total_amount || 0);
      const invPaid = new Decimal(inv.paid_amount || 0);
      totalInvoicedDec = totalInvoicedDec.plus(invTotal);
      totalPaidDec = totalPaidDec.plus(invPaid);
    }

    const totalRemainingDec = totalInvoicedDec.minus(totalPaidDec);

    const activeCount = enrichedTrips.filter((t) => t.status === 'in_transit' || t.status === 'pending').length;
    const deliveredCount = enrichedTrips.filter((t) => t.status === 'completed').length;

    const portalData: ClientPortalData = {
      client: targetClient,
      trips: enrichedTrips,
      invoices: invoicesSource,
      stats: {
        totalInvoiced: totalInvoicedDec.toFixed(2),
        totalPaid: totalPaidDec.toFixed(2),
        totalRemaining: totalRemainingDec.toFixed(2),
        currency: targetClient.currency || 'EUR',
        activeShipmentsCount: activeCount,
        deliveredShipmentsCount: deliveredCount,
        totalShipmentsCount: enrichedTrips.length,
      },
    };

    return {
      success: true,
      data: portalData,
    };
  } catch (err) {
    console.error('Error fetching client portal data:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'تعذر تحميل بيانات بوابة العملاء',
    };
  }
}

export async function getAvailablePortalClientsAction(): Promise<{
  id: number;
  name: string;
  ice: string;
  city?: string;
}[]> {
  try {
    const supabase = await createClient();
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, ice, shipping_city')
      .eq('is_active', true)
      .order('name');

    if (clients && clients.length > 0) {
      return clients.map((c) => ({
        id: c.id,
        name: c.name,
        ice: c.ice,
        city: c.shipping_city,
      }));
    }

    return DEFAULT_CLIENTS.map((c) => ({
      id: c.id,
      name: c.name,
      ice: c.ice,
      city: c.city || c.shipping_city,
    }));
  } catch {
    return DEFAULT_CLIENTS.map((c) => ({
      id: c.id,
      name: c.name,
      ice: c.ice,
      city: c.city || c.shipping_city,
    }));
  }
}

