/**
 * Trans Bodanon TMS — Monthly Dock Arrivals Excel Exporter Service
 * Generates an official multi-sheet Microsoft Excel Spreadsheet (XML-based)
 * Worksheets:
 * 1. Synthèse_Mensuelle (Executive KPI & Docks Distribution)
 * 2. Détail_Arrivages_Docks (Detailed Log of Arrivals & WhatsApp Dispatches)
 * 3. Audit_Chaine_Froid (Cold Chain Compliance & MKT Evaluation)
 * Enforces Decimal.js for all percentage and thermal averages.
 */

import Decimal from 'decimal.js';
import type { MonthlyDockReportContext } from '../types/dock-export.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export class DockArrivalsExcelService {
  /**
   * Generates a multi-sheet Microsoft Excel XML document string
   */
  public static generateMonthlyExcel(context: MonthlyDockReportContext): string {
    const { company, filter, summary, arrivals, verificationHash, verificationUrl, generatedAt, locale } = context;

    const isRtl = locale === 'ar';

    // Trilingual Labels
    const labels = {
      ar: {
        sheetSummary: 'Synthèse_Mensuelle',
        sheetDetail: 'Détail_Arrivages_Docks',
        sheetAudit: 'Audit_Chaine_Froid',
        title: 'التقرير الشهري لحركة وصول الأرصفة وبث شهادات التبريد',
        period: 'الفترة المحاسبية',
        company: 'الشركة الناقلة',
        ice: 'رقم التعريف الموحد (ICE)',
        generatedAt: 'تاريخ وتوقيت الإصدار',
        kpiTitle: 'مؤشرات الأداء التشغيلية ومطابقة درجات الحرارة',
        totalArrivals: 'إجمالي عمليات الوصول للأرصفة',
        totalDispatches: 'إجمالي الشهادات المبثوثة للمستلمين',
        successfulDispatches: 'التسليمات المؤكدة عبر WhatsApp',
        cooldownProtected: 'العمليات المحمية برادار التهدئة',
        successRate: 'نسبة نجاح البث والتسليم',
        complianceRate: 'نسبة الامتثال لمعايير التبريد GDP',
        avgMkt: 'متوسط الحرارة الحركية (MKT)',
        topDocksTitle: 'توزيع الأرصفة الأكثر نشاطاً',
        dockName: 'اسم الرصيف / المستودع',
        arrivalCount: 'عدد عمليات الوصول',
        sharePct: 'النسبة المئوية',
        compBreakdownTitle: 'مطابقة الحجرات المبردة المستقلة (Multi-Temp)',
        compCode: 'رمز الحجرة',
        compName: 'تسمية الحجرة',
        category: 'صنف البضاعة',
        compliant: 'مطابق',
        warning: 'تحذير',
        breached: 'مخالف',
        // Table Columns
        colIndex: 'الرقم',
        colTime: 'توقيت الوصول',
        colTruck: 'رقم الشاحنة',
        colTrailer: 'المقطورة',
        colTrip: 'رقم الرحلة',
        colCmr: 'وثيقة CMR',
        colDock: 'الرصيف / المستودع',
        colReceiver: 'مستلم الشحنة',
        colPhone: 'هاتف المستلم',
        colComp: 'الحجرة',
        colStatus: 'حالة التسليم',
        colColdStatus: 'حالة التبريد',
        colMkt: 'MKT (°C)',
        colCooldown: 'حالة التهدئة',
        colMessageId: 'معرّف الرسالة',
        colHash: 'البصمة الرقمية للشهادة',
        activeCooldown: 'نشط (محمي)',
        readyCooldown: 'متاح للإرسال',
        delivered: 'تم التسليم',
        sent: 'مرسل',
        simulated: 'تجريبي 🧪',
        skipped: 'تخطي (تهدئة)',
        failed: 'فشل الإرسال',
        integrityTitle: 'الختم الرقمي والتأمين الجمركي (HMAC-SHA256)',
        hashNotice: 'وثيقة رسمية معتمدة وفق معايير EN 12830 وميثاق النقل الدولي ATP.',
      },
      fr: {
        sheetSummary: 'Synthèse_Mensuelle',
        sheetDetail: 'Détail_Arrivages_Docks',
        sheetAudit: 'Audit_Chaine_Froid',
        title: 'Rapport Mensuel des Arrivages aux Quais & Envois Télématiques',
        period: 'Période Comptable',
        company: 'Transporteur Officiel',
        ice: 'Identifiant Commun de l\'Entreprise (ICE)',
        generatedAt: 'Date et Heure d\'Émission',
        kpiTitle: 'Indicateurs de Performance & Conformité Chaîne du Froid',
        totalArrivals: 'Total des Arrivages aux Quais',
        totalDispatches: 'Total des Certificats Diffusés',
        successfulDispatches: 'Livraisons WhatsApp Confirmées',
        cooldownProtected: 'Opérations Protégées par Temporisation',
        successRate: 'Taux de Succès de Diffusion',
        complianceRate: 'Taux de Conformité GDP / EN 12830',
        avgMkt: 'Température Cinétique Moyenne (MKT)',
        topDocksTitle: 'Distribution des Quais les Plus Fréquentés',
        dockName: 'Quai / Plateforme Logistique',
        arrivalCount: 'Nombre d\'Arrivages',
        sharePct: 'Part (%)',
        compBreakdownTitle: 'Conformité des Compartiments Indépendants (Multi-Temp)',
        compCode: 'Code Compartiment',
        compName: 'Désignation',
        category: 'Catégorie Fret',
        compliant: 'Conforme',
        warning: 'Avertissement',
        breached: 'Non-Conforme',
        colIndex: 'N°',
        colTime: 'Heure d\'Arrivée',
        colTruck: 'Immatriculation Camion',
        colTrailer: 'Remorque Frigo',
        colTrip: 'N° Mission',
        colCmr: 'Lettre de Voiture (CMR)',
        colDock: 'Quai / Site',
        colReceiver: 'Destinataire',
        colPhone: 'Téléphone WhatsApp',
        colComp: 'Compartiment',
        colStatus: 'Statut Envoi',
        colColdStatus: 'Statut Froid',
        colMkt: 'MKT (°C)',
        colCooldown: 'Temporisation',
        colMessageId: 'ID Message WhatsApp',
        colHash: 'Empreinte Numérique Certificat',
        activeCooldown: 'Actif (Protégé)',
        readyCooldown: 'Prêt à l\'envoi',
        delivered: 'Livré',
        sent: 'Envoyé',
        simulated: 'Simulé 🧪',
        skipped: 'Ignoré (Délai)',
        failed: 'Échoué',
        integrityTitle: 'Sceau d\'Intégrité Numérique HMAC-SHA256',
        hashNotice: 'Rapport officiel certifié conforme EN 12830 et traité ATP.',
      },
      es: {
        sheetSummary: 'Synthèse_Mensuelle',
        sheetDetail: 'Détail_Arrivages_Docks',
        sheetAudit: 'Audit_Chaine_Froid',
        title: 'Informe Mensual de Llegadas a Muelles y Despacho Telemático',
        period: 'Período Contable',
        company: 'Transportista Oficial',
        ice: 'Identificador ICE',
        generatedAt: 'Fecha y Hora de Emisión',
        kpiTitle: 'Indicadores de Rendimiento y Cumplimiento Cadena de Frío',
        totalArrivals: 'Total de Llegadas a Muelles',
        totalDispatches: 'Total de Certificados Transmitidos',
        successfulDispatches: 'Entregas WhatsApp Confirmadas',
        cooldownProtected: 'Operaciones Protegidas por Cooldown',
        successRate: 'Tasa de Éxito de Entrega',
        complianceRate: 'Tasa de Cumplimiento GDP / EN 12830',
        avgMkt: 'Temperatura Cinética Media (MKT)',
        topDocksTitle: 'Distribución de Muelles Más Concurridos',
        dockName: 'Muelle / Plataforma Logística',
        arrivalCount: 'Número de Llegadas',
        sharePct: 'Porcentaje (%)',
        compBreakdownTitle: 'Cumplimiento por Compartimento Independiente (Multi-Temp)',
        compCode: 'Código',
        compName: 'Denominación',
        category: 'Categoría Carga',
        compliant: 'Conforme',
        warning: 'Advertencia',
        breached: 'No Conforme',
        colIndex: 'N°',
        colTime: 'Hora de Llegada',
        colTruck: 'Matrícula Camión',
        colTrailer: 'Semirremolque Frigo',
        colTrip: 'N° Viaje',
        colCmr: 'Carta de Porte (CMR)',
        colDock: 'Muelle / Sitio',
        colReceiver: 'Destinatario',
        colPhone: 'Teléfono WhatsApp',
        colComp: 'Compartimento',
        colStatus: 'Estado Envío',
        colColdStatus: 'Estado Frío',
        colMkt: 'MKT (°C)',
        colCooldown: 'Cooldown',
        colMessageId: 'ID Mensaje WhatsApp',
        colHash: 'Huella Digital Certificado',
        activeCooldown: 'Activo (Protegido)',
        readyCooldown: 'Listo para envío',
        delivered: 'Entregado',
        sent: 'Enviado',
        simulated: 'Simulado 🧪',
        skipped: 'Omitido (Cooldown)',
        failed: 'Fallido',
        integrityTitle: 'Sello de Integridad Digital HMAC-SHA256',
        hashNotice: 'Informe oficial certificado conforme a EN 12830 y tratado ATP.',
      },
    }[locale];

    const xmlEscape = (str: string | number | undefined | null) => {
      if (str === undefined || str === null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    // Calculate rates with Decimal.js
    const totalArrDec = new Decimal(summary.totalArrivals || 1);
    const topDocksWithPct = summary.topDocks.map((d) => {
      const countDec = new Decimal(d.count);
      const pct = countDec.dividedBy(totalArrDec).times(100).toDecimalPlaces(1).toNumber();
      return { ...d, pct };
    });

    const xmlWorkbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>${xmlEscape(labels.title)}</Title>
  <Author>Trans Bodanon TMS</Author>
  <Created>${xmlEscape(generatedAt)}</Created>
  <Company>${xmlEscape(company.name)}</Company>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center" ${isRtl ? 'ss:ReadingOrder="RightToLeft"' : ''}/>
   <Borders/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1E293B"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="HeaderMain">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0F766E"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="14" ss:Bold="1" ss:Color="#0F766E"/>
   <Interior ss:Color="#F0FDFA" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="SectionHeader">
   <Alignment ss:Horizontal="${isRtl ? 'Right' : 'Left'}" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
   </Borders>
  </Style>
  <Style ss:ID="TableHead">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0F766E" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="All" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0D9488"/>
   </Borders>
  </Style>
  <Style ss:ID="CellText">
   <Alignment ss:Horizontal="${isRtl ? 'Right' : 'Left'}" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="All" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="CellCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="All" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="CellNumber">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="All" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
  <Style ss:ID="CellPercent">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="All" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <NumberFormat ss:Format="0.0%"/>
  </Style>
  <Style ss:ID="CellDecimal">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="All" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <NumberFormat ss:Format="0.00"/>
  </Style>
  <Style ss:ID="BadgeDelivered">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Bold="1" ss:Color="#15803D"/>
   <Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/>
   <Borders><Border ss:Position="All" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#86EFAC"/></Borders>
  </Style>
  <Style ss:ID="BadgeProtected">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Bold="1" ss:Color="#6B21A8"/>
   <Interior ss:Color="#F3E8FF" ss:Pattern="Solid"/>
   <Borders><Border ss:Position="All" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D8B4FE"/></Borders>
  </Style>
  <Style ss:ID="BadgeWarning">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Bold="1" ss:Color="#B45309"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
   <Borders><Border ss:Position="All" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FCD34D"/></Borders>
  </Style>
  <Style ss:ID="BadgeFailed">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Bold="1" ss:Color="#B91C1C"/>
   <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
   <Borders><Border ss:Position="All" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FCA5A5"/></Borders>
  </Style>
 </Styles>

 <!-- ========================================================= -->
 <!-- WORKBOOK SHEET 1: Synthèse_Mensuelle                      -->
 <!-- ========================================================= -->
 <Worksheet ss:Name="${labels.sheetSummary}">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="200"/>
   <Column ss:Width="160"/>
   <Column ss:Width="140"/>
   <Column ss:Width="140"/>

   <!-- Document Header -->
   <Row ss:Height="30">
    <Cell ss:MergeAcross="3" ss:StyleID="HeaderMain"><Data ss:Type="String">${xmlEscape(labels.title)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${xmlEscape(labels.company)}: ${xmlEscape(company.name)}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${xmlEscape(labels.ice)}: ${xmlEscape(company.ice || 'N/A')}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${xmlEscape(labels.period)}: ${xmlEscape(summary.reportPeriodName)}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${xmlEscape(labels.generatedAt)}: ${xmlEscape(generatedAt)}</Data></Cell>
   </Row>
   <Row ss:Height="10"/>

   <!-- Section 1: KPI Overview -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="3" ss:StyleID="SectionHeader"><Data ss:Type="String">1. ${xmlEscape(labels.kpiTitle)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${xmlEscape(labels.totalArrivals)}</Data></Cell>
    <Cell ss:StyleID="CellNumber"><Data ss:Type="Number">${summary.totalArrivals}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${xmlEscape(labels.successRate)}</Data></Cell>
    <Cell ss:StyleID="CellPercent"><Data ss:Type="Number">${new Decimal(summary.overallComplianceRatePct).dividedBy(100).toNumber()}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${xmlEscape(labels.totalDispatches)}</Data></Cell>
    <Cell ss:StyleID="CellNumber"><Data ss:Type="Number">${summary.totalDispatches}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${xmlEscape(labels.complianceRate)}</Data></Cell>
    <Cell ss:StyleID="CellPercent"><Data ss:Type="Number">${new Decimal(summary.overallComplianceRatePct).dividedBy(100).toNumber()}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${xmlEscape(labels.cooldownProtected)}</Data></Cell>
    <Cell ss:StyleID="CellNumber"><Data ss:Type="Number">${summary.cooldownProtected}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${xmlEscape(labels.avgMkt)}</Data></Cell>
    <Cell ss:StyleID="CellDecimal"><Data ss:Type="Number">${summary.avgMktTempC}</Data></Cell>
   </Row>
   <Row ss:Height="12"/>

   <!-- Section 2: Top Docks -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="3" ss:StyleID="SectionHeader"><Data ss:Type="String">2. ${xmlEscape(labels.topDocksTitle)}</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:MergeAcross="1" ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.dockName)}</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.arrivalCount)}</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.sharePct)}</Data></Cell>
   </Row>
   ${topDocksWithPct
     .map(
       (dock) => `
   <Row>
    <Cell ss:MergeAcross="1" ss:StyleID="CellText"><Data ss:Type="String">${xmlEscape(dock.zoneName)}</Data></Cell>
    <Cell ss:StyleID="CellNumber"><Data ss:Type="Number">${dock.count}</Data></Cell>
    <Cell ss:StyleID="CellPercent"><Data ss:Type="Number">${new Decimal(dock.pct).dividedBy(100).toNumber()}</Data></Cell>
   </Row>`
     )
     .join('')}
   <Row ss:Height="12"/>

   <!-- Section 3: Multi-Temp Compartments Breakdown -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="3" ss:StyleID="SectionHeader"><Data ss:Type="String">3. ${xmlEscape(labels.compBreakdownTitle)}</Data></Cell>
   </Row>
   <Row ss:Height="22">
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.compCode)} - ${xmlEscape(labels.compName)}</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.category)}</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.avgMkt)}</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.complianceRate)}</Data></Cell>
   </Row>
   ${['C1', 'C2', 'C3']
     .map((code) => {
       const comp = summary.compartmentsBreakdown[code as 'C1' | 'C2' | 'C3'];
       if (!comp) return '';
       return `
   <Row>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${xmlEscape(comp.code)}: ${xmlEscape(comp.name)}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${xmlEscape(comp.category)}</Data></Cell>
    <Cell ss:StyleID="CellDecimal"><Data ss:Type="Number">${comp.avgMktTempC}</Data></Cell>
    <Cell ss:StyleID="CellPercent"><Data ss:Type="Number">${new Decimal(comp.complianceRatePct).dividedBy(100).toNumber()}</Data></Cell>
   </Row>`;
     })
     .join('')}
   <Row ss:Height="15"/>

   <!-- Cryptographic Seal Footer -->
   <Row>
    <Cell ss:MergeAcross="3" ss:StyleID="CellText"><Data ss:Type="String">🔒 ${xmlEscape(labels.integrityTitle)}: ${xmlEscape(verificationHash)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:MergeAcross="3" ss:StyleID="CellText"><Data ss:Type="String">🌐 ${xmlEscape(labels.hashNotice)} | ${xmlEscape(verificationUrl)}</Data></Cell>
   </Row>
  </Table>
 </Worksheet>

 <!-- ========================================================= -->
 <!-- WORKBOOK SHEET 2: Détail_Arrivages_Docks                   -->
 <!-- ========================================================= -->
 <Worksheet ss:Name="${labels.sheetDetail}">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="40"/>
   <Column ss:Width="110"/>
   <Column ss:Width="90"/>
   <Column ss:Width="100"/>
   <Column ss:Width="110"/>
   <Column ss:Width="180"/>
   <Column ss:Width="150"/>
   <Column ss:Width="110"/>
   <Column ss:Width="80"/>
   <Column ss:Width="90"/>
   <Column ss:Width="90"/>
   <Column ss:Width="100"/>

   <Row ss:Height="25">
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.colIndex)}</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.colTime)}</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.colTruck)}</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.colTrip)}</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.colCmr)}</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.colDock)}</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.colReceiver)}</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.colPhone)}</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.colComp)}</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.colStatus)}</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.colCooldown)}</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.colMessageId)}</Data></Cell>
   </Row>

   ${arrivals
     .map((item, idx) => {
       const statusStyle =
         item.dispatchStatus === 'delivered'
           ? 'BadgeDelivered'
           : item.dispatchStatus === 'cooldown_skipped'
           ? 'BadgeProtected'
           : item.dispatchStatus === 'failed'
           ? 'BadgeFailed'
           : 'CellCenter';

       const statusLabel =
         item.dispatchStatus === 'delivered'
           ? labels.delivered
           : item.dispatchStatus === 'sent'
           ? labels.sent
           : item.dispatchStatus === 'simulated'
           ? labels.simulated
           : item.dispatchStatus === 'cooldown_skipped'
           ? labels.skipped
           : labels.failed;

       return `
   <Row>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${xmlEscape(new Date(item.arrivedAt).toLocaleString('fr-FR'))}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${xmlEscape(item.truckPlate)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${xmlEscape(item.tripNumber)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${xmlEscape(item.cmrNumber || '-')}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${xmlEscape(item.zoneName)}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${xmlEscape(item.receiverName)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${xmlEscape(item.receiverPhone)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${xmlEscape(item.compartmentCode)}</Data></Cell>
    <Cell ss:StyleID="${statusStyle}"><Data ss:Type="String">${xmlEscape(statusLabel)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${xmlEscape(item.isCooldownActive ? `${labels.activeCooldown} (${item.cooldownRemainingMinutes}m)` : labels.readyCooldown)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${xmlEscape(item.messageId || 'wamid.auto.sim')}</Data></Cell>
   </Row>`;
     })
     .join('')}
  </Table>
 </Worksheet>

 <!-- ========================================================= -->
 <!-- WORKBOOK SHEET 3: Audit_Chaine_Froid                      -->
 <!-- ========================================================= -->
 <Worksheet ss:Name="${labels.sheetAudit}">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="40"/>
   <Column ss:Width="110"/>
   <Column ss:Width="90"/>
   <Column ss:Width="100"/>
   <Column ss:Width="80"/>
   <Column ss:Width="130"/>
   <Column ss:Width="90"/>
   <Column ss:Width="90"/>
   <Column ss:Width="100"/>
   <Column ss:Width="200"/>

   <Row ss:Height="25">
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.colIndex)}</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.colTime)}</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.colTruck)}</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.colTrip)}</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.colComp)}</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.category)}</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.colMkt)}</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.colColdStatus)}</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.complianceRate)}</Data></Cell>
    <Cell ss:StyleID="TableHead"><Data ss:Type="String">${xmlEscape(labels.colHash)}</Data></Cell>
   </Row>

   ${arrivals
     .map((item, idx) => {
       const coldStyle =
         item.status === 'compliant'
           ? 'BadgeDelivered'
           : item.status === 'warning'
           ? 'BadgeWarning'
           : 'BadgeFailed';

       const coldLabel =
         item.status === 'compliant'
           ? labels.compliant
           : item.status === 'warning'
           ? labels.warning
           : labels.breached;

       return `
   <Row>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${xmlEscape(new Date(item.arrivedAt).toLocaleString('fr-FR'))}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${xmlEscape(item.truckPlate)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${xmlEscape(item.tripNumber)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${xmlEscape(item.compartmentCode)}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${xmlEscape(item.cargoCategory || (item.compartmentCode === 'C1' ? 'deep_frozen' : 'fresh_produce'))}</Data></Cell>
    <Cell ss:StyleID="CellDecimal"><Data ss:Type="Number">${item.mktTempC !== undefined ? item.mktTempC : 0}</Data></Cell>
    <Cell ss:StyleID="${coldStyle}"><Data ss:Type="String">${xmlEscape(coldLabel)}</Data></Cell>
    <Cell ss:StyleID="CellPercent"><Data ss:Type="Number">${new Decimal(item.complianceScore || 100).dividedBy(100).toNumber()}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${xmlEscape(item.verificationHash || verificationHash)}</Data></Cell>
   </Row>`;
     })
     .join('')}
  </Table>
 </Worksheet>
</Workbook>`;

    return xmlWorkbook;
  }
}

