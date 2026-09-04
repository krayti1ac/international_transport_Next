import Decimal from 'decimal.js';
import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/server';
import type { Invoice, Client, BankAccount } from '@/types/database';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const EUROPEAN_COUNTRIES = new Set([
  'FR', 'ES', 'IT', 'DE', 'BE', 'NL', 'PT', 'AT', 'CH', 'GB',
  'IE', 'LU', 'DK', 'SE', 'NO', 'FI', 'PL', 'CZ', 'GR', 'RO',
]);

export interface InvoicePdfData {
  invoice: Invoice;
  client: Client;
  bankAccount: BankAccount | null;
  qrCodeBase64: string;
  qrPayload: string;
  companyName: string;
  companyLogoDataUrl: string | null;
}

export async function generateInvoiceQrPayload(invoice: Invoice, client: Client, companyName: string): Promise<string> {
  const name = companyName || 'Trans Bodanon';
  const ice = client.ice || '';
  const date = invoice.issue_date || new Date().toISOString().split('T')[0];
  const ttc = new Decimal(invoice.ttc_amount || invoice.total_amount || 0).toFixed(2);
  const tva = new Decimal(invoice.tva_amount || 0).toFixed(2);

  return `${name}|${ice}|${date}|${ttc}|${tva}`;
}

export async function generateQrCodeBase64(payload: string): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(payload, {
      width: 200,
      margin: 2,
      errorCorrectionLevel: 'M',
      type: 'image/png',
    });
    return dataUrl;
  } catch (err) {
    console.error('QR generation failed:', err);
    return '';
  }
}

async function fetchLogoAsDataUrl(publicUrl: string): Promise<string | null> {
  try {
    const res = await fetch(publicUrl, { cache: 'no-store' });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || 'image/png';
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (err) {
    console.warn('Could not inline company logo for PDF:', err);
    return null;
  }
}

export async function getInvoicePdfData(invoiceId: number): Promise<{ success: boolean; data?: InvoicePdfData; error?: string }> {
  try {
    const supabase = await createClient();

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', invoice.client_id)
      .single();

    if (clientError || !client) {
      return { success: false, error: 'Client not found' };
    }

    let bankAccount: BankAccount | null = null;

    if (invoice.currency === 'EUR' || (client.shipping_country && EUROPEAN_COUNTRIES.has(client.shipping_country.toUpperCase()))) {
      const { data: eurBank } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('currency', 'EUR')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      bankAccount = eurBank || null;
    }

    if (!bankAccount) {
      const { data: madBank } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('currency', 'MAD')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      bankAccount = madBank || null;
    }

    // Load company branding (name + logo) for the PDF header
    const { data: settings } = await supabase
      .from('system_settings')
      .select('company_name, logo_url')
      .eq('id', 1)
      .maybeSingle();
    const companyName = settings?.company_name?.trim() || 'Trans Bodanon International Logistics';
    const companyLogoDataUrl = settings?.logo_url ? await fetchLogoAsDataUrl(settings.logo_url) : null;

    const qrPayload = await generateInvoiceQrPayload(invoice, client, companyName);
    const qrCodeBase64 = await generateQrCodeBase64(qrPayload);

    return {
      success: true,
      data: {
        invoice,
        client,
        bankAccount,
        qrCodeBase64,
        qrPayload,
        companyName,
        companyLogoDataUrl,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate invoice PDF data';
    return { success: false, error: message };
  }
}

export function buildInvoicePdfHtml(data: InvoicePdfData): string {
  const ht = new Decimal(data.invoice.ht_amount || data.invoice.total_amount || 0).toFixed(2);
  const tvaRate = data.invoice.tva_rate || '0';
  const tva = new Decimal(data.invoice.tva_amount || 0).toFixed(2);
  const ttc = new Decimal(data.invoice.ttc_amount || data.invoice.total_amount || 0).toFixed(2);

  const bankInfo = data.bankAccount
    ? `${data.bankAccount.bank_name} - IBAN: ${data.bankAccount.account_number} (${data.bankAccount.currency})`
    : '';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>Facture ${data.invoice.invoice_number}</title>
  <style>
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
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-left">
        ${data.companyLogoDataUrl ? `<img src="${data.companyLogoDataUrl}" alt="Logo" class="header-logo" />` : ''}
        <div>
          <h1>${data.companyName}</h1>
          <p style="font-size: 12px; color: #475569;">المملكة المغربية - شركة النقل الدولي</p>
        </div>
      </div>
      <div style="text-align: left;">
        <h1 style="font-size: 22px;">FACTURE / فاتورة</h1>
        <p style="font-family: monospace; font-size: 14px;">N°: ${data.invoice.invoice_number || `INV-${data.invoice.id}`}</p>
        <p style="font-size: 12px;">Date: ${data.invoice.issue_date || new Date().toISOString().split('T')[0]}</p>
      </div>
    </div>

    <div class="grid">
      <div class="box">
        <label>العميل (Client)</label>
        <p><strong>${data.client.name}</strong></p>
        <p>ICE: ${data.client.ice || 'N/A'}</p>
        <p>${data.client.address || data.client.city || 'المغرب'}</p>
        <p>${data.client.phone}</p>
      </div>
      <div class="box">
        <label>Payment Details</label>
        <p><span style="color: #64748b;">Due Date:</span> ${data.invoice.due_date || 'Upon Receipt'}</p>
        <p><span style="color: #64748b;">Currency:</span> ${data.invoice.currency || 'MAD'}</p>
        <p><span style="color: #64748b;">Status:</span> <strong>${data.invoice.status}</strong></p>
      </div>
    </div>

    <div class="qr">
      <p style="font-size: 10px; color: #64748b; margin-bottom: 4px;">Facture Électronique (QR)</p>
      <img src="${data.qrCodeBase64}" alt="QR Code" />
      <p style="font-size: 9px; color: #94a3b8; margin-top: 4px; font-family: monospace;">${data.qrPayload}</p>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Route</th>
          <th style="text-align: left;">HT</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>خدمات الشحن والنقل الدولي</td>
          <td>${data.invoice.route || 'شحن دولي'}</td>
          <td style="text-align: left; font-family: monospace;">${ht} ${data.invoice.currency}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-box">
        <div class="total-row">
          <span>HT:</span>
          <span style="font-family: monospace;">${ht} ${data.invoice.currency}</span>
        </div>
        <div class="total-row">
          <span>TVA (${tvaRate}%):</span>
          <span style="font-family: monospace;">${tva} ${data.invoice.currency}</span>
        </div>
        <div class="total-row bold">
          <span>TTC:</span>
          <span style="font-family: monospace;">${ttc} ${data.invoice.currency}</span>
        </div>
      </div>
    </div>

    ${bankInfo ? `
    <div class="bank-info">
      <p style="font-weight: bold; margin-bottom: 4px;">معلومات التحويل البنكي:</p>
      <p>${bankInfo}</p>
    </div>
    ` : ''}

    <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; font-size: 11px; color: #94a3b8; margin-top: 24px;">
      شكراً لتعاملكم معنا • وثيقة تجارية نظامية صادرة إلكترونياً
    </div>
  </div>
</body>
</html>`;
}
