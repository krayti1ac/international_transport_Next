export type CustomsGateway = 'portnet' | 'tir_epd' | 'badr';
export type CustomsSubmissionStatus =
  | 'draft'
  | 'submitting'
  | 'submitted'
  | 'accepted'
  | 'rejected'
  | 'pending'
  | 'failed';

export type CustomsApiMode = 'sandbox' | 'production';

export interface TirEpdCustomsOffice {
  code: string;
  name: string;
  country: string;
}

export interface PortNetBookingDetails {
  localizador: string;
  shippingLine: string;
  portOfLoading: string;
  portOfDischarge: string;
}

export interface PortNetTransportDetails {
  carrierName: string;
  carrierTirHolder: string;
  carrierIce: string;
  truckPlate: string;
  trailerPlate: string;
  driverName: string;
  driverPassport: string;
  driverCin: string;
  driverPhone?: string;
}

export interface PortNetConsignmentDetails {
  cmrNumber: string;
  mrnNumber: string;
  grossWeightKg: number;
  sealNumber: string;
  goodsDescription: string;
  clientIce: string;
  shipperName: string;
  consigneeName: string;
  consigneeAddress?: string;
  consigneeVat?: string;
}

export interface PortNetPayloadData {
  declarationType: 'PRE_GATE_PASS' | 'BADR_CUSTOMS_TIR';
  version: string;
  referenceNumber: string;
  timestamp: string;
  booking: PortNetBookingDetails;
  transport: PortNetTransportDetails;
  consignment: PortNetConsignmentDetails;
}

export interface TirEpdCarrierDetails {
  name: string;
  ice: string;
  address: string;
}

export interface TirEpdTransportMeansDetails {
  truckPlate: string;
  truckNationality: string;
  trailerPlate: string;
  trailerNationality: string;
  driverName: string;
  driverPassport: string;
  driverNationality: string;
}

export interface TirEpdCargoDetails {
  description: string;
  grossWeightKg: number;
  sealNumber: string;
  packagesCount: number;
  hsCode?: string;
  containerNumber?: string;
}

export interface TirEpdMetadataDetails {
  tripId: number;
  referenceNumber: string;
  createdAt: string;
}

export interface TirEpdPayloadData {
  carnetTirNumber: string;
  voucherNumber: string;
  tirHolderCode: string;
  operationType: 'EXIT' | 'ENTRY' | 'TRANSIT';
  departureOffice: TirEpdCustomsOffice;
  destinationOffice: TirEpdCustomsOffice;
  carrier: TirEpdCarrierDetails;
  transportMeans: TirEpdTransportMeansDetails;
  cargo: TirEpdCargoDetails;
  metadata: TirEpdMetadataDetails;
}

export interface CustomsSubmissionResult {
  success: boolean;
  gateway: CustomsGateway;
  mode: CustomsApiMode;
  referenceNumber: string;
  mrnNumber?: string;
  barcodeUrl?: string;
  status: CustomsSubmissionStatus;
  idempotencyKey: string;
  idempotentReplay?: boolean;
  messageAr: string;
  messageFr: string;
  timestamp: string;
  xmlPayload?: string;
  rawResponse?: unknown;
  error?: string;
}

export interface CustomsSubmissionRecord {
  id: string;
  company_id: string;
  trip_id: number;
  gateway: CustomsGateway;
  idempotency_key: string;
  reference_number: string;
  mrn_number?: string | null;
  barcode_url?: string | null;
  status: CustomsSubmissionStatus;
  payload_xml?: string | null;
  response_payload?: unknown | null;
  error_message?: string | null;
  mode: CustomsApiMode;
  submitted_at: string;
  accepted_at?: string | null;
  created_at: string;
  updated_at: string;
}

