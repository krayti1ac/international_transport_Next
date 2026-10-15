/**
 * Trans Bodanon TMS — LCN Electronic Teletransmission (SIMT / ISO 20022 XML) & WhatsApp Alerts Engine
 * Standards:
 *  - Bank Al-Maghrib SIMT (Système Interbancaire Marocain de Télécompensation) 160-char fixed-width LCN records
 *  - ISO 20022 pain.008.001.02 Direct Debit / LCN Remittance XML for Moroccan Corporate Banking Portals
 *  - Trilingual (AR/FR/ES) Proactive WhatsApp Maturity Reminders & Bounce/Unpaid Alerts
 * Strict Financial Rule: 100% Decimal.js arithmetic for all nominal, centime, agios, and claim calculations.
 */

import Decimal from 'decimal.js';
import crypto from 'crypto';
import type { RemittanceBordereau } from '../types/remittance-bordereau.types';
import type { CommercialBill } from '../types/commercial-bills.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export type EdiExportFormat = 'simt' | 'xml';
export type BillWhatsAppAlertType = 'maturity_reminder' | 'bounced_alert';

export interface SimtEdiResult {
  content: string;
  filename: string;
  recordCount: number;
  totalCentimes: string;
  securityHash: string;
}

export interface Iso20022XmlResult {
  content: string;
  filename: string;
  controlSum: string;
  securityHash: string;
}

export interface BillWhatsAppAlertPayload {
  message: string;
  alertType: BillWhatsAppAlertType;
  totalClaimableAmount: number;
}

/**
 * Normalizes text to clean ASCII upper-case fixed length (padded or truncated)
 * for Bank Al-Maghrib SIMT 160-character teletransmission records.
 */
function formatSimtAlpha(value: string | null | undefined, length: number): string {
  const clean = (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .toUpperCase()
    .trim();
  return clean.substring(0, length).padEnd(length, ' ');
}

/**
 * Formats digits-only fixed-length field (zero-padded on the left).
 */
function formatSimtNumeric(value: string | number | null | undefined, length: number): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.substring(0, length).padStart(length, '0');
}

/**
 * Formats YYYY-MM-DD date string into YYYYMMDD (8 chars).
 */
function formatSimtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '00000000';
  const clean = dateStr.split('T')[0].replace(/\D/g, '');
  return clean.length === 8 ? clean : clean.substring(0, 8).padEnd(8, '0');
}

/**
 * Converts a MAD amount to zero-padded integer centimes using strict Decimal.js math.
 */
export function amountToSimtCentimes(amount: number | string, length = 15): string {
  const centimes = new Decimal(amount || 0)
    .times(100)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toFixed(0);
  return centimes.replace(/\D/g, '').substring(0, length).padStart(length, '0');
}

/**
 * Generates an official Bank Al-Maghrib / SIMT 160-character fixed-width LCN teletransmission file.
 * Every record ('03' Header, '06' Detail, '08' Footer) is guaranteed to be exactly 160 characters long.
 */
