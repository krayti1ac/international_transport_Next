import crypto from 'crypto';

export interface PortNetPayloadData {
  declarationType: 'PRE_GATE_PASS' | 'BADR_CUSTOMS_TIR';
  version: string;
  referenceNumber: string;
  timestamp: string;
  booking: {
    localizador: string;
    shippingLine: string;
    portOfLoading: string;
    portOfDischarge: string;
  };
  transport: {
    carrierName: string;
    carrierTirHolder: string;
    carrierIce: string;
    truckPlate: string;
    trailerPlate: string;
    driverName: string;
    driverPassport: string;
    driverCin: string;
  };
  consignment: {
    cmrNumber: string;
    mrnNumber: string;
    grossWeightKg: number;
    sealNumber: string;
    goodsDescription: string;
    clientIce: string;
    shipperName: string;
    consigneeName: string;
  };
}

/**
 * Generate HMAC-SHA256 digital signature for customs payloads
 */
export function generateCustomsHmacSignature(payload: string, secretKey?: string): string {
  const secret = secretKey || process.env.CUSTOMS_GATEWAY_SECRET || 'transbodanon_portnet_badr_secret_key';
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Convert structured customs payload data into standard PortNet XML
 */
export function buildPortNetXml(data: PortNetPayloadData): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<PortNetDeclaration version="${data.version}" type="${data.declarationType}">
  <Header>
    <ReferenceNumber>${data.referenceNumber}</ReferenceNumber>
    <Timestamp>${data.timestamp}</Timestamp>
    <Corridor>TangerMed-Algeciras</Corridor>
  </Header>
  <Booking>
    <Localizador>${data.booking.localizador}</Localizador>
    <ShippingLine>${data.booking.shippingLine}</ShippingLine>
    <PortOfLoading>${data.booking.portOfLoading}</PortOfLoading>
    <PortOfDischarge>${data.booking.portOfDischarge}</PortOfDischarge>
  </Booking>
  <TransportEquipment>
    <CarrierName>${data.transport.carrierName}</CarrierName>
    <TirHolderCode>${data.transport.carrierTirHolder}</TirHolderCode>
    <CarrierICE>${data.transport.carrierIce}</CarrierICE>
    <TruckPlate>${data.transport.truckPlate}</TruckPlate>
    <TrailerPlate>${data.transport.trailerPlate}</TrailerPlate>
    <Driver>
      <Name>${data.transport.driverName}</Name>
      <Passport>${data.transport.driverPassport}</Passport>
      <NationalID>${data.transport.driverCin}</NationalID>
    </Driver>
  </TransportEquipment>
  <Consignment>
    <CMRNumber>${data.consignment.cmrNumber}</CMRNumber>
    <MRNNumber>${data.consignment.mrnNumber}</MRNNumber>
    <GrossWeightUnit="KG">${data.consignment.grossWeightKg}</GrossWeightUnit>
    <SealNumber>${data.consignment.sealNumber}</SealNumber>
    <GoodsDescription>${data.consignment.goodsDescription}</GoodsDescription>
    <Shipper>
      <Name>${data.consignment.shipperName}</Name>
      <ICE>${data.consignment.clientIce}</ICE>
    </Shipper>
    <Consignee>
      <Name>${data.consignment.consigneeName}</Name>
    </Consignee>
  </Consignment>
</PortNetDeclaration>`.trim();
}

