'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/components/language-provider';
import type { Invoice, Client, TripOrder } from '@/types/database';
import type {
  EInvoiceDocument,
  FiscalVaultRecord,
  DgiComplianceStatus,
} from '../types/einvoice.types';
import {
  sealAndIssueDgiEInvoiceAction,
  verifyEInvoiceIntegrityAction,
  sendEInvoiceViaWhatsAppAction,
} from '../services/einvoicing.actions';
import { DgiComplianceBadge } from './DgiComplianceBadge';
import {
  ShieldCheck,
  ShieldAlert,
  Download,
  Send,
  FileCode,
  QrCode,
  CheckCircle2,
  Copy,
  ExternalLink,
  Printer,
  RefreshCw,
  Landmark,
  Scale,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import Image from 'next/image';

interface EInvoiceDgiModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  client?: Client | null;
  trip?: TripOrder | null;
}

export function EInvoiceDgiModal({
  isOpen,
  onClose,
  invoice,
  client,
  trip,
}: EInvoiceDgiModalProps) {
  const { t, dir, locale } = useLanguage();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingWa, setIsSendingWa] = useState(false);
  const [document, setDocument] = useState<EInvoiceDocument | null>(null);
  const [vaultRecord, setVaultRecord] = useState<FiscalVaultRecord | null>(null);
  const [complianceStatus, setComplianceStatus] = useState<DgiComplianceStatus>('compliant');
  const [integrityMessage, setIntegrityMessage] = useState<string>('');
  const [waPhone, setWaPhone] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'certificate' | 'breakdown' | 'xml'>('certificate');

  // Load or seal on modal open
  useEffect(() => {
    if (isOpen && invoice) {
      setWaPhone(client?.phone || '');
      loadOrSealEInvoice(invoice.id);
    } else {
      setDocument(null);
      setVaultRecord(null);
      setIntegrityMessage('');
    }
  }, [isOpen, invoice]);

  const loadOrSealEInvoice = async (invId: number) => {
    setIsLoading(true);
    try {
      const res = await sealAndIssueDgiEInvoiceAction(invId);
      if (res.success && res.document && res.vaultRecord) {
        setDocument(res.document);
        setVaultRecord(res.vaultRecord);
        setComplianceStatus(res.vaultRecord.complianceStatus);
      } else {
        toast({
          title: t('خطأ في إعداد الفاتورة', 'Erreur de génération', 'Error de generación'),
          description: res.error || t('تعذر إعداد الختم الضريبي', 'Impossible de sceller la facture', 'No se pudo sellar la factura'),
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      console.error('[EInvoiceDgiModal] Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyIntegrity = async () => {
    if (!invoice) return;
    setIsVerifying(true);
    try {
      const res = await verifyEInvoiceIntegrityAction(invoice.invoice_number, {
        totalHt: invoice.ht_amount || invoice.total_amount || '0',
        totalTtc: invoice.ttc_amount || invoice.total_amount || '0',
        currency: invoice.currency || 'MAD',
        buyerIce: client?.ice,
      });

      if (res.success && 'status' in res && res.status) {
        setComplianceStatus(res.status);
        setIntegrityMessage(res.message || '');
        toast({
          title: res.isCompliant
            ? t('الفاتورة مطابقة 100%', 'Facture 100% Conforme', 'Factura 100% Conforme')
            : t('تحذير أمني', 'Alerte de Sécurité', 'Alerta de Seguridad'),
          description: res.message,
          variant: res.isCompliant ? 'default' : 'destructive',
        });
      } else {
        toast({
          title: t('خطأ في التحقق', 'Erreur de vérification', 'Error de verificación'),
          description: ('error' in res && res.error) || t('تعذر إتمام الفحص الجنائي', 'Échec du contrôle criminel', 'Error en el control criminal'),
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: t('خطأ في التحقق', 'Erreur de vérification', 'Error de verificación'),
        description: t('تعذر إتمام الفحص الجنائي', 'Échec du contrôle criminel', 'Error en el control criminal'),
        variant: 'destructive',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDownloadXml = () => {
    if (!document?.xmlContent) return;
    const blob = new Blob([document.xmlContent], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `UBL21_${document.invoiceNumber}.xml`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: t('تم تنزيل ملف UBL 2.1', 'Fichier UBL 2.1 Téléchargé', 'Archivo UBL 2.1 Descargado'),
      description: `UBL21_${document.invoiceNumber}.xml`,
    });
  };

  const handleCopyHash = () => {
    if (!document?.seal.sha256Digest) return;
    navigator.clipboard.writeText(document.seal.sha256Digest);
    toast({
      title: t('تم النسخ', 'Copié', 'Copiado'),
      description: t('تم نسخ بصمة التشفير SHA-256', 'Empreinte SHA-256 copiée', 'Huella SHA-256 copiada'),
    });
  };

  const handleSendWhatsApp = async () => {
    if (!invoice || !waPhone) {
      toast({
        title: t('رقم الهاتف مطلوب', 'Numéro de téléphone requis', 'Número de teléfono requerido'),
        variant: 'destructive',
      });
      return;
    }

    setIsSendingWa(true);
    try {
      const res = await sendEInvoiceViaWhatsAppAction({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        recipientPhone: waPhone,
        totalTtc: invoice.ttc_amount || invoice.total_amount || '0',
        currency: invoice.currency || 'MAD',
        buyerName: client?.name,
        verificationUrl: document?.seal.verificationUrl,
      });

      if (res.success) {
        toast({
          title: t('تم إرسال الفاتورة', 'Facture Envoyée', 'Factura Enviada'),
          description: t(
            'تم إرسال رابط الفاتورة والختم الضريبي للعميل عبر WhatsApp بنجاح',
            'Facture et scellé fiscal DGI envoyés avec succès par WhatsApp',
            'Factura y sello fiscal DGI enviados con éxito por WhatsApp'
          ),
        });
      } else {
        toast({
          title: t('فشل الإرسال', "Échec d'envoi", 'Error de envío'),
          description: res.error,
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: t('خطأ في الاتصال', 'Erreur de connexion', 'Error de conexión'),
        variant: 'destructive',
      });
    } finally {
      setIsSendingWa(false);
    }
  };

  if (!isOpen || !invoice) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 gap-0" dir={dir}>
        {/* Sovereign Header */}
        <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
              <Landmark className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-lg font-bold text-white">
                  {t(
                    'الفوترة الإلكترونية المعتمدة ضريبياً (DGI)',
                    'Facture Électronique Certifiée DGI',
                    'Factura Electrónica Certificada DGI'
                  )}
                </DialogTitle>
                <DgiComplianceBadge status={complianceStatus} />
              </div>
              <DialogDescription className="text-xs text-slate-400 mt-0.5">
                {t(
                  'المعيار الوطني المغربي للفوترة الإلكترونية UBL 2.1 • نظام الأختام المشفرة',
                  'Standard Marocain de Facturation Électronique UBL 2.1 • Système de Scellés Cryptographiques',
                  'Estándar Marroquí de Facturación Electrónica UBL 2.1 • Sistema de Sellos Criptográficos'
                )}
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleVerifyIntegrity}
              disabled={isVerifying || isLoading}
              className="bg-slate-800/80 border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700 text-xs h-8 gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
              <span>{t('فحص السلامة الجنائية', 'Vérifier Intégrité', 'Verificar Integridad')}</span>
            </Button>
            <Button
              size="sm"
              onClick={handleDownloadXml}
              disabled={!document}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t('تنزيل UBL 2.1 XML', 'Télécharger UBL XML', 'Descargar UBL XML')}</span>
            </Button>
          </div>
        </div>

        {/* Article 92-I-10° Sovereign Banner */}
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-5 py-2.5 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold">
              {locale === 'ar'
                ? 'إعفاء كلي من الضريبة على القيمة المضافة بموجب المادة 92-I-10° من المدونة العامة للضرائب المغربية (CGI)'
                : locale === 'es'
                ? 'Exención total del IVA según el Artículo 92-I-10° del Código General de Impuestos de Marruecos (CGI)'
                : "Exonération totale de la TVA en vertu de l'Article 92-I-10° du Code Général des Impôts marocain (CGI)"}
            </span>
          </div>
          <Badge variant="outline" className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-400 text-[10px] uppercase font-mono">
            TVA: 0.00% (Cat. E)
          </Badge>
        </div>

        {/* Content Body */}
        <div className="p-5">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="certificate" className="text-xs gap-1.5">
                <QrCode className="w-3.5 h-3.5" />
                <span>{t('الشهادة ورمز الـ QR', 'Certificat & QR Code', 'Certificado y QR')}</span>
              </TabsTrigger>
              <TabsTrigger value="breakdown" className="text-xs gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>{t('تفكيك المبالغ والأطراف', 'Montants & Parties', 'Montos y Partes')}</span>
              </TabsTrigger>
              <TabsTrigger value="xml" className="text-xs gap-1.5">
                <FileCode className="w-3.5 h-3.5" />
                <span>{t('ملف UBL 2.1 XML', 'Fichier UBL 2.1 XML', 'Archivo UBL 2.1 XML')}</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Certificate & QR */}
            <TabsContent value="certificate" className="space-y-4 m-0">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                {/* QR Code Presentation Box */}
                <div className="md:col-span-5 flex flex-col items-center justify-center p-5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                  <div className="relative p-2 bg-white rounded-lg shadow-sm border border-slate-200 mb-3">
                    {document?.seal.qrCodeDataUri ? (
                      <img
                        src={document.seal.qrCodeDataUri}
                        alt="DGI Tax QR Code"
                        className="w-48 h-48 rounded"
                      />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center bg-slate-100 text-slate-400">
                        <QrCode className="w-12 h-12 animate-pulse" />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {t(
                      'رمز الاستجابة السريعة الضريبي المشفر للمديرية العامة للضرائب',
                      'Code QR Fiscal Cryptographique DGI',
                      'Código QR Fiscal Criptográfico DGI'
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {t(
                      'امسح الرمز للتحقق من سلامة الفاتورة على البوابة الرسمية',
                      'Scannez pour vérifier la conformité fiscale officielle',
                      'Escanee para verificar la conformidad fiscal oficial'
                    )}
                  </p>
                </div>

                {/* Fiscal Certificate Metadata */}
                <div className="md:col-span-7 space-y-3">
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{t('رقم الفاتورة:', 'N° Facture:', 'N° Factura:')}</span>
                      <span className="font-mono font-bold text-foreground">{invoice.invoice_number}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{t('المعرف الموحد للمقاولة (ICE البائع):', 'ICE Fournisseur:', 'ICE Proveedor:')}</span>
                      <span className="font-mono font-semibold text-foreground">002345678000091</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{t('المعرف الموحد للمقاولة (ICE العميل):', 'ICE Client:', 'ICE Cliente:')}</span>
                      <span className="font-mono font-semibold text-foreground">{client?.ice || '001928374000082'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{t('تاريخ الإصدار والختم:', 'Date de Scellé:', 'Fecha de Sellado:')}</span>
                      <span className="font-mono text-foreground">{vaultRecord?.sealedAt || new Date().toISOString()}</span>
                    </div>
                  </div>

                  {/* SHA-256 Digest Box */}
                  <div className="p-3 bg-slate-900 text-slate-200 rounded-lg border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                        {t('بصمة النزاهة الرقمية (SHA-256 Digest)', 'Empreinte Digitale SHA-256', 'Huella Digital SHA-256')}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyHash}
                        className="h-6 text-[10px] px-2 text-slate-400 hover:text-white hover:bg-slate-800 gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{t('نسخ', 'Copier', 'Copiar')}</span>
                      </Button>
                    </div>
                    <p className="font-mono text-[11px] break-all text-emerald-400">
                      {document?.seal.sha256Digest || '6a0f...calculating...'}
                    </p>
                  </div>

                  {/* WhatsApp Dispatch Direct Form */}
                  <div className="p-3.5 bg-emerald-500/5 rounded-lg border border-emerald-500/20 space-y-2">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{t('إرسال الفاتورة والختم الضريبي للعميل عبر WhatsApp', 'Envoyer par WhatsApp', 'Enviar por WhatsApp')}</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={waPhone}
                        onChange={(e) => setWaPhone(e.target.value)}
                        placeholder="+212 600 000000"
                        className="h-8 text-xs font-mono"
                      />
                      <Button
                        size="sm"
                        onClick={handleSendWhatsApp}
                        disabled={isSendingWa}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs shrink-0 gap-1"
                      >
                        <Send className="w-3 h-3" />
                        <span>{t('إرسال الآن', 'Envoyer', 'Enviar')}</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: Breakdown & Financials */}
            <TabsContent value="breakdown" className="space-y-4 m-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Supplier Info */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-primary" />
                    <span>{t('بيانات الشركة المصدرة (الناقل)', 'Société Émettrice', 'Empresa Emisora')}</span>
                  </h4>
                  <p className="font-bold text-foreground">TRANS BODANON SARL</p>
                  <p className="text-muted-foreground">ICE: 002345678000091 | IF: 45892014</p>
                  <p className="text-muted-foreground">RC: 10452 Tanger | CNSS: 7890123</p>
                  <p className="text-muted-foreground">Zone Franche Logistique, Port Tanger Med</p>
                </div>

                {/* Customer Info */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>{t('بيانات العميل المستلم', 'Client Destinataire', 'Cliente Destinatario')}</span>
                  </h4>
                  <p className="font-bold text-foreground">{client?.name || 'CLIENT'}</p>
                  <p className="text-muted-foreground">ICE: {client?.ice || '001928374000082'}</p>
                  <p className="text-muted-foreground">{client?.address || client?.billing_address_line1 || 'Tanger, Maroc'}</p>
                  <p className="text-muted-foreground">{client?.phone || '-'} | {client?.email || '-'}</p>
                </div>
              </div>

              {/* Financial Totals Table */}
              <div className="border border-border/80 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 text-muted-foreground border-b border-border">
                    <tr>
                      <th className="py-2.5 px-3 text-start">{t('البند والخدمة', 'Prestation', 'Servicio')}</th>
                      <th className="py-2.5 px-3 text-center">{t('الكمية', 'Qté', 'Cant.')}</th>
                      <th className="py-2.5 px-3 text-end">{t('المبلغ الصافي (HT)', 'Montant HT', 'Monto Neto')}</th>
                      <th className="py-2.5 px-3 text-center">{t('الضريبة (TVA)', 'TVA', 'IVA')}</th>
                      <th className="py-2.5 px-3 text-end">{t('الإجمالي (TTC)', 'Total TTC', 'Total')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    <tr>
                      <td className="py-3 px-3 font-medium text-foreground">
                        {t('خدمات النقل الدولي للبضائع', 'Transport International Routier', 'Transporte Internacional por Carretera')}
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {trip?.route || invoice.route || 'Tanger Med -> Algeciras'} • {trip?.cmr_export_number || 'CMR-INTERNATIONAL'}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono">1.00</td>
                      <td className="py-3 px-3 text-end font-mono font-semibold">
                        {invoice.ht_amount || invoice.total_amount || '0'} {invoice.currency || 'MAD'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300">
                          0.00% (Exempt)
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-end font-mono font-bold text-foreground">
                        {invoice.ttc_amount || invoice.total_amount || '0'} {invoice.currency || 'MAD'}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-900 border-t border-border font-semibold">
                    <tr>
                      <td colSpan={4} className="py-2.5 px-3 text-end text-muted-foreground">
                        {t('المبلغ الإجمالي المستحق:', 'Total Net à Payer:', 'Total Neto a Pagar:')}
                      </td>
                      <td className="py-2.5 px-3 text-end font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        {invoice.ttc_amount || invoice.total_amount || '0'} {invoice.currency || 'MAD'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </TabsContent>

            {/* TAB 3: UBL 2.1 XML Content */}
            <TabsContent value="xml" className="space-y-3 m-0">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-mono">Standard: OASIS UBL 2.1 (ISO/IEC 19845) • Profile: DGI-MA-1.0</span>
                <Button variant="ghost" size="sm" onClick={handleDownloadXml} className="h-6 text-xs gap-1 text-primary">
                  <Download className="w-3 h-3" />
                  <span>{t('تنزيل الملف', 'Télécharger', 'Descargar')}</span>
                </Button>
              </div>
              <pre className="p-4 bg-slate-950 text-emerald-400 font-mono text-[11px] rounded-lg max-h-72 overflow-y-auto whitespace-pre-wrap border border-slate-800 leading-relaxed">
                {document?.xmlContent || '<!-- UBL 2.1 XML Generating... -->'}
              </pre>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

