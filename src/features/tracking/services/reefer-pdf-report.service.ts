/**
 * Trans Bodanon TMS — Reefer Official PDF / Print Report Service
 * Vector A4 Layout for EN 12830 / GDP Cold Chain Compliance Certification
 * Supports Arabic (RTL), French (LTR), and Spanish (LTR) with Cryptographic Seal.
 */

import Decimal from 'decimal.js';
import type { ReeferReportExportContext } from '../types/reefer-export.types';

export class ReeferPdfReportService {
  public static generateReportHtml(context: ReeferReportExportContext): string {
    const {
      company,
      trip,
      profile,
      evaluation,
      logs,
      incidents,
      locale,
      issuedAt,
      verificationHash,
      verificationUrl,
    } = context;

    const isRtl = locale === 'ar';
    const dir = isRtl ? 'rtl' : 'ltr';

    const labels = {
      ar: {
        docTitle: 'شهادة تدقيق سلسلة التبريد وسجل درجات الحرارة الرسمي',
        docSubtitle: 'Certificat Officiel d\'Audit de la Chaîne du Froid (Norme EN 12830 & GDP)',
        officialNotice: 'وثيقة تليماتية رسمية معتمدة للتخليص الجمركي وعمليات الاستيراد والتصدير الدولي',
        secCompany: 'بيانات الشركة الناقلة',
        secMission: 'هوية الشحنة ووحدة التبريد',
        tripId: 'معرّف الرحلة المرجعي',
        cmr: 'رقم وثيقة النقل (CMR)',
        route: 'المسار الدولي',
        client: 'العميل / الشاحن',
        driver: 'السائق المكلف',
        truck: 'الشاحنة المخصصة',
        trailer: 'المقطورة المبردة (Frigo)',
        brand: 'وحدة التبريد',
        atp: 'تصنيف ميثاق ATP',
        cargo: 'نوع الشحنة الحساسة',
        setpoint: 'نقطة الضبط المعتمدة',
        secKpi: 'المؤشرات الحرارية والحركية المعتمدة (Arrhenius Index)',
        mkt: 'الحرارة الحركية (MKT)',
        avgReturn: 'متوسط الهواء الراجع (Return)',
        avgSupply: 'متوسط هواء الضخ (Supply)',
        excursionTime: 'مدة الانحراف الحراري',
        dieselBurned: 'وقود التبريد المستهلك',
        complianceStatus: 'حالة الامتثال لمعايير GDP',
        score: 'مؤشر المطابقة الجمركية',
        compliant: 'مطابق تماماً للمعايير (COMPLIANT)',
        warning: 'تحذير تقلبات طفيفة (WARNING)',
        breached: 'مخالفة حرجة لسلسلة التبريد (BREACHED)',
        secIncidents: 'سجل حوادث الانحراف الحراري المسجلة (Excursions)',
        noIncidents: 'لم يتم تسجيل أي انحراف حراري خارج النطاق المسموح طوال فترة الترانزيت.',
        secLogs: 'عينة من تدفق قراءات مسجل التبريد EN 12830 (DataCOLD)',
        colTime: 'التوقيت القياسي',
        colSupply: 'هواء الضخ',
        colReturn: 'هواء الراجع',
        colAmbient: 'المحيط',
        colCompressor: 'الضاغط',
        colDoor: 'الأبواب',
        colBurnRate: 'الاستهلاك',
        secSignatures: 'المصادقة والتوقيعات الرسمية',
        sigEngineer: 'تأشيرة مهندس التبريد المعتمد',
        sigCustoms: 'مراقبة الجمارك والمصالح البيطرية',
        secHash: 'الختم الرقمي ونزاهة البيانات (Cryptographic Integrity Seal)',
        hashNotice: 'تم تشفير هذا السجل التليماتي بواسطة بصمة HMAC-SHA256 لمنع أي تلاعب بالسجلات.',
        scanVerify: 'التحقق الرقمي عبر البوابة الرسمية:',
        printBtn: 'طباعة / حفظ كـ PDF',
      },
      fr: {
        docTitle: 'Certificat Officiel d\'Audit Thermique & Rapport EN 12830',
        docSubtitle: 'Cold Chain Compliance & Telematics Audit Report (GDP Guidelines)',
        officialNotice: 'Document télématique certifié pour le dédouanement et le contrôle sanitaire international',
        secCompany: 'Identité du Transporteur',
        secMission: 'Mission & Équipement Frigorifique',
        tripId: 'ID Mission / Voyage',
        cmr: 'Lettre de Voiture (CMR)',
        route: 'Corridor International',
        client: 'Client / Chargeur',
        driver: 'Conducteur Assigné',
        truck: 'Tracteur Assigné',
        trailer: 'Semi-Remorque Frigo',
        brand: 'Groupe Frigorifique',
        atp: 'Classement Norme ATP',
        cargo: 'Nature de la Marchandise',
        setpoint: 'Température de Consigne',
        secKpi: 'Indicateurs Thermiques & Cinétiques (MKT Arrhenius)',
        mkt: 'Température Cinétique (MKT)',
        avgReturn: 'Moyenne Air Repris',
        avgSupply: 'Moyenne Air Soufflé',
        excursionTime: 'Temps d\'Excursion Thermique',
        dieselBurned: 'Gazole Consommé (Groupe)',
        complianceStatus: 'Statut de Conformité GDP',
        score: 'Score de Conformité',
        compliant: 'CONFORME AUX NORMES (COMPLIANT)',
        warning: 'AVERTISSEMENT EXCURSION (WARNING)',
        breached: 'RUPTURE DE LA CHAÎNE (BREACHED)',
        secIncidents: 'Registre des Événements & Excursions Thermiques',
        noIncidents: 'Aucune rupture de la chaîne du froid enregistrée durant le transit.',
        secLogs: 'Échantillonnage du Flux Télématique EN 12830 (DataCOLD)',
        colTime: 'Horodatage UTC',
        colSupply: 'Air Soufflé',
        colReturn: 'Air Repris',
        colAmbient: 'Ambiant',
        colCompressor: 'Compresseur',
        colDoor: 'Portes',
        colBurnRate: 'Conso Gazole',
        secSignatures: 'Visas & Signatures Officielles',
        sigEngineer: 'Visa Responsable Technique Frigo',
        sigCustoms: 'Contrôle Sanitaire & Douanes',
        secHash: 'Sceau d\'Intégrité Numérique (HMAC-SHA256)',
        hashNotice: 'Rapport certifié et sécurisé par empreinte cryptographique inviolable.',
        scanVerify: 'Vérification en ligne sur le portail sécurisé :',
        printBtn: 'Imprimer / Enregistrer en PDF',
      },
      es: {
        docTitle: 'Certificado Oficial de Auditoría Térmica y Registro EN 12830',
        docSubtitle: 'Certificado de Conformidad de Cadena de Frío (GDP & ATP)',
        officialNotice: 'Documento telemático oficial para despacho aduanero e inspección sanitaria',
        secCompany: 'Identificación del Transportista',
        secMission: 'Identificación de Misión y Equipo de Frío',
        tripId: 'ID Viaje / Transporte',
        cmr: 'Carta de Porte (CMR)',
        route: 'Ruta Internacional',
        client: 'Cliente / Cargador',
        driver: 'Conductor Asignado',
        truck: 'Tractora',
        trailer: 'Semirremolque Frigo',
        brand: 'Equipo Frigorífico',
        atp: 'Clasificación Norma ATP',
        cargo: 'Tipo de Carga',
        setpoint: 'Punto de Consigna',
        secKpi: 'Indicadores Térmicos y Cinéticos (Índice MKT)',
        mkt: 'Temperatura Cinética (MKT)',
        avgReturn: 'Media Aire Retorno',
        avgSupply: 'Media Aire Impulsado',
        excursionTime: 'Tiempo de Excursión Térmica',
        dieselBurned: 'Combustible Consumido (Frigo)',
        complianceStatus: 'Estado de Conformidad GDP',
        score: 'Puntuación de Cumplimiento',
        compliant: 'CONFORME CON NORMATIVA (COMPLIANT)',
        warning: 'ADVERTENCIA EXCURSIÓN (WARNING)',
        breached: 'RUPTURA DE CADENA DE FRÍO (BREACHED)',
        secIncidents: 'Registro de Incidencias y Excursiones Térmicas',
        noIncidents: 'No se registraron rupturas de cadena de frío durante el transporte.',
        secLogs: 'Muestreo de Registros Telemáticos EN 12830 (DataCOLD)',
        colTime: 'Marca Temporal',
        colSupply: 'Aire Impulsado',
        colReturn: 'Aire Retorno',
        colAmbient: 'Ambiente',
        colCompressor: 'Compresor',
        colDoor: 'Puertas',
        colBurnRate: 'Consumo (L/h)',
        secSignatures: 'Firmas y Visados Oficiales',
        sigEngineer: 'Responsable Técnico Frigorífico',
        sigCustoms: 'Inspección Sanitaria y Aduanas',
        secHash: 'Sello Digital de Integridad (HMAC-SHA256)',
        hashNotice: 'Registro protegido criptográficamente mediante algoritmo HMAC-SHA256.',
        scanVerify: 'Verificación en línea en el portal oficial:',
        printBtn: 'Imprimir / Guardar en PDF',
      },
    }[locale];

    const isCompliant = evaluation.complianceStatus === 'compliant';
    const isWarning = evaluation.complianceStatus === 'warning';
    const statusColor = isCompliant ? '#059669' : isWarning ? '#d97706' : '#dc2626';
    const statusBg = isCompliant ? '#ecfdf5' : isWarning ? '#fffbeb' : '#fef2f2';
    const statusText = isCompliant
      ? labels.compliant
      : isWarning
      ? labels.warning
      : labels.breached;

    return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <title>${labels.docTitle} - ${trip.tripId}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.4;
      direction: ${dir};
    }
    .print-bar {
      background: #0f172a;
      color: white;
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    @media print {
      .print-bar { display: none; }
      body { padding: 0; }
    }
    .header-table {
      width: 100%;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .company-title {
      font-size: 16px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.3px;
    }
    .company-meta {
      font-size: 9.5px;
      color: #475569;
      margin-top: 3px;
    }
    .doc-badge {
      text-align: ${isRtl ? 'left' : 'right'};
    }
    .doc-badge h1 {
      margin: 0;
      font-size: 14px;
      color: #0f172a;
      font-weight: 800;
    }
    .doc-badge p {
      margin: 2px 0 0;
      font-size: 9px;
      color: #64748b;
    }
    .status-banner {
      background: ${statusBg};
      border: 1.5px solid ${statusColor};
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .status-title {
      font-size: 12px;
      font-weight: 800;
      color: ${statusColor};
    }
    .status-score {
      font-size: 11px;
      font-weight: 700;
      color: ${statusColor};
    }
    .section-title {
      font-size: 11px;
      font-weight: 800;
      color: #1e293b;
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 3px;
      margin: 10px 0 6px;
      text-transform: uppercase;
    }
    .grid-2 {
      display: table;
      width: 100%;
      margin-bottom: 8px;
    }
    .col-half {
      display: table-cell;
      width: 50%;
      vertical-align: top;
      padding: ${isRtl ? '0 0 0 8px' : '0 8px 0 0'};
    }
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 8px;
      font-size: 10px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      padding: 2.5px 0;
      border-bottom: 1px dotted #e2e8f0;
    }
    .meta-row:last-child {
      border-bottom: none;
    }
    .meta-label {
      color: #64748b;
      font-weight: 500;
    }
    .meta-value {
      font-weight: 700;
      color: #0f172a;
    }
    .kpi-grid {
      display: table;
      width: 100%;
      margin-bottom: 10px;
    }
    .kpi-cell {
      display: table-cell;
      width: 25%;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 7px;
      text-align: center;
      margin-right: 4px;
    }
    .kpi-val {
      font-size: 15px;
      font-weight: 900;
      color: #0f172a;
      margin-top: 2px;
    }
    .kpi-lbl {
      font-size: 9px;
      color: #475569;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5px;
      margin-bottom: 10px;
    }
    table.data-table th, table.data-table td {
      border: 1px solid #cbd5e1;
      padding: 4px 6px;
      text-align: ${isRtl ? 'right' : 'left'};
    }
    table.data-table th {
      background: #f1f5f9;
      font-weight: 700;
      color: #334155;
    }
    table.data-table tr:nth-child(even) {
      background: #f8fafc;
    }
    .signatures-table {
      width: 100%;
      margin-top: 15px;
      margin-bottom: 15px;
      border-collapse: collapse;
    }
    .sig-box {
      border: 1px dashed #94a3b8;
      border-radius: 4px;
      height: 65px;
      padding: 6px;
      font-size: 9.5px;
      color: #64748b;
      vertical-align: top;
      background: #fafafa;
    }
    .hash-footer {
      border-top: 1px solid #cbd5e1;
      padding-top: 8px;
      font-size: 8.5px;
      color: #64748b;
      line-height: 1.3;
    }
    .hash-code {
      font-family: monospace;
      font-size: 9px;
      font-weight: 700;
      color: #0f172a;
      word-break: break-all;
    }
  </style>
</head>
<body>

  <div class="print-bar">
    <span>${labels.docTitle} - <strong>${trip.tripId}</strong></span>
    <button onclick="window.print()" style="background:#059669; color:white; border:none; padding:6px 14px; border-radius:4px; font-weight:bold; cursor:pointer;">
      ${labels.printBtn}
    </button>
  </div>

  <!-- Header -->
  <table class="header-table">
    <tr>
      <td style="vertical-align: top; width: 60%;">
        <div class="company-title">${company.name}</div>
        <div class="company-meta">
          ICE: <strong>${company.ice}</strong> • RC: <strong>${company.rc}</strong> • IF: <strong>${company.ifNumber}</strong> • Patente: <strong>${company.patente}</strong><br>
          ${company.address} • Tél: ${company.phone} • Email: ${company.email}
        </div>
      </td>
      <td class="doc-badge" style="vertical-align: top; width: 40%;">
        <h1>${labels.docTitle}</h1>
        <p>${labels.docSubtitle}</p>
        <p><strong>${issuedAt}</strong></p>
      </td>
    </tr>
  </table>

  <!-- Status Banner -->
  <div class="status-banner">
    <span class="status-title">${statusText}</span>
    <span class="status-score">${labels.score}: ${evaluation.complianceScorePercent}%</span>
  </div>

  <!-- Metadata Grid -->
  <div class="grid-2">
    <div class="col-half">
      <div class="section-title">${labels.secMission}</div>
      <div class="meta-box">
        <div class="meta-row"><span class="meta-label">${labels.tripId}:</span><span class="meta-value">${trip.tripId}</span></div>
        <div class="meta-row"><span class="meta-label">${labels.cmr}:</span><span class="meta-value">${trip.cmrNumber || 'N/A'}</span></div>
        <div class="meta-row"><span class="meta-label">${labels.route}:</span><span class="meta-value">${trip.routeName || 'International Transport'}</span></div>
        <div class="meta-row"><span class="meta-label">${labels.client}:</span><span class="meta-value">${trip.clientName || 'Export Client'}</span></div>
        <div class="meta-row"><span class="meta-label">${labels.driver}:</span><span class="meta-value">${trip.driverName || 'N/A'}</span></div>
      </div>
    </div>
    <div class="col-half">
      <div class="section-title">${labels.brand}</div>
      <div class="meta-box">
        <div class="meta-row"><span class="meta-label">${labels.truck} / ${labels.trailer}:</span><span class="meta-value">${trip.truckPlate || 'N/A'} / ${trip.trailerPlate || 'Frigo'}</span></div>
        <div class="meta-row"><span class="meta-label">${labels.brand}:</span><span class="meta-value">${profile.coolingUnitBrand}</span></div>
        <div class="meta-row"><span class="meta-label">${labels.atp}:</span><span class="meta-value">Classe ${profile.atpClass.toUpperCase()}</span></div>
        <div class="meta-row"><span class="meta-label">${labels.cargo}:</span><span class="meta-value">${profile.cargoCategory}</span></div>
        <div class="meta-row"><span class="meta-label">${labels.setpoint}:</span><span class="meta-value">${profile.setpointTemp > 0 ? `+${profile.setpointTemp}` : profile.setpointTemp}°C</span></div>
      </div>
    </div>
  </div>

  <!-- Core Thermal KPIs -->
  <div class="section-title">${labels.secKpi}</div>
  <div class="kpi-grid">
    <div class="kpi-cell">
      <div class="kpi-lbl">${labels.mkt}</div>
      <div class="kpi-val" style="color: #059669;">${evaluation.mktTemperatureCelsius > 0 ? `+${evaluation.mktTemperatureCelsius}` : evaluation.mktTemperatureCelsius}°C</div>
    </div>
    <div class="kpi-cell">
      <div class="kpi-lbl">${labels.avgReturn}</div>
      <div class="kpi-val">${evaluation.avgReturnTemp > 0 ? `+${evaluation.avgReturnTemp}` : evaluation.avgReturnTemp}°C</div>
    </div>
    <div class="kpi-cell">
      <div class="kpi-lbl">${labels.avgSupply}</div>
      <div class="kpi-val">${evaluation.avgSupplyTemp > 0 ? `+${evaluation.avgSupplyTemp}` : evaluation.avgSupplyTemp}°C</div>
    </div>
    <div class="kpi-cell">
      <div class="kpi-lbl">${labels.excursionTime}</div>
      <div class="kpi-val" style="color: ${evaluation.totalExcursionMinutes > profile.maxAllowedExcursionMinutes ? '#dc2626' : '#d97706'};">
        ${evaluation.totalExcursionMinutes} min
      </div>
    </div>
  </div>

  <!-- Excursion Incidents -->
  <div class="section-title">${labels.secIncidents}</div>
  ${
    incidents && incidents.length > 0
      ? `<table class="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Gravité</th>
              <th>Début</th>
              <th>Écart Max</th>
              <th>Durée</th>
            </tr>
          </thead>
          <tbody>
            ${incidents
              .slice(0, 5)
              .map(
                (inc) => `<tr>
                  <td>${inc.incidentType}</td>
                  <td><strong>${inc.severity}</strong></td>
                  <td>${new Date(inc.startedAt).toLocaleString()}</td>
                  <td>${inc.peakDeviationTemp}°C</td>
                  <td>${inc.durationMinutes} min</td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>`
      : `<div style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 6px 10px; border-radius: 4px; font-size: 10px; margin-bottom: 10px;">
          ✓ ${labels.noIncidents}
        </div>`
  }

  <!-- DataCOLD Telemetry Log Table (Sample) -->
  <div class="section-title">${labels.secLogs} (${logs.length} enregistrements)</div>
  <table class="data-table">
    <thead>
      <tr>
        <th>${labels.colTime}</th>
        <th>${labels.colSupply}</th>
        <th>${labels.colReturn}</th>
        <th>${labels.colAmbient}</th>
        <th>${labels.colCompressor}</th>
        <th>${labels.colDoor}</th>
        <th>${labels.colBurnRate}</th>
      </tr>
    </thead>
    <tbody>
      ${logs
        .slice(-8)
        .map(
          (l) => `<tr>
            <td style="font-family: monospace;">${new Date(l.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
            <td style="font-weight: 700; color: #0284c7;">${l.supplyAirTemp > 0 ? `+${l.supplyAirTemp}` : l.supplyAirTemp}°C</td>
            <td style="font-weight: 700;">${l.returnAirTemp > 0 ? `+${l.returnAirTemp}` : l.returnAirTemp}°C</td>
            <td>${l.ambientTemp ? `${l.ambientTemp}°C` : '—'}</td>
            <td>${l.compressorStatus}</td>
            <td>${l.doorOpenSensor ? '<span style="color:#dc2626; font-weight:bold;">Ouvert</span>' : '<span style="color:#059669;">Fermé</span>'}</td>
            <td>${l.dieselBurnRateLph ? `${l.dieselBurnRateLph} L/h` : '—'}</td>
          </tr>`
        )
        .join('')}
    </tbody>
  </table>

  <!-- Official Signatures -->
  <div class="section-title">${labels.secSignatures}</div>
  <table class="signatures-table">
    <tr>
      <td class="sig-box" style="width: 50%;">
        <strong>${labels.sigEngineer}</strong><br>
        <span style="font-size: 8.5px;">Visa Technique & Cachet Électronique :</span>
      </td>
      <td style="width: 4%;"></td>
      <td class="sig-box" style="width: 46%;">
        <strong>${labels.sigCustoms}</strong><br>
        <span style="font-size: 8.5px;">Contrôle Frontalier & Dédouanement :</span>
      </td>
    </tr>
  </table>

  <!-- Cryptographic Seal Footer -->
  <div class="hash-footer">
    <div><strong>${labels.secHash}</strong></div>
    <div>${labels.hashNotice}</div>
    <div class="hash-code">HMAC-SHA256: ${verificationHash}</div>
    <div>${labels.scanVerify} <a href="${verificationUrl}" style="color:#0284c7; text-decoration:none;">${verificationUrl}</a></div>
  </div>

</body>
</html>`;
  }
}

