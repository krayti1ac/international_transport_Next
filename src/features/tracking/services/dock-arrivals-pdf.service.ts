/**
 * Trans Bodanon TMS — Monthly Dock Arrivals & Compliance PDF Generator Service
 * Standards: EN 12830 / ATP Treaty (FRC / FRA) / EU GDP Guidelines 2013/C 343/01
 * Produces an official A4 printable vector report with Cryptographic Seal & QR Code.
 */

import Decimal from 'decimal.js';
import type { MonthlyDockReportContext } from '../types/dock-export.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export class DockArrivalsPdfService {
  /**
   * Generates official A4 vector HTML report ready for direct printing or PDF export
   */
  public static generateMonthlyReportHtml(
    context: MonthlyDockReportContext,
    qrDataUrl?: string
  ): string {
    const { company, filter, summary, arrivals, verificationHash, verificationUrl, generatedAt, locale } = context;

    const isRtl = locale === 'ar';
    const dir = isRtl ? 'rtl' : 'ltr';

    const labels = {
      ar: {
        docTitle: 'التقرير الشهري لحركة وصول الأرصفة وبث شهادات التبريد',
        docSubtitle: 'Rapport Mensuel des Arrivages aux Quais & Conformité Télématisée (EN 12830 / GDP)',
        officialNotice: 'وثيقة تليماتية رسمية معتمدة وموجهة لمديري سلاسل التبريد والتخليص الجمركي والصحي الدولي',
        secCompany: 'بيانات الشركة الناقلة والاعتماد',
        secPeriod: 'فترة التقرير والبيانات الإحصائية',
        companyName: 'الشركة الناقلة',
        ice: 'رقم التعريف الموحد (ICE)',
        period: 'الفترة المحاسبية',
        generatedAt: 'تاريخ وتوقيت الإصدار',
        atpLicense: 'رقم ترخيص النقل المبرد الدولي (ATP)',
        kpiTitle: 'المؤشرات التشغيلية والحرارية الكلية',
        totalArrivals: 'إجمالي وصول الأرصفة',
        totalDispatches: 'الشهادات المبثوثة',
        successRate: 'نسبة نجاح البث',
        complianceRate: 'نسبة الامتثال GDP',
        avgMkt: 'متوسط الحرارة الحركية (MKT)',
        topDocksTitle: 'الأرصفة الأكثر نشاطاً',
        compBreakdownTitle: 'مطابقة الحجرات المستقلة (Multi-Temp)',
        secTableTitle: 'السجل الزمني المفصل لوصول الشاحنات وبث الرسائل',
        colTime: 'التوقيت',
        colTruck: 'الشاحنة',
        colTrip: 'الرحلة / CMR',
        colDock: 'الرصيف / المستودع',
        colReceiver: 'مستلم الشحنة',
        colPhone: 'الهاتف',
        colComp: 'الحجرة',
        colStatus: 'حالة البث',
        colCold: 'الامتثال',
        colMkt: 'MKT',
        compliant: 'مطابق',
        warning: 'تحذير',
        breached: 'مخالف',
        delivered: 'مستلم',
        sent: 'مرسل',
        simulated: 'تجريبي 🧪',
        skipped: 'محمي بالتهدئة',
        failed: 'فشل',
        secSignatures: 'المصادقة والتوقيعات الرسمية',
        sigOperations: 'تأشيرة مدير عمليات الأسطول والتتبع',
        sigQuality: 'تأشيرة مدير الجودة وسلاسل التبريد (GDP)',
        secHash: 'الختم الرقمي والتأمين التشفيري (Cryptographic Integrity Seal)',
        hashNotice: 'تم توثيق وتشفير هذا التقرير ببصمة رقمية HMAC-SHA256 تمنع أي تلاعب وتتيح التحقق الدولي الفوري.',
        scanPrompt: 'امسح الرمز للتحقق الفوري من صحة السجل',
      },
      fr: {
        docTitle: 'Rapport Mensuel des Arrivages aux Quais & Conformité Télématisée',
        docSubtitle: 'Monthly Dock Arrivals & Cold Chain Telematics Compliance Report (EN 12830 / GDP)',
        officialNotice: 'Document officiel certifié pour la direction qualité, audits logistiques et contrôles vétérinaires',
        secCompany: 'Transporteur Officiel & Agréments',
        secPeriod: 'Période du Rapport & Données',
        companyName: 'Transporteur',
        ice: 'Identifiant ICE',
        period: 'Période Comptable',
        generatedAt: 'Date et Heure d\'Émission',
        atpLicense: 'Agrément ATP / FRC International',
        kpiTitle: 'Indicateurs Globaux de Performance & Chaîne du Froid',
        totalArrivals: 'Arrivages aux Quais',
        totalDispatches: 'Certificats Diffusés',
        successRate: 'Succès Diffusion',
        complianceRate: 'Conformité GDP',
        avgMkt: 'Température MKT Moy.',
        topDocksTitle: 'Quais les Plus Actifs',
        compBreakdownTitle: 'Conformité par Compartiment (Multi-Temp)',
        secTableTitle: 'Journal Chronologique Détaillé des Arrivages aux Quais',
        colTime: 'Heure',
        colTruck: 'Camion',
        colTrip: 'Voyage / CMR',
        colDock: 'Quai / Plateforme',
        colReceiver: 'Destinataire',
        colPhone: 'Téléphone',
        colComp: 'Zone',
        colStatus: 'Diffusion',
        colCold: 'Froid',
        colMkt: 'MKT',
        compliant: 'Conforme',
        warning: 'Avertissement',
        breached: 'Non-Conforme',
        delivered: 'Livré',
        sent: 'Envoyé',
        simulated: 'Simulé 🧪',
        skipped: 'Temporisé',
        failed: 'Échoué',
        secSignatures: 'Validations & Signatures Officielles',
        sigOperations: 'Directeur des Opérations & Flotte',
        sigQuality: 'Responsable Qualité & GDP Chaîne du Froid',
        secHash: 'Sceau d\'Intégrité Numérique HMAC-SHA256',
        hashNotice: 'Rapport certifié et sécurisé par empreinte cryptographique HMAC-SHA256 contre toute altération.',
        scanPrompt: 'Scannez pour vérifier l\'authenticité en ligne',
      },
      es: {
        docTitle: 'Informe Mensual de Llegadas a Muelles y Cumplimiento Telemático',
        docSubtitle: 'Monthly Dock Arrivals & Cold Chain Telematics Compliance Report (EN 12830 / GDP)',
        officialNotice: 'Documento oficial certificado para la dirección de calidad, auditorías y controles fitosanitarios',
        secCompany: 'Transportista Oficial y Acreditaciones',
        secPeriod: 'Período del Informe y Datos',
        companyName: 'Transportista',
        ice: 'Identificador ICE',
        period: 'Período Contable',
        generatedAt: 'Fecha y Hora de Emisión',
        atpLicense: 'Licencia ATP / FRC Internacional',
        kpiTitle: 'Indicadores Globales de Rendimiento y Cadena de Frío',
        totalArrivals: 'Llegadas a Muelles',
        totalDispatches: 'Certificados Transmitidos',
        successRate: 'Éxito Difusión',
        complianceRate: 'Cumplimiento GDP',
        avgMkt: 'Temp. MKT Media',
        topDocksTitle: 'Muelles Más Concurridos',
        compBreakdownTitle: 'Cumplimiento por Compartimento (Multi-Temp)',
        secTableTitle: 'Registro Cronológico Detallado de Llegadas y Despacho',
        colTime: 'Hora',
        colTruck: 'Camión',
        colTrip: 'Viaje / CMR',
        colDock: 'Muelle / Sitio',
        colReceiver: 'Destinatario',
        colPhone: 'Teléfono',
        colComp: 'Zona',
        colStatus: 'Despacho',
        colCold: 'Frío',
        colMkt: 'MKT',
        compliant: 'Conforme',
        warning: 'Advertencia',
        breached: 'No Conforme',
        delivered: 'Entregado',
        sent: 'Enviado',
        simulated: 'Simulado 🧪',
        skipped: 'Cooldown',
        failed: 'Fallido',
        secSignatures: 'Validaciones y Firmas Oficiales',
        sigOperations: 'Director de Operaciones y Flota',
        sigQuality: 'Responsable de Calidad y Cadena de Frío (GDP)',
        secHash: 'Sello de Integridad Digital HMAC-SHA256',
        hashNotice: 'Informe certificado y asegurado con huella criptográfica HMAC-SHA256 para verificación internacional.',
        scanPrompt: 'Escanee para verificar autenticidad en línea',
      },
    }[locale];

    return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <title>${labels.docTitle} - ${summary.reportPeriodName}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 10px;
      font-size: 11px;
      line-height: 1.4;
      direction: ${dir};
    }
    .header-table {
      width: 100%;
      border-bottom: 2px solid #0f766e;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .brand-title {
      font-size: 18px;
      font-weight: 800;
      color: #0f766e;
      letter-spacing: -0.5px;
    }
    .brand-subtitle {
      font-size: 10px;
      color: #475569;
      font-weight: 500;
    }
    .notice-badge {
      display: inline-block;
      background: #f0fdfa;
      color: #0d9488;
      border: 1px solid #99f6e4;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 600;
      margin-top: 4px;
    }
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 10px;
      text-align: ${isRtl ? 'left' : 'right'};
    }
    .meta-row {
      margin-bottom: 3px;
    }
    .meta-label {
      color: #64748b;
      font-weight: 600;
    }
    .meta-val {
      color: #0f172a;
      font-weight: 700;
    }

    /* Bento KPI Grid */
    .kpi-grid {
      display: table;
      width: 100%;
      margin-bottom: 14px;
    }
    .kpi-cell {
      display: table-cell;
      width: 25%;
      padding: 4px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px;
      text-align: center;
    }
    .kpi-val {
      font-size: 20px;
      font-weight: 800;
      color: #0f766e;
      font-family: monospace;
    }
    .kpi-title {
      font-size: 9px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      margin-top: 2px;
    }

    /* Section Split */
    .split-table {
      width: 100%;
      margin-bottom: 14px;
    }
    .split-col {
      width: 50%;
      vertical-align: top;
      padding: 0 4px;
    }
    .box-container {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      overflow: hidden;
    }
    .box-title {
      background: #f1f5f9;
      padding: 6px 10px;
      font-size: 10px;
      font-weight: 700;
      color: #1e293b;
      border-bottom: 1px solid #e2e8f0;
    }

    /* Data Tables */
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    table.data-table th {
      background: #0f766e;
      color: #ffffff;
      font-weight: 700;
      padding: 6px 8px;
      text-align: ${isRtl ? 'right' : 'left'};
      border: 1px solid #0d9488;
      font-size: 9px;
    }
    table.data-table td {
      padding: 5px 8px;
      border: 1px solid #e2e8f0;
      color: #1e293b;
    }
    table.data-table tr:nth-child(even) {
      background: #f8fafc;
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 8px;
      font-weight: 700;
      text-align: center;
    }
    .badge-delivered { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .badge-protected { background: #f3e8ff; color: #6b21a8; border: 1px solid #d8b4fe; }
    .badge-warning { background: #fef3c7; color: #b45309; border: 1px solid #fcd34d; }
    .badge-failed { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }

    /* Footer & Seal */
    .seal-box {
      margin-top: 14px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #f8fafc;
      padding: 10px;
      display: table;
      width: 100%;
    }
    .seal-left {
      display: table-cell;
      vertical-align: middle;
      padding: 4px;
    }
    .seal-right {
      display: table-cell;
      width: 120px;
      text-align: center;
      vertical-align: middle;
    }
    .hash-text {
      font-family: monospace;
      font-size: 9px;
      color: #0f766e;
      word-break: break-all;
      font-weight: 700;
      margin-top: 2px;
    }

    .sig-table {
      width: 100%;
      margin-top: 14px;
    }
    .sig-cell {
      width: 50%;
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      padding: 10px;
      height: 70px;
      vertical-align: top;
      background: #ffffff;
    }

    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <table class="header-table">
    <tr>
      <td style="vertical-align: middle;">
        <div class="brand-title">Trans Bodanon Transport & Logistique S.A.R.L.</div>
        <div class="brand-subtitle">${labels.docTitle} — ${labels.docSubtitle}</div>
        <div class="notice-badge">⚡ ${labels.officialNotice}</div>
      </td>
      <td style="width: 280px; vertical-align: middle;">
        <div class="meta-box">
          <div class="meta-row"><span class="meta-label">${labels.period}:</span> <span class="meta-val">${summary.reportPeriodName}</span></div>
          <div class="meta-row"><span class="meta-label">${labels.ice}:</span> <span class="meta-val">${company.ice || '002938475000084'}</span></div>
          <div class="meta-row"><span class="meta-label">${labels.atpLicense}:</span> <span class="meta-val">${company.licenseAtp || 'FRC-MA-2026-9941'}</span></div>
          <div class="meta-row"><span class="meta-label">${labels.generatedAt}:</span> <span class="meta-val">${new Date(generatedAt).toLocaleString('fr-FR')}</span></div>
        </div>
      </td>
    </tr>
  </table>

  <!-- Bento KPI Grid -->
  <div class="kpi-grid">
    <div class="kpi-cell">
      <div class="kpi-card">
        <div class="kpi-val">${summary.totalArrivals}</div>
        <div class="kpi-title">${labels.totalArrivals}</div>
      </div>
    </div>
    <div class="kpi-cell">
      <div class="kpi-card">
        <div class="kpi-val">${summary.successfulDispatches}</div>
        <div class="kpi-title">${labels.totalDispatches} (WhatsApp)</div>
      </div>
    </div>
    <div class="kpi-cell">
      <div class="kpi-card">
        <div class="kpi-val">${summary.overallComplianceRatePct}%</div>
        <div class="kpi-title">${labels.complianceRate}</div>
      </div>
    </div>
    <div class="kpi-cell">
      <div class="kpi-card">
        <div class="kpi-val">${summary.avgMktTempC}°C</div>
        <div class="kpi-title">${labels.avgMkt}</div>
      </div>
    </div>
  </div>

  <!-- Split Summary: Top Docks & Compartments -->
  <table class="split-table">
    <tr>
      <td class="split-col">
        <div class="box-container">
          <div class="box-title">📍 ${labels.topDocksTitle}</div>
          <table class="data-table">
            <thead>
              <tr>
                <th>${labels.colDock}</th>
                <th style="width: 70px; text-align: center;">${labels.totalArrivals}</th>
                <th style="width: 70px; text-align: center;">%</th>
              </tr>
            </thead>
            <tbody>
              ${summary.topDocks.slice(0, 4).map((d) => `
                <tr>
                  <td>${d.zoneName}</td>
                  <td style="text-align: center; font-weight: 700;">${d.count}</td>
                  <td style="text-align: center;">${new Decimal(d.count).dividedBy(summary.totalArrivals || 1).times(100).toFixed(1)}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </td>
      <td class="split-col">
        <div class="box-container">
          <div class="box-title">❄️ ${labels.compBreakdownTitle}</div>
          <table class="data-table">
            <thead>
              <tr>
                <th>${labels.colComp}</th>
                <th>الصنف</th>
                <th style="text-align: center;">MKT</th>
                <th style="text-align: center;">الامتثال</th>
              </tr>
            </thead>
            <tbody>
              ${['C1', 'C2', 'C3'].map((code) => {
                const comp = summary.compartmentsBreakdown[code as 'C1' | 'C2' | 'C3'];
                if (!comp) return '';
                return `
                  <tr>
                    <td><strong>${comp.code}</strong> (${comp.name})</td>
                    <td>${comp.category}</td>
                    <td style="text-align: center; font-family: monospace;">${comp.avgMktTempC}°C</td>
                    <td style="text-align: center;"><span class="badge badge-delivered">${comp.complianceRatePct}%</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  </table>

  <!-- Detailed Arrivals Table -->
  <div class="box-container" style="margin-bottom: 12px;">
    <div class="box-title">📋 ${labels.secTableTitle} (${arrivals.length} ${labels.totalArrivals})</div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 70px;">${labels.colTime}</th>
          <th style="width: 80px;">${labels.colTruck}</th>
          <th style="width: 90px;">${labels.colTrip}</th>
          <th>${labels.colDock}</th>
          <th>${labels.colReceiver}</th>
          <th style="width: 90px;">${labels.colPhone}</th>
          <th style="width: 45px; text-align: center;">${labels.colComp}</th>
          <th style="width: 60px; text-align: center;">${labels.colMkt}</th>
          <th style="width: 70px; text-align: center;">${labels.colCold}</th>
          <th style="width: 80px; text-align: center;">${labels.colStatus}</th>
        </tr>
      </thead>
      <tbody>
        ${arrivals.slice(0, 25).map((item) => `
          <tr>
            <td style="font-size: 9px;">${new Date(item.arrivedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
            <td><strong>${item.truckPlate}</strong></td>
            <td style="font-size: 9px;">${item.tripNumber}</td>
            <td>${item.zoneName}</td>
            <td>${item.receiverName}</td>
            <td style="font-family: monospace; font-size: 9px;" dir="ltr">${item.receiverPhone}</td>
            <td style="text-align: center;"><strong>${item.compartmentCode}</strong></td>
            <td style="text-align: center; font-family: monospace;">${item.mktTempC !== undefined ? `${item.mktTempC.toFixed(1)}°C` : '-'}</td>
            <td style="text-align: center;">
              <span class="badge ${item.status === 'compliant' ? 'badge-delivered' : item.status === 'warning' ? 'badge-warning' : 'badge-failed'}">
                ${item.status === 'compliant' ? labels.compliant : item.status === 'warning' ? labels.warning : labels.breached}
              </span>
            </td>
            <td style="text-align: center;">
              <span class="badge ${item.dispatchStatus === 'delivered' ? 'badge-delivered' : item.dispatchStatus === 'cooldown_skipped' ? 'badge-protected' : 'badge-warning'}">
                ${item.dispatchStatus === 'delivered' ? labels.delivered : item.dispatchStatus === 'cooldown_skipped' ? labels.skipped : labels.sent}
              </span>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <!-- Signatures Block -->
  <table class="sig-table">
    <tr>
      <td class="sig-cell">
        <div style="font-weight: 700; color: #475569; font-size: 9px; text-transform: uppercase;">${labels.sigOperations}</div>
        <div style="margin-top: 30px; font-size: 9px; color: #94a3b8;">Signature & Cachet Électronique</div>
      </td>
      <td class="sig-cell">
        <div style="font-weight: 700; color: #475569; font-size: 9px; text-transform: uppercase;">${labels.sigQuality}</div>
        <div style="margin-top: 30px; font-size: 9px; color: #94a3b8;">Visa Qualité EN 12830 / Traité ATP</div>
      </td>
    </tr>
  </table>

  <!-- Cryptographic Integrity Seal & QR -->
  <div class="seal-box">
    <div class="seal-left">
      <div style="font-weight: 800; font-size: 10px; color: #0f766e;">🔒 ${labels.secHash}</div>
      <div class="hash-text">SHA256: ${verificationHash}</div>
      <div style="font-size: 9px; color: #64748b; margin-top: 4px;">${labels.hashNotice}</div>
      <div style="font-size: 9px; color: #0f766e; margin-top: 2px;">🌐 URL: ${verificationUrl}</div>
    </div>
    <div class="seal-right">
      ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR Seal" style="width: 75px; height: 75px; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px; background: #fff;" />` : ''}
      <div style="font-size: 8px; color: #64748b; margin-top: 2px;">${labels.scanPrompt}</div>
    </div>
  </div>
</body>
</html>`;
  }
}

