import React from 'react';
import Decimal from 'decimal.js';
import type { InvoicePdfData } from '@/lib/pdf-service';

export interface InvoicePdfTemplateProps {
  data: InvoicePdfData;
}

export function InvoicePdfTemplate({ data }: InvoicePdfTemplateProps) {
  const ht = new Decimal(data.invoice.ht_amount || data.invoice.total_amount || 0).toFixed(2);
  const tvaRate = data.invoice.tva_rate || '0';
  const tva = new Decimal(data.invoice.tva_amount || 0).toFixed(2);
  const ttc = new Decimal(data.invoice.ttc_amount || data.invoice.total_amount || 0).toFixed(2);

  const bankInfo = data.bankAccount
    ? `${data.bankAccount.bank_name} - IBAN: ${data.bankAccount.account_number} (${data.bankAccount.currency})`
    : '';

  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="UTF-8" />
        <title>{`Facture ${data.invoice.invoice_number}`}</title>
        <style dangerouslySetInnerHTML={{ __html: `
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #fff; color: #0f172a; padding: 24px; line-height: 1.6; }
          .page { max-width: 800px; margin: 0 auto; border: 2px solid #0f172a; padding: 24px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; gap: 12px; }
          .header h1 { font-size: 20px; letter-spacing: 0.5px; }
          .header-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
          .header-logo { width: 64px; height: 64px; object-fit: contain; border: 1px solid #cbd5e1; border-radius: 8px; padding: 4px; background: #fff; flex-shrink: 0; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
          .box { border: 1px solid #0f172a; padding: 10px; min-height: 80px; }
          .box label { font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px; }
          .full { grid-column: 1 / -1; }
          .qr { text-align: center; margin: 16px 0; }
          .qr img { max-width: 160px; }
          table { width: 100%; border-collapse: collapse; margin: 12px 0; }
          th, td { border: 1px solid #0f172a; padding: 8px; text-align: right; font-size: 14px; }
          th { background: #f1f5f9; }
          .totals { display: flex; justify-content: flex-end; }
          .totals-box { width: 240px; }
          .total-row { display: flex; justify-content: space-between; padding: 4px 0; }
          .total-row.bold { font-weight: bold; border-top: 2px solid #0f172a; padding-top: 8px; margin-top: 4px; }
          .bank-info { background: #f0f9ff; border: 1px solid #bae6fd; padding: 10px; border-radius: 6px; margin-top: 12px; font-size: 13px; }
          @media print { body { padding: 0; } .page { border: 2px solid #000; max-width: 100%; } }
        ` }} />
      </head>
      <body>
        <div className="page">
          <div className="header">
            <div className="header-left">
              {data.companyLogoDataUrl && (
                <img src={data.companyLogoDataUrl} alt="Logo" className="header-logo" />
              )}
              <div>
                <h1>{data.companyName}</h1>
                <p style={{ fontSize: '12px', color: '#475569' }}>المملكة المغربية - شركة النقل الدولي</p>
                {data.companyIce && (
                  <p style={{ fontSize: '11px', color: '#64748b' }}>ICE: {data.companyIce}</p>
                )}
              </div>
            </div>
            <div style={{ textAlign: 'left' }}>
              <h1 style={{ fontSize: '22px' }}>FACTURE / فاتورة</h1>
              <p style={{ fontFamily: 'monospace', fontSize: '14px' }}>N°: {data.invoice.invoice_number || `INV-${data.invoice.id}`}</p>
              <p style={{ fontSize: '12px' }}>Date: {data.invoice.issue_date || new Date().toISOString().split('T')[0]}</p>
            </div>
          </div>

          <div className="grid">
            <div className="box">
              <label>العميل (Client)</label>
              <p><strong>{data.client.name}</strong></p>
              <p>ICE: {data.client.ice || 'N/A'}</p>
              <p>{data.client.address || data.client.city || 'المغرب'}</p>
              <p>{data.client.phone}</p>
            </div>
            <div className="box">
              <label>Payment Details</label>
              <p><span style={{ color: '#64748b' }}>Due Date:</span> {data.invoice.due_date || 'Upon Receipt'}</p>
              <p><span style={{ color: '#64748b' }}>Currency:</span> {data.invoice.currency || 'MAD'}</p>
              <p><span style={{ color: '#64748b' }}>Status:</span> <strong>{data.invoice.status}</strong></p>
            </div>
          </div>

          <div className="qr">
            <p style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>Facture Électronique (QR)</p>
            <img src={data.qrCodeBase64} alt="QR Code" />
            <p style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px', fontFamily: 'monospace' }}>{data.qrPayload}</p>
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Route</th>
                <th style={{ textAlign: 'left' }}>HT</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>خدمات الشحن والنقل الدولي</td>
                <td>{data.invoice.route || 'شحن دولي'}</td>
                <td style={{ textAlign: 'left', fontFamily: 'monospace' }}>{ht} {data.invoice.currency}</td>
              </tr>
            </tbody>
          </table>

          <div className="totals">
            <div className="totals-box">
              <div className="total-row">
                <span>HT:</span>
                <span style={{ fontFamily: 'monospace' }}>{ht} {data.invoice.currency}</span>
              </div>
              <div className="total-row">
                <span>TVA ({tvaRate}%):</span>
                <span style={{ fontFamily: 'monospace' }}>{tva} {data.invoice.currency}</span>
              </div>
              <div className="total-row bold">
                <span>TTC:</span>
                <span style={{ fontFamily: 'monospace' }}>{ttc} {data.invoice.currency}</span>
              </div>
            </div>
          </div>

          {bankInfo && (
            <div className="bank-info">
              <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>معلومات التحويل البنكي:</p>
              <p>{bankInfo}</p>
            </div>
          )}

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', textAlign: 'center', fontSize: '11px', color: '#94a3b8', marginTop: '24px' }}>
            شكراً لتعاملكم معنا • وثيقة تجارية نظامية صادرة إلكترونياً
          </div>
        </div>
      </body>
    </html>
  );
}

export default InvoicePdfTemplate;
