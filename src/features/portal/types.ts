import type { Client, TripOrder, Invoice, DeliverySignature, Truck, Driver, BookingRequest } from '@/types/database';

export interface PortalTripItem extends TripOrder {
  truck?: Truck | null;
  driver?: Driver | null;
  deliveryProof?: DeliverySignature | null;
  cargo_type?: string | null;
  cargo_description?: string | null;
  current_temperature?: number | null;
  target_temperature?: number | null;
  destination?: string | null;
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
  bookings: BookingRequest[];
  stats: PortalFinancialStats;
}

export interface PortalLookupResult {
  success: boolean;
  data?: ClientPortalData;
  error?: string;
}

export interface CreateBookingInput {
  clientId?: number;
  routeFrom: string;
  routeTo: string;
  corridorType?: 'european_maritime' | 'african_overland';
  cargoType: 'fresh_produce' | 'frozen_fish' | 'general_cargo' | 'pharmaceuticals';
  trailerType: 'frigo' | 'bache' | 'box' | 'container';
  targetTemperature?: number | null;
  weightTons?: number | null;
  pickupDate: string;
  deliveryDeadline?: string | null;
  pickupAddress?: string | null;
  pickupGpsUrl?: string | null;
  deliveryAddress?: string | null;
  deliveryGpsUrl?: string | null;
  specialInstructions?: string | null;
}

export interface CreateBookingResult {
  success: boolean;
  booking?: BookingRequest;
  error?: string;
}


