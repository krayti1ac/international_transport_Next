'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  generateAccountingExport,
  getTaxComplianceSummaryAction,
  getCorridorPnlSummaryAction,
} from '../services/accounting-export.actions';
import type {
  AccountingSoftware,
  AccountingReportType,
  TaxComplianceSummary,
  CorridorPnlSummary,
} from '../types';
import {
  Download,
  FileSpreadsheet,
  RefreshCw,
  FileCheck2,
  ShieldCheck,
  TrendingUp,
  Layers,
  Building2,
  Anchor,
  Globe2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/forex';
import { useLanguage } from '@/components/language-provider';

interface AccountingExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccountingExportModal({ isOpen, onClose }: AccountingExportModalProps) {
  const { t, dir } = useLanguage();
  const { toast } = useToast();
  const now = new Date();
  const currentYear = now.getFullYear();

  const [activeTab, setActiveTab] = useState<AccountingReportType>('journal');
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(`${currentYear}-12-31`);
  const [software, setSoftware] = useState<AccountingSoftware>('sage100');
  const [includeSales, setIncludeSales] = useState(true);
  const [includeTreasury, setIncludeTreasury] = useState(true);
  const [loading, setLoading] = useState(false);

  // Live KPI Summary states
  const [taxSummary, setTaxSummary] = useState<TaxComplianceSummary | null>(null);
  const [pnlSummary, setPnlSummary] = useState<CorridorPnlSummary | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);

  const loadKpis = useCallback(async () => {
    if (!isOpen) return;
    setKpiLoading(true);
    try {
      if (activeTab === 'tva_art92') {
        const res = await getTaxComplianceSummaryAction(startDate, endDate);
        if (res.success && res.summary) setTaxSummary(res.summary);
      } else if (activeTab === 'corridor_pnl') {
        const res = await getCorridorPnlSummaryAction(startDate, endDate);
        if (res.success && res.summary) setPnlSummary(res.summary);
      }
    } catch (err) {
      console.error('Failed to load accounting KPIs:', err);
    } finally {
      setKpiLoading(false);
    }
  }, [isOpen, activeTab, startDate, endDate]);

  useEffect(() => {
    loadKpis();
  }, [loadKpis]);

  const handleExport = async (reportTypeOverride?: AccountingReportType) => {
    const reportType = reportTypeOverride || activeTab;
    const journalTypes: ('sales' | 'purchases' | 'treasury' | 'forex')[] = [];
    if (includeSales) journalTypes.push('sales');
    if (includeTreasury) journalTypes.push('treasury');

    if (reportType === 'journal' && journalTypes.length === 0) {
      toast({
        title: t('تنبيه', 'Attention', 'Atención'),
        description: t(
          'يرجى تحديد دفتر يومية واحد على الأقل',
          'Veuillez sélectionner au moins un type de journal',
          'Seleccione al menos un tipo de diario'
        ),
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await generateAccountingExport({
        startDate,
        endDate,
        reportType,
        journalTypes,
        software,
      });

      if (!res.success || !res.content) {
        throw new Error(
          res.error ||
            t('فشل توليد ملف التصدير', "Échec de génération du fichier d'export", 'Error al generar exportación')
        );
      }

      // Trigger automatic browser download
      const blob = new Blob([res.content], { type: res.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: t('✅ تم التصدير بنجاح', '✅ Exportation réussie', '✅ Exportación exitosa'),
        description: t(
          `تم تنزيل ${res.filename} (${res.totalEntries} سجلاً).`,
          `Fichier ${res.filename} téléchargé (${res.totalEntries} enregistrements).`,
          `Archivo ${res.filename} descargado (${res.totalEntries} registros).`
        ),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export error';
      toast({
        title: t('خطأ أثناء التصدير', "Erreur lors de l'export", 'Error en la exportación'),
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir={dir}>
        <DialogHeader className="text-start border-b border-border/60 pb-3">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            {t(
              'محرك تصدير الإقرارات الجبائية والمحاسبية المتقدمة',
              'Générateur Fiscal & Export Comptable Avancé (ERP / TVA / DUM)',
              'Generador Fiscal y Exportación Contable Avanzada (ERP / IVA / DUM)'
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t(
              'توليد قيود ERP متوازنة، إقرار إعفاء الضريبة مادة 92 CGI، وتتبع تصاريح DUM وأرباح الممرات.',
              'Génération des écritures ERP équilibrées, attestation Art. 92 CGI, traçabilité DUM et rentabilité par corridor.',
              'Generación de asientos ERP balanceados, certificación Art. 92 CGI, trazabilidad DUM y rentabilidad por corredor.'
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Navigation Tabs */}
        <div className="flex border-b border-border/80 gap-1 pt-1 overflow-x-auto text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('journal')}
            className={`px-3 py-2 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'journal'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            {t('دفاتر اليومية (ERP)', 'Journaux ERP (Sage/Odoo)', 'Diarios ERP')}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tva_art92')}
            className={`px-3 py-2 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'tva_art92'
                ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400 font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {t('إقرار TVA (مادة 92 CGI)', 'Déclaration TVA (Art. 92 CGI)', 'Declaración IVA (Art. 92 CGI)')}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dum_customs')}
            className={`px-3 py-2 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'dum_customs'
                ? 'border-amber-600 text-amber-700 dark:text-amber-400 font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Anchor className="w-3.5 h-3.5" />
            {t('سجل الجمارك (DUM / PortNet)', 'Registre Douane (DUM/PortNet)', 'Registro Aduanas (DUM)')}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('corridor_pnl')}
            className={`px-3 py-2 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'corridor_pnl'
                ? 'border-teal-600 text-teal-700 dark:text-teal-400 font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            {t('أرباح الممرات (Corridor P&L)', 'Rentabilité P&L Corridors', 'Rentabilidad Corredores')}
          </button>
        </div>

        {/* Global Date Range Filter */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">
              {t('من تاريخ:', 'Du (Date début):', 'Desde:')}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono"
              dir="ltr"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">
              {t('إلى تاريخ:', 'Au (Date fin):', 'Hasta:')}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono"
              dir="ltr"
            />
          </div>
        </div>

        {/* TAB 1: ERP JOURNALS */}
        {activeTab === 'journal' && (
          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                {t('البرنامج المحاسبي المستهدف:', 'Logiciel Comptable Cible:', 'Software Contable Objetivo:')}
              </label>
              <Select value={software} onValueChange={(val) => setSoftware(val as AccountingSoftware)}>
                <SelectTrigger className="w-full h-9 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sage100">Sage 100 Comptabilité (.txt tabulé PNM)</SelectItem>
                  <SelectItem value="odoo">Odoo Accounting v16/v17/v18 (.csv move lines)</SelectItem>
                  <SelectItem value="ciel">Ciel Compta / Sage 50 (.csv point-virgule)</SelectItem>
                  <SelectItem value="standard_csv">
                    {t('ملف قيود عام (.csv موحد)', 'Journal Général Standard (.csv UTF-8)', 'Diario General (.csv)')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-muted/40 rounded-xl border border-border/80 space-y-2.5">
              <label className="text-xs font-bold text-foreground block">
                {t('دفاتر اليومية المراد إدراجها:', 'Journaux à inclure:', 'Diarios a incluir:')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sales"
                  checked={includeSales}
                  onChange={(e) => setIncludeSales(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                />
                <label htmlFor="sales" className="text-xs cursor-pointer select-none">
                  {t(
                    'يومية المبيعات والفواتير الدولية (Journal des Ventes - VT)',
                    'Journal des Ventes & Prestations TIR (VT)',
                    'Diario de Ventas (VT)'
                  )}
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="treasury"
                  checked={includeTreasury}
                  onChange={(e) => setIncludeTreasury(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                />
                <label htmlFor="treasury" className="text-xs cursor-pointer select-none">
                  {t(
                    'يومية الخزينة والمقبوضات بنظام FIFO (Journal de Trésorerie - BQ/CA)',
                    'Journal de Trésorerie & Encaissements FIFO (BQ/CA)',
                    'Diario de Tesorería (BQ/CA)'
                  )}
                </label>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TVA ARTICLE 92 CGI */}
        {activeTab === 'tva_art92' && (
          <div className="space-y-4 py-2">
            {kpiLoading ? (
              <div className="flex items-center justify-center p-6 text-xs text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin me-2" />
                {t('جاري احتساب مؤشرات الإقرار الضريبي...', 'Calcul des indicateurs fiscaux...', 'Calculando indicadores...')}
              </div>
            ) : taxSummary ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 block">
                    {t('رقم المعاملات المعفى (مادة 92)', 'C.A Exonéré Art. 92 CGI', 'Facturación Exenta Art. 92')}
                  </span>
                  <span className="text-base font-extrabold text-emerald-800 dark:text-emerald-300 font-mono">
                    {formatCurrency(taxSummary.exemptTurnoverArt92MAD, 'MAD')}
                  </span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    {t(
                      `نسبة الإعفاء: ${taxSummary.exemptionRatio}% من إجمالي المبيعات`,
                      `Taux d'exonération: ${taxSummary.exemptionRatio}% du C.A global`,
                      `Ratio de exención: ${taxSummary.exemptionRatio}%`
                    )}
                  </span>
                </div>

                <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
                  <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 block">
                    {t('رقم المعاملات الخاضع للضريبة', 'C.A Taxable National', 'Facturación Sujeta')}
                  </span>
                  <span className="text-base font-extrabold text-indigo-800 dark:text-indigo-300 font-mono">
                    {formatCurrency(taxSummary.taxableTurnoverMAD, 'MAD')}
                  </span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    {t('ضريبة محصلة: ', 'TVA collectée: ', 'IVA repercutido: ')}
                    {formatCurrency(taxSummary.totalTvaCollectedMAD, 'MAD')}
                  </span>
                </div>

                <div className="p-3 bg-slate-500/10 border border-slate-500/30 rounded-xl">
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">
                    {t('العمليات ووثائق DUM', 'Opérations & DUMs', 'Operaciones y DUMs')}
                  </span>
                  <span className="text-base font-extrabold text-slate-800 dark:text-slate-200 font-mono">
                    {taxSummary.totalDumsTracked} / {taxSummary.totalInvoicesCount}
                  </span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    {t('فواتير دولية موثقة برقم DUM', 'Factures avec traçabilité DUM', 'Facturas con trazabilidad')}
                  </span>
                </div>
              </div>
            ) : null}

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              <FileCheck2 className="w-4 h-4 inline-block me-1.5 text-amber-600" />
              {t(
                'وفقاً للمادة 92-I-38° من المدونة العامة للضرائب (CGI Maroc)، تعفى خدمات النقل الدولي للبضائع الموجهة أو القادمة من الخارج مع الحق في خصم الضريبة المدفوعة مسبقاً (Gasoil, Péage, Maintenance). يتضمن الملف المعرف الموحد للمقاولة (ICE) وأرقام الـ DUM الجمركية.',
                "Conformément à l'Art. 92-I-38° du CGI marocain, les prestations de transport international routier (TIR) sont exonérées de la TVA avec droit à déduction. Le relevé exporté contient l'ICE client, le numéro DUM et la référence CMR officielle pour contrôle fiscal.",
                'Según el Art. 92-I-38° del Estatuto Fiscal de Marruecos, el transporte internacional TIR está exento de IVA con derecho a deducción.'
              )}
            </div>
          </div>
        )}

        {/* TAB 3: DUM & CUSTOMS AUDIT */}
        {activeTab === 'dum_customs' && (
          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-border/80 bg-muted/30">
                <div className="flex items-center gap-1.5 text-foreground font-semibold">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <span>{t('مكتب طنجة المتوسط', 'Bureau Tanger Med (MA003100)', 'Aduana Tánger Med')}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {t(
                    'الممر الأوروبي البحري، الربط المسبق مع PortNet وأرقام MRN الجمركية.',
                    'Corridor maritime européen, pré-avis PortNet et numéros MRN européens.',
                    'Corredor marítimo europeo y notificaciones PortNet.'
                  )}
                </p>
              </div>

              <div className="p-3 rounded-xl border border-border/80 bg-muted/30">
                <div className="flex items-center gap-1.5 text-foreground font-semibold">
                  <Globe2 className="w-4 h-4 text-amber-600" />
                  <span>{t('مكتب الكركارات', 'Bureau Guerguerat (MA004900)', 'Aduana Guerguerat')}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {t(
                    'الممر الإفريقي البري (موريتانيا / السنغال)، أختام الترانزيت ودفاتر المرور.',
                    'Corridor terrestre africain (Mauritanie / Sénégal), transit et carnet TIR.',
                    'Corredor terrestre africano y tránsitos aduaneros.'
                  )}
                </p>
              </div>
            </div>

            <p className="text-muted-foreground leading-relaxed">
              {t(
                'يولد هذا التقرير جدولاً تفصيلياً مطابقاً لمتطلبات إدارة الجمارك والضرائب غير المباشرة (ADII) يربط رقم الفاتورة والوزن الصافي ورقم التصريح المفصل (DUM) ورقم الـ MRN.',
                "Ce rapport génère un tableau conforme aux audits de l'ADII reliant facture, poids net exporté, DUM et MRN PortNet.",
                'Genera un informe para la ADII relacionando factura, peso, DUM y MRN.'
              )}
            </p>
          </div>
        )}

        {/* TAB 4: CORRIDOR P&L */}
        {activeTab === 'corridor_pnl' && (
          <div className="space-y-4 py-2">
            {kpiLoading ? (
              <div className="flex items-center justify-center p-6 text-xs text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin me-2" />
                {t('جاري احتساب ربحية الممرات بدقة Decimal.js...', 'Calcul de la rentabilité par corridor...', 'Calculando rentabilidad...')}
              </div>
            ) : pnlSummary ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-teal-500/10 border border-teal-500/30 rounded-xl">
                    <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 block">
                      {t('إجمالي المداخيل', 'Chiffre d’Affaires Total', 'Ingresos Totales')}
                    </span>
                    <span className="text-base font-extrabold text-teal-800 dark:text-teal-300 font-mono">
                      {formatCurrency(pnlSummary.totalRevenueMAD, 'MAD')}
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      {pnlSummary.totalTripsCount} {t('رحلة دولية ومحلية', 'voyages réalisés', 'viajes')}
                    </span>
                  </div>

                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl">
                    <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 block">
                      {t('تكاليف التشغيل', 'Charges d’Exploitation', 'Costes Operativos')}
                    </span>
                    <span className="text-base font-extrabold text-rose-800 dark:text-rose-300 font-mono">
                      {formatCurrency(pnlSummary.totalOperatingCostsMAD, 'MAD')}
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      {t('وقود، بواخر، بدلات وصيانة', 'Gasoil, Ferry, Primes & Entretien', 'Combustible, Ferry, Dietas')}
                    </span>
                  </div>

                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 block">
                      {t('الهامش الإجمالي الصافي', 'Marge Nette Consolidée', 'Margen Neto')}
                    </span>
                    <span className="text-base font-extrabold text-emerald-800 dark:text-emerald-300 font-mono">
                      {formatCurrency(pnlSummary.netMarginMAD, 'MAD')}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                      {pnlSummary.overallMarginPercent}% {t('نسبة المردودية', 'Taux de Marge', 'Margen')}
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-border/60 rounded-xl border border-border/80 overflow-hidden text-xs">
                  {pnlSummary.corridors.map((c) => (
                    <div key={c.corridor} className="p-2.5 flex items-center justify-between bg-card">
                      <div>
                        <span className="font-bold text-foreground block">{c.corridorName}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {c.totalTrips} {t('رحلات', 'voyages', 'viajes')} • {t('تكاليف:', 'Charges:', 'Costes:')}{' '}
                          {formatCurrency(c.totalOperatingCostMAD, 'MAD')}
                        </span>
                      </div>
                      <div className="text-end">
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400 block font-mono">
                          +{formatCurrency(c.grossMarginMAD, 'MAD')}
                        </span>
                        <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-md">
                          {c.grossMarginPercent}% {t('هامش', 'Marge', 'Margen')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border/60">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading} className="rounded-xl text-xs">
            {t('إغلاق', 'Fermer', 'Cerrar')}
          </Button>

          <Button
            size="sm"
            onClick={() => handleExport()}
            disabled={loading}
            className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>
              {activeTab === 'journal'
                ? t('تصدير قيود اليومية الآن', 'Exporter le Journal ERP', 'Exportar Diario ERP')
                : activeTab === 'tva_art92'
                ? t('تحميل إقرار المادة 92 CGI', 'Télécharger Relevé Art. 92 CGI', 'Descargar Relevé Art. 92')
                : activeTab === 'dum_customs'
                ? t('تحميل سجل DUM الجمركي', 'Télécharger Registre DUM Douane', 'Descargar Registro DUM')
                : t('تحميل تحليل P&L للممرات', 'Télécharger P&L Corridors', 'Descargar P&L')}
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
