/**
 * Trans Bodanon TMS — Universal Business Language (UBL 2.1) & CII Generator
 * Generates ISO/IEC 19845 compliant XML invoices tailored to Moroccan DGI specifications.
 * Enforces strict Decimal.js calculation on financial totals and Article 92-I-10° CGI VAT exemption.
 */

import Decimal from 'decimal.js';
import type { Invoice, Client, TripOrder } from '@/types/database';
import type {
  EInvoiceDocument,
  EInvoiceParty,
  EInvoiceItem,
  EInvoiceTotals,
} from '../types/einvoice.types';
import { generateCryptographicTaxSeal } from './cryptographic-tax-seal.service';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export const DEFAULT_TRANS_BODANON_SUPPLIER: EInvoiceParty = {
  companyName: 'TRANS BODANON SARL',
  ice: '002345678000091',
  identifiantFiscal: '45892014',
  registreCommerce: '10452 Tanger',
  cnss: '7890123',
  taxScheme: 'EXEMPT',
  address: 'Zone Franche Logistique, Port Tanger Med',
  city: 'Tanger',
  postalCode: '90000',
  countryCode: 'MA',
  phone: '+212 539 94 00 11',
  email: 'facturation@transbodanon.com',
};

function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Builds the canonical EInvoiceDocument data structure from database models.
 */
export async function buildEInvoiceDocumentFromTripInvoice(params: {
  invoice: Invoice;
  client?: Client | null;
  trip?: TripOrder | null;
  customSupplier?: Partial<EInvoiceParty>;
}): Promise<EInvoiceDocument> {
  const { invoice, client, trip, customSupplier } = params;

  const supplier: EInvoiceParty = {
    ...DEFAULT_TRANS_BODANON_SUPPLIER,
    ...(customSupplier || {}),
  };

  const customer: EInvoiceParty = {
    companyName: client?.name || 'CLIENT DESTINATAIRE',
    ice: client?.ice || '000000000000000',
    identifiantFiscal: client?.id ? `CLI-${client.id}` : undefined,
    taxScheme: 'EXEMPT',
    address: client?.address || client?.billing_address_line1 || 'Adresse non spécifiée',
    city: client?.city || client?.billing_city || 'Tanger',
    postalCode: client?.shipping_postal_code || client?.billing_postal_code || '90000',
    countryCode: client?.billing_country === 'Spain' ? 'ES' : 'MA',
    phone: client?.phone,
    email: client?.email,
  };

  const htDec = new Decimal(invoice.ht_amount || invoice.total_amount || '0');
  const tvaDec = new Decimal(invoice.tva_amount || '0');
  const ttcDec = new Decimal(invoice.ttc_amount || invoice.total_amount || '0');
  const paidDec = new Decimal(invoice.paid_amount || '0');
  const payableDec = ttcDec.minus(paidDec);

  const currency = (invoice.currency || 'MAD').toUpperCase();

  const totals: EInvoiceTotals = {
    lineExtensionAmount: htDec.toFixed(2),
    taxExclusiveAmount: htDec.toFixed(2),
    taxInclusiveAmount: ttcDec.toFixed(2),
    taxTotalAmount: tvaDec.toFixed(2),
    paidAmount: paidDec.toFixed(2),
    payableAmount: payableDec.toFixed(2),
    currency,
  };

  const routeDescription =
    trip?.route ||
    trip?.route_export ||
    invoice.route ||
    'Transport International Routier de Marchandises';

  const cmrRef = trip?.cmr_export_number || trip?.cmr_number || `CMR-${invoice.invoice_number}`;

  const items: EInvoiceItem[] = [
    {
      lineNumber: 1,
      description: `Transport International de Marchandises (${routeDescription})`,
      descriptionFr: `Prestation de transport international routier (${routeDescription})`,
      descriptionAr: `خدمات النقل الدولي الطرقي للبضائع (${routeDescription})`,
      descriptionEs: `Servicio de transporte internacional de mercancías (${routeDescription})`,
      quantity: '1.00',
      unitCode: 'C62',
      unitPrice: htDec.toFixed(2),
      lineTotal: htDec.toFixed(2),
      taxCategoryCode: 'E', // Exempt
      taxRatePercent: '0.00',
      taxAmount: '0.00',
      exemptionReasonCode: 'CGI-92-I-10',
      exemptionReasonText:
        "Exonération de la TVA en vertu de l'Article 92-I-10° du Code Général des Impôts (CGI)",
      cmrReference: cmrRef,
      dumReference: trip?.mrn_export_url ? 'DUM-DOUANE-VALIDEE' : undefined,
    },
  ];

  const issueDate = invoice.issue_date || new Date().toISOString().split('T')[0];
  const issueTime = '12:00:00';
  const dueDate = invoice.due_date || issueDate;

  // Cryptographic Seal calculation
  const seal = await generateCryptographicTaxSeal({
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    sellerIce: supplier.ice,
    buyerIce: customer.ice,
    issueTimestamp: `${issueDate}T${issueTime}`,
    currency,
    totalHt: totals.taxExclusiveAmount,
    totalTva: totals.taxTotalAmount,
    totalTtc: totals.taxInclusiveAmount,
    isArticle92Exempt: true,
  });

  const doc: EInvoiceDocument = {
    ublVersion: '2.1',
    customizationId: 'urn:cen.eu:en16931:2017#compliant#urn:fdc:dgi.gov.ma:einvoicing:1.0',
    profileId: 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0',
    invoiceNumber: invoice.invoice_number,
    issueDate,
    issueTime,
    dueDate,
    invoiceTypeCode: '380',
    documentCurrencyCode: currency,
    orderReference: cmrRef,
    supplier,
    customer,
    paymentMeansCode: '30',
    paymentIbanRib: '011 640 0000 123456789012 34',
    paymentBankName: 'Attijariwafa Bank - Agence Tanger Med Port',
    items,
    totals,
    seal,
    xmlContent: '',
  };

  doc.xmlContent = generateUbl21Xml(doc);
  return doc;
}

