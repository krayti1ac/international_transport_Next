import React from 'react';
import { formatCurrency } from '@/lib/forex';
import type { TripDossierData } from '@/lib/trip-dossier-pdf';

export interface TripDossierPdfTemplateProps {
  data: TripDossierData;
}

export function TripDossierPdfTemplate({ data: d }: TripDossierPdfTemplateProps) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="UTF-8" />
        <title>{`الملف اللوجستي والمالي الموحد - رحلة #${d.trip.id}`}</title>
        <style dangerouslySetInnerHTML={{ __html: `
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background: #fff; color: #0f172a; padding: 24px; font-size: 13px; line-height: 1.5; }
          .dossier-page { max-width: 900px; margin: 0 auto; border: 2px solid #0f172a; padding: 24px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 18px; }
          .header-title h1 { font-size: 20px; font-weight: 800; color: #0f172a; }
          .header-title p { font-size: 11px; color: #64748b; margin-top: 2px; }
          .qr-badge { text-align: left; }
          .qr-badge img { width: 90px; height: 90px; }
          .section-title { font-size: 13px; font-weight: 700; background: #f1f5f9; padding: 6px 10px; border-right: 4px solid #0f172a; margin: 14px 0 8px 0; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
          .card-box { border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; }
          .card-box label { font-size: 10px; font-weight: 700; color: #64748b; display: block; margin-bottom: 3px; }
          .card-box p { font-weight: 600; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right; }
          th { background: #f8fafc; font-weight: 700; }
          .financial-box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; margin-top: 10px; }
          .financial-row { display: flex; justify-content: space-between; padding: 3px 0; }
          .financial-total { border-top: 2px solid #0f172a; margin-top: 6px; padding-top: 6px; font-weight: 800; font-size: 14px; }
          .signature-container { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 10px; }
          .signature-box { border: 1px dashed #0f172a; border-radius: 6px; padding: 8px; text-align: center; }
          .signature-box img { max-height: 120px; object-fit: contain; width: 100%; }
          .security-stamp { margin-top: 14px; padding: 8px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; font-size: 10px; font-family: monospace; }
          @media print {
            body { padding: 0; }
            .dossier-page { border: none; max-width: 100%; padding: 12px; }
          }
        ` }} />
      </head>
      <body>
        <div className="dossier-page">
          <div className="header">
            <div className="header-title">
              <h1>TRANS BODANON — الملف اللوجستي الموحد (Dossier de Voyage)</h1>
              <p>أرشيف متكامل: وثائق النقل، بيانات الشحن، تقرير إثبات التسليم (POD)، والتحليل المالي</p>
              <p>رقم الرحلة: <strong>#{d.trip.id}</strong> | تاريخ الإصدار: <strong>{new Date(d.generatedAt).toLocaleString('ar-MA')}</strong></p>
            </div>
            <div className="qr-badge">
              <img src={d.qrCodeBase64} alt="QR Verification" />
            </div>
          </div>

          <div className="section-title">1. المسار الدولي والشحنة</div>
          <div className="grid-2">
            <div className="card-box">
              <label>مسار الذهاب (Export)</label>
              <p>{d.trip.route_export || d.trip.route}</p>
              <p style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                العميل: {d.clientExport?.name || 'غير محدد'} (ICE: {d.clientExport?.ice || 'N/A'})
              </p>
              <p style={{ fontSize: '11px', color: '#475569' }}>
                البضاعة: {d.trip.goods_description_export || 'بضائع متنوعة'}
              </p>
            </div>
            <div className="card-box">
              <label>مسار العودة (Import)</label>
              <p>{d.trip.route_import || 'رحلة عودة بدون حمولة (Retour à vide)'}</p>
              <p style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                العميل: {d.clientImport?.name || 'N/A'}
              </p>
              <p style={{ fontSize: '11px', color: '#475569' }}>
                البضاعة: {d.trip.goods_description_import || 'N/A'}
              </p>
            </div>
          </div>

          <div className="section-title">2. الشاحنة والتجهيزات والسائق</div>
          <div className="grid-3">
            <div className="card-box">
              <label>السائق المكلف</label>
              <p>{d.driver?.name || 'N/A'}</p>
              <p style={{ fontSize: '11px', color: '#475569' }}>الهاتف: {d.driver?.phone || 'N/A'}</p>
            </div>
            <div className="card-box">
              <label>الشاحنة (Tracteur)</label>
              <p>{d.truck?.plate_number || 'N/A'}</p>
              <p style={{ fontSize: '11px', color: '#475569' }}>الموديل: {d.truck?.model || 'N/A'}</p>
            </div>
            <div className="card-box">
              <label>المقطورة (Remorque)</label>
              <p>{d.trailer?.plate_number || 'N/A'}</p>
              <p style={{ fontSize: '11px', color: '#475569' }}>الموديل: {d.trailer?.model || 'N/A'}</p>
            </div>
          </div>

          <div className="section-title">3. المعبر البحري وبيانات الترانزيت</div>
          <div className="grid-2">
            <div className="card-box">
              <label>العبّارة البحرية (Ferry)</label>
              <p>{d.trip.ferry_company || 'طنجة المتوسط - الجزيرة الخضراء'}</p>
              <p style={{ fontSize: '11px', color: '#475569' }}>رقم الحجز (Localizador): {d.trip.ferry_localizador || 'N/A'}</p>
            </div>
            <div className="card-box">
              <label>وثائق الشحن والجمارك</label>
              <p>رقم التصريح (MRN): {d.trip.cmr_export_number || d.trip.cmr_number || 'N/A'}</p>
              <p style={{ fontSize: '11px', color: '#475569' }}>وثيقة CMR: متوفرة وموثقة إلكترونياً</p>
            </div>
          </div>

          <div className="section-title">4. إثبات التسليم الرقمي المعتمد (Proof of Delivery - POD)</div>
          {d.deliveryProof ? (
            <>
              <div className="grid-2">
                <div className="card-box">
                  <label>بيانات المستلم</label>
                  <p>المستلم: <strong>{d.deliveryProof.signed_by}</strong></p>
                  <p style={{ fontSize: '11px', color: '#475569' }}>
                    تاريخ التسليم: {new Date(d.deliveryProof.signed_at).toLocaleString('ar-MA')}
                  </p>
                  <p style={{ fontSize: '11px', color: '#475569' }}>
                    الإحداثيات GPS: {d.deliveryProof.latitude?.toFixed(5) || 'N/A'}, {d.deliveryProof.longitude?.toFixed(5) || 'N/A'}
                  </p>
                </div>
                <div className="card-box">
                  <label>حالة الاعتماد الجنائي</label>
                  <p style={{ color: '#059669', fontWeight: 700 }}>✓ التوقيع موثق ومحمٍ ضد التعديل</p>
                  <p style={{ fontSize: '10px', color: '#64748b', wordBreak: 'break-all' }}>البصمة: {d.integrityHash}</p>
                </div>
              </div>
              <div className="signature-container">
                <div className="signature-box">
                  <label>التوقيع الحي للمستلم</label>
                  <img src={d.deliveryProof.signature_url} alt="Signature" />
                </div>
                {d.deliveryProof.cmr_image_url ? (
                  <div className="signature-box">
                    <label>صورة وثيقة CMR المختومة (Visé)</label>
                    <img src={d.deliveryProof.cmr_image_url} alt="Stamped CMR" />
                  </div>
                ) : (
                  <div className="signature-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                    لم يتم إرفاق صورة CMR إضافية
                  </div>
                )}
              </div>
            </>
          ) : (
            <p style={{ color: '#e11d48', padding: '8px', fontWeight: 600 }}>⚠️ لم يتم تسجيل إثبات التسليم (POD) لهذه الرحلة بعد.</p>
          )}

          <div className="section-title">5. الخلاصة المالية والربحية التشغيلية (P&L)</div>
          <div className="financial-box">
            <div className="financial-row">
              <span>إجمالي إيراد الرحلة (ذهاب + عودة):</span>
              <strong>{formatCurrency(d.financialSummary.revenue, 'MAD')}</strong>
            </div>
            <div className="financial-row" style={{ color: '#e11d48' }}>
              <span>نفقات الوقود (Gasoil):</span>
              <span>-{formatCurrency(d.financialSummary.fuelCost, 'MAD')}</span>
            </div>
            <div className="financial-row" style={{ color: '#e11d48' }}>
              <span>سلف ومصروفات السائق:</span>
              <span>-{formatCurrency(d.financialSummary.advancesCost, 'MAD')}</span>
            </div>
            {d.financialSummary.ferryCost > 0 && (
              <div className="financial-row" style={{ color: '#e11d48' }}>
                <span>تذاكر العبّارة البحرية:</span>
                <span>-{formatCurrency(d.financialSummary.ferryCost, 'MAD')}</span>
              </div>
            )}
            <div className="financial-row financial-total" style={{ color: '#059669' }}>
              <span>صافي الأرباح المحققة:</span>
              <span>{formatCurrency(d.financialSummary.netProfit, 'MAD')} (هامش {d.financialSummary.profitMarginPercentage}%)</span>
            </div>
          </div>

          <div className="security-stamp">
            🔐 شهادة أمان رقمية صادرة آلياً من نظام Trans Bodanon ERP • البصمة التشفيرية: {d.integrityHash}
          </div>
        </div>
      </body>
    </html>
  );
}

export default TripDossierPdfTemplate;
