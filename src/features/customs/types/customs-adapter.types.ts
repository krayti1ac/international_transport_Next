export type CustomsGatewayType = 'portnet' | 'badr' | 'tir_epd';
export type CustomsApiMode = 'sandbox' | 'production';

export interface PortNetApiConfig {
  apiUrl: string;
  clientId: string;
  apiKey: string;
  clientCert?: string;
  privateKey?: string;
  mode: CustomsApiMode;
}

export interface TirEpdConfig {
  apiUrl: string;
  tirHolderCode: string; // e.g. 'MA/042/2026'
  clientId: string;
  clientSecret: string;
  mode: CustomsApiMode;
}

export interface TirEpdCustomsOffice {
  code: string;
  name: string;
  country: string;
}

export interface TirEpdPayloadData {
  carnetTirNumber: string;
  voucherNumber: string;
  tirHolderCode: string;
  operationType: 'EXIT' | 'ENTRY' | 'TRANSIT';
  departureOffice: TirEpdCustomsOffice;
  destinationOffice: TirEpdCustomsOffice;
  carrier: {
    name: string;
    ice: string;
    address: string;
  };
  transportMeans: {
    truckPlate: string;
    truckNationality: string;
    trailerPlate: string;
    trailerNationality: string;
    driverName: string;
    driverPassport: string;
    driverNationality: string;
  };
  cargo: {
    description: string;
    grossWeightKg: number;
    sealNumber: string;
    packagesCount: number;
    containerNumber?: string;
  };
  metadata: {
    tripId: number;
    referenceNumber: string;
    createdAt: string;
  };
}

export interface CustomsApiResponse {
  success: boolean;
  gateway: CustomsGatewayType;
  mode: CustomsApiMode;
  referenceNumber: string;
  customsRegistrationNumber?: string; // MRN (Movement Reference Number)
  barcode?: string;
  status: 'accepted' | 'rejected' | 'pending';
  messageAr: string;
  messageFr: string;
  timestamp: string;
  rawPayload?: unknown;
  rawResponse?: unknown;
  error?: string;
}

