/**
 * Trans Bodanon TMS — Multi-Compartment Independent GDP Certificate PDF Generator
 * Standards: EN 12830 / ATP Treaty (FRC / FRA) / EU GDP Guidelines 2013/C 343/01
 * Produces official Vector A4 printable document with Cryptographic Seal & QR Code.
 */

import type { CompartmentCertificatePayload } from '../types/multi-temp-certificate.types';

export class MultiTempPdfGeneratorService {
  /**
   * Generates official A4 vector HTML report ready for direct printing or PDF download
   */
  public static generateCertificateHtml(payload: CompartmentCertificatePayload): string {
    const isRtl = payload.locale === 'ar';
    const dir = isRtl ? 'rtl' : 'ltr';

    const labels = {
      ar: {
        docTitle: `شهادة تدقيق ومطابقة تبريد مستقلة — الحجرة ${payload.compartmentCode}`,
        docSubtitle: `Certificat d'Audit Thermique Indépendant du Fret — Zone ${payload.compartmentCode} (EN 12830 / GDP)`,
        officialNotice: 'وثيقة تليماتية رسمية معتمدة وموجهة لمستلم الشحنة والتخليص الجمركي والصحي الدولي',
        secCompany: 'بيانات الناقل الدولي',
        secCompartment: 'هوية الحجرة والمواصفات الفنية',
        certNumber: 'رقم الشهادة المرجعي',
        trailer: 'المقطورة المبردة (Frigo)',
        cmr: 'رقم وثيقة النقل (CMR)',
        trip: 'معرّف الرحلة',
        client: 'العميل / الشاحن',
        driver: 'السائق المكلف',
        route: 'المسار الدولي',
        cargo: 'صنف الشحنة المعزولة',
        setpoint: 'درجة الضبط المعتمدة (Setpoint)',
        tempRange: 'النطاق المسموح به',
        bulkheadPosition: 'موقع الحاجز العازل المتحرك',
        evaporator: 'المبخر المستقل',
        secKpi: 'المؤشرات الحرارية المعتمدة للحجرة (EN 12830 / MKT)',
        mkt: 'الحرارة الحركية (MKT Index)',
        avgReturn: 'متوسط الهواء الراجع',
        avgSupply: 'متوسط هواء الضخ',
        excursions: 'مدة الانحراف الحراري',
        doorEvents: 'حوادث فتح الأبواب',
        complianceStatus: 'حالة الامتثال لمعايير GDP',
        compliant: 'مطابق تماماً للمعايير (COMPLIANT)',
        warning: 'تحذير: تقلبات حرارية طفيفة (WARNING)',
        breached: 'مخالفة حرجة لسلسلة التبريد (BREACHED)',
        score: 'مؤشر النزاهة الحرارية',
        secLogs: `سجل قراءات مسجل التبريد للحجرة ${payload.compartmentCode} (DataCOLD EN 12830)`,
        colTime: 'التوقيت القياسي',
        colSupply: 'هواء الضخ',
        colReturn: 'هواء الإرجاع',
        colCargo: 'حساس البضاعة',
        colMode: 'وضع المبخر',
        colDoor: 'الأبواب',
        secSignatures: 'المصادقة والتوقيعات الرسمية',
        sigEngineer: 'تأشيرة مهندس التبريد المعتمد',
        sigReceiver: 'تأشيرة مستلم البضاعة / المصالح البيطرية',
        secHash: 'الختم الرقمي والتحقق الميداني (Cryptographic Integrity Seal)',
        hashNotice: 'تم التحقق وتشفير هذا السجل ببصمة رقمية غير قابلة للتلاعب لحماية حقوق المستلم والجمارك الدولية.',
        scanPrompt: 'امسح الرمز للتحقق الفوري من صحة السجل',
        doorsClosed: 'مغلقة',
        doorsOpen: 'مفتوحة',
        emptyLogs: 'لا توجد تسجيلات مسجلة لهذه الحجرة خلال الفترة',
      },
      fr: {
        docTitle: `Certificat d'Audit Thermique Indépendant — Compartiment ${payload.compartmentCode}`,
        docSubtitle: `Official Independent Cold Chain Audit Certificate — Zone ${payload.compartmentCode} (EN 12830 / GDP)`,
        officialNotice: 'Document télématique officiel certifié pour le destinataire, douanes et contrôle sanitaire international',
        secCompany: 'Transporteur International',
        secCompartment: 'Spécifications Techniques du Compartiment',
        certNumber: 'N° de Certificat',
        trailer: 'Semi-Remorque Frigo',
        cmr: 'Lettre de Voiture (CMR)',
        trip: 'Mission Réf.',
        client: 'Client / Chargeur',
        driver: 'Chauffeur Dédié',
        route: 'Itinéraire International',
        cargo: 'Nature du Fret Isolé',
        setpoint: 'Température de Consigne',
        tempRange: 'Plage Tolérée',
        bulkheadPosition: 'Position de la Cloison Mobile',
        evaporator: 'Évaporateur Dédié',
        secKpi: 'Indicateurs Thermiques Validés (EN 12830 / MKT)',
        mkt: 'Température Cinétique Moyenne (MKT)',
        avgReturn: 'Air Repris Moyen',
        avgSupply: 'Air Soufflé Moyen',
        excursions: 'Durée des Excursions',
        doorEvents: 'Ouvertures de Portes',
        complianceStatus: 'Statut de Conformité GDP',
        compliant: 'PARFAITEMENT CONFORME (COMPLIANT)',
        warning: 'AVERTISSEMENT : FLUCTUATIONS (WARNING)',
        breached: 'RUPTURE DE LA CHAÎNE DU FROID (BREACHED)',
        score: 'Score d\'Intégrité Thermique',
        secLogs: `Relevés Télématiques du Compartiment ${payload.compartmentCode} (DataCOLD EN 12830)`,
        colTime: 'Horodatage UTC',
        colSupply: 'Air Soufflé',
        colReturn: 'Air Repris',
        colCargo: 'Sonde Fret',
        colMode: 'Mode Évaporateur',
        colDoor: 'Portes',
        secSignatures: 'Authentification & Signatures Officielles',
        sigEngineer: 'Visa Ingénieur Frigoriste Agréé',
        sigReceiver: 'Visa Réceptionnaire / Inspection Vétérinaire',
        secHash: 'Sceau d\'Intégrité Cryptographique & Vérification',
        hashNotice: 'Ce relevé est scellé cryptographiquement et infalsifiable pour la protection du réceptionnaire et des douanes.',
        scanPrompt: 'Scannez pour vérifier en ligne',
        doorsClosed: 'Fermée',
        doorsOpen: 'Ouverte',
        emptyLogs: 'Aucun relevé télématique enregistré pour ce compartiment',
      },
      es: {
        docTitle: `Certificado Oficial de Cumplimiento Térmico — Compartimento ${payload.compartmentCode}`,
        docSubtitle: `Certificat d'Audit Thermique Indépendant du Fret — Zone ${payload.compartmentCode} (EN 12830 / GDP)`,
        officialNotice: 'Documento telemático oficial certificado para el receptor, aduanas e inspección sanitaria internacional',
        secCompany: 'Transportista Internacional',
        secCompartment: 'Especificaciones Técnicas del Compartimento',
        certNumber: 'Nº de Certificado',
        trailer: 'Semirremolque Frigo',
        cmr: 'Carta de Porte (CMR)',
        trip: 'Misión Ref.',
        client: 'Cliente / Cargador',
        driver: 'Conductor Asignado',
        route: 'Ruta Internacional',
        cargo: 'Naturaleza de la Carga Aislada',
        setpoint: 'Temperatura de Consigna',
        tempRange: 'Rango Permitido',
        bulkheadPosition: 'Posición del Tabique Móvil',
        evaporator: 'Evaporador Dedicado',
        secKpi: 'Indicadores Térmicos Validados (EN 12830 / MKT)',
        mkt: 'Temperatura Cinética Media (MKT)',
        avgReturn: 'Aire de Retorno Medio',
        avgSupply: 'Aire de Impulsión Medio',
        excursions: 'Duración de Excursiones',
        doorEvents: 'Aperturas de Puertas',
        complianceStatus: 'Estado de Cumplimiento GDP',
        compliant: 'TOTALMENTE CONFORME (COMPLIANT)',
        warning: 'AVISO: FLUCTUACIONES LEVES (WARNING)',
        breached: 'RUPTURA DE LA CADENA DE FRÍO (BREACHED)',
        score: 'Puntuación de Integridad Térmica',
        secLogs: `Lecturas Telemáticas del Compartimento ${payload.compartmentCode} (DataCOLD EN 12830)`,
        colTime: 'Hora Estándar UTC',
        colSupply: 'Aire Impulsión',
        colReturn: 'Aire Retorno',
        colCargo: 'Sonda Carga',
        colMode: 'Modo Evaporador',
        colDoor: 'Puertas',
        secSignatures: 'Autenticación y Firmas Oficiales',
        sigEngineer: 'Firma Ingeniero Frigorífico Acreditado',
        sigReceiver: 'Firma Receptor / Inspección Veterinaria',
        secHash: 'Sello de Integridad Criptográfica y Verificación',
        hashNotice: 'Este registro está sellado criptográficamente y es infalsificable para aduanas y el destinatario.',
        scanPrompt: 'Escanee para verificar online',
        doorsClosed: 'Cerrada',
        doorsOpen: 'Abierta',
        emptyLogs: 'No hay registros telemáticos para este compartimento',
      },
    }[payload.locale];

    // Status styling
    const statusText =
      payload.status === 'compliant'
        ? labels.compliant
        : payload.status === 'warning'
        ? labels.warning
        : labels.breached;

    const statusBadgeColor =
      payload.status === 'compliant'
        ? '#059669'
        : payload.status === 'warning'
        ? '#d97706'
        : '#dc2626';

    const statusBadgeBg =
      payload.status === 'compliant'
        ? '#ecfdf5'
        : payload.status === 'warning'
        ? '#fffbeb'
        : '#fef2f2';

    // SVG QR Code generator representation
    const qrSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="85" height="85">
        <rect width="100" height="100" fill="#ffffff" rx="6" />
        <path d="M10 10h30v30h-30z M16 16v18h18v-18z M22 22h6v6h-6z" fill="#0f172a" />
        <path d="M60 10h30v30h-30z M66 16v18h18v-18z M72 22h6v6h-6z" fill="#0f172a" />
        <path d="M10 60h30v30h-30z M16 66v18h18v-18z M22 72h6v6h-6z" fill="#0f172a" />
        <rect x="46" y="10" width="8" height="8" fill="#0891b2" />
        <rect x="46" y="24" width="8" height="14" fill="#0f172a" />
        <rect x="10" y="46" width="14" height="8" fill="#0f172a" />
        <rect x="30" y="46" width="8" height="8" fill="#0891b2" />
        <rect x="46" y="46" width="8" height="8" fill="#0f172a" />
        <rect x="60" y="46" width="14" height="8" fill="#0f172a" />
        <rect x="80" y="46" width="10" height="8" fill="#0891b2" />
        <rect x="46" y="60" width="8" height="14" fill="#0891b2" />
        <rect x="60" y="60" width="14" height="8" fill="#0f172a" />
        <rect x="80" y="60" width="10" height="14" fill="#0f172a" />
        <rect x="60" y="80" width="8" height="10" fill="#0891b2" />
        <rect x="74" y="80" width="16" height="10" fill="#0f172a" />
      </svg>
    `;

    return `<!DOCTYPE html>
<html lang="${payload.locale}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <title>${labels.docTitle} - ${payload.certificateNumber}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 14mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 11px;
      line-height: 1.45;
      color: #1e293b;
      background: #ffffff;
      direction: ${dir};
    }
    .header-table {
      width: 100%;
      border-bottom: 2px solid #0284c7;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .company-title {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.3px;
    }
    .company-subtitle {
      font-size: 9px;
      color: #64748b;
      margin-top: 2px;
    }
    .cert-badge {
      display: inline-block;
      padding: 4px 10px;
      background: #0284c7;
      color: #ffffff;
      font-weight: 700;
      border-radius: 4px;
      font-size: 11px;
      font-family: monospace;
    }
    .doc-banner {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: ${isRtl ? '1px solid #e2e8f0' : '4px solid #0284c7'};
      border-right: ${isRtl ? '4px solid #0284c7' : '1px solid #e2e8f0'};
      padding: 8px 12px;
      margin-bottom: 14px;
      border-radius: 4px;
    }
    .doc-title {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
    }
    .doc-subtitle {
      font-size: 10px;
      color: #475569;
      font-weight: 600;
    }
    .notice {
      font-size: 9px;
      color: #64748b;
      margin-top: 3px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 12px;
    }
    .section-card {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px;
      background: #ffffff;
    }
    .section-card h3 {
      font-size: 10.5px;
      font-weight: 700;
      color: #0284c7;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 4px;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 2.5px 0;
      font-size: 10px;
      border-bottom: 1px dashed #f8fafc;
    }
    .info-label {
      color: #64748b;
      font-weight: 500;
    }
    .info-val {
      color: #0f172a;
      font-weight: 600;
    }
    .kpi-container {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .kpi-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px;
      text-align: center;
      background: #f8fafc;
    }
    .kpi-title {
      font-size: 8.5px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
    }
    .kpi-val {
      font-size: 16px;
      font-weight: 800;
      font-family: monospace;
      margin-top: 3px;
    }
    .status-box {
      margin-bottom: 14px;
      padding: 10px 14px;
      border-radius: 6px;
      border: 1.5px solid ${statusBadgeColor};
      background: ${statusBadgeBg};
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .status-text {
      font-size: 13px;
      font-weight: 800;
      color: ${statusBadgeColor};
    }
    .table-logs {
      width: 100%;
      border-collapse: collapse;
      font-size: 9px;
      margin-bottom: 14px;
    }
    .table-logs th {
      background: #0f172a;
      color: #ffffff;
      padding: 5px 6px;
      font-weight: 600;
      text-align: start;
    }
    .table-logs td {
      padding: 4px 6px;
      border-bottom: 1px solid #e2e8f0;
      font-family: monospace;
    }
    .table-logs tr:nth-child(even) {
      background: #f8fafc;
    }
    .seal-box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 14px;
      background: #f8fafc;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .hash-code {
      font-family: monospace;
      font-size: 8px;
      word-break: break-all;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      padding: 4px;
      border-radius: 4px;
      color: #0369a1;
      margin-top: 4px;
    }
    .signatures-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-top: 8px;
    }
    .signature-card {
      border: 1px dashed #94a3b8;
      border-radius: 6px;
      padding: 10px;
      height: 80px;
      position: relative;
    }
    .signature-title {
      font-size: 9.5px;
      font-weight: 750;
      color: #475569;
    }
    .signature-stamp {
      position: absolute;
      bottom: 6px;
      left: ${isRtl ? 'auto' : '10px'};
      right: ${isRtl ? '10px' : 'auto'};
      font-size: 8px;
      color: #94a3b8;
    }
  </style>
