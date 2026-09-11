'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { getDynamicTreasuryBalance } from '@/features/finance/services/finance.actions';
import { mapDbStatusToKanbanStage } from '@/lib/utils/trip-status';
import type { TreasuryTransaction } from '@/types/database';

export interface SecretaryCashData {
  boxId: number | null;
  currency: string;
  balance: string;
  recentTransactions: TreasuryTransaction[];
  isLoading: boolean;
}

export interface CriticalDocItem {
  id: string | number;
  type: 'visa' | 'truck_doc' | 'trailer_doc';
  title: string;
  entityName: string;
  entityPlate?: string;
  expiryDate: string;
  daysRemaining: number;
  urgency: 'expired' | 'urgent' | 'soon' | 'upcoming';
}

export interface ScheduledDepartureItem {
  id: number;
  departureDate: string;
  route: string;
  cmrNumber?: string;
  driverName?: string;
  truckPlate?: string;
  status: string;
}

export interface SecretaryDatesData {
  criticalDocs: CriticalDocItem[];
  scheduledDepartures: ScheduledDepartureItem[];
  urgentCount: number;
  totalAlertsCount: number;
}

export interface SecretaryTripItem {
  id: number;
  cmr_number?: string;
  route: string;
  departure_date: string;
  status: string;
  stage: string;
  driver_name?: string;
  truck_plate?: string;
  trailer_plate?: string;
  client_name?: string;
}

export interface SecretaryPipelineData {
  trips: SecretaryTripItem[];
  stageCounts: {
    pendingAssignment: number;
    outbound: number;
    pendingReturn: number;
    returnRoute: number;
    settled: number;
    total: number;
  };
}

/**
 * Hook to fetch secretary cash balance and recent transactions
 */
export function useSecretaryCash() {
  return useQuery({
    queryKey: ['secretary-cash-data'],
    queryFn: async (): Promise<SecretaryCashData> => {
      const supabase = createClient();

      // 1. Get secretary cash box
      const { data: cashBox, error: boxError } = await supabase
        .from('cash_boxes')
        .select('id, name, code, currency')
        .eq('code', 'secretary_cash')
        .maybeSingle();

      if (boxError || !cashBox) {
        return {
          boxId: null,
          currency: 'MAD',
          balance: '0.00',
          recentTransactions: [],
          isLoading: false,
        };
      }

      // 2. Fetch dynamic balance
      let balance = '0.00';
      try {
        balance = await getDynamicTreasuryBalance('secretary_cash');
      } catch (e) {
        console.warn('Could not calculate secretary cash balance:', e);
      }

      // 3. Fetch latest 5 transactions for this cash box
      const { data: txs } = await supabase
        .from('treasury_transactions')
        .select('*')
        .eq('cash_box_id', cashBox.id)
        .order('created_at', { ascending: false })
        .limit(6);

      return {
        boxId: cashBox.id,
        currency: cashBox.currency || 'MAD',
        balance,
        recentTransactions: (txs || []) as TreasuryTransaction[],
        isLoading: false,
      };
    },
    staleTime: 15_000,
  });
}

/**
 * Hook to track critical dates, document expiries, and scheduled trips
 */
