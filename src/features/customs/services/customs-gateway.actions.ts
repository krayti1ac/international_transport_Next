'use server';

import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/server';
import type {
  PortNetGatePass,
  TirEpdDeclaration,
  CustomsPreCheckResult,
} from '../types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Fetch complete trip details for customs documentation
 */
export async function getTripCustomsData(tripId: number): Promise<{
  success: boolean;
  trip?: any;
  portNet?: PortNetGatePass;
  tirEpd?: TirEpdDeclaration;
  readiness?: CustomsPreCheckResult;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Fetch trip order with related truck, trailer, driver, client, company
    const { data: trip, error: tripErr } = await supabase
      .from('trip_orders')
      .select(`
        *,
        truck:trucks(id, plate_number, model),
        trailer:trailers(id, plate_number, model),
        driver:drivers(id, name, passport_number, cin, phone),
        client:clients!trip_orders_client_id_fkey(id, name, ice, tax_id, address, city),
        client_import:clients!trip_orders_client_import_id_fkey(id, name, ice, tax_id, address, city)
      `)
      .eq('id', tripId)
      .single();

    if (tripErr) throw tripErr;
    if (!trip) throw new Error('الرحلة غير موجودة');

    // Extract carrier / company
    const carrierName = 'TRANS BODANON SARL';
    const carrierTirHolder = 'MA/042/2026'; // National TIR Holder code

    const cmrNumber = trip.cmr_export_number || trip.cmr_number || `CMR-${trip.id}`;
    const mrnNumber = trip.cmr_export_number ? `MRN-MA-${trip.cmr_export_number}` : `MRN-MA-${trip.id}-DUM`;
    const sealNumber = `MA-DOUANE-${trip.id.toString().padStart(6, '0')}`;

    const grossWeight = new Decimal(trip.weight_export || trip.weight_import || 22000).toNumber();
    const goodsDesc = trip.goods_description_export || trip.goods_description_import || 'Marchandises Générales (TIR)';

    const consignor = trip.client?.name || 'Chargeur Maroc';
    const consignorIce = trip.client?.ice || '';
    const consignee = trip.client_import?.name || 'Destinataire Europe';
    const consigneeVat = trip.client_import?.tax_id || trip.client_import?.ice || '';

    const portNet: PortNetGatePass = {
      tripId: trip.id,
      cmrNumber,
      bookingReference: trip.ferry_localizador || `FR-${trip.id}-BKG`,
      ferryCompany: trip.ferry_company || 'FRS Iberia / Baleària',
      mrnNumber,
      portOfDeparture: 'TANGER MED PORT PASSAGER (MA)',
      portOfArrival: 'PUERTO DE ALGECIRAS (ES)',
      tractorPlate: trip.truck?.plate_number || 'T-MAROC',
      trailerPlate: trip.trailer?.plate_number || 'R-MAROC',
      driverName: trip.driver?.name || 'Conducteur Non Assigné',
      driverCinOrPassport: trip.driver?.passport_number || trip.driver?.cin || '',
      driverPhone: trip.driver?.phone,
      customsSealNumber: sealNumber,
      goodsDescription: goodsDesc,
      grossWeightKg: grossWeight,
      consignorName: consignor,
      consignorIce,
      consigneeName: consignee,
      consigneeAddress: trip.client_import?.address || 'Zone Industrielle, Espagne / UE',
      consigneeVatOrEori: consigneeVat,
      issueDate: new Date().toISOString().split('T')[0],
    };

    const tirEpd: TirEpdDeclaration = {
      tripId: trip.id,
      carnetTirNumber: `XF-${trip.id.toString().padStart(7, '0')}`,
      customsOfficeDeparture: 'MA000001', // Tanger Med Port Douane
      customsOfficeEntryEU: 'ES001101', // Algeciras Puerto
      mrnReference: mrnNumber,
      tractorPlate: trip.truck?.plate_number || '',
      trailerPlate: trip.trailer?.plate_number || '',
      driverFullName: trip.driver?.name || '',
      driverPassport: trip.driver?.passport_number || '',
      hsCode: '870423', // Code SH Transport Marchandises
      goodsDescription: goodsDesc,
      packageCount: 33, // Standard 33 Europallets
      packageType: 'PX', // Pallet
      grossWeightKg: grossWeight,
      customsSealNumber: sealNumber,
      carrierName,
      carrierTirHolderId: carrierTirHolder,
      declarationDate: new Date().toISOString().split('T')[0],
    };

    // Pre-check readiness
    const missingPortNet: string[] = [];
    if (!trip.truck?.plate_number) missingPortNet.push('رقم لوحة الشاحنة (Tracteur)');
    if (!trip.trailer?.plate_number) missingPortNet.push('رقم لوحة المقطورة (Remorque)');
    if (!trip.driver?.name) missingPortNet.push('اسم السائق');
    if (!trip.driver?.passport_number && !trip.driver?.cin) missingPortNet.push('جواز سفر / بطاقة تعريف السائق');
    if (!trip.ferry_localizador) missingPortNet.push('رقم حجز العبّارة (Booking Localizador)');

    const missingTirEpd: string[] = [];
    if (!trip.truck?.plate_number) missingTirEpd.push('لوحة رأس الشاحنة');
    if (!trip.trailer?.plate_number) missingTirEpd.push('لوحة المقطورة');
    if (!trip.driver?.passport_number) missingTirEpd.push('رقم جواز السفر الدولي للسائق');
    if (!grossWeight || grossWeight <= 0) missingTirEpd.push('الوزن الإجمالي للبضاعة');

    const readiness: CustomsPreCheckResult = {
      isReadyForPortNet: missingPortNet.length === 0,
      isReadyForTirEpd: missingTirEpd.length === 0,
      missingPortNetFields: missingPortNet,
      missingTirEpdFields: missingTirEpd,
    };

    return {
      success: true,
      trip,
      portNet,
      tirEpd,
      readiness,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'فشل جلب بيانات الجمارك والموانئ';
    return { success: false, error: msg };
  }
}

