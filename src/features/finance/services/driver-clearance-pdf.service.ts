import type { ClearanceSheetExportContext } from '../types/financial-export.types';

export class DriverClearancePdfService {
  /**
   * إنشاء قالب HTML المتجهي الرسمي عالي الدقة القابل للطباعة والتحويل لـ PDF (Vector A4)
   */
  public static generateClearanceHtml(context: ClearanceSheetExportContext): string {
    const {
      company,
      driver,
      statement,
      locale,
      verificationUrl,
      verificationHash,
      issuedAt,
      qrCodeDataUri,
    } = context;

    const isRtl = locale === 'ar';
    const dir = isRtl ? 'rtl' : 'ltr';

    // نصوص العناوين بحسب اللغة
    const labels = {
      ar: {
        docTitle: 'كشف تصفية مصاريف الطريق وإبراء ذمة سائق',
        docSubtitle: 'Décompte des Frais de Route & Décharge Officielle',
        statementNumber: 'رقم الكشف المرجعي',
        dateIssued: 'تاريخ الإصدار والاعتماد',
        driverName: 'السائق المكلف',
        driverCin: 'رقم البطاقة الوطنية / الإقامة',
        driverPassport: 'جواز السفر الدولي',
        driverLicense: 'رخصة السياقة المهنية',
        driverMatricule: 'الرمز المهني',
        assignedTruck: 'الشاحنة المخصصة',
        period: 'الفترة التشغيلية',
        tripsCount: 'الرحلات المنجزة',
        totalDistance: 'إجمالي المسافة',
        // الأعمدة المحاسبية
        sec1Title: '1. مستحقات العمل والعمولات',
        baseSalary: 'الراتب الأساسي',
        missionBonuses: 'عمولة الرحلات الدولية',
        safetyBonus: 'مكافأة السلامة والقيادة الآمنة',
        grossEarnings: 'إجمالي المستحقات',
        sec2Title: '2. موازنة نفقات الطريق والعهد',
        totalAdvances: 'إجمالي السلف المسلمة',
        totalExpenses: 'مصاريف الطريق الموثقة',
        fuelShare: '• وقود الشاحنة',
        tollsShare: '• رسوم الطرق (Via-T / Télépéage)',
        ferryShare: '• العبّارات والترانزيت البحري',
        portCustomsShare: '• الموانئ والجمارك',
        variance: 'فارق العهدة (المصاريف - السلف)',
        sec3Title: '3. صافي الصرف وإبراء الذمة',
        finesDeduction: 'خصم مخالفات تشغيلية',
        netPayout: 'صافي الصرف المحول',
        // تفاصيل
        itemizedTitle: 'تفاصيل الإيصالات والمصاريف المعتمدة بالفترة',
        colDate: 'التاريخ',
        colCat: 'النوع',
        colDesc: 'المرجع والبيان',
        colAmount: 'المبلغ (MAD)',
        // إبراء الذمة
        legalClearance:
          'أقر أنا السائق الموقع أسفله باستلامي لكافة مستحقاتي عن الفترة المذكورة أعلاه وبمطابقة كافة السلف التشغيلية المسلمة لي مع مصاريف الطريق المبررة بالإيصالات، وأقر بإبراء ذمة الشركة إبراءً تاماً ونهائياً لا رجعة فيه من أي مطالبات مالية تخص هذه الفترة.',
        driverSig: 'توقيع وإبراء ذمة السائق',
        driverSigNote: '(قرأت ووافقت مع إبراء تام للذمة)',
        mgmtSig: 'تأشيرة ومصادقة الإدارة المالية',
        mgmtSigNote: 'Trans Bodanon TMS — Contrôle Financier',
        scanVerify: 'امسح الرمز للتحقق الرقمي الفوري من صحة الوثيقة',
        securityHash: 'الختم التشفيري الرقمي (HMAC-SHA256)',
      },
      fr: {
        docTitle: 'Décompte des Frais de Route & Décharge Chauffeur',
        docSubtitle: 'Driver Expense Settlement Statement & Legal Discharge',
        statementNumber: 'N° de Décompte',
        dateIssued: 'Date d\'Émission',
        driverName: 'Chauffeur Titulaire',
        driverCin: 'N° CNI / Carte Séjour',
        driverPassport: 'Passeport International',
        driverLicense: 'Permis de Conduire',
        driverMatricule: 'Matricule Chauffeur',
        assignedTruck: 'Tracteur Assigné',
        period: 'Période d\'Exploitation',
        tripsCount: 'Voyages Réalisés',
        totalDistance: 'Distance Totale',
        sec1Title: '1. Rémunération & Primes',
        baseSalary: 'Salaire de Base',
        missionBonuses: 'Primes Missions Internationales',
        safetyBonus: 'Prime de Conduite Sécurisée',
        grossEarnings: 'Rémunération Brute',
        sec2Title: '2. Balance Frais de Route / Avances',
        totalAdvances: 'Total Avances Versées',
        totalExpenses: 'Frais de Route Justifiés',
        fuelShare: '• Carburant',
        tollsShare: '• Péages (Via-T / Télépéage)',
        ferryShare: '• Ferries & Transit Maritime',
        portCustomsShare: '• Frais Portuaires & Douane',
        variance: 'Solde Avances (Frais - Avances)',
        sec3Title: '3. Net à Payer & Décharge',
        finesDeduction: 'Retenue Infractions',
        netPayout: 'Net à Payer Virement',
        itemizedTitle: 'Détail des Pièces Justificatives & Frais Engagés',
        colDate: 'Date',
        colCat: 'Catégorie',
        colDesc: 'Réf & Libellé',
        colAmount: 'Montant (MAD)',
        legalClearance:
          'Je soussigné, chauffeur titulaire désigné ci-dessus, atteste avoir perçu l\'intégralité de mes droits et émoluments pour la période concernée après apurement régulier de toutes les avances opérationnelles et justificatifs de route, et donne par la présente quitus entier, définitif et sans réserve à la société Trans Bodanon.',
        driverSig: 'Signature & Décharge du Chauffeur',
        driverSigNote: '(Lu et approuvé, décharge totale et définitive)',
        mgmtSig: 'Visa & Validation Direction Financière',
        mgmtSigNote: 'Trans Bodanon TMS — Contrôle Financier',
        scanVerify: 'Scanner pour vérification numérique instantanée',
        securityHash: 'Signature Cryptographique (HMAC-SHA256)',
      },
      es: {
        docTitle: 'Liquidación de Gastos de Ruta y Finiquito de Chofer',
        docSubtitle: 'Driver Expense Settlement Statement & Legal Discharge',
        statementNumber: 'N° Liquidación',
        dateIssued: 'Fecha de Emisión',
        driverName: 'Chofer Titular',
        driverCin: 'DNI / NIE',
        driverPassport: 'Pasaporte Internacional',
        driverLicense: 'Permiso de Conducir',
        driverMatricule: 'Matrícula Chofer',
        assignedTruck: 'Camión Asignado',
        period: 'Período Operativo',
        tripsCount: 'Viajes Realizados',
        totalDistance: 'Distancia Total',
        sec1Title: '1. Retribución y Primas',
        baseSalary: 'Salario Base',
        missionBonuses: 'Primas Viajes Internacionales',
        safetyBonus: 'Bono Conducción Segura',
        grossEarnings: 'Retribución Bruta',
        sec2Title: '2. Balance Gastos de Ruta / Anticipos',
        totalAdvances: 'Total Anticipos Entregados',
        totalExpenses: 'Gastos de Ruta Justificados',
        fuelShare: '• Combustible',
        tollsShare: '• Peajes (Via-T / Télépéage)',
        ferryShare: '• Ferries y Tránsito Marítimo',
        portCustomsShare: '• Gastos Portuarios y Aduana',
        variance: 'Saldo Anticipos (Gastos - Anticipos)',
        sec3Title: '3. Neto a Liquidar y Finiquito',
        finesDeduction: 'Deducción Infracciones',
        netPayout: 'Neto a Abonar por Banco',
        itemizedTitle: 'Detalle de Comprobantes y Gastos de Ruta',
        colDate: 'Fecha',
        colCat: 'Categoría',
        colDesc: 'Ref y Detalle',
        colAmount: 'Importe (MAD)',
        legalClearance:
          'Yo, el abajo firmante, chofer titular indicado arriba, reconozco haber recibido la totalidad de mis emolumentos por el período indicado tras la conciliación regular de anticipos y gastos de ruta justificados, otorgando el correspondiente finiquito y descargo total y definitivo a la empresa Trans Bodanon.',
        driverSig: 'Firma y Finiquito del Chofer',
        driverSigNote: '(Leído y conforme, finiquito y descargo total)',
        mgmtSig: 'Visto Bueno Dirección Financiera',
        mgmtSigNote: 'Trans Bodanon TMS — Control Financiero',
        scanVerify: 'Escanear para verificación digital instantánea',
        securityHash: 'Firma Criptográfica (HMAC-SHA256)',
      },
    };

    const l = labels[locale] || labels.ar;
    const isVariancePositive = statement.expenses_advances_balance_mad >= 0;
    const varianceSign = isVariancePositive ? '+' : '';

    const formatNumber = (num: number) =>
      new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num);

