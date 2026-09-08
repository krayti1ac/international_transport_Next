import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.edge';
import Decimal from 'decimal.js';
import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/server';
import InvoicePdfTemplate from '@/components/pdf/InvoicePdfTemplate';
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
  companyIce?: string | null;
}

export async function generateInvoiceQrPayload(invoice: Invoice, client: Client, companyName: string): Promise<string> {
  const name = companyName || 'Trans Bodanon';
  const ice = client.ice || '';
  const date = invoice.issue_date || new Date().toISOString().split('T')[0];
  const ttc = new Decimal(invoice.ttc_amount || invoice.total_amount || 0).toFixed(2);
  const tva = new Decimal(invoice.tva_amount || 0).toFixed(2);

  return `${name}|${ice}|${date}|${ttc}|${tva}`;
}

async function fetchLogoAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/png';
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

export async function generateQrCodeBase64(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    width: 140,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
}

export async function getInvoicePdfData(invoiceId: number): Promise<{ success: boolean; data?: InvoicePdfData; error?: string }> {
  try {
    const supabase = await createClient();

    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (invErr || !invoice) {
      return { success: false, error: invErr?.message || 'Invoice not found' };
    }

    const { data: client, error: cliErr } = await supabase
      .from('clients')
      .select('*')
      .eq('id', parseInt(invoice.client_id, 10))
      .single();

    if (cliErr || !client) {
      return { success: false, error: cliErr?.message || 'Client not found' };
    }

    let bankAccount: BankAccount | null = null;
    if (invoice.bank_account_id) {
      const { data: bAcc } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('id', parseInt(invoice.bank_account_id, 10))
        .maybeSingle();
      bankAccount = bAcc || null;
    }

    const isEuropean = EUROPEAN_COUNTRIES.has(client.shipping_country || '') ||
      EUROPEAN_COUNTRIES.has(client.billing_country || '');

    if (!bankAccount && isEuropean) {
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

    // Load company branding (name + logo + ICE) for the PDF header
    let companyName = 'ترانس بودانون الدولية';
    let companyLogoDataUrl: string | null = null;
    let companyIce: string | null = null;

    if (invoice.company_id) {
      const { data: comp } = await supabase
        .from('companies')
        .select('*')
        .eq('id', invoice.company_id)
        .maybeSingle();

      if (comp) {
        companyName = comp.name?.trim() || companyName;
        companyLogoDataUrl = comp.logo_url ? await fetchLogoAsDataUrl(comp.logo_url) : null;
        companyIce = comp.ice || null;
      }
    }

    if (!companyLogoDataUrl && !companyIce) {
      const { data: settings } = await supabase
        .from('system_settings')
        .select('company_name, logo_url')
        .eq('id', 1)
        .maybeSingle();
      if (settings?.company_name) {
        companyName = settings.company_name.trim();
      }
      if (settings?.logo_url) {
        companyLogoDataUrl = await fetchLogoAsDataUrl(settings.logo_url);
      }
    }

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
        companyIce,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate invoice PDF data';
    return { success: false, error: message };
  }
}

export function buildInvoicePdfHtml(data: InvoicePdfData): string {
  const staticHtml = renderToStaticMarkup(React.createElement(InvoicePdfTemplate, { data }));
  return `<!DOCTYPE html>${staticHtml}`;
}
