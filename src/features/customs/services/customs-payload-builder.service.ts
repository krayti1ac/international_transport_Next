import Decimal from 'decimal.js';
import type {
  PortNetPayloadData,
  TirEpdPayloadData,
  TirEpdCustomsOffice,
} from '../types/customs.types';
import { STANDARD_CUSTOMS_OFFICES } from './customs-api-adapter.service';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Escapes characters that have special meaning in XML to prevent XML injection or syntax corruption.
 */
export function escapeXml(unsafe: unknown): string {
  if (unsafe === undefined || unsafe === null) return '';
  const str = String(unsafe);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Validates and sanitizes Moroccan ICE (Identifiant Commun de l'Entreprise) - must be 15 digits.
 */
export function validateMoroccanIce(ice?: string | null): {
  isValid: boolean;
  cleanedIce: string;
} {
  if (!ice) return { isValid: false, cleanedIce: '' };
  const cleaned = ice.replace(/\D/g, '');
  const isValid = cleaned.length === 15;
  return { isValid, cleanedIce: cleaned };
}

/**
 * Builds XML payload for Moroccan Single Window PortNet (Guichet Unique PortNet - Tanger Med)
 */
export function buildPortNetXML(data: PortNetPayloadData): string {
  const { cleanedIce: carrierIce } = validateMoroccanIce(data.transport.carrierIce);
  const { cleanedIce: clientIce } = validateMoroccanIce(data.consignment.clientIce);

  const safeCarrierIce = carrierIce || escapeXml(data.transport.carrierIce);
  const safeClientIce = clientIce || escapeXml(data.consignment.clientIce);

  return `<?xml version="1.0" encoding="UTF-8"?>
<PortNetDeclaration version="${escapeXml(data.version)}" type="${escapeXml(data.declarationType)}">
  <Header>
    <ReferenceNumber>${escapeXml(data.referenceNumber)}</ReferenceNumber>
    <Timestamp>${escapeXml(data.timestamp)}</Timestamp>
    <Corridor>TangerMed-Algeciras</Corridor>
  </Header>
  <Booking>
    <Localizador>${escapeXml(data.booking.localizador)}</Localizador>
    <ShippingLine>${escapeXml(data.booking.shippingLine)}</ShippingLine>
    <PortOfLoading>${escapeXml(data.booking.portOfLoading)}</PortOfLoading>
    <PortOfDischarge>${escapeXml(data.booking.portOfDischarge)}</PortOfDischarge>
  </Booking>
  <TransportEquipment>
    <CarrierName>${escapeXml(data.transport.carrierName)}</CarrierName>
    <TirHolderCode>${escapeXml(data.transport.carrierTirHolder)}</TirHolderCode>
    <CarrierICE>${safeCarrierIce}</CarrierICE>
    <TruckPlate>${escapeXml(data.transport.truckPlate)}</TruckPlate>
    <TrailerPlate>${escapeXml(data.transport.trailerPlate)}</TrailerPlate>
    <Driver>
      <Name>${escapeXml(data.transport.driverName)}</Name>
      <Passport>${escapeXml(data.transport.driverPassport)}</Passport>
      <NationalID>${escapeXml(data.transport.driverCin)}</NationalID>
      ${data.transport.driverPhone ? `<Phone>${escapeXml(data.transport.driverPhone)}</Phone>` : ''}
    </Driver>
  </TransportEquipment>
  <Consignment>
    <CMRNumber>${escapeXml(data.consignment.cmrNumber)}</CMRNumber>
    <MRNNumber>${escapeXml(data.consignment.mrnNumber)}</MRNNumber>
    <GrossWeight unit="KG">${data.consignment.grossWeightKg}</GrossWeight>
    <SealNumber>${escapeXml(data.consignment.sealNumber)}</SealNumber>
    <GoodsDescription>${escapeXml(data.consignment.goodsDescription)}</GoodsDescription>
    <Shipper>
      <Name>${escapeXml(data.consignment.shipperName)}</Name>
      <ICE>${safeClientIce}</ICE>
    </Shipper>
    <Consignee>
      <Name>${escapeXml(data.consignment.consigneeName)}</Name>
      ${data.consignment.consigneeAddress ? `<Address>${escapeXml(data.consignment.consigneeAddress)}</Address>` : ''}
      ${data.consignment.consigneeVat ? `<VatNumber>${escapeXml(data.consignment.consigneeVat)}</VatNumber>` : ''}
    </Consignee>
  </Consignment>
</PortNetDeclaration>`.trim();
}

/**
 * Builds XML payload for IRU TIR-EPD (Electronic Pre-Declaration)
 */
export function buildTirEpdXML(data: TirEpdPayloadData): string {
  const { cleanedIce: carrierIce } = validateMoroccanIce(data.carrier.ice);
  const safeCarrierIce = carrierIce || escapeXml(data.carrier.ice);

  return `<?xml version="1.0" encoding="UTF-8"?>
<TirEpdDeclaration xmlns="http://www.iru.org/tirepd/v4" version="4.1">
  <DeclarationHeader>
    <MessageReference>${escapeXml(data.metadata.referenceNumber)}</MessageReference>
    <CarnetNumber>${escapeXml(data.carnetTirNumber)}</CarnetNumber>
    <VoucherNumber>${escapeXml(data.voucherNumber)}</VoucherNumber>
    <DeclarationType>${escapeXml(data.operationType)}</DeclarationType>
    <DeclarationDate>${escapeXml(data.metadata.createdAt)}</DeclarationDate>
    <CarrierHolderCode>${escapeXml(data.tirHolderCode)}</CarrierHolderCode>
    <CarrierName>${escapeXml(data.carrier.name)}</CarrierName>
    <CarrierICE>${safeCarrierIce}</CarrierICE>
    <CarrierAddress>${escapeXml(data.carrier.address)}</CarrierAddress>
  </DeclarationHeader>
  <Itinerary>
    <CustomsOfficeDeparture code="${escapeXml(data.departureOffice.code)}">${escapeXml(data.departureOffice.name)}</CustomsOfficeDeparture>
    <CustomsOfficeDestination code="${escapeXml(data.destinationOffice.code)}">${escapeXml(data.destinationOffice.name)}</CustomsOfficeDestination>
  </Itinerary>
  <TransportMeans>
    <ModeOfTransport>30</ModeOfTransport>
    <TractorPlate nationality="${escapeXml(data.transportMeans.truckNationality)}">${escapeXml(data.transportMeans.truckPlate)}</TractorPlate>
    <TrailerPlate nationality="${escapeXml(data.transportMeans.trailerNationality)}">${escapeXml(data.transportMeans.trailerPlate)}</TrailerPlate>
    <Driver>
      <FullName>${escapeXml(data.transportMeans.driverName)}</FullName>
      <PassportNumber nationality="${escapeXml(data.transportMeans.driverNationality)}">${escapeXml(data.transportMeans.driverPassport)}</PassportNumber>
    </Driver>
  </TransportMeans>
  <ConsignmentItem number="1">
    <GoodsItemNumber>1</GoodsItemNumber>
    <HsCommodityCode>${escapeXml(data.cargo.hsCode || '870423')}</HsCommodityCode>
    <Description>${escapeXml(data.cargo.description)}</Description>
    <GrossMassKg>${data.cargo.grossWeightKg}</GrossMassKg>
    <Packages>
      <Count>${data.cargo.packagesCount}</Count>
      <TypeCode>PX</TypeCode>
    </Packages>
    <CustomsSeal>
      <SealNumber>${escapeXml(data.cargo.sealNumber)}</SealNumber>
    </CustomsSeal>
    ${data.cargo.containerNumber ? `<ContainerNumber>${escapeXml(data.cargo.containerNumber)}</ContainerNumber>` : ''}
  </ConsignmentItem>
</TirEpdDeclaration>`.trim();
}

/**
 * Builds structured PortNet payload from a TripOrder database record
 */
export function buildPortNetPayloadFromTripOrder(trip: any): {
  isValid: boolean;
  payload: PortNetPayloadData;
  missingFields: string[];
} {
  const tripId = trip.id || 1;
  const missingFields: string[] = [];

  const truckPlate = trip.truck?.plate_number;
  if (!truckPlate) missingFields.push('رقم لوحة الشاحنة (Tracteur)');

  const trailerPlate = trip.trailer?.plate_number;
  if (!trailerPlate) missingFields.push('رقم لوحة المقطورة (Remorque)');

  const driverName = trip.driver?.name;
  if (!driverName) missingFields.push('اسم السائق');

  const driverPassport = trip.driver?.passport_number || trip.driver?.cin;
  if (!driverPassport) missingFields.push('جواز سفر / بطاقة تعريف السائق');

  const localizador = trip.ferry_localizador || `LOC-${tripId}-TM`;
  if (!trip.ferry_localizador) {
    missingFields.push('رقم حجز العبّارة (Booking Localizador)');
  }

  const rawWeight =
    trip.weight_export !== undefined && trip.weight_export !== null
      ? trip.weight_export
      : trip.weight_import !== undefined && trip.weight_import !== null
      ? trip.weight_import
      : 0;
  const grossWeightDec = new Decimal(rawWeight || 0);
  const grossWeightKg = Math.round(grossWeightDec.toNumber());
  if (grossWeightKg <= 0) {
    missingFields.push('الوزن الإجمالي للبضاعة');
  }

  const clientIce = trip.client?.ice || '001928374650001';
  const iceCheck = validateMoroccanIce(clientIce);
  if (!iceCheck.isValid) {
    missingFields.push('رقم التعريف الموحد للمقاولة (ICE 15 رقماً)');
  }

  const cmrNumber = trip.cmr_export_number || trip.cmr_number || `CMR-BK-2026-${String(tripId).padStart(4, '0')}`;
  const mrnNumber = `MRN-MA-${tripId}-${new Date().getFullYear()}`;
  const sealNumber = `SEAL-MA-${String(tripId).padStart(6, '0')}`;
  const goodsDescription = trip.goods_description_export || trip.goods_description_import || 'Marchandises Générales TIR';

  const payload: PortNetPayloadData = {
    declarationType: 'PRE_GATE_PASS',
    version: '2.0',
    referenceNumber: `PN-DEC-${tripId}-${Date.now().toString().slice(-6)}`,
    timestamp: new Date().toISOString(),
    booking: {
      localizador,
      shippingLine: trip.ferry_company || 'Balearia / FRS Iberia',
      portOfLoading: 'MA-TNG (Tanger Med)',
      portOfDischarge: 'ES-ALG (Algeciras)',
    },
    transport: {
      carrierName: 'TRANS BODANON SARL',
      carrierTirHolder: 'MA/042/2026',
      carrierIce: '001928374650001',
      truckPlate: truckPlate || '10101-A-40',
      trailerPlate: trailerPlate || 'REM-1001-MA',
      driverName: driverName || 'Conducteur Non Assigné',
      driverPassport: trip.driver?.passport_number || 'P0000000',
      driverCin: trip.driver?.cin || 'C000000',
      driverPhone: trip.driver?.phone,
    },
    consignment: {
      cmrNumber,
      mrnNumber,
      grossWeightKg,
      sealNumber,
      goodsDescription,
      clientIce: iceCheck.cleanedIce || clientIce,
      shipperName: trip.client?.name || 'Chargeur Maroc SARL',
      consigneeName: trip.client_import?.name || 'Destinataire International',
      consigneeAddress: trip.client_import?.address,
      consigneeVat: trip.client_import?.tax_id || trip.client_import?.ice,
    },
  };

  return {
    isValid: missingFields.length === 0,
    payload,
    missingFields,
  };
}

/**
 * Builds structured TIR-EPD payload from a TripOrder database record
 */
export function buildTirEpdPayloadFromTripOrder(trip: any): {
  isValid: boolean;
  payload: TirEpdPayloadData;
  missingFields: string[];
} {
  const tripId = trip.id || 1;
  const missingFields: string[] = [];

  const isEuro = trip.corridor_type !== 'african_overland';

  const departureOffice: TirEpdCustomsOffice = isEuro
    ? STANDARD_CUSTOMS_OFFICES.tanger_med
    : STANDARD_CUSTOMS_OFFICES.guerguerat;

  const destinationOffice: TirEpdCustomsOffice = isEuro
    ? STANDARD_CUSTOMS_OFFICES.algeciras
    : STANDARD_CUSTOMS_OFFICES.dakar;

  const truckPlate = trip.truck?.plate_number;
  if (!truckPlate) missingFields.push('رقم لوحة رأس الشاحنة');

  const trailerPlate = trip.trailer?.plate_number;
  if (!trailerPlate) missingFields.push('رقم لوحة المقطورة');

  const driverPassport = trip.driver?.passport_number;
  if (!driverPassport) missingFields.push('رقم جواز السفر الدولي للسائق');

  const rawWeight =
    trip.weight_export !== undefined && trip.weight_export !== null
      ? trip.weight_export
      : trip.weight_import !== undefined && trip.weight_import !== null
      ? trip.weight_import
      : 0;
  const grossWeightDec = new Decimal(rawWeight || 0);
  const grossWeightKg = Math.round(grossWeightDec.toNumber());
  if (grossWeightKg <= 0) {
    missingFields.push('الوزن الإجمالي للبضاعة');
  }

  const carnetTirNumber =
    trip.cmr_export_number || trip.cmr_number || `TIR-MA-2026-${String(tripId).padStart(5, '0')}`;
  const voucherNumber = `VC-${tripId}-01`;
  const sealNumber = `SEAL-MA-${String(tripId).padStart(6, '0')}`;
  const goodsDescription = trip.goods_description_export || trip.goods_description_import || 'Poissons Congelés Frigo TIR';

  const payload: TirEpdPayloadData = {
    carnetTirNumber,
    voucherNumber,
    tirHolderCode: process.env.TIR_HOLDER_CODE || 'MA/042/2026',
    operationType: 'EXIT',
    departureOffice,
    destinationOffice,
    carrier: {
      name: 'TRANS BODANON SARL',
      ice: '001928374650001',
      address: 'Zone Franche Logistique, Tanger Med, Maroc',
    },
    transportMeans: {
      truckPlate: truckPlate || '10101-A-40',
      truckNationality: 'MA',
      trailerPlate: trailerPlate || 'REM-1001-MA',
      trailerNationality: 'MA',
      driverName: trip.driver?.name || 'Abdelkarim El Khamlichi',
      driverPassport: driverPassport || 'PA901245',
      driverNationality: 'MA',
    },
    cargo: {
      description: goodsDescription,
      grossWeightKg,
      sealNumber,
      packagesCount: 1200,
      hsCode: '870423',
      containerNumber: trailerPlate,
    },
    metadata: {
      tripId,
      referenceNumber: `TIR-EPD-${tripId}-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
    },
  };

  return {
    isValid: missingFields.length === 0,
    payload,
    missingFields,
  };
}