export function generateSimtLcnEdiFile(bordereau: RemittanceBordereau): SimtEdiResult {
  const opCode = bordereau.bordereauType === 'escompte' ? '061' : '060';
  const remDate = formatSimtDate(bordereau.remittanceDate);
  const cleanBankRib = (bordereau.bankRib || '').replace(/\D/g, '');
  const bankCode = formatSimtNumeric(cleanBankRib.substring(0, 3) || '007', 3);
  const remitterRib = formatSimtNumeric(cleanBankRib, 24);
  const companyName = formatSimtAlpha(bordereau.companyInfo?.name || 'TRANS BODANON SARL AU', 35);
  const companyIce = formatSimtNumeric(bordereau.companyInfo?.ice || '003291823000045', 15);
  const bordereauRef = formatSimtAlpha(bordereau.bordereauNumber, 20);

  // 1. Header Record ('03') -> 2 + 3 + 8 + 3 + 24 + 35 + 15 + 20 = 110 + 50 spaces = 160 chars
  const headerPrefix =
    '03' +
    opCode +
    remDate +
    bankCode +
    remitterRib +
    companyName +
    companyIce +
    bordereauRef;
  const headerLine = headerPrefix.substring(0, 160).padEnd(160, ' ');

  // 2. Detail Records ('06') -> 160 chars each
  const detailLines: string[] = [];
  let accumulatedCentimes = new Decimal(0);

  bordereau.bills.forEach((bill, index) => {
    const seq = formatSimtNumeric(index + 1, 6);
    const typeCode =
      bill.billType === 'cheque' ? 'CHQ' : bill.billType === 'traite' ? 'TRT' : 'LCN';
    const billNum = formatSimtAlpha(bill.billNumber, 12);
    const drawerRib = formatSimtNumeric(bill.drawerBankRib || '', 24);
    const clientName = formatSimtAlpha(bill.clientName, 35);
    const issueDate = formatSimtDate(bill.issueDate);
    const dueDate = formatSimtDate(bill.dueDate);

    const billCentimesDec = new Decimal(bill.faceValue || 0)
      .times(100)
      .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    accumulatedCentimes = accumulatedCentimes.plus(billCentimesDec);

    const centimesField = billCentimesDec.toFixed(0).padStart(15, '0');
    const currency = 'MAD';

    // 2 + 6 + 3 + 12 + 24 + 35 + 8 + 8 + 15 + 3 = 116 + 44 spaces = 160 chars
    const detailPrefix =
      '06' +
      seq +
      typeCode +
      billNum +
      drawerRib +
      clientName +
      issueDate +
      dueDate +
      centimesField +
      currency;
    detailLines.push(detailPrefix.substring(0, 160).padEnd(160, ' '));
  });

  // 3. Footer Record ('08') -> 160 chars
  const totalCountField = formatSimtNumeric(bordereau.bills.length, 6);
  const totalCentimesStr = accumulatedCentimes.toFixed(0).padStart(15, '0');
  const totalAgiosCentimes = amountToSimtCentimes(bordereau.estimatedAgios || 0, 15);
  const totalNetCentimes = amountToSimtCentimes(
    bordereau.estimatedNetProceeds || bordereau.totalFaceValue || 0,
    15
  );

  // Compute deterministic SIMT HMAC-SHA256 signature
  const secret = process.env.BORDEREAU_HMAC_SECRET || 'trans-bodanon-lcn-remittance-secret-key-2026';
  const hmacPayload = `${bordereau.bordereauNumber}|${bordereau.bills.length}|${totalCentimesStr}|${remitterRib}`;
  const simtHash = crypto
    .createHmac('sha256', secret)
    .update(hmacPayload)
    .digest('hex')
    .toUpperCase();

  // 2 + 6 + 15 + 15 + 15 + 64 = 117 + 43 spaces = 160 chars
  const footerPrefix =
    '08' +
    totalCountField +
    totalCentimesStr +
    totalAgiosCentimes +
    totalNetCentimes +
    simtHash.substring(0, 64);
  const footerLine = footerPrefix.substring(0, 160).padEnd(160, ' ');

  const allLines = [headerLine, ...detailLines, footerLine];
  const content = allLines.join('\r\n');
  const safeRef = bordereau.bordereauNumber.replace(/[^A-Za-z0-9_-]/g, '_');

  return {
    content,
    filename: `SIMT_LCN_${safeRef}.simt`,
    recordCount: allLines.length,
    totalCentimes: totalCentimesStr,
    securityHash: simtHash,
  };
}

/**
 * Escapes XML special characters safely.
 */
function escapeXml(str: string | null | undefined): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates an ISO 20022 (pain.008.001.02) LCN Remittance XML file for Moroccan E-Banking portals.
 * Uses Decimal.js for all control sums, individual nominal amounts, and agios calculations.
 */