    const expensesRows = (statement.itemized_expenses || [])
      .map(
        (item: any) => `
        <tr>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e2e8f0; font-family: monospace; color: #475569;">${item.date}</td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; font-size: 9px; font-weight: bold; color: #0369a1;">${item.category}</td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e2e8f0;">
            <div style="font-weight: 600; color: #1e293b;">${item.description}</div>
            <div style="font-size: 8px; color: #64748b; font-family: monospace;">${item.reference}</div>
          </td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e2e8f0; text-align: ${isRtl ? 'left' : 'right'}; font-family: monospace; font-weight: 700; color: #0f172a;">
            ${formatNumber(item.amount)}
          </td>
        </tr>
      `
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${l.docTitle} - ${statement.statement_number}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 10mm 12mm 10mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 11px;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 12px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
    }
    @media print {
      body { background: #fff; }
      .sheet-container { border: none; padding: 0; max-width: 100%; }
      .no-print { display: none !important; }
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .company-title {
      font-size: 16px;
      font-weight: 900;
      color: #0284c7;
      letter-spacing: -0.3px;
    }
    .company-sub {
      font-size: 9px;
      color: #475569;
      line-height: 1.3;
      margin-top: 2px;
    }
    .doc-meta {
      text-align: ${isRtl ? 'left' : 'right'};
    }
    .doc-badge {
      display: inline-block;
      background: #0f172a;
      color: #ffffff;
      padding: 3px 10px;
      border-radius: 4px;
      font-weight: 800;
      font-size: 11px;
      font-family: monospace;
      letter-spacing: 0.5px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 12px;
    }
    .info-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 10px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      padding: 2px 0;
    }
    .info-label { color: #64748b; font-weight: 500; }
    .info-val { font-weight: 700; color: #0f172a; }
    
    .grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
      margin-bottom: 12px;
    }
    .acc-box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px;
      background: #ffffff;
    }
    .acc-header {
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      padding-bottom: 4px;
      margin-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
    }
    .acc-row {
      display: flex;
      justify-content: space-between;
      font-size: 9.5px;
      margin-bottom: 3px;
    }
    .acc-row.total {
      border-top: 1px solid #e2e8f0;
      padding-top: 4px;
      margin-top: 4px;
      font-weight: 800;
      font-size: 10.5px;
    }
    .text-emerald { color: #059669; }
    .text-blue { color: #2563eb; }
    .text-amber { color: #d97706; }
    .text-rose { color: #e11d48; }

    .table-container {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 12px;
    }
    .table-header {
      background: #f1f5f9;
      padding: 6px 10px;
      font-weight: 800;
      font-size: 9.5px;
      color: #334155;
      border-bottom: 1px solid #e2e8f0;
      text-transform: uppercase;
    }
    table { width: 100%; border-collapse: collapse; font-size: 9px; }
    th {
      background: #f8fafc;
      padding: 5px 8px;
      border-bottom: 1px solid #cbd5e1;
      font-weight: 700;
      color: #475569;
      text-align: ${isRtl ? 'right' : 'left'};
    }
    
    .legal-box {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      margin-bottom: 12px;
      font-size: 9px;
      color: #334155;
      text-align: justify;
      line-height: 1.45;
    }

    .sig-section {
      display: grid;
      grid-template-columns: 1fr 140px 1fr;
      gap: 12px;
      align-items: center;
      margin-top: 6px;
      padding-top: 8px;
      border-top: 1px dashed #cbd5e1;
    }
    .sig-col {
      text-align: center;
    }
    .sig-title {
      font-size: 10px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 2px;
    }
    .sig-sub { font-size: 8px; color: #64748b; }
    .sig-space {
      height: 48px;
      border-bottom: 1px solid #94a3b8;
      margin-bottom: 4px;
    }
    .qr-col {
      text-align: center;
    }
    .qr-img {
      width: 75px;
      height: 75px;
      display: block;
      margin: 0 auto;
    }
    .qr-caption {
      font-size: 7.5px;
      color: #64748b;
      margin-top: 2px;
      line-height: 1.2;
    }
    .hash-footer {
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px solid #e2e8f0;
      font-size: 7.5px;
      color: #94a3b8;
      font-family: monospace;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="sheet-container">
    <!-- Header -->
    <div class="header-bar">
      <div>
        <div class="company-title">${company.name}</div>
        <div class="company-sub">
          <strong>ICE:</strong> ${company.ice} | <strong>RC:</strong> ${company.rc} | <strong>Patente:</strong> ${company.patente} | <strong>IF:</strong> ${company.ifNumber}<br />
          ${company.address} • Tél: ${company.phone} • Email: ${company.email}
        </div>
      </div>
      <div class="doc-meta">
        <div class="doc-badge">${statement.statement_number}</div>
        <div style="font-size: 9px; color: #64748b; margin-top: 3px;">
          ${l.dateIssued}: <strong>${issuedAt}</strong>
        </div>
      </div>
    </div>

    <!-- Title Bar -->
    <div style="text-align: center; margin-bottom: 10px;">
      <h1 style="font-size: 15px; font-weight: 900; color: #0f172a; text-transform: uppercase;">
        ${l.docTitle}
      </h1>
      <p style="font-size: 9px; color: #64748b; font-weight: 500;">
        ${l.docSubtitle}
      </p>
    </div>

    <!-- Driver & Period Metadata -->
    <div class="grid-2">
      <div class="info-card">
        <div class="info-row">
          <span class="info-label">${l.driverName}:</span>
          <span class="info-val">${driver.name}</span>
        </div>
        <div class="info-row">
          <span class="info-label">${l.driverCin}:</span>
          <span class="info-val">${driver.cin || '—'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">${l.driverPassport}:</span>
          <span class="info-val">${driver.passportNumber || '—'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">${l.driverLicense}:</span>
          <span class="info-val">${driver.driverLicenseNumber || '—'}</span>
        </div>
      </div>

      <div class="info-card">
        <div class="info-row">
          <span class="info-label">${l.period}:</span>
          <span class="info-val" style="font-family: monospace;">${statement.period_start} ➔ ${statement.period_end}</span>
        </div>
        <div class="info-row">
          <span class="info-label">${l.assignedTruck}:</span>
          <span class="info-val">${driver.truckPlate || '—'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">${l.tripsCount}:</span>
          <span class="info-val">${statement.trips_count} voyages</span>
        </div>
        <div class="info-row">
          <span class="info-label">${l.totalDistance}:</span>
          <span class="info-val">${formatNumber(statement.total_distance_km)} km</span>
        </div>
      </div>
    </div>

    <!-- Accounting Decomposition (3 Columns) -->
    <div class="grid-3">
      <!-- Box 1 -->
      <div class="acc-box">
        <div class="acc-header" style="color: #0369a1;">${l.sec1Title}</div>
        <div class="acc-row">
          <span>${l.baseSalary}:</span>
          <span style="font-family: monospace;">${formatNumber(statement.base_salary_mad)}</span>
        </div>
        <div class="acc-row">
          <span>${l.missionBonuses}:</span>
          <span style="font-family: monospace;" class="text-emerald">+${formatNumber(statement.mission_bonuses_mad)}</span>
        </div>
        <div class="acc-row">
          <span>${l.safetyBonus}:</span>
          <span style="font-family: monospace;" class="text-emerald">+${formatNumber(statement.safety_bonus_mad)}</span>
        </div>
        <div class="acc-row total">
          <span>${l.grossEarnings}:</span>
          <span style="font-family: monospace; color: #0284c7;">${formatNumber(statement.gross_driver_earnings_mad)} MAD</span>
        </div>
      </div>

      <!-- Box 2 -->
      <div class="acc-box">
        <div class="acc-header" style="color: #b45309;">${l.sec2Title}</div>
        <div class="acc-row">
          <span>${l.totalAdvances}:</span>
          <span style="font-family: monospace;" class="text-amber">${formatNumber(statement.total_advances_mad)}</span>
        </div>
        <div class="acc-row">
          <span>${l.totalExpenses}:</span>
          <span style="font-family: monospace;" class="text-blue">${formatNumber(statement.total_driver_expenses_mad)}</span>
        </div>
        <div style="font-size: 8px; color: #64748b; padding-left: 4px;">
          ${l.fuelShare}: ${formatNumber(statement.total_fuel_expenses_mad)}<br />
          ${l.tollsShare}: ${formatNumber(statement.total_toll_expenses_mad)}<br />
          ${l.ferryShare}: ${formatNumber(statement.total_ferry_expenses_mad)}
        </div>
        <div class="acc-row total">
          <span>${l.variance}:</span>
          <span style="font-family: monospace;" class="${isVariancePositive ? 'text-emerald' : 'text-amber'}">
            ${varianceSign}${formatNumber(statement.expenses_advances_balance_mad)} MAD
          </span>
        </div>
      </div>

      <!-- Box 3 -->
      <div class="acc-box" style="background: #f0fdf4; border-color: #86efac;">
        <div class="acc-header" style="color: #15803d;">${l.sec3Title}</div>
        <div class="acc-row">
          <span>${l.grossEarnings}:</span>
          <span style="font-family: monospace;">${formatNumber(statement.gross_driver_earnings_mad)}</span>
        </div>
        <div class="acc-row">
          <span>${l.variance}:</span>
          <span style="font-family: monospace;" class="${isVariancePositive ? 'text-emerald' : 'text-amber'}">
            ${varianceSign}${formatNumber(statement.expenses_advances_balance_mad)}
          </span>
        </div>
        ${
          statement.total_fines_mad > 0
            ? `
        <div class="acc-row" style="color: #e11d48;">
          <span>${l.finesDeduction}:</span>
          <span style="font-family: monospace;">-${formatNumber(statement.total_fines_mad)}</span>
        </div>`
            : ''
        }
        <div class="acc-row total" style="color: #166534; font-size: 12px; border-top-color: #86efac;">
          <span>${l.netPayout}:</span>
          <span style="font-family: monospace;">${formatNumber(statement.net_payout_mad)} MAD</span>
        </div>
      </div>
    </div>

    <!-- Table of Itemized Expenses -->
    <div class="table-container">
      <div class="table-header">${l.itemizedTitle} (${(statement.itemized_expenses || []).length} lignes)</div>
      <div style="max-height: 160px; overflow: hidden;">
        <table>
          <thead>
            <tr>
              <th style="width: 15%;">${l.colDate}</th>
              <th style="width: 15%;">${l.colCat}</th>
              <th style="width: 55%;">${l.colDesc}</th>
              <th style="width: 15%; text-align: ${isRtl ? 'left' : 'right'};">${l.colAmount}</th>
            </tr>
          </thead>
          <tbody>
            ${expensesRows}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Legal Discharge Statement -->
    <div class="legal-box">
      <strong>Engagement & Décharge:</strong> ${l.legalClearance}
    </div>

    <!-- Signature and QR Validation Block -->
    <div class="sig-section">
      <!-- Driver Signature -->
      <div class="sig-col">
        <div class="sig-title">${l.driverSig}</div>
        <div class="sig-sub">${l.driverSigNote}</div>
        <div class="sig-space"></div>
        <div style="font-size: 8.5px; font-weight: 700;">${driver.name}</div>
      </div>

      <!-- QR Code Security -->
      <div class="qr-col">
        ${
          qrCodeDataUri
            ? `<img src="${qrCodeDataUri}" alt="Verification QR" class="qr-img" />`
            : ''
        }
        <div class="qr-caption">${l.scanVerify}</div>
      </div>

      <!-- Management Visa -->
      <div class="sig-col">
        <div class="sig-title">${l.mgmtSig}</div>
        <div class="sig-sub">${l.mgmtSigNote}</div>
        <div class="sig-space"></div>
        <div style="font-size: 8.5px; font-weight: 700;">Trans Bodanon S.A.R.L.</div>
      </div>
    </div>

    <!-- Tamper-proof cryptographic hash footer -->
    <div class="hash-footer">
      <span>${l.securityHash}: <strong>${verificationHash.slice(0, 32)}...</strong></span>
      <span>Vérifiable en direct: ${verificationUrl}</span>
    </div>
  </div>
</body>
</html>`;
  }
}

