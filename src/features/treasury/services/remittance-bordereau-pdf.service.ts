import Decimal from 'decimal.js';
import crypto from 'crypto';
import QRCode from 'qrcode';
import type {
  BordereauType,
  BordereauBillItem,
  RemittanceBordereau,
  BordereauCompanyHeader,
} from '../types/remittance-bordereau.types';

// Enforce strict financial precision
Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface BordereauFinancialCalculation {
  totalFaceValue: number;
  billsCount: number;
  estimatedAgios: number;
  estimatedVat: number;
  estimatedNetProceeds: number;
  billItemsWithMetrics: BordereauBillItem[];
}

/**
 * Calculates aggregated totals and optional banking discount (escompte) agios using Decimal.js.
 * Moroccan Banking Year: 360-day commercial basis.
 * Bank VAT: 10% on agios and commissions.
 */
export function calculateBordereauFinancials(
  bills: BordereauBillItem[],
  type: BordereauType,
  discountRate = 0,
  bankCommission = 0,
  remittanceDateStr?: string
): BordereauFinancialCalculation {
  const remittanceDate = remittanceDateStr ? new Date(remittanceDateStr) : new Date();
  
  let totalFace = new Decimal(0);
  let totalAgiosWithoutVat = new Decimal(0);
  let totalVat = new Decimal(0);

  const rateDec = new Decimal(discountRate);
  const commPerBill = bills.length > 0
    ? new Decimal(bankCommission).dividedBy(bills.length)
    : new Decimal(0);

  const billItemsWithMetrics: BordereauBillItem[] = bills.map((bill) => {
    const faceDec = new Decimal(bill.faceValue);
    totalFace = totalFace.plus(faceDec);

    if (type === 'escompte' && discountRate > 0) {
      const dueDate = new Date(bill.dueDate);
      const diffTime = dueDate.getTime() - remittanceDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const days = Math.max(1, diffDays);

      // Formula: (FaceValue * Rate * Days) / 36,000 + Commission
      const discountInterest = faceDec.times(rateDec).times(days).dividedBy(36000);
      const preVatAgios = discountInterest.plus(commPerBill);
      const vat = preVatAgios.times(0.10); // 10% Bank VAT
      const billTotalAgios = preVatAgios.plus(vat);

      totalAgiosWithoutVat = totalAgiosWithoutVat.plus(preVatAgios);
      totalVat = totalVat.plus(vat);

      return {
        ...bill,
        daysToMaturity: days,
        estimatedAgios: Number(billTotalAgios.toFixed(2)),
      };
    }

    return {
      ...bill,
      daysToMaturity: 0,
      estimatedAgios: 0,
    };
  });

  const totalAgiosCombined = totalAgiosWithoutVat.plus(totalVat);
  const totalNetProceeds = type === 'escompte'
    ? totalFace.minus(totalAgiosCombined)
    : totalFace;

  return {
    totalFaceValue: Number(totalFace.toFixed(2)),
    billsCount: bills.length,
    estimatedAgios: Number(totalAgiosWithoutVat.toFixed(2)),
    estimatedVat: Number(totalVat.toFixed(2)),
    estimatedNetProceeds: Number(totalNetProceeds.toFixed(2)),
    billItemsWithMetrics,
  };
}

/**
 * Generates a cryptographic HMAC-SHA256 signature for the remittance bordereau.
 */
export function generateBordereauSecurityHash(
  bordereauNumber: string,
  totalFaceValue: number,
  bankRib: string,
  remittanceDate: string,
  secretKey = process.env.PDF_SIGNING_KEY || 'trans-bodanon-bordereau-secret'
): string {
  const payload = `${bordereauNumber}|${totalFaceValue.toFixed(2)}|${bankRib}|${remittanceDate}`;
  return crypto.createHmac('sha256', secretKey).update(payload).digest('hex');
}

/**
 * Generates Base64 QR code data for scanning & verification.
 */
