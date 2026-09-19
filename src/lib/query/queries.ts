import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Client, Driver, Truck, Trailer, TripOrder, Advance, Invoice, TreasuryTransaction, FleetDocument, FleetDocumentRenewal, CashBox } from '@/types/database';
import { useFiscalStore } from '@/lib/stores/fiscal-store';
import Decimal from 'decimal.js';
import { recordAuditLog } from '@/lib/audit';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const supabase = () => createClient();

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from('clients')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Client[];
    },
  });
}

export function useDrivers() {
  return useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from('drivers')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Driver[];
    },
  });
}

export function useTrucks() {
  return useQuery({
    queryKey: ['trucks'],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from('trucks')
        .select('*')
        .order('plate_number');
      if (error) throw error;
      return data as Truck[];
    },
  });
}

export function useTrailers() {
  return useQuery({
    queryKey: ['trailers'],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from('trailers')
        .select('*')
        .order('plate_number');
      if (error) throw error;
      return data as Trailer[];
    },
  });
}

export function useTripOrders(filters?: { status?: string; driver_id?: number }) {
  return useQuery({
    queryKey: ['tripOrders', filters],
    queryFn: async () => {
      let query = supabase()
        .from('trip_orders')
        .select('*')
        .order('departure_date', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.driver_id) {
        query = query.eq('driver_id', filters.driver_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TripOrder[];
    },
  });
}

export function useTripOrder(id: number) {
  return useQuery({
    queryKey: ['tripOrders', id],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from('trip_orders')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as TripOrder;
    },
    enabled: !!id,
  });
}

export function useAdvances(filters?: { trip_id?: number; driver_id?: number; status?: string }) {
  return useQuery({
    queryKey: ['advances', filters],
    queryFn: async () => {
      let query = supabase()
        .from('advances')
        .select('*')
        .order('date', { ascending: false });

      if (filters?.trip_id) query = query.eq('trip_id', filters.trip_id);
      if (filters?.driver_id) query = query.eq('driver_id', filters.driver_id);
      if (filters?.status) query = query.eq('status', filters.status);

      const { data, error } = await query;
      if (error) throw error;
      return data as Advance[];
    },
  });
}

export function useInvoices(filters?: { client_id?: string; status?: string }) {
  return useQuery({
    queryKey: ['invoices', filters],
    queryFn: async () => {
      let query = supabase()
        .from('invoices')
        .select('*')
        .order('issue_date', { ascending: false });

      if (filters?.client_id) query = query.eq('client_id', filters.client_id);
      if (filters?.status) query = query.eq('status', filters.status);

      const { data, error } = await query;
      if (error) throw error;
      return data as Invoice[];
    },
  });
}

export function useInvoicesByPeriod(filters?: { client_id?: string; status?: string }) {
  const { startDate, endDate } = useFiscalStore();
  return useQuery({
    queryKey: ['invoices', 'period', startDate, endDate, filters],
    queryFn: async () => {
      let query = supabase()
        .from('invoices')
        .select('*')
        .gte('issue_date', startDate)
        .lte('issue_date', endDate)
        .order('issue_date', { ascending: false });

      if (filters?.client_id) query = query.eq('client_id', filters.client_id);
      if (filters?.status) query = query.eq('status', filters.status);

      const { data, error } = await query;
      if (error) throw error;
      return data as Invoice[];
    },
  });
}

export function useTreasuryTransactions(filters?: { type?: string; cash_box_id?: number }) {
  return useQuery({
    queryKey: ['treasuryTransactions', filters],
    queryFn: async () => {
      let query = supabase()
        .from('treasury_transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.type) query = query.eq('type', filters.type);
      if (filters?.cash_box_id) query = query.eq('cash_box_id', filters.cash_box_id);

      const { data, error } = await query;
      if (error) throw error;
      return data as TreasuryTransaction[];
    },
  });
}

export function useFleetDocuments(filters?: { entity_type?: string; entity_id?: number }) {
  return useQuery({
    queryKey: ['fleetDocuments', filters],
    queryFn: async () => {
      let query = supabase()
        .from('fleet_documents')
        .select('*')
        .eq('is_archived', false)
        .order('expiry_date');

      if (filters?.entity_type) query = query.eq('entity_type', filters.entity_type);
      if (filters?.entity_id) query = query.eq('entity_id', filters.entity_id);

      const { data, error } = await query;
      if (error) throw error;
      return data as FleetDocument[];
    },
  });
}

export function useCreateTripOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (trip: Partial<TripOrder>) => {
      const { data, error } = await supabase()
        .from('trip_orders')
        .insert(trip)
        .select()
        .single();
      if (error) throw error;
      return data as TripOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tripOrders'] });
    },
  });
}

export function useCreateAdvance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (advance: Partial<Advance>) => {
      const { data, error } = await supabase()
        .from('advances')
        .insert(advance)
        .select()
        .single();
      if (error) throw error;
      return data as Advance;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advances'] });
    },
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoice: Partial<Invoice>) => {
      const { data, error } = await supabase()
        .from('invoices')
        .insert(invoice)
        .select()
        .single();
      if (error) throw error;
      return data as Invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useCreateTreasuryTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transaction: Partial<TreasuryTransaction>) => {
      const { data, error } = await supabase()
        .from('treasury_transactions')
        .insert(transaction)
        .select()
        .single();
      if (error) throw error;
      return data as TreasuryTransaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasuryTransactions'] });
    },
  });
}

export function useFleetDocumentRenewals(documentId: number) {
  return useQuery({
    queryKey: ['fleetDocumentRenewals', documentId],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from('fleet_document_renewals')
        .select('*')
        .eq('fleet_document_id', documentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as FleetDocumentRenewal[];
    },
    enabled: !!documentId,
  });
}