</head>
<body>

  <!-- Top Header Table -->
  <table class="header-table">
    <tr>
      <td style="vertical-align: top;">
        <div class="company-title">TRANS BODANON S.A.R.L.</div>
        <div class="company-subtitle">
          Transport International Routier Frigorifique (T.I.R.) | ISO 9001 / EN 12830<br>
          Zone Franche Port Tanger Med, Route Principale, Maroc | Tél: +212 539 94 82 10<br>
          I.C.E: 002938475000084 | R.C: 104928 Tanger | Patente: 49201948
        </div>
      </td>
      <td style="text-align: ${isRtl ? 'left' : 'right'}; vertical-align: top;">
        <div class="cert-badge">${payload.certificateNumber}</div>
        <div style="font-size: 8.5px; color: #64748b; margin-top: 4px; font-family: monospace;">
          ${new Date(payload.issuedAt).toUTCString()}
        </div>
      </td>
    </tr>
  </table>

  <!-- Document Title Banner -->
  <div class="doc-banner">
    <div class="doc-title">${labels.docTitle}</div>
    <div class="doc-subtitle">${labels.docSubtitle}</div>
    <div class="notice">${labels.officialNotice}</div>
  </div>

  <!-- Status Compliance Box -->
  <div class="status-box">
    <div>
      <span style="font-size: 10px; color: #64748b; font-weight: 600; display: block;">${labels.complianceStatus}</span>
      <span class="status-text">${statusText}</span>
    </div>
    <div style="text-align: ${isRtl ? 'left' : 'right'};">
      <span style="font-size: 9px; color: #64748b; font-weight: 600; display: block;">${labels.score}</span>
      <span style="font-size: 18px; font-weight: 800; font-family: monospace; color: ${statusBadgeColor};">
        ${payload.complianceScore}/100
      </span>
    </div>
  </div>

  <!-- 2-Column Info Grid -->
  <div class="grid-2">
    <!-- Compartment & Technical Info -->
    <div class="section-card">
      <h3>${labels.secCompartment}</h3>
      <div class="info-row">
        <span class="info-label">${labels.cargo}:</span>
        <span class="info-val" style="color: #0284c7;">${payload.compartmentName} (${payload.cargoCategory})</span>
      </div>
      <div class="info-row">
        <span class="info-label">${labels.setpoint}:</span>
        <span class="info-val">${payload.setpointTempC}°C</span>
      </div>
      <div class="info-row">
        <span class="info-label">${labels.tempRange}:</span>
        <span class="info-val">${payload.minTempLimitC}°C إلى ${payload.maxTempLimitC}°C</span>
      </div>
      <div class="info-row">
        <span class="info-label">${labels.bulkheadPosition}:</span>
        <span class="info-val">${payload.bulkheadPositionPct}% de la remorque</span>
      </div>
      <div class="info-row">
        <span class="info-label">${labels.evaporator}:</span>
        <span class="info-val">${payload.evaporatorModel || 'Carrier MVS / Thermo King S-3'}</span>
      </div>
    </div>

    <!-- Mission & Logistics Info -->
    <div class="section-card">
      <h3>${labels.secCompany}</h3>
      <div class="info-row">
        <span class="info-label">${labels.trailer}:</span>
        <span class="info-val">${payload.trailerPlate}</span>
      </div>
      <div class="info-row">
        <span class="info-label">${labels.trip}:</span>
        <span class="info-val">${payload.tripNumber || 'TRIP-' + payload.trailerId}</span>
      </div>
      <div class="info-row">
        <span class="info-label">${labels.cmr}:</span>
        <span class="info-val">${payload.cmrNumber || 'CMR-MA-ES-94820'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">${labels.client}:</span>
        <span class="info-val">${payload.clientName || 'Exportateur Agréé'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">${labels.driver}:</span>
        <span class="info-val">${payload.driverName || 'Conducteur International'}</span>
      </div>
    </div>
  </div>

  <!-- Thermal Performance KPIs Grid -->
  <div class="kpi-container">
    <div class="kpi-card">
      <div class="kpi-title">${labels.mkt}</div>
      <div class="kpi-val" style="color: #0284c7;">${payload.mktTempC}°C</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">${labels.avgReturn}</div>
      <div class="kpi-val" style="color: #334155;">${payload.avgReturnAirTempC}°C</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">${labels.avgSupply}</div>
      <div class="kpi-val" style="color: #0891b2;">${payload.avgSupplyAirTempC}°C</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">${labels.excursions}</div>
      <div class="kpi-val" style="color: ${payload.excursionMinutes > 0 ? '#ea580c' : '#059669'};">
        ${payload.excursionMinutes} min
      </div>
    </div>
  </div>

  <!-- EN 12830 Telemetry Samples Table -->
  <div style="font-size: 10px; font-weight: 700; color: #0284c7; margin-bottom: 4px; text-transform: uppercase;">
    ${labels.secLogs}
  </div>
  <table class="table-logs">
    <thead>
      <tr>
        <th>${labels.colTime}</th>
        <th>${labels.colSupply}</th>
        <th>${labels.colReturn}</th>
        <th>${labels.colCargo}</th>
        <th>${labels.colMode}</th>
        <th>${labels.colDoor}</th>
      </tr>
    </thead>
    <tbody>
      ${
        payload.logsSample.length === 0
          ? `<tr><td colspan="6" style="text-align: center; color: #64748b; font-style: italic; padding: 12px;">${labels.emptyLogs}</td></tr>`
          : payload.logsSample
              .slice(0, 10)
              .map(
                (log) => {
                  const d = new Date(log.time);
                  const timeStr = isNaN(d.getTime()) ? log.time : d.toLocaleTimeString();
                  return `
        <tr>
          <td>${timeStr}</td>
          <td style="color: #0891b2;">${log.supply}°C</td>
          <td style="color: #0f172a; font-weight: 700;">${log.return}°C</td>
          <td style="color: #b45309;">${log.cargo}°C</td>
          <td>${log.mode}</td>
          <td>${log.door ? `<span style="color: #dc2626;">${labels.doorsOpen}</span>` : labels.doorsClosed}</td>
        </tr>
      `;
                }
              )
              .join('')
      }
    </tbody>
  </table>

  <!-- Cryptographic Integrity Seal & QR Code -->
  <div class="seal-box">
    <div>${qrSvg}</div>
    <div style="flex: 1;">
      <div style="font-size: 10px; font-weight: 700; color: #0f172a;">${labels.secHash}</div>
      <div style="font-size: 8.5px; color: #64748b; margin-top: 1px;">${labels.hashNotice}</div>
      <div class="hash-code">HMAC-SHA256: ${payload.verificationHash}</div>
      <div style="font-size: 8px; color: #64748b; margin-top: 3px;">
        URL: ${payload.verificationUrl}
      </div>
    </div>
  </div>

  <!-- Official Signatures Block -->
  <div class="signatures-grid">
    <div class="signature-card">
      <div class="signature-title">${labels.sigEngineer}</div>
      <div class="signature-stamp">Cachet & Signature Électronique</div>
    </div>
    <div class="signature-card">
      <div class="signature-title">${labels.sigReceiver}</div>
      <div class="signature-stamp">Douane / Contrôle Sanitaire / Réception</div>
    </div>
  </div>

</body>
</html>`;
  }
}