export async function generateBordereauQrCode(
  bordereau: Pick<RemittanceBordereau, 'bordereauNumber' | 'totalFaceValue' | 'securityHash' | 'remittanceDate' | 'bankName'>
): Promise<string> {
  const payload = JSON.stringify({
    ref: bordereau.bordereauNumber,
    amt: bordereau.totalFaceValue,
    bank: bordereau.bankName,
    date: bordereau.remittanceDate,
    sig: bordereau.securityHash.substring(0, 16),
  });

  try {
    return await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 140,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
  } catch {
    return '';
  }
}

/**
 * Builds vector-grade official print-ready Moroccan Bank Remittance HTML document.
 */
export function buildBordereauHtml(bordereau: RemittanceBordereau, qrCodeBase64: string): string {
  const isEscompte = bordereau.bordereauType === 'escompte';
  const titleFr = isEscompte
    ? "BORDEREAU DE REMISE DE VALEURS À L'ESCOMPTE"
    : "BORDEREAU DE REMISE DE VALEURS À L'ENCAISSEMENT";
  const titleAr = isEscompte
    ? 'جدول تسليم القيم والأوراق التجارية للخصم المسبق'
    : 'جدول تسليم القيم والأوراق التجارية للتحصيل';

  const company: BordereauCompanyHeader = bordereau.companyInfo || {
    name: 'TRANS BODANON SARL AU',
    ice: '003291823000045',
    rc: '54821 Tanger',
    ifNum: '52849102',
    tp: '4129034',
    address: 'Zone Franche d&apos;Exportation, Tanger, Maroc',
    phone: '+212 539 94 20 10',
  };

  const rows = bordereau.bills
    .map(
      (bill, idx) => `
    <tr>
      <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
      <td style="text-align: center; text-transform: uppercase; font-size: 11px;">
        ${bill.billType === 'lcn_promissory_note' ? 'LCN' : bill.billType === 'cheque' ? 'CHÈQUE' : 'TRAITE'}
      </td>
      <td style="font-family: monospace; font-weight: bold; font-size: 11px;">${bill.billNumber}</td>
      <td>
        <div style="font-weight: 600;">${bill.clientName}</div>
        ${bill.issuerName ? `<div style="font-size: 10px; color: #64748b;">Tireur: ${bill.issuerName}</div>` : ''}
      </td>
      <td style="font-size: 11px;">${bill.drawerBankName || '—'}</td>
      <td style="font-family: monospace; font-size: 10px; letter-spacing: 0.5px;">${bill.drawerBankRib || '—'}</td>
      <td style="text-align: center; font-weight: bold; font-size: 11px;">${bill.dueDate}</td>
      <td style="text-align: right; font-weight: bold; font-family: monospace; font-size: 12px;">
        ${bill.faceValue.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD
      </td>
      ${
        isEscompte
          ? `<td style="text-align: right; font-size: 11px; color: #b91c1c; font-family: monospace;">
              -${(bill.estimatedAgios || 0).toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>`
          : ''
      }
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
  <meta charset="utf-8" />
  <title>${bordereau.bordereauNumber} — ${titleFr}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #f8fafc;
      margin: 0;
      padding: 20px;
      font-size: 12px;
      line-height: 1.4;
    }
    .page-container {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      padding: 24px 30px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .header-table {
      width: 100%;
      border-bottom: 2px solid #0284c7;
      padding-bottom: 14px;
      margin-bottom: 16px;
    }
    .company-title {
      font-size: 18px;
      font-weight: 800;
      color: #0369a1;
      letter-spacing: -0.5px;
    }
    .company-meta {
      font-size: 10.5px;
      color: #475569;
      line-height: 1.5;
    }
    .title-box {
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 16px;
      text-align: center;
    }
    .title-escompte {
      background: #eff6ff;
      border-color: #93c5fd;
    }
    .main-title {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 4px 0;
      letter-spacing: 0.3px;
    }
    .sub-title-ar {
      font-size: 13px;
      font-weight: 700;
      color: #0369a1;
      margin: 0;
      direction: rtl;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }
    .info-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px 12px;
      background: #f8fafc;
    }
    .info-card h4 {
      margin: 0 0 6px 0;
      font-size: 11px;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.5px;
    }
    .info-card p {
      margin: 2px 0;
      font-size: 11.5px;
    }
    .values-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .values-table th {
      background: #0f172a;
      color: #ffffff;
      padding: 7px 8px;
      font-size: 10.5px;
      text-align: left;
      font-weight: 600;
    }
    .values-table td {
      border-bottom: 1px solid #e2e8f0;
      padding: 7px 8px;
      vertical-align: middle;
    }
    .values-table tr:nth-child(even) {
      background: #f8fafc;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
    }
    .summary-table td {
      padding: 6px 10px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11.5px;
    }
    .summary-table tr:last-child td {
      border-bottom: none;
      background: #f1f5f9;
      font-weight: bold;
      font-size: 12.5px;
    }
    .signatures-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 10px;
      page-break-inside: avoid;
    }
    .signature-box {
      border: 1px dashed #94a3b8;
      border-radius: 6px;
      padding: 10px;
      min-height: 85px;
      background: #ffffff;
    }
    .signature-box label {
      display: block;
      font-size: 10.5px;
      font-weight: bold;
      color: #334155;
      text-transform: uppercase;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-bottom: 6px;
    }
    .verification-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      margin-top: 16px;
      font-size: 10px;
      color: #64748b;
    }
    .no-print {
      margin-top: 20px;
      text-align: center;
    }
    .print-btn {
      background: #0284c7;
      color: #ffffff;
      border: none;
      padding: 10px 24px;
      font-size: 13px;
      font-weight: bold;
      border-radius: 6px;
      cursor: pointer;
    }
    .print-btn:hover {
      background: #0369a1;
    }
    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .page-container {
        border: none;
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="page-container">
    <table class="header-table">
      <tr>
        <td style="vertical-align: top;">
          <div class="company-title">${company.name}</div>
          <div class="company-meta">
            Transport Routier International & Logistique Globale<br />
            ICE: <strong>${company.ice || '—'}</strong> | RC: ${company.rc || '—'} | IF: ${company.ifNum || '—'} | TP: ${company.tp || '—'}<br />
            ${company.address || ''} | Tél: ${company.phone || ''}
          </div>
        </td>
        <td style="text-align: right; vertical-align: top;">
          ${qrCodeBase64 ? `<img src="${qrCodeBase64}" width="75" height="75" alt="QR Code" style="border: 1px solid #cbd5e1; border-radius: 4px;" />` : ''}
        </td>
      </tr>
    </table>

    <div class="title-box ${isEscompte ? 'title-escompte' : ''}">
      <h2 class="main-title">${titleFr}</h2>
      <p class="sub-title-ar">${titleAr}</p>
    </div>

    <div class="meta-grid">
      <div class="info-card">
        <h4>Compte de Dépôt / Domiciliation Bancaire</h4>
        <p><strong>Banque:</strong> ${bordereau.bankName}</p>
        <p><strong>Intitulé Compte:</strong> ${bordereau.bankAccountName}</p>
        <p><strong>RIB:</strong> <span style="font-family: monospace; font-weight: bold;">${bordereau.bankRib}</span></p>
      </div>
      <div class="info-card">
        <h4>Références du Bordereau</h4>
        <p><strong>N° Bordereau:</strong> <span style="font-family: monospace; font-weight: bold; color: #0284c7;">${bordereau.bordereauNumber}</span></p>
        <p><strong>Date de Remise:</strong> ${bordereau.remittanceDate}</p>
        <p><strong>Type d'Opération:</strong> ${isEscompte ? 'Escompte Commercial (خصم تجاري)' : 'Encaissement Simple (تحصيل)'}</p>
      </div>
    </div>

    <table class="values-table">
      <thead>
        <tr>
          <th style="width: 25px; text-align: center;">N°</th>
          <th style="width: 55px; text-align: center;">Type</th>
          <th>N° de Valeur</th>
          <th>Tiré / Client</th>
          <th>Banque Tirée</th>
          <th>RIB Tiré</th>
          <th style="text-align: center;">Échéance</th>
          <th style="text-align: right;">Montant</th>
          ${isEscompte ? '<th style="text-align: right;">Agios Est.</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="summary-grid">
      <div>
        <table class="summary-table">
          <tr>
            <td>Nombre total de valeurs remises (عدد الأوراق)</td>
            <td style="text-align: right; font-weight: bold;">${bordereau.billsCount}</td>
          </tr>
          <tr>
            <td>Montant total brut nominal (إجمالي القيمة الاسمية)</td>
            <td style="text-align: right; font-weight: bold; font-family: monospace; color: #0369a1;">
              ${bordereau.totalFaceValue.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD
            </td>
          </tr>
          ${
            isEscompte
              ? `
          <tr>
            <td>Taux d'escompte appliqué / Commission (معدل الخصم والعمولة)</td>
            <td style="text-align: right;">${bordereau.discountRate || 0}% + ${bordereau.bankCommission || 0} MAD</td>
          </tr>
          <tr>
            <td>Agios d'escompte HT (مصاريف الخصم غير شاملة الضريبة)</td>
            <td style="text-align: right; font-family: monospace; color: #b91c1c;">
              -${bordereau.estimatedAgios.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD
            </td>
          </tr>
          <tr>
            <td>TVA Bancaire légale 10% (الضريبة البنكية)</td>
            <td style="text-align: right; font-family: monospace; color: #b91c1c;">
              -${bordereau.estimatedVat.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD
            </td>
          </tr>
          <tr>
            <td>Net estimé à créditer au compte (الصافي المتوقع إيداعه)</td>
            <td style="text-align: right; font-family: monospace; color: #15803d; font-size: 13px;">
              ${bordereau.estimatedNetProceeds.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD
            </td>
          </tr>
          `
              : ''
          }
        </table>
      </div>

      <div style="font-size: 10.5px; color: #475569; padding: 6px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
        <strong>Engagement et Décharge:</strong><br />
        Nous soussignés certifions la régularité des titres ci-dessus énumérés et donnons mandat à la banque de procéder à leur ${isEscompte ? 'escompte' : 'encaissement'} conformément aux conventions de compte en vigueur.
      </div>
    </div>

    <div class="signatures-grid">
      <div class="signature-box">
        <label>1. Signature et Cachet de l'Entreprise (Émetteur)</label>
        <div style="height: 55px; display: flex; align-items: flex-end; justify-content: center; font-size: 11px; color: #64748b;">
          Zone Franche, Tanger — Trans Bodanon TMS
        </div>
      </div>
      <div class="signature-box">
        <label>2. Visa, Date et Cachet de Réception de la Banque</label>
        <div style="height: 55px; display: flex; align-items: flex-end; justify-content: center; font-size: 11px; color: #94a3b8; font-style: italic;">
          Réservé à l'Agence Bancaire
        </div>
      </div>
    </div>

    <div class="verification-bar">
      <div>Empreinte HMAC-SHA256: <span style="font-family: monospace;">${bordereau.securityHash}</span></div>
      <div>Généré par Trans Bodanon TMS le ${new Date().toLocaleString('fr-MA')}</div>
    </div>

    <div class="no-print">
      <button class="print-btn" onclick="window.print()">Imprimer le Bordereau / Sauvegarder en PDF (طباعة جدول التسليم)</button>
    </div>
  </div>
</body>
</html>`;
}