/**
 * Serializes an EInvoiceDocument into formal UBL 2.1 XML string.
 */
export function generateUbl21Xml(doc: EInvoiceDocument): string {
  const currency = escapeXml(doc.documentCurrencyCode);
  const legalExemptionNotice =
    "Exonération de la TVA en vertu de l'Article 92-I-10° du Code Général des Impôts (CGI) - Transport International de Marchandises";

  const linesXml = doc.items
    .map(
      (item) => `    <cac:InvoiceLine>
      <cbc:ID>${item.lineNumber}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="${escapeXml(item.unitCode)}">${item.quantity}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${currency}">${item.lineTotal}</cbc:LineExtensionAmount>
      ${
        item.cmrReference
          ? `<cac:DocumentReference>
        <cbc:ID>${escapeXml(item.cmrReference)}</cbc:ID>
        <cbc:DocumentTypeCode>CMR</cbc:DocumentTypeCode>
      </cac:DocumentReference>`
          : ''
      }
      <cac:Item>
        <cbc:Description>${escapeXml(item.descriptionFr)}</cbc:Description>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>${escapeXml(item.taxCategoryCode)}</cbc:ID>
          <cbc:Percent>${item.taxRatePercent}</cbc:Percent>
          <cbc:TaxExemptionReasonCode>${escapeXml(item.exemptionReasonCode || 'CGI-92-I-10')}</cbc:TaxExemptionReasonCode>
          <cbc:TaxExemptionReason>${escapeXml(item.exemptionReasonText || legalExemptionNotice)}</cbc:TaxExemptionReason>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${currency}">${item.unitPrice}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>${escapeXml(doc.customizationId)}</cbc:CustomizationID>
  <cbc:ProfileID>${escapeXml(doc.profileId)}</cbc:ProfileID>
  <cbc:ID>${escapeXml(doc.invoiceNumber)}</cbc:ID>
  <cbc:IssueDate>${escapeXml(doc.issueDate)}</cbc:IssueDate>
  <cbc:IssueTime>${escapeXml(doc.issueTime)}</cbc:IssueTime>
  <cbc:DueDate>${escapeXml(doc.dueDate)}</cbc:DueDate>
  <cbc:InvoiceTypeCode>${escapeXml(doc.invoiceTypeCode)}</cbc:InvoiceTypeCode>
  <cbc:Note>${escapeXml(legalExemptionNotice)}</cbc:Note>
  <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>

  <!-- Cryptographic Integrity Digest & DGI Seal -->
  <cac:AdditionalDocumentReference>
    <cbc:ID>${escapeXml(doc.seal.sha256Digest)}</cbc:ID>
    <cbc:DocumentTypeCode>DGI-DIGITAL-SEAL</cbc:DocumentTypeCode>
    <cbc:DocumentDescription>Empreinte cryptographique d'intégrité fiscale SHA-256</cbc:DocumentDescription>
  </cac:AdditionalDocumentReference>

  ${
    doc.orderReference
      ? `<cac:OrderReference>
    <cbc:ID>${escapeXml(doc.orderReference)}</cbc:ID>
  </cac:OrderReference>`
      : ''
  }

  <!-- Supplier Party (Émetteur) -->
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${escapeXml(doc.supplier.companyName)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(doc.supplier.address)}</cbc:StreetName>
        <cbc:CityName>${escapeXml(doc.supplier.city)}</cbc:CityName>
        <cbc:PostalZone>${escapeXml(doc.supplier.postalCode || '90000')}</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>${escapeXml(doc.supplier.countryCode)}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(doc.supplier.ice)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(doc.supplier.companyName)}</cbc:RegistrationName>
        <cbc:CompanyID>RC: ${escapeXml(doc.supplier.registreCommerce || '')} | IF: ${escapeXml(
    doc.supplier.identifiantFiscal || ''
  )} | CNSS: ${escapeXml(doc.supplier.cnss || '')}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>

  <!-- Customer Party (Client Destinataire) -->
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${escapeXml(doc.customer.companyName)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(doc.customer.address)}</cbc:StreetName>
        <cbc:CityName>${escapeXml(doc.customer.city)}</cbc:CityName>
        <cbc:PostalZone>${escapeXml(doc.customer.postalCode || '90000')}</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>${escapeXml(doc.customer.countryCode)}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(doc.customer.ice)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingCustomerParty>

  <!-- Payment Means -->
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>${escapeXml(doc.paymentMeansCode)}</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount>
      <cbc:ID>${escapeXml(doc.paymentIbanRib || '')}</cbc:ID>
      <cac:FinancialInstitutionBranch>
        <cbc:Name>${escapeXml(doc.paymentBankName || '')}</cbc:Name>
      </cac:FinancialInstitutionBranch>
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>

  <!-- Tax Total (0% VAT Exemption Art. 92-I-10° CGI) -->
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${currency}">${doc.totals.taxTotalAmount}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${currency}">${doc.totals.taxExclusiveAmount}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${currency}">${doc.totals.taxTotalAmount}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>E</cbc:ID>
        <cbc:Percent>0.00</cbc:Percent>
        <cbc:TaxExemptionReasonCode>CGI-92-I-10</cbc:TaxExemptionReasonCode>
        <cbc:TaxExemptionReason>${escapeXml(legalExemptionNotice)}</cbc:TaxExemptionReason>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>

  <!-- Legal Monetary Totals -->
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${currency}">${doc.totals.lineExtensionAmount}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${currency}">${doc.totals.taxExclusiveAmount}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${currency}">${doc.totals.taxInclusiveAmount}</cbc:TaxInclusiveAmount>
    <cbc:PrepaidAmount currencyID="${currency}">${doc.totals.paidAmount}</cbc:PrepaidAmount>
    <cbc:PayableAmount currencyID="${currency}">${doc.totals.payableAmount}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

  <!-- Invoice Lines -->
${linesXml}
</Invoice>`;
}