export function useSecretaryCriticalDates() {
  return useQuery({
    queryKey: ['secretary-critical-dates'],
    queryFn: async (): Promise<SecretaryDatesData> => {
      const supabase = createClient();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const threshold30 = new Date(today);
      threshold30.setDate(threshold30.getDate() + 30);
      const threshold30Str = threshold30.toISOString().split('T')[0];

      // Fetch drivers with upcoming/expired visas
      const [driversRes, docsRes, trucksRes, trailersRes, tripsRes] = await Promise.all([
        supabase
          .from('drivers')
          .select('id, name, visa_expiry_date')
          .not('visa_expiry_date', 'is', null)
          .lte('visa_expiry_date', threshold30Str)
          .order('visa_expiry_date', { ascending: true }),
        supabase
          .from('fleet_documents')
          .select('*')
          .or('is_archived.is.null,is_archived.eq.false')
          .lte('expiry_date', threshold30Str)
          .order('expiry_date', { ascending: true }),
        supabase.from('trucks').select('id, plate_number'),
        supabase.from('trailers').select('id, plate_number'),
        supabase
          .from('trip_orders')
          .select('id, departure_date, route, cmr_number, status, drivers(name), trucks(plate_number)')
          .gte('departure_date', today.toISOString().split('T')[0])
          .order('departure_date', { ascending: true })
          .limit(10),
      ]);

      const truckMap = (trucksRes.data || []).reduce((acc: Record<number, string>, t: { id: number; plate_number: string }) => {
        acc[t.id] = t.plate_number;
        return acc;
      }, {});

      const trailerMap = (trailersRes.data || []).reduce((acc: Record<number, string>, t: { id: number; plate_number: string }) => {
        acc[t.id] = t.plate_number;
        return acc;
      }, {});

      const criticalDocs: CriticalDocItem[] = [];

      // Process Driver Visas
      (driversRes.data || []).forEach((d) => {
        if (!d.visa_expiry_date) return;
        const exp = new Date(d.visa_expiry_date);
        exp.setHours(0, 0, 0, 0);
        const days = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        let urgency: 'expired' | 'urgent' | 'soon' | 'upcoming' = 'upcoming';
        if (days < 0) urgency = 'expired';
        else if (days <= 2) urgency = 'urgent';
        else if (days <= 7) urgency = 'soon';

        criticalDocs.push({
          id: `driver-${d.id}`,
          type: 'visa',
          title: 'تأشيرة دخول السائق (Visa)',
          entityName: d.name,
          expiryDate: d.visa_expiry_date,
          daysRemaining: days,
          urgency,
        });
      });

      // Process Fleet Documents
      (docsRes.data || []).forEach((doc) => {
        if (!doc.expiry_date) return;
        const exp = new Date(doc.expiry_date);
        exp.setHours(0, 0, 0, 0);
        const days = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        let urgency: 'expired' | 'urgent' | 'soon' | 'upcoming' = 'upcoming';
        if (days < 0) urgency = 'expired';
        else if (days <= 2) urgency = 'urgent';
        else if (days <= 7) urgency = 'soon';

        const isTruck = (doc.entity_type || '').toLowerCase() === 'truck';
        const plate = isTruck ? truckMap[doc.entity_id] : trailerMap[doc.entity_id];
        const typeLabel = doc.document_type || doc.doc_type || (isTruck ? 'وثيقة شاحنة' : 'وثيقة مقطورة');

        criticalDocs.push({
          id: `doc-${doc.id}`,
          type: isTruck ? 'truck_doc' : 'trailer_doc',
          title: typeLabel,
          entityName: plate || (isTruck ? 'شاحنة' : 'مقطورة'),
          entityPlate: plate,
          expiryDate: doc.expiry_date,
          daysRemaining: days,
          urgency,
        });
      });

      // Sort critical docs: expired first, then urgent, then soon
      criticalDocs.sort((a, b) => a.daysRemaining - b.daysRemaining);

      const scheduledDepartures: ScheduledDepartureItem[] = (tripsRes.data || []).map((tr: any) => ({
        id: tr.id,
        departureDate: tr.departure_date,
        route: tr.route || 'غير محدد',
        cmrNumber: tr.cmr_number,
        driverName: tr.drivers?.name,
        truckPlate: tr.trucks?.plate_number,
        status: tr.status,
      }));

      const urgentCount = criticalDocs.filter((d) => d.urgency === 'expired' || d.urgency === 'urgent').length;

      return {
        criticalDocs,
        scheduledDepartures,
        urgentCount,
        totalAlertsCount: criticalDocs.length,
      };
    },
    staleTime: 30_000,
  });
}

/**
 * Hook to fetch active trips and stages for secretary operational pipeline
 */
export function useSecretaryTripStages() {
  return useQuery({
    queryKey: ['secretary-trip-stages'],
    queryFn: async (): Promise<SecretaryPipelineData> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('trip_orders')
        .select(`
          id,
          cmr_number,
          route,
          departure_date,
          status,
          drivers:driver_id(name),
          trucks:truck_id(plate_number),
          trailers:trailer_id(plate_number),
          clients:client_id(name)
        `)
        .order('departure_date', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching secretary trips:', error);
        return {
          trips: [],
          stageCounts: {
            pendingAssignment: 0,
            outbound: 0,
            pendingReturn: 0,
            returnRoute: 0,
            settled: 0,
            total: 0,
          },
        };
      }

      const stageCounts = {
        pendingAssignment: 0,
        outbound: 0,
        pendingReturn: 0,
        returnRoute: 0,
        settled: 0,
        total: 0,
      };

      const trips: SecretaryTripItem[] = (data || []).map((t: any) => {
        const stage = mapDbStatusToKanbanStage(t.status);
        if (stage in stageCounts) {
          (stageCounts as any)[stage] += 1;
        }
        stageCounts.total += 1;

        return {
          id: t.id,
          cmr_number: t.cmr_number,
          route: t.route || 'غير محدد',
          departure_date: t.departure_date,
          status: t.status,
          stage,
          driver_name: t.drivers?.name,
          truck_plate: t.trucks?.plate_number,
          trailer_plate: t.trailers?.plate_number,
          client_name: t.clients?.name,
        };
      });

      return { trips, stageCounts };
    },
    staleTime: 15_000,
  });
}