export function useCashBoxes() {
  return useQuery({
    queryKey: ['cashBoxes'],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from('cash_boxes')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as CashBox[];
    },
  });
}

export function useCreateFleetDocumentRenewal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (renewal: Partial<FleetDocumentRenewal>) => {
      const { data, error } = await supabase()
        .from('fleet_document_renewals')
        .insert(renewal)
        .select()
        .single();

      if (error) throw error;
      return data as FleetDocumentRenewal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleetDocumentRenewals'] });
    },
  });
}

export interface RenewFleetDocumentInput {
  documentId: number;
  newExpiryDate?: string | Date;
  renewalCost?: number | string | InstanceType<typeof Decimal>;
  documentType?: string;
  fileUrl?: string;
  cashBoxId?: number;
  notes?: string;
}


export function useRenewFleetDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
      newExpiryDate,
      renewalCost = 0,
      documentType,
      fileUrl,
      cashBoxId,
      notes,
    }: RenewFleetDocumentInput) => {
      const { data: document, error: fetchError } = await supabase()
        .from('fleet_documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (fetchError || !document) throw (fetchError || new Error('الوثيقة غير موجودة'));

      // حساب تاريخ الانتهاء الجديد (إذا لم يُمرر، يضاف 365 يوماً)
      let formattedNewExpiry: string;
      if (newExpiryDate) {
        const d = typeof newExpiryDate === 'string' ? new Date(newExpiryDate) : newExpiryDate;
        formattedNewExpiry = d.toISOString().split('T')[0];
      } else {
        const baseDate = document.expiry_date ? new Date(document.expiry_date) : new Date();
        const now = new Date();
        const targetDate = baseDate < now ? now : baseDate;
        const nextYear = new Date(targetDate);
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        formattedNewExpiry = nextYear.toISOString().split('T')[0];
      }

      // حساب التكلفة بدقة تامة باستخدام decimal.js
      const costDec = new Decimal(renewalCost || 0);
      const formattedCost = parseFloat(costDec.toFixed(2));
      const previousExpiryDate = document.expiry_date;
      const currency = document.currency || 'MAD';
      const docTypeResolved = documentType || document.document_type || document.doc_type || 'وثيقة أسطول';

      // 1. تحديث جدول fleet_documents
      const docUpdatePayload: Record<string, unknown> = {
        expiry_date: formattedNewExpiry,
        previous_expiry_date: previousExpiryDate,
        cost: formattedCost,
        updated_at: new Date().toISOString(),
      };
      if (fileUrl) docUpdatePayload.file_url = fileUrl;
      if (notes) docUpdatePayload.notes = notes;

      const { data: updatedDoc, error: updateError } = await supabase()
        .from('fleet_documents')
        .update(docUpdatePayload)
        .eq('id', documentId)
        .select()
        .single();

      if (updateError) throw updateError;

      // 2. تسجيل العملية في جدول fleet_document_renewals للأرشيف التاريخي
      const { data: renewalRecord, error: renewalError } = await supabase()
        .from('fleet_document_renewals')
        .insert({
          fleet_document_id: documentId,
          document_id: documentId,
          previous_expiry_date: previousExpiryDate,
          new_expiry_date: formattedNewExpiry,
          renewal_cost: formattedCost,
          cost: formattedCost,
          currency: currency,
          document_type: docTypeResolved,
          notes: notes || `تجديد سريع للوثيقة إلى ${formattedNewExpiry}`,
        })
        .select()
        .single();

      if (renewalError) throw renewalError;

      // 3. إذا كانت تكلفة التجديد renewal_cost > 0: توليد حركة سحب في treasury_transactions
      let treasuryTxId: number | undefined;
      if (costDec.greaterThan(0)) {
        let resolvedCashBoxId = cashBoxId;
        if (!resolvedCashBoxId) {
          const { data: defaultCb } = await supabase().from('cash_boxes').select('id').limit(1).single();
          if (defaultCb) resolvedCashBoxId = defaultCb.id;
        }

        const timestamp = Date.now();
        const reference = `RENEWAL-${documentId}-${timestamp}`;

        const { data: txData, error: treasuryError } = await supabase()
          .from('treasury_transactions')
          .insert({
            type: 'office_expense',
            amount: formattedCost,
            currency: currency,
            cash_box_id: resolvedCashBoxId,
            description: `تجديد وثيقة: ${docTypeResolved} (ID: ${documentId})`,
            reference: reference,
            reconciliation_status: 'pending',
          })
          .select('id')
          .maybeSingle();

        if (treasuryError) {
          console.error('Treasury transaction insert error:', treasuryError);
        } else if (txData?.id && renewalRecord?.id) {
          treasuryTxId = txData.id;
          // ربط رقم حركة الخزينة في جدول fleet_document_renewals
          await supabase()
            .from('fleet_document_renewals')
            .update({ treasury_transaction_id: txData.id })
            .eq('id', renewalRecord.id);
        }
      }

      // 4. تسجيل العملية في سجل التدقيق الأمني audit_logs
      await recordAuditLog({
        entityType: 'fleet_document',
        entityId: documentId,
        actionType: 'update',
        reason: `تجديد وثيقة أسطول (${docTypeResolved}) إلى ${formattedNewExpiry} بتكلفة ${formattedCost} ${currency}`,
        oldData: {
          expiry_date: previousExpiryDate,
          cost: document.cost,
        },
        newData: {
          expiry_date: formattedNewExpiry,
          cost: formattedCost,
          file_url: fileUrl || document.file_url,
          treasury_transaction_id: treasuryTxId,
        },
      });

      return updatedDoc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleetDocuments'] });
      queryClient.invalidateQueries({ queryKey: ['treasuryTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['fleetDocumentRenewals'] });
    },
  });
}