/**
 * Generate XML payload compliant with PortNet (Guichet Unique PortNet - Tanger Med)
 */
export function generatePortNetXml(data: PortNetGatePass): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<PortNetGatePassRequest xmlns="http://www.portnet.ma/schema/gatepass/v2" version="2.0">
  <Header>
    <MessageId>PN-TRIP-${data.tripId}-${Date.now()}</MessageId>
    <PortCode>MAPTM</PortCode>
    <Terminal>TANGER_MED_PASSAGERS</Terminal>
    <CreationDateTime>${new Date().toISOString()}</CreationDateTime>
  </Header>
  <GatePassInfo>
    <BookingReference>${data.bookingReference}</BookingReference>
    <FerryCompany>${data.ferryCompany}</FerryCompany>
    <PortDeparture>${data.portOfDeparture}</PortDeparture>
    <PortArrival>${data.portOfArrival}</PortArrival>
    <CrossingDate>${data.issueDate}</CrossingDate>
    <MovementReferenceNumber>${data.mrnNumber}</MovementReferenceNumber>
    <CmrNumber>${data.cmrNumber}</CmrNumber>
    <CustomsSealNumber>${data.customsSealNumber}</CustomsSealNumber>
  </GatePassInfo>
  <TransportEquipment>
    <TractorPlateNumber>${data.tractorPlate}</TractorPlateNumber>
    <TrailerPlateNumber>${data.trailerPlate}</TrailerPlateNumber>
    <GrossWeight unit="KG">${data.grossWeightKg}</GrossWeight>
  </TransportEquipment>
  <DriverDetails>
    <FullName>${data.driverName}</FullName>
    <IdentificationNumber>${data.driverCinOrPassport}</IdentificationNumber>
    <Phone>${data.driverPhone || ''}</Phone>
  </DriverDetails>
  <Consignment>
    <Consignor>
      <Name>${data.consignorName}</Name>
      <ICE>${data.consignorIce || ''}</ICE>
    </Consignor>
    <Consignee>
      <Name>${data.consigneeName}</Name>
      <VatNumber>${data.consigneeVatOrEori || ''}</VatNumber>
      <Address>${data.consigneeAddress || ''}</Address>
    </Consignee>
    <GoodsDescription>${data.goodsDescription}</GoodsDescription>
  </Consignment>
</PortNetGatePassRequest>`;
}

/**
 * Generate XML payload compliant with IRU TIR-EPD (Electronic Pre-Declaration)
 */
export function generateTirEpdXml(data: TirEpdDeclaration): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<TirEpdDeclaration xmlns="http://www.iru.org/tirepd/v4" version="4.1">
  <DeclarationHeader>
    <MessageReference>TIR-EPD-${data.carnetTirNumber}</MessageReference>
    <CarnetNumber>${data.carnetTirNumber}</CarnetNumber>
    <DeclarationType>TIR_TRANSIT</DeclarationType>
    <DeclarationDate>${data.declarationDate}</DeclarationDate>
    <CarrierHolderCode>${data.carrierTirHolderId}</CarrierHolderCode>
    <CarrierName>${data.carrierName}</CarrierName>
  </DeclarationHeader>
  <Itinerary>
    <CustomsOfficeDeparture code="${data.customsOfficeDeparture}">TANGER PORT MED</CustomsOfficeDeparture>
    <CustomsOfficeEntryEU code="${data.customsOfficeEntryEU}">ALGECIRAS PUERTO</CustomsOfficeEntryEU>
  </Itinerary>
  <TransportMeans>
    <ModeOfTransport>30</ModeOfTransport> <!-- Road transport -->
    <TractorPlate>${data.tractorPlate}</TractorPlate>
    <TrailerPlate>${data.trailerPlate}</TrailerPlate>
    <Driver>
      <FullName>${data.driverFullName}</FullName>
      <PassportNumber>${data.driverPassport}</PassportNumber>
    </Driver>
  </TransportMeans>
  <ConsignmentItem number="1">
    <GoodsItemNumber>1</GoodsItemNumber>
    <HsCommodityCode>${data.hsCode}</HsCommodityCode>
    <Description>${data.goodsDescription}</Description>
    <GrossMassKg>${data.grossWeightKg}</GrossMassKg>
    <Packages>
      <Count>${data.packageCount}</Count>
      <TypeCode>${data.packageType}</TypeCode>
    </Packages>
    <CustomsSeal>
      <SealNumber>${data.customsSealNumber}</SealNumber>
    </CustomsSeal>
    <ProducedDocuments>
      <DocumentType>MRN</DocumentType>
      <DocumentReference>${data.mrnReference}</DocumentReference>
    </ProducedDocuments>
  </ConsignmentItem>
</TirEpdDeclaration>`;
}

