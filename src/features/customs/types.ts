export interface PortNetGatePass {
  tripId: number;
  cmrNumber: string;
  bookingReference: string; // Ferry booking code / localizador
  ferryCompany: string; // FRS, Baleària, GNV, Trasmediterránea, Armas
  mrnNumber: string; // Movement Reference Number / DUM
  portOfDeparture: string; // e.g. Tanger Med Port Passager
  portOfArrival: string; // e.g. Port d'Algésiras
  tractorPlate: string; // Immatriculation Tracteur
  trailerPlate: string; // Immatriculation Remorque
  driverName: string;
  driverCinOrPassport: string;
  driverPhone?: string;
  customsSealNumber: string; // Numéro de scellé douanier
  goodsDescription: string;
  grossWeightKg: number;
  consignorName: string;
  consignorIce?: string;
  consigneeName: string;
  consigneeAddress?: string;
  consigneeVatOrEori?: string;
  issueDate: string;
}

export interface TirEpdDeclaration {
  tripId: number;
  carnetTirNumber: string; // e.g. XF-1294820
  customsOfficeDeparture: string; // Code bureau douane départ (e.g. MA000001 Tanger Port)
  customsOfficeEntryEU: string; // Code bureau douane entrée UE (e.g. ES001101 Algeciras)
  mrnReference: string;
  tractorPlate: string;
  trailerPlate: string;
  driverFullName: string;
  driverPassport: string;
  hsCode: string; // Code SH (Système Harmonisé)
  goodsDescription: string;
  packageCount: number;
  packageType: string; // e.g. 'PX' (Pallets) / 'CT' (Cartons)
  grossWeightKg: number;
  customsSealNumber: string;
  carrierName: string;
  carrierTirHolderId: string; // Numéro d'adhérent TIR (AMTRI Maroc / IRU)
  declarationDate: string;
}

export interface CustomsPreCheckResult {
  isReadyForPortNet: boolean;
  isReadyForTirEpd: boolean;
  missingPortNetFields: string[];
  missingTirEpdFields: string[];
}

