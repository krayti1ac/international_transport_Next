import type { PortNetGatePass, TirEpdDeclaration } from '../types';

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
