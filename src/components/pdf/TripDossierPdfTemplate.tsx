import React from 'react';
import { formatCurrency } from '@/lib/forex';
import type { TripDossierData } from '@/lib/trip-dossier-pdf';

export interface TripDossierPdfTemplateProps {
  data: TripDossierData;
}

export function TripDossierPdfTemplate({ data: d }: TripDossierPdfTemplateProps) {
  const loc = d.locale || 'ar';
  const isRtl = loc === 'ar';
  const dir = isRtl ? 'rtl' : 'ltr';

  const t = (ar: string, fr: string, es: string) => {
    if (loc === 'fr') return fr;
    if (loc === 'es') return es;
    return ar;
  };

  const companyName = d.company?.name || 'TRANS BODANON S.A.R.L';
  const companyIce = d.company?.ice ? `ICE: ${d.company.ice}` : 'ICE: 001234567000089';
  const currency = d.company?.currency || 'MAD';

  const hasImportCargo = Boolean(
    d.trip.route_import ||
      d.trip.client_import_id ||
      d.clientImport ||
      d.trip.goods_description_import ||
      d.trip.cmr_import_number
  );

  const portFees = d.financialSummary.portFeesBreakdown || {
    ferry: 4500,
    triptik: 500,
    transitAlmeria: 1200,
    marsaMaroc: 800,
    total: 7000,
  };

  const isNetProfitPositive = d.financialSummary.netProfit >= 0;

  const docTitle = `${t(
    'الملف اللوجستي والمالي الموحد',
    'Dossier de Mission TIR & Financier',
    'Dossier de Misión TIR y Financiero'
  )} - #${d.trip.id}`;

  return (
    <html lang={loc} dir={dir}>
      <head>
        <meta charSet="UTF-8" />
        <title>{docTitle}</title>
        <style
          dangerouslySetInnerHTML={{
            __html: `
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: #f8fafc;
            color: #0f172a;
            padding: 20px;
            font-size: 12px;
            line-height: 1.45;
            direction: ${dir};
            text-align: ${isRtl ? 'right' : 'left'};
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .toolbar {
            max-width: 860px;
            margin: 0 auto 16px auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #0f172a;
            color: #fff;
            padding: 10px 18px;
            border-radius: 8px;
          }
          .toolbar button {
            background: #2563eb;
            color: #fff;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: 700;
            font-size: 13px;
            cursor: pointer;
          }
          .toolbar button:hover {
            background: #1d4ed8;
          }
          .dossier-page {
            max-width: 860px;
            margin: 0 auto;
            background: #fff;
            border: 2px solid #0f172a;
            padding: 22px;
            border-radius: 4px;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 14px;
          }
          .header-brand {
            display: flex;
            align-items: center;
            gap: 14px;
          }
          .header-logo {
            width: 60px;
            height: 60px;
            object-fit: contain;
            border-radius: 6px;
            border: 1px solid #cbd5e1;
            padding: 2px;
          }
          .header-title h1 {
            font-size: 18px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.5px;
          }
          .header-title .company-sub {
            font-size: 11px;
            color: #475569;
            font-weight: 600;
            margin-top: 1px;
          }
          .header-title .trip-meta {
            font-size: 11px;
            color: #64748b;
            margin-top: 3px;
          }
          .qr-badge {
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
          }
          .qr-badge img {
            width: 85px;
            height: 85px;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            padding: 2px;
            background: #fff;
          }
          .qr-badge span {
            font-size: 9px;
            font-family: monospace;
            font-weight: 700;
            color: #475569;
          }
          .section-title {
            font-size: 12px;
            font-weight: 800;
            background: #f1f5f9;
            color: #0f172a;
            padding: 5px 10px;
            border-${isRtl ? 'right' : 'left'}: 4px solid #0f172a;
            border-${isRtl ? 'left' : 'right'}: none;
            margin: 12px 0 6px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .section-title span.badge-pill {
            font-size: 10px;
            font-family: monospace;
            background: #e2e8f0;
            padding: 2px 6px;
            border-radius: 4px;
          }
          .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }
          .grid-3 {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 10px;
          }
          .card-box {
            border: 1px solid #cbd5e1;
            padding: 8px 10px;
            border-radius: 5px;
            background: #fff;
          }
          .card-box label {
            font-size: 10px;
            font-weight: 700;
            color: #64748b;
            display: block;
            margin-bottom: 2px;
            text-transform: uppercase;
          }
          .card-box p {
            font-weight: 600;
            font-size: 12px;
            color: #0f172a;
          }
          .card-box p.sub {
            font-size: 11px;
            color: #475569;
            font-weight: normal;
            margin-top: 2px;
          }
          .card-box.export-box {
            border-top: 3px solid #2563eb;
          }
          .card-box.import-box {
            border-top: 3px solid #059669;
          }
          .card-box.empty-box {
            border-top: 3px solid #94a3b8;
            background: #f8fafc;
          }
          table.financial-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px;
            font-size: 11.5px;
          }
          table.financial-table th, table.financial-table td {
            border: 1px solid #cbd5e1;
            padding: 5px 8px;
            text-align: ${isRtl ? 'right' : 'left'};
          }
          table.financial-table td.col-amount {
            text-align: ${isRtl ? 'left' : 'right'};
            font-family: monospace;
          }
          table.financial-table th {
            background: #f1f5f9;
            font-weight: 700;
            color: #0f172a;
          }
          table.financial-table tr.total-row td {
            background: #f8fafc;
            font-weight: 800;
            border-top: 2px solid #0f172a;
            font-size: 12.5px;
          }
          .profit-tag-positive {
            color: #059669;
            font-weight: 800;
          }
          .profit-tag-negative {
            color: #e11d48;
            font-weight: 800;
          }
          .signature-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-top: 8px;
          }
          .signature-box {
            border: 1px dashed #0f172a;
            border-radius: 5px;
            padding: 6px;
            text-align: center;
            background: #fafafa;
          }
          .signature-box label {
            display: block;
            font-size: 10px;
            font-weight: 700;
            color: #475569;
            margin-bottom: 4px;
          }
          .signature-box img {
            max-height: 90px;
            object-fit: contain;
            width: 100%;
            background: #fff;
          }
          .security-stamp {
            margin-top: 12px;
            padding: 7px 10px;
            background: #ecfdf5;
            border: 1px solid #a7f3d0;
            border-radius: 5px;
            font-size: 10px;
            font-family: monospace;
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: #065f46;
          }
          @media print {
            body {
              padding: 0;
              background: #fff;
            }
            .toolbar {
              display: none !important;
            }
            .dossier-page {
              border: none;
              box-shadow: none;
              max-width: 100%;
              padding: 0;
            }
          }
        `,
          }}
        />
      </head>
      <body>
        <div className="toolbar">
          <div>
            <strong>
              {t('أرشيف الرحلة الدولية الموحد', 'Dossier de Mission TIR', 'Dossier de Misión TIR')} #{d.trip.id}
            </strong>{' '}
            — {t('جاهز للطباعة والتصدير', 'Prêt pour impression & export', 'Listo para impresión y exportación')}
          </div>
          <button
            onClick={() => {}}
            dangerouslySetInnerHTML={{
              __html: t(
                'طباعة / حفظ كملف PDF',
                'Imprimer / Exporter en PDF',
                'Imprimir / Guardar en PDF'
              ),
            }}
          />
        </div>

        <div className="dossier-page">
          {/* Header */}
          <div className="header">
            <div className="header-brand">
              {d.company?.logo_url ? (
                <img src={d.company.logo_url} alt="Logo" className="header-logo" />
              ) : (
                <div
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 6,
                    background: '#0f172a',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 18,
                  }}
                >
                  TB
                </div>
              )}
              <div className="header-title">
                <h1>{companyName}</h1>
                <div className="company-sub">
                  {t(
                    'الملف اللوجستي والمالي الموحد (Dossier de Mission TIR)',
                    'Dossier de Mission TIR & Financier Consolidé',
                    'Dossier de Misión TIR y Financiero Consolidado'
                  )}{' '}
                  • {companyIce}
                </div>
                <div className="trip-meta">
                  {t('رقم الرحلة:', 'N° de Mission :', 'N° de Misión :')}{' '}
                  <strong>#{d.trip.id}</strong> |{' '}
                  {t('تاريخ الإصدار:', "Date d'émission :", 'Fecha de emisión :')}{' '}
                  <strong>
                    {new Date(d.generatedAt).toLocaleString(
                      loc === 'ar' ? 'ar-MA' : loc === 'es' ? 'es-ES' : 'fr-FR'
                    )}
                  </strong>
                </div>
              </div>
            </div>
            <div className="qr-badge">
              <img src={d.qrCodeBase64} alt="QR Verification" />
              <span>SCAN TO VERIFY</span>
            </div>
          </div>

          {/* Section 1: Route & Cargo */}
          <div className="section-title">
            <span>
              {t(
                '1. المسار الدولي ومواصفات الشحنة (Export Aller / Import Retour)',
                '1. Itinéraire International & Spécifications du Fret',
                '1. Itinerario Internacional y Especificaciones de la Carga'
              )}
            </span>
            <span className="badge-pill">TIR CORRIDOR</span>
          </div>
          <div className="grid-2">
            <div className="card-box export-box">
              <label>
                {t(
                  'مسار الذهاب والتصدير (Export Aller)',
                  'Trajet Aller & Exportation (Export Aller)',
                  'Trayecto de Ida y Exportación (Export Aller)'
                )}
              </label>
              <p>{d.trip.route_export || d.trip.route || (isRtl ? 'المغرب ➔ أوروبا' : 'Maroc ➔ Europe')}</p>
              <p className="sub">
                {t('العميل الشاحن:', 'Client Chargeur :', 'Cliente Cargador :')}{' '}
                <strong>{d.clientExport?.name || t('غير محدد', 'Non spécifié', 'No especificado')}</strong>{' '}
                {d.clientExport?.ice ? `(ICE: ${d.clientExport.ice})` : ''}
              </p>
              <p className="sub">
                {t('البضاعة:', 'Marchandises :', 'Mercancía :')}{' '}
                {d.trip.goods_description_export ||
                  t('بضائع عامة / فواكه وخضار', 'Marchandises générales / Fruits & Légumes', 'Mercancías generales / Frutas y Verduras')}
              </p>
              <p className="sub">
                {t('الوزن القائم:', 'Poids Brut :', 'Peso Bruto :')}{' '}
                {d.trip.weight_export ? `${d.trip.weight_export.toLocaleString()} kg` : 'N/A'}
              </p>
              {(d.trip.shipping_gps_url || d.clientExport?.loading_gps_url) && (
                <p className="sub" style={{ color: '#059669', fontSize: '10px' }}>
                  {t(
                    '✓ موقع الشحن بالمغرب موثق بالإحداثيات GPS',
                    '✓ Lieu de chargement au Maroc certifié par coordonnées GPS',
                    '✓ Punto de carga en Marruecos certificado con coordenadas GPS'
                  )}
                </p>
              )}
            </div>

            {hasImportCargo ? (
              <div className="card-box import-box">
                <label>
                  {t(
                    'مسار العودة والاستيراد (Import Retour)',
                    'Trajet Retour & Importation (Import Retour)',
                    'Trayecto de Vuelta e Importación (Import Retour)'
                  )}
                </label>
                <p>{d.trip.route_import || (isRtl ? 'أوروبا ➔ المغرب' : 'Europe ➔ Maroc')}</p>
                <p className="sub">
                  {t('العميل المستورد:', 'Client Importateur :', 'Cliente Importador :')}{' '}
                  <strong>{d.clientImport?.name || t('غير محدد', 'Non spécifié', 'No especificado')}</strong>{' '}
                  {d.clientImport?.ice ? `(ICE: ${d.clientImport.ice})` : ''}
                </p>
                <p className="sub">
                  {t('البضاعة:', 'Marchandises :', 'Mercancía :')}{' '}
                  {d.trip.goods_description_import ||
                    t('بضائع صناعية ومعدات', 'Marchandises industrielles & équipements', 'Mercancías industriales y equipos')}
                </p>
                <p className="sub">
                  {t('الوزن القائم:', 'Poids Brut :', 'Peso Bruto :')}{' '}
                  {d.trip.weight_import ? `${d.trip.weight_import.toLocaleString()} kg` : 'N/A'}
                </p>
                {(d.trip.unloading_gps_url || d.clientImport?.unloading_gps_url) && (
                  <p className="sub" style={{ color: '#059669', fontSize: '10px' }}>
                    {t(
                      '✓ موقع التفريغ بالمغرب موثق بالإحداثيات GPS',
                      '✓ Lieu de déchargement au Maroc certifié par coordonnées GPS',
                      '✓ Punto de descarga en Marruecos certificado con coordenadas GPS'
                    )}
                  </p>
                )}
              </div>
            ) : (
              <div className="card-box empty-box">
                <label>
                  {t('مسار العودة (Retour à vide)', 'Trajet Retour à vide', 'Trayecto de Regreso en vacío')}
                </label>
                <p>
                  {t(
                    'رحلة عودة بدون حمولة (Retour à vide)',
                    'Voyage retour à vide sans chargement',
                    'Viaje de regreso en vacío sin carga'
                  )}
                </p>
                <p className="sub">
                  {t(
                    'عادت الشاحنة فارغة بعد إتمام تسليم بضاعة التصدير لتسريع الجاهزية للرحلة التالية.',
                    'Le véhicule est rentré à vide après déchargement export pour disponibilité immédiate.',
                    'El camión regresó vacío tras completar la entrega de exportación para disponibilidad inmediata.'
                  )}
                </p>
                <p className="sub" style={{ color: '#64748b', fontSize: '10px' }}>
                  {t(
                    'الحمولة: 0 kg • لا توجد تكاليف شحن مستردة',
                    'Charge : 0 kg • Aucun fret de retour encaissé',
                    'Carga: 0 kg • Sin flete de retorno cobrado'
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Section 2: Fleet & Crew */}
          <div className="section-title">
            <span>
              {t(
                '2. طاقم المأمورية والعتاد المشغل',
                '2. Équipage & Véhicules Assignés',
                '2. Tripulación y Vehículos Asignados'
              )}
            </span>
            <span className="badge-pill">FLEET & CREW</span>
          </div>
          <div className="grid-3">
            <div className="card-box">
              <label>
                {t('الشاحنة الجرار (Tracteur)', 'Tracteur Routier (Truck)', 'Camión Tractor (Truck)')}
              </label>
              <p>{d.truck?.plate_number || t('غير معينة', 'Non assigné', 'No asignado')}</p>
              <p className="sub">
                {t('الموديل:', 'Modèle :', 'Modelo :')} {d.truck?.model || 'Volvo FH'}
              </p>
              <p className="sub">
                {t('معدل الاستهلاك:', 'Consommation :', 'Consumo :')}{' '}
                {d.truck?.fuel_consumption_rate || 36}%
              </p>
            </div>
            <div className="card-box">
              <label>
                {t('المقطورة الملحقة (Semi-Remorque)', 'Semi-Remorque (Trailer)', 'Semirremolque (Trailer)')}
              </label>
              <p>{d.trailer?.plate_number || t('غير معينة', 'Non assignée', 'No asignado')}</p>
              <p className="sub">
                {t('الموديل:', 'Modèle :', 'Modelo :')} {d.trailer?.model || 'Schmitz Frigo ATP'}
              </p>
              <p className="sub">
                {t('النوع:', 'Type :', 'Tipo :')}{' '}
                {d.trailer?.model?.includes('Frigo')
                  ? t('مقطورة تبريد (Frigo)', 'Semi frigorifique (Frigo)', 'Semirremolque frigorífico (Frigo)')
                  : t('مقطورة مشمعة (Bâchée)', 'Semi bâchée', 'Semirremolque con lona (Bâchée)')}
              </p>
            </div>
            <div className="card-box">
              <label>
                {t('السائق المكلف (Chauffeur)', 'Chauffeur Assigné (Driver)', 'Conductor Asignado (Driver)')}
              </label>
              <p>{d.driver?.name || t('غير معين', 'Non assigné', 'No asignado')}</p>
              <p className="sub">
                {t('الهاتف:', 'Tél :', 'Tel :')} {d.driver?.phone || 'N/A'}
              </p>
              <p className="sub">
                {t('رخصة السياقة:', 'Permis :', 'Permiso :')} {d.driver?.license || 'EC'}
              </p>
            </div>
          </div>

          {/* Section 3: Maritime & Customs */}
          <div className="section-title">
            <span>
              {t(
                '3. بيانات العبور البحري والتخليص الجمركي',
                '3. Transit Maritime & Douane Internationale',
                '3. Tránsito Marítimo y Aduana Internacional'
              )}
            </span>
            <span className="badge-pill">TRANSIT & CUSTOMS</span>
          </div>
          <div className="grid-2">
            <div className="card-box">
              <label>
                {t('العبّارة البحرية (Ferry Maritime)', 'Traversée Maritime (Ferry)', 'Ferry Marítimo')}
              </label>
              <p>
                {d.trip.ferry_company ||
                  t(
                    'طنجة المتوسط - الجزيرة الخضراء (FRS / Baleària)',
                    'Tanger Med - Algésiras (FRS / Baleària)',
                    'Tánger Med - Algeciras (FRS / Baleària)'
                  )}
              </p>
              <p className="sub">
                {t('رقم الحجز (Localizador الذهاب):', 'Réf. Réservation Aller (Localizador) :', 'Ref. Reserva Ida (Localizador) :')}{' '}
                <strong>{d.trip.ferry_localizador || 'N/A'}</strong>
              </p>
              {d.trip.ferry_localizador_import && (
                <p className="sub">
                  {t('رقم الحجز (Localizador العودة):', 'Réf. Réservation Retour (Localizador) :', 'Ref. Reserva Vuelta (Localizador) :')}{' '}
                  <strong>{d.trip.ferry_localizador_import}</strong>
                </p>
              )}
            </div>
            <div className="card-box">
              <label>
                {t('وثائق الشحن والجمارك الدولية', 'Documents Douaniers & CMR', 'Documentos Aduaneros y CMR')}
              </label>
              <p>
                {t('رقم التصريح الجمركي (MRN):', 'Déclaration Douane (MRN) :', 'Declaración Aduanera (MRN) :')}{' '}
                {d.trip.cmr_export_number || d.trip.cmr_number || 'N/A'}
              </p>
              <p className="sub">
                CMR {t('ذهاب:', 'Aller :', 'Ida :')}{' '}
                <strong>{d.trip.cmr_export_number || d.trip.cmr_number || 'N/A'}</strong>
                {d.trip.cmr_import_number
                  ? ` | CMR ${t('عودة:', 'Retour :', 'Vuelta :')} ${d.trip.cmr_import_number}`
                  : ''}
              </p>
              <p className="sub" style={{ color: '#059669', fontSize: '10px' }}>
                {t(
                  '✓ وثيقة النقل e-CMR موثقة ومربوطة رقمياً',
                  '✓ Document e-CMR authentifié et lié numériquement',
                  '✓ Documento e-CMR autenticado y vinculado digitalmente'
                )}
              </p>
            </div>
          </div>

          {/* Section 4: Proof of Delivery (e-POD) */}
          <div className="section-title">
            <span>
              {t(
                '4. شهادة إثبات التسليم الرقمي المعتمد (Proof of Delivery - e-POD)',
                '4. Preuve de Livraison Numérique Certifiée (e-POD)',
                '4. Prueba de Entrega Digital Certificada (e-POD)'
              )}
            </span>
            <span className="badge-pill">SHA256-HMAC SECURED</span>
          </div>
          {d.deliveryProof ? (
            <>
              <div className="grid-2">
                <div className="card-box">
                  <label>
                    {t('بيانات الاستلام والتسليم', 'Données de Réception', 'Datos de Recepción')}
                  </label>
                  <p>
                    {t('المستلم:', 'Réceptionnaire :', 'Receptor :')}{' '}
                    <strong>{d.deliveryProof.signed_by}</strong>
                  </p>
                  <p className="sub">
                    {t('تاريخ التسليم:', 'Date de livraison :', 'Fecha de entrega :')}{' '}
                    {new Date(d.deliveryProof.signed_at).toLocaleString(
                      loc === 'ar' ? 'ar-MA' : loc === 'es' ? 'es-ES' : 'fr-FR'
                    )}
                  </p>
                  <p className="sub">
                    {t('إحداثيات GPS:', 'Coordonnées GPS :', 'Coordenadas GPS :')}{' '}
                    {d.deliveryProof.latitude !== undefined && d.deliveryProof.latitude !== null
                      ? `${d.deliveryProof.latitude.toFixed(5)}, ${d.deliveryProof.longitude?.toFixed(5)}`
                      : t('موثقة ميدانياً', 'Certifiées sur le terrain', 'Certificadas en el terreno')}
                  </p>
                </div>
                <div className="card-box">
                  <label>
                    {t('حالة التحقق الجنائي المشفر', 'État de Certification Cryptographique', 'Estado de Certificación Criptográfica')}
                  </label>
                  <p style={{ color: '#059669', fontWeight: 700 }}>
                    {t(
                      '✓ التوقيع موثق ومحمٍ ضد التعديل',
                      '✓ Signature vérifiée et protégée contre toute altération',
                      '✓ Firma verificada y protegida contra manipulaciones'
                    )}
                  </p>
                  <p className="sub" style={{ wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '10px' }}>
                    {t('البصمة:', 'Empreinte :', 'Huella :')} {d.integrityHash}
                  </p>
                </div>
              </div>
              <div className="signature-container">
                <div className="signature-box">
                  <label>
                    {t(
                      'التوقيع الحي للمستلم عند التسليم',
                      'Signature numérique du destinataire',
                      'Firma digital del destinatario'
                    )}
                  </label>
                  <img src={d.deliveryProof.signature_url} alt="Recipient Signature" />
                </div>
                {d.deliveryProof.cmr_image_url ? (
                  <div className="signature-box">
                    <label>
                      {t(
                        'صورة وصل CMR المختوم بختم العميل (Visé)',
                        'Copie CMR visée et tamponnée par le client',
                        'Copia CMR sellada y visada por el cliente'
                      )}
                    </label>
                    <img src={d.deliveryProof.cmr_image_url} alt="Stamped CMR Document" />
                  </div>
                ) : (
                  <div
                    className="signature-box"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94a3b8',
                      fontSize: '11px',
                    }}
                  >
                    {t(
                      'تم الاعتماد بالتوقيع الإلكتروني الحي والموقع الجغرافي',
                      'Certifié par signature numérique et horodatage GPS',
                      'Certificado mediante firma digital y geolocalización GPS'
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="card-box" style={{ background: '#fff1f2', borderColor: '#fecdd3', color: '#be123c' }}>
              <strong>
                {t('⚠️ التسليم قيد التنفيذ:', '⚠️ Livraison en cours :', '⚠️ Entrega en curso :')}{' '}
              </strong>
              {t(
                'لم يتم تسجيل إثبات التسليم (e-POD) لهذه الرحلة حتى الآن.',
                'Aucune preuve de livraison (e-POD) enregistrée pour ce trajet à ce jour.',
                'No se ha registrado prueba de entrega (e-POD) para este viaje hasta el momento.'
              )}
            </div>
          )}

          {/* Section 5: Profit & Loss (P&L) */}
          <div className="section-title">
            <span>
              {t(
                '5. كشف الأرباح والخسائر التشغيلي (Consolidated P&L Statement)',
                "5. Compte de Résultat d'Exploitation (P&L Consolidé)",
                '5. Cuenta de Resultados Operativa (P&L Consolidado)'
              )}
            </span>
            <span className="badge-pill">DECIMAL.JS PRECISION</span>
          </div>
          <table className="financial-table">
            <thead>
              <tr>
                <th style={{ width: '60%' }}>
                  {t('البند المالي / البيان', 'Poste Financier / Libellé', 'Partida Financiera / Concepto')}
                </th>
                <th className="col-amount" style={{ width: '40%' }}>
                  {t('المبلغ', 'Montant', 'Importe')} ({currency})
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>
                    {t(
                      'إجمالي إيراد الرحلة (ذهاب + عودة)',
                      "Chiffre d'Affaires Fret Total (Aller + Retour)",
                      'Ingresos Totales por Flete (Ida + Vuelta)'
                    )}
                  </strong>
                  {d.financialSummary.priceExport
                    ? ` [${t('ذهاب:', 'Aller :', 'Ida :')} ${formatCurrency(d.financialSummary.priceExport, currency)}]`
                    : ''}
                  {d.financialSummary.priceImport
                    ? ` [${t('عودة:', 'Retour :', 'Vuelta :')} ${formatCurrency(d.financialSummary.priceImport, currency)}]`
                    : ''}
                </td>
                <td className="col-amount" style={{ fontWeight: 700 }}>
                  {formatCurrency(d.financialSummary.revenue, currency)}
                </td>
              </tr>
              <tr>
                <td>
                  {t(
                    'خصم: نفقات الوقود البري المعتمد (Gasoil)',
                    'Déduction : Carburant diesel (Gasoil)',
                    'Deducción: Combustible diésel (Gasoil)'
                  )}
                </td>
                <td className="col-amount" style={{ color: '#e11d48' }}>
                  -{formatCurrency(d.financialSummary.fuelCost, currency)}
                </td>
              </tr>
              <tr>
                <td>
                  {t(
                    'خصم: سلف ومصروفات السائق الميدانية',
                    'Déduction : Avances & frais de route chauffeur',
                    'Deducción: Anticipos y gastos de viaje del conductor'
                  )}
                </td>
                <td className="col-amount" style={{ color: '#e11d48' }}>
                  -{formatCurrency(d.financialSummary.advancesCost, currency)}
                </td>
              </tr>
              <tr>
                <td>
                  {t(
                    'خصم: رسوم الموانئ والترانزيت الأربعة القياسية:',
                    'Déduction : Frais portuaires et maritimes standards :',
                    'Deducción: Tasas portuarias y marítimas estándar:'
                  )}
                  <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px', paddingRight: isRtl ? '10px' : 0, paddingLeft: !isRtl ? '10px' : 0 }}>
                    • {t('تذكرة الباخرة (Ferry):', 'Billet Bateau (Ferry) :', 'Billete Barco (Ferry) :')} {formatCurrency(portFees.ferry, currency)}
                    <br />
                    • {t('تصريح المرور الجمركي (Triptyque):', 'Carnet Triptyque Douane (CPD) :', 'Tríptico Aduanero (CPD) :')} {formatCurrency(portFees.triptik, currency)}
                    <br />
                    • {t('ترانزيت الميريا / الجزيرة الخضراء:', 'Transit Port Alméria / Algésiras :', 'Tránsito Almería / Algeciras :')} {formatCurrency(portFees.transitAlmeria, currency)}
                    <br />
                    • {t('رسوم ميناء مرسى المغرب (Marsa Maroc):', 'Frais Port Tanger Med (Marsa Maroc) :', 'Tasas Puerto Tánger Med (Marsa Maroc) :')} {formatCurrency(portFees.marsaMaroc, currency)}
                  </div>
                </td>
                <td className="col-amount" style={{ color: '#e11d48', verticalAlign: 'top' }}>
                  -{formatCurrency(d.financialSummary.ferryCost, currency)}
                </td>
              </tr>
              {d.financialSummary.finesCost > 0 && (
                <tr>
                  <td>
                    {t(
                      'خصم: الغرامات والمخالفات الميدانية',
                      'Déduction : Amendes & pénalités de route',
                      'Deducción: Multas y sanciones de carretera'
                    )}
                  </td>
                  <td className="col-amount" style={{ color: '#e11d48' }}>
                    -{formatCurrency(d.financialSummary.finesCost, currency)}
                  </td>
                </tr>
              )}
              <tr style={{ background: '#f8fafc' }}>
                <td>
                  <strong>
                    {t(
                      'إجمالي المصروفات التشغيلية المخصومة',
                      "Total Dépenses d'Exploitation Déduites",
                      'Total Gastos Operativos Deducidos'
                    )}
                  </strong>
                </td>
                <td className="col-amount" style={{ color: '#e11d48', fontWeight: 700 }}>
                  -{formatCurrency(d.financialSummary.totalExpenses, currency)}
                </td>
              </tr>
              <tr className="total-row">
                <td>
                  <strong>
                    {t(
                      'صافي الربح التشغيلي المحقق (Net Profit)',
                      "Résultat d'Exploitation Net (Marge Nette)",
                      'Beneficio Neto Operativo (Margen Neto)'
                    )}
                  </strong>
                  <span style={{ fontSize: '11px', color: '#64748b', marginInlineStart: '8px' }}>
                    ({t('هامش ربحية:', 'Marge :', 'Margen :')} {d.financialSummary.profitMarginPercentage}%)
                  </span>
                </td>
                <td className={`col-amount ${isNetProfitPositive ? 'profit-tag-positive' : 'profit-tag-negative'}`}>
                  {formatCurrency(d.financialSummary.netProfit, currency)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Security Stamp */}
          <div className="security-stamp">
            <span>
              {t(
                '🔐 شهادة أمان رقمية معتمدة آلياً من منصة Trans Bodanon ERP',
                '🔐 Certificat numérique certifié automatiquement par la plateforme Trans Bodanon ERP',
                '🔐 Certificado digital certificado automáticamente por la plataforma Trans Bodanon ERP'
              )}
            </span>
            <span>SHA-256 HMAC: {d.integrityHash.substring(0, 32)}...</span>
          </div>
        </div>

        <script
          dangerouslySetInnerHTML={{
            __html: `
          document.querySelector('.toolbar button')?.addEventListener('click', function() {
            window.print();
          });
        `,
          }}
        />
      </body>
    </html>
  );
}

export default TripDossierPdfTemplate;
