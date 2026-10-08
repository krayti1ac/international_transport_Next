export type InspectionChannel = 'GREEN' | 'ORANGE' | 'RED';

export type PortNetBadrStatus =
  | 'DRAFT'
  | 'TRANSMITTED'
  | 'ACCEPTED'
  | 'INSPECTION_REQUIRED'
  | 'REJECTED'
  | 'CLEARED_BAE';

export type CustomsEdiDeclarationType =
  | 'DUM' // Déclaration Unique de Marchandises (BADR)
  | 'MANIFEST' // Manifeste CUSCAR (PortNet)
  | 'TIR_EPD' // Transit International Routier (IRU)
  | 'BON_A_ENLEVER'; // BAE Release Authorization

export interface CustomsCertificateConfig {
  certPem: string;
  keyPem: string;
  passphrase?: string;
  caPem?: string;
  issuerCN?: string;
  subjectCN?: string;
  serialNumber?: string;
  validFrom?: string;
  validTo?: string;
  daysUntilExpiry?: number;
  isValid: boolean;
}

export interface CustomsXmlSigningResult {
  signedXml: string;
  signatureAlgorithm: 'RSA-SHA256';
  digestValue: string;
  signatureValue: string;
  certificateFingerprintSha256: string;
  signedAt: string;
}

export interface BadrClearanceReceipt {
  mrn: string; // Movement Reference Number (e.g. 26MA003100DUM00123)
  declarationNumber: string; // DUM number
  customsOfficeCode: string; // e.g. MA003100 (Tanger Med)
  inspectionChannel: InspectionChannel; // GREEN: Mainlevée immédiate, ORANGE: Contrôle doc, RED: Scanner/Visite
  baeNumber?: string; // Bon à Enlever official reference
  baeDate?: string;
  liquidationAmountMad: number; // Droits et taxes liquidés
  declarantAgrement: string;
  validationStatus: PortNetBadrStatus;
  receivedAt: string;
  messageAr: string;
  messageFr: string;
  messageEs: string;
}

export interface BadrDumData {
  tripId: number;
  referenceNumber: string;
  regimeDouanier: string; // e.g. '1000' (Exportation définitive) or '4000' (Importation)
  bureauDouanier: string; // e.g. 'MA003100' (Tanger Med) or 'MA004900' (Guerguerat)
  declarantAgrement: string; // e.g. 'AGR-MA-789'
  declarantName: string;
  carrierIce: string;
  exporterIce: string;
  exporterName: string;
  importerName: string;
  importerCountry: string; // e.g. 'ES', 'FR', 'SN', 'MR'
  importerVat?: string;
  truckPlate: string;
  trailerPlate?: string;
  cmrNumber: string;
  commodityCodeHs: string; // 10-digit HS code e.g. '0702000000' (Tomatoes), '0303890000' (Frozen Fish)
  goodsDescription: string;
  grossWeightKg: number;
  netWeightKg: number;
  customsValueMad: number;
  packagesCount: number;
  ferryBookingRef?: string;
  departureDate?: string;
}

export interface PortNetManifestData {
  tripId: number;
  referenceNumber: string;
  voyageNumber: string; // Ferry voyage or TIR trip number
  shippingLine: string; // e.g. 'Balearia', 'FRS', 'Africa Morocco Link'
  portOfLoading: string; // e.g. 'MAPTM' (Tanger Med)
  portOfDischarge: string; // e.g. 'ESALG' (Algeciras)
  truckPlate: string;
  trailerPlate: string;
  driverName: string;
  driverPassport: string;
  driverCin: string;
  cmrNumber: string;
  mrnNumber?: string;
  grossWeightKg: number;
  sealNumber: string;
  goodsDescription: string;
  ferryLocalizador: string;
  timestamp: string;
}

export interface InboundCustomsWebhookPayload {
  gateway: 'portnet' | 'badr';
  declarationType: CustomsEdiDeclarationType;
  referenceNumber: string;
  mrn?: string;
  declarationNumber?: string;
  status: PortNetBadrStatus;
  inspectionChannel?: InspectionChannel;
  baeNumber?: string;
  baeDate?: string;
  liquidationAmountMad?: number;
  remarks?: string;
  signature?: string;
  timestamp: string;
}

