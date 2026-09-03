import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Client, Driver, Truck, Trailer, TripOrder, Advance, Invoice, TreasuryTransaction, FleetDocument, FleetDocumentRenewal, CashBox } from '@/types/database';

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

export function useRenewFleetDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentId, renewalCost, documentType }: { documentId: number; renewalCost: number; documentType: string }) => {
      const { data: document, error: fetchError } = await supabase()
        .from('fleet_documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (fetchError) throw fetchError;

      const newExpiryDate = new Date(document.expiry_date || Date.now());
      newExpiryDate.setFullYear(newExpiryDate.getFullYear() + 1);

      const { data: updatedDoc, error: updateError } = await supabase()
        .from('fleet_documents')
        .update({
          expiry_date: newExpiryDate.toISOString(),
          previous_expiry_date: document.expiry_date,
          renewal_cost: renewalCost,
        })
        .eq('id', documentId)
        .select()
        .single();

      if (updateError) throw updateError;

      const { error: renewalError } = await supabase()
        .from('fleet_document_renewals')
        .insert({
          fleet_document_id: documentId,
          previous_expiry_date: document.expiry_date,
          new_expiry_date: newExpiryDate.toISOString(),
          renewal_cost: renewalCost,
          document_type: documentType,
        });

      if (renewalError) throw renewalError;

      const { error: treasuryError } = await supabase()
        .from('treasury_transactions')
        .insert({
          type: 'office_expense',
          amount: renewalCost,
          description: `Renewal: ${documentType} (ID: ${documentId})`,
          reference: `RENEWAL-${documentId}-${Date.now()}`,
        });

      if (treasuryError) throw treasuryError;

      return updatedDoc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleetDocuments'] });
      queryClient.invalidateQueries({ queryKey: ['treasuryTransactions'] });
    },
  });
}