export function generateIso20022LcnXml(bordereau: RemittanceBordereau): Iso20022XmlResult {
  const totalNominalDec = bordereau.bills.reduce(
    (sum, b) => sum.plus(new Decimal(b.faceValue || 0)),
    new Decimal(0)
  );
  const controlSum = totalNominalDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  const agiosFormatted = new Decimal(bordereau.estimatedAgios || 0)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toFixed(2);
  const netFormatted = new Decimal(bordereau.estimatedNetProceeds || totalNominalDec)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toFixed(2);

  const creationTimestamp = new Date(bordereau.createdAt || new Date().toISOString()).toISOString();
  const creditorName = escapeXml(bordereau.companyInfo?.name || 'TRANS BODANON SARL AU');
  const creditorIce = escapeXml(bordereau.companyInfo?.ice || '003291823000045');
  const creditorRib = escapeXml((bordereau.bankRib || '').replace(/\s+/g, ''));

  const txItemsXml = bordereau.bills
    .map((bill, idx) => {
      const amountStr = new Decimal(bill.faceValue || 0)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toFixed(2);
      const billAgiosStr = new Decimal(bill.estimatedAgios || 0)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toFixed(2);
      const debtorName = escapeXml(bill.clientName);
      const debtorRib = escapeXml((bill.drawerBankRib || '').replace(/\s+/g, '') || '000000000000000000000000');
      const debtorBank = escapeXml(bill.drawerBankName || 'BANQUE MAROCAINE');
      const instrId = `${escapeXml(bordereau.bordereauNumber)}-${String(idx + 1).padStart(3, '0')}`;

      return `      <DrctDbtTxInf>
        <PmtId>
          <InstrId>${instrId}</InstrId>
          <EndToEndId>${escapeXml(bill.billNumber)}</EndToEndId>
        </PmtId>
        <InstdAmt Ccy="MAD">${amountStr}</InstdAmt>
        <DrctDbtTx>
          <MndtRltdInf>
            <MndtId>${escapeXml(bill.billType.toUpperCase())}-${escapeXml(bill.billNumber)}</MndtId>
            <DtOfSgntr>${escapeXml(bill.issueDate)}</DtOfSgntr>
          </MndtRltdInf>
        </DrctDbtTx>
        <DbtrAgt>
          <FinInstnId>
            <Nm>${debtorBank}</Nm>
          </FinInstnId>
        </DbtrAgt>
        <Dbtr>
          <Nm>${debtorName}</Nm>
        </Dbtr>
        <DbtrAcct>
          <Id>
            <Othr>
              <Id>${debtorRib}</Id>
              <SchmeNm>
                <Prtry>RIB_MA</Prtry>
              </SchmeNm>
            </Othr>
          </Id>
        </DbtrAcct>
        <RmtInf>
          <Ustrd>Echeance: ${escapeXml(bill.dueDate)} | Agios Est.: ${billAgiosStr} MAD</Ustrd>
        </RmtInf>
      </DrctDbtTxInf>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${escapeXml(bordereau.bordereauNumber)}</MsgId>
      <CreDtTm>${creationTimestamp}</CreDtTm>
      <NbOfTxs>${bordereau.bills.length}</NbOfTxs>
      <CtrlSum>${controlSum}</CtrlSum>
      <InitgPty>
        <Nm>${creditorName}</Nm>
        <Id>
          <OrgId>
            <Othr>
              <Id>${creditorIce}</Id>
              <SchmeNm>
                <Prtry>ICE_MA</Prtry>
              </SchmeNm>
            </Othr>
          </OrgId>
        </Id>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${escapeXml(bordereau.bordereauNumber)}-PMT</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <BtchBookg>true</BtchBookg>
      <NbOfTxs>${bordereau.bills.length}</NbOfTxs>
      <CtrlSum>${controlSum}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Prtry>SIMT_LCN_${bordereau.bordereauType.toUpperCase()}</Prtry>
        </SvcLvl>
      </PmtTpInf>
      <ReqdColltnDt>${escapeXml(bordereau.remittanceDate)}</ReqdColltnDt>
      <Cdtr>
        <Nm>${creditorName}</Nm>
      </Cdtr>
      <CdtrAcct>
        <Id>
          <Othr>
            <Id>${creditorRib}</Id>
            <SchmeNm>
              <Prtry>RIB_MA</Prtry>
            </SchmeNm>
          </Othr>
        </Id>
        <Ccy>MAD</Ccy>
      </CdtrAcct>
      <CdtrAgt>
        <FinInstnId>
          <Nm>${escapeXml(bordereau.bankName)}</Nm>
        </FinInstnId>
      </CdtrAgt>
${txItemsXml}
    </PmtInf>
    <SplmtryData>
      <Envlp>
        <BordereauType>${escapeXml(bordereau.bordereauType)}</BordereauType>
        <EstimatedAgiosHT>${agiosFormatted}</EstimatedAgiosHT>
        <EstimatedNetProceeds>${netFormatted}</EstimatedNetProceeds>
        <SecurityHashHmacSha256>${escapeXml(bordereau.securityHash)}</SecurityHashHmacSha256>
      </Envlp>
    </SplmtryData>
  </CstmrDrctDbtInitn>
</Document>`;

  const safeRef = bordereau.bordereauNumber.replace(/[^A-Za-z0-9_-]/g, '_');

  return {
    content: xml,
    filename: `ISO20022_LCN_${safeRef}.xml`,
    controlSum,
    securityHash: bordereau.securityHash,
  };
}

/**
 * Builds a trilingual (AR / FR / ES) WhatsApp notification message for:
 *  - 'maturity_reminder': Proactive alert before/on commercial bill due date
 *  - 'bounced_alert': Instant alert when a check/LCN is returned unpaid (Impayé)
 * All monetary amounts are computed strictly with Decimal.js.
 */
export function buildCommercialBillWhatsAppAlert(
  bill: CommercialBill,
  alertType: BillWhatsAppAlertType,
  locale: 'ar' | 'fr' | 'es' = 'ar'
): BillWhatsAppAlertPayload {
  const faceValueDec = new Decimal(bill.faceValue || 0);
  const bounceFeeDec = new Decimal(bill.bounceFee || 0);
  const totalClaimableDec =
    alertType === 'bounced_alert' ? faceValueDec.plus(bounceFeeDec) : faceValueDec;

  const nominalFormatted = faceValueDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  const feeFormatted = bounceFeeDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  const totalFormatted = totalClaimableDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  const currency = bill.currency || 'MAD';

  const typeLabelAr =
    bill.billType === 'cheque' ? 'شيك بنكي' : bill.billType === 'traite' ? 'سند لأمر (Traite)' : 'كمبيالة (LCN)';
  const typeLabelFr =
    bill.billType === 'cheque' ? 'Chèque Bancaire' : bill.billType === 'traite' ? 'Traite' : 'Effet LCN';
  const typeLabelEs =
    bill.billType === 'cheque' ? 'Cheque Bancario' : bill.billType === 'traite' ? 'Letra de Cambio' : 'Pagaré LCN';

  let message = '';

  if (alertType === 'maturity_reminder') {
    if (locale === 'fr') {
      message =
        `🔔 *RAPPEL D'ÉCHÉANCE — TRANS BODANON TMS*\n\n` +
        `Bonjour *${bill.clientName}*,\n` +
        `Nous vous rappelons l'échéance prochaine de votre effet commercial :\n` +
        `• *Type & N° :* ${typeLabelFr} #${bill.billNumber}\n` +
        `• *Banque domiciliataire :* ${bill.drawerBankName || '—'}\n` +
        `• *Date d'échéance :* ${bill.dueDate}\n` +
        `• *Montant Nominal :* *${nominalFormatted} ${currency}*\n\n` +
        `Merci de veiller à la provision du compte avant la présentation en compensation SIMT.`;
    } else if (locale === 'es') {
      message =
        `🔔 *RECORDATORIO DE VENCIMIENTO — TRANS BODANON TMS*\n\n` +
        `Estimado/a *${bill.clientName}*,\n` +
        `Le recordamos el próximo vencimiento de su efecto comercial:\n` +
        `• *Tipo y N.°:* ${typeLabelEs} #${bill.billNumber}\n` +
        `• *Banco domiciliatario:* ${bill.drawerBankName || '—'}\n` +
        `• *Fecha de vencimiento:* ${bill.dueDate}\n` +
        `• *Importe Nominal:* *${nominalFormatted} ${currency}*\n\n` +
        `Le rogamos asegurar la provisión de fondos antes de la compensación bancaria SIMT.`;
    } else {
      message =
        `🔔 *تذكير بموعد استحقاق ورقة تجارية — TRANS BODANON TMS*\n\n` +
        `السادة *${bill.clientName}* المحترمين،\n` +
        `نود تذكيركم بقرب حلول أجل استحقاق الورقة التجارية التالية:\n` +
        `• *النوع والرقم:* ${typeLabelAr} رقم #${bill.billNumber}\n` +
        `• *البنك المسحوب عليه:* ${bill.drawerBankName || '—'}\n` +
        `• *تاريخ الاستحقاق:* ${bill.dueDate}\n` +
        `• *القيمة الاسمية:* *${nominalFormatted} ${currency}*\n\n` +
        `يرجى التأكد من توفير المؤونة الكافية بالحساب البنكي قبل تاريخ المقاصة الإلكترونية (SIMT).`;
    }
  } else {
    // bounced_alert
    const reason = bill.bounceReason || (locale === 'fr' ? 'Défaut de provision' : locale === 'es' ? 'Falta de fondos' : 'عدم كفاية المؤونة');
    if (locale === 'fr') {
      message =
        `🚨 *ALERTE IMPAYÉ / REJET BANCAIRE — TRANS BODANON TMS*\n\n` +
        `Attention *${bill.clientName}*,\n` +
        `L'effet commercial suivant a été rejeté par la compensation bancaire :\n` +
        `• *Référence :* ${typeLabelFr} #${bill.billNumber}\n` +
        `• *Motif du rejet :* ${reason}\n` +
        `• *Montant Nominal :* ${nominalFormatted} ${currency}\n` +
        `• *Frais de rejet bancaire :* ${feeFormatted} ${currency}\n` +
        `• *Total Exigible Immédiatement :* *${totalFormatted} ${currency}*\n\n` +
        `Merci de régulariser cette situation en urgence par virement bancaire.`;
    } else if (locale === 'es') {
      message =
        `🚨 *ALERTA DE IMPAGO / DEVOLUCIÓN BANCARIA — TRANS BODANON TMS*\n\n` +
        `Atención *${bill.clientName}*,\n` +
        `El siguiente efecto comercial ha sido devuelto impagado por el banco:\n` +
        `• *Referencia:* ${typeLabelEs} #${bill.billNumber}\n` +
        `• *Motivo de devolución:* ${reason}\n` +
        `• *Importe Nominal:* ${nominalFormatted} ${currency}\n` +
        `• *Comisión por devolución:* ${feeFormatted} ${currency}\n` +
        `• *Total Exigible:* *${totalFormatted} ${currency}*\n\n` +
        `Por favor, regularice este saldo de forma urgente mediante transferencia bancaria.`;
    } else {
      message =
        `🚨 *إشعار عاجل: رجوع ورقة تجارية بدون أداء (Impayé) — TRANS BODANON TMS*\n\n` +
        `السادة *${bill.clientName}*،\n` +
        `نحيطكم علماً بأنه قد تم رفض وإرجاع الورقة التجارية التالية من طرف البنك:\n` +
        `• *المرجع:* ${typeLabelAr} رقم #${bill.billNumber}\n` +
        `• *سبب الرفض البنكي:* ${reason}\n` +
        `• *أصل المبلغ الاسمي:* ${nominalFormatted} ${currency}\n` +
        `• *عمولة ومصاريف الإرجاع:* ${feeFormatted} ${currency}\n` +
        `• *إجمالي المبلغ المستحق فوراً:* *${totalFormatted} ${currency}*\n\n` +
        `يرجى تسوية الوضعية بشكل عاجل عبر تحويل بنكي لتفادي الإجراءات القانونية.`;
    }
  }

  return {
    message,
    alertType,
    totalClaimableAmount: totalClaimableDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
  };
}

