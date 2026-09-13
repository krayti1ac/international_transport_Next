import type { Client, TripOrder, Invoice, DeliverySignature, Truck, Driver } from '@/types/database';

export interface PortalTripItem extends TripOrder {
  truck?: Truck | null;
  driver?: Driver | null;
  deliveryProof?: DeliverySignature | null;
}

export interface PortalFinancialStats {
  totalInvoiced: string;
  totalPaid: string;
  totalRemaining: string;
  currency: string;
  activeShipmentsCount: number;
  deliveredShipmentsCount: number;
  totalShipmentsCount: number;
}

export interface ClientPortalData {
  client: Client;
  trips: PortalTripItem[];
  invoices: Invoice[];
  stats: PortalFinancialStats;
}

export interface PortalLookupResult {
  success: boolean;
  data?: ClientPortalData;
  error?: string;
}

