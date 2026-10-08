'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/components/language-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import type {
  FuelCardProvider,
  ReconciledFuelEntry,
  FuelReconciliationSummary,
  ReconciliationStatus,
} from '../types/fuel-reconciliation.types';
import {
  getSimulatedFuelReconciliationAction,
  reconcileFuelCardStatementAction,
} from '../services/fuel-reconciliation.actions';
import {
  CreditCard,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Upload,
  Search,
  Filter,
  RefreshCw,
  MapPin,
  Flame,
  CheckCircle2,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
  Layers,
  ArrowUpDown,
  Coins,
} from 'lucide-react';

interface FuelReconciliationDashboardViewProps {
  initialSummary?: FuelReconciliationSummary;
  initialEntries?: ReconciledFuelEntry[];
}

export function FuelReconciliationDashboardView({
  initialSummary,
  initialEntries,
}: FuelReconciliationDashboardViewProps) {
  const { t, locale, dir } = useLanguage();

  const [summary, setSummary] = useState<FuelReconciliationSummary | null>(initialSummary || null);
  const [entries, setEntries] = useState<ReconciledFuelEntry[]>(initialEntries || []);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [csvInput, setCsvInput] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<FuelCardProvider>('afriquia');

  // Load baseline simulated or live reconciliation on mount if empty
  useEffect(() => {
    if (!summary || entries.length === 0) {
      handleRefresh();
    }
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const res = await getSimulatedFuelReconciliationAction();
      if (res.success && res.summary && res.entries) {
        setSummary(res.summary);
        setEntries(res.entries);
      }
    } catch (err) {
      console.error('Error fetching reconciliation:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadCsv = async () => {
    if (!csvInput.trim()) return;
    setLoading(true);
    try {
      const res = await reconcileFuelCardStatementAction({
        provider: selectedProvider,
        rawCsvContent: csvInput,
      });

      if (res.success && res.summary && res.entries) {
        setSummary(res.summary);
        setEntries(res.entries);
        setShowUploadModal(false);
        setCsvInput('');
      } else {
        alert(res.error || 'فشل استيراد ومطابقة كشف الوقود');
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('خطأ أثناء معالجة الكشف');
    } finally {
      setLoading(false);
    }
  };

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const matchesSearch =
        e.cardTransaction.truckPlate.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.cardTransaction.stationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.cardTransaction.cardNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.cardTransaction.cardHolder && e.cardTransaction.cardHolder.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesProvider =
        providerFilter === 'all' || e.provider === providerFilter;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'matched' && e.status === 'matched') ||
        (statusFilter === 'variance' && e.status === 'variance') ||
        (statusFilter === 'fraud' && (e.status === 'ghost_refuel' || e.status === 'overfill_fraud' || e.status === 'duplicate_swipe')) ||
        (statusFilter === 'unmatched' && e.status === 'unmatched_card');

      return matchesSearch && matchesProvider && matchesStatus;
    });
  }, [entries, searchQuery, providerFilter, statusFilter]);

  // Provider badge helper
  const getProviderBadge = (provider: FuelCardProvider) => {
    switch (provider) {
      case 'afriquia':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
            Afriquia Oasis
          </span>
        );
      case 'totalenergies':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
            TotalEnergies Fleet
          </span>
        );
      case 'shell':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-yellow-500/15 text-yellow-800 dark:text-yellow-400 border border-yellow-500/30">
            Shell Card
          </span>
        );
      case 'ola_energy':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30">
            Ola Energy
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30">
            Fuel Card
          </span>
        );
    }
  };

  // Status badge helper
  const getStatusBadge = (status: ReconciliationStatus) => {
    switch (status) {
      case 'matched':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 border-emerald-500/30 gap-1 text-[11px]">
            <CheckCircle2 className="w-3 h-3" />
            {t('مطابق 100%', 'Conforme', 'Conforme')}
          </Badge>
        );
      case 'variance':
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 border-amber-500/30 gap-1 text-[11px]">
            <AlertTriangle className="w-3 h-3" />
            {t('فارق كمية/سعر', 'Écart détecté', 'Discrepancia')}
          </Badge>
        );
      case 'ghost_refuel':
        return (
          <Badge className="bg-rose-500/20 text-rose-700 dark:text-rose-300 hover:bg-rose-500/30 border-rose-500/40 gap-1 text-[11px] animate-pulse">
            <AlertOctagon className="w-3 h-3 text-rose-600" />
            {t('تزود وهمي (Ghost Refuel)', 'Ravitaillement Fictif', 'Repostaje Fantasma')}
          </Badge>
        );
      case 'overfill_fraud':
        return (
          <Badge className="bg-rose-500/20 text-rose-700 dark:text-rose-300 hover:bg-rose-500/30 border-rose-500/40 gap-1 text-[11px]">
            <Flame className="w-3 h-3 text-rose-600" />
            {t('تجاوز سعة الخزان', 'Sur-capacité réservoir', 'Depósito sobrepasado')}
          </Badge>
        );
      case 'duplicate_swipe':
        return (
          <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 border-purple-500/30 gap-1 text-[11px]">
            <RefreshCw className="w-3 h-3" />
            {t('سحب مكرر متقارب', 'Passage Rapproché', 'Pase Duplicado')}
          </Badge>
        );
      case 'unmatched_card':
        return (
          <Badge variant="outline" className="text-muted-foreground gap-1 text-[11px]">
            {t('بدون وصل بالسجل', 'Sans reçu terrain', 'Sin justificante')}
          </Badge>
        );
      default:
        return null;
    }
  };

  const handleExportCsv = () => {
    if (entries.length === 0) return;
    const csvRows = [
      'ID,Provider,Card_Number,Truck_Plate,Timestamp,Station,Liters,Amount_MAD,Matched_Receipt_ID,Receipt_Liters,Volume_Variance_L,Variance_MAD,Status,GPS_Distance_KM',
      ...entries.map((e) =>
        [
          e.id,
          e.provider,
          e.cardTransaction.cardNumber,
          e.cardTransaction.truckPlate,
          e.cardTransaction.timestamp,
          `"${e.cardTransaction.stationName}"`,
          e.cardTransaction.liters,
          e.cardTransaction.totalAmount,
          e.matchedReceipt?.receiptId || '',
          e.matchedReceipt?.receiptLiters || '',
          e.volumeVarianceLiters,
          e.financialVarianceMad,
          e.status,
          e.stationDistanceToGpsKm || '',
        ].join(',')
      ),
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `fuel-reconciliation-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5" dir={dir}>
      {/* 1. Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black font-amiri text-foreground flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <span>
              {t(
                'محرك مطابقة بطاقات الوقود الرقمية ومكافحة الاحتيال',
                'Rapprochement Cartes Carburant & Anti-Fraude',
                'Conciliación Tarjetas de Combustible y Anti-Fraude'
              )}
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(
              'مطابقة ثلاثية فورية: كشوفات المزودين (أفريقيا، طوطال، شل) + وصولات السائقين + مواقع GPS وسعة الخزان',
              'Rapprochement tripartite automatique : Relevés pétroliers + Reçus conducteurs + Géolocalisation GPS',
              'Conciliación tripartita automática: Extractos de tarjetas + Recibos conductores + GPS'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowUploadModal(true)}
            className="h-9 text-xs gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{t('استيراد كشف (CSV)', 'Importer Relevé', 'Importar Extracto')}</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCsv}
            className="h-9 text-xs gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('تصدير التقرير', 'Exporter CSV', 'Exportar CSV')}</span>
          </Button>

          <Button
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="h-9 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t('تحديث المطابقة', 'Actualiser', 'Actualizar')}</span>
          </Button>
        </div>
      </div>

      {/* 2. Bento Metrics Strip */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Card Spend */}
          <div className="p-3.5 rounded-xl bg-card border border-border shadow-xs">
            <span className="text-[11px] text-muted-foreground block font-medium">
              {t('إجمالي كشوفات البطاقات', 'Total Relevés Cartes', 'Total Tarjetas')}
            </span>
            <div className="text-xl font-black font-mono text-foreground mt-1 flex items-baseline gap-1">
              <span>{summary.totalCardAmountMad.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</span>
              <span className="text-xs text-muted-foreground font-sans">MAD</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              {summary.totalCardTransactions} {t('معاملة مسجلة', 'transactions', 'transacciones')}
            </span>
          </div>

          {/* Matched Rate */}
          <div className="p-3.5 rounded-xl bg-card border border-border shadow-xs">
            <span className="text-[11px] text-muted-foreground block font-medium">
              {t('نسبة المطابقة التامة', 'Taux de Conformité', 'Tasa de Conformidad')}
            </span>
            <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1.5">
              <ShieldCheck className="w-5 h-5" />
              <span>{summary.reconciliationRate}%</span>
            </div>
            <span className="text-[10px] text-emerald-600 font-medium">
              {summary.totalMatched} {t('معاملة متطابقة 100%', 'conformes', 'conformes')}
            </span>
          </div>

          {/* Variances */}
          <div className="p-3.5 rounded-xl bg-card border border-border shadow-xs">
            <span className="text-[11px] text-muted-foreground block font-medium">
              {t('فروقات بالكمية أو السعر', 'Écarts Détectés', 'Discrepancias')}
            </span>
            <div className="text-xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1.5">
              <AlertTriangle className="w-5 h-5" />
              <span>{summary.totalVariance}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {t('تتطلب مراجعة المحاسب', 'À auditer', 'A auditar')}
            </span>
          </div>

          {/* Suspected Fraud */}
          <div className="p-3.5 rounded-xl bg-card border border-border shadow-xs">
            <span className="text-[11px] text-muted-foreground block font-medium">
              {t('شبهات احتيال وتزود وهمي', 'Alertes Fraude / Fictif', 'Alertas Fraude')}
            </span>
            <div className="text-xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1.5">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
              <span>{summary.totalFraudSuspected}</span>
            </div>
            <span className="text-[10px] text-rose-600 font-medium">
              {t('تزود خارج الموقع أو سعة الخزان', 'Hors-site ou sur-capacité', 'Fuera de ruta o sobrellenado')}
            </span>
          </div>

          {/* Net Financial Discrepancy */}
          <div className="p-3.5 rounded-xl bg-card border border-border shadow-xs">
            <span className="text-[11px] text-muted-foreground block font-medium">
              {t('صافي الفارق المالي', 'Écart Financier Net', 'Diferencia Neta')}
            </span>
            <div className="text-xl font-black font-mono mt-1 flex items-baseline gap-1 text-foreground">
              <span>{summary.netDiscrepancyMad > 0 ? `+${summary.netDiscrepancyMad.toFixed(2)}` : summary.netDiscrepancyMad.toFixed(2)}</span>
              <span className="text-xs text-muted-foreground font-sans">MAD</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {t('فارق البطاقة مقابل وصولات السائق', 'Carte vs Reçus', 'Tarjeta vs Recibos')}
            </span>
          </div>
        </div>
      )}

      {/* 3. Filters & Search Toolstrip */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card border border-border/70 p-3 rounded-xl">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t(
              'بحث برقم الشاحنة، المحطة، السائق، أو البطاقة...',
              'Rechercher immatriculation, station, carte...',
              'Buscar matrícula, estación, tarjeta...'
            )}
            className="ps-9 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Provider Filter */}
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="h-9 text-xs px-2.5 rounded-lg border border-border bg-background text-foreground font-medium"
          >
            <option value="all">{t('جميع مزودي البطاقات', 'Tous les pétroliers', 'Todos los proveedores')}</option>
            <option value="afriquia">Afriquia Oasis / Fastoll</option>
            <option value="totalenergies">TotalEnergies Fleet</option>
            <option value="shell">Shell Card</option>
            <option value="ola_energy">Ola Energy</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 text-xs px-2.5 rounded-lg border border-border bg-background text-foreground font-medium"
          >
            <option value="all">{t('جميع حالات المطابقة', 'Tous les statuts', 'Todos los estados')}</option>
            <option value="matched">{t('🟢 مطابق سليم فقط', '🟢 Conformes uniquement', '🟢 Conformes')}</option>
            <option value="variance">{t('🟡 فروقات كمية وسعر', '🟡 Écarts volume/prix', '🟡 Discrepancias')}</option>
            <option value="fraud">{t('🚨 شبهات احتيال وتزود وهمي', '🚨 Alertes fraude', '🚨 Fraude')}</option>
            <option value="unmatched">{t('⚪ غير مسجل بالوصولات', '⚪ Sans reçu', '⚪ Sin recibo')}</option>
          </select>
        </div>
      </div>

      {/* 4. Reconciliation Table / Card List */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="bg-muted/70 border-b border-border text-muted-foreground font-bold">
              <tr>
                <th className="py-3 px-3 text-start">{t('الشاحنة والبطاقة', 'Véhicule & Carte', 'Vehículo y Tarjeta')}</th>
                <th className="py-3 px-3 text-start">{t('المحطة والموقع', 'Station & Lieu', 'Estación y Ubicación')}</th>
                <th className="py-3 px-3 text-center">{t('الكمية (كشف vs وصل)', 'Volume (L)', 'Volumen (L)')}</th>
                <th className="py-3 px-3 text-center">{t('المبلغ المفوتر', 'Montant (MAD)', 'Importe (MAD)')}</th>
                <th className="py-3 px-3 text-center">{t('فحص تموضع الـ GPS', 'Vérification GPS', 'Verificación GPS')}</th>
                <th className="py-3 px-3 text-center">{t('حالة المطابقة', 'Statut', 'Estado')}</th>
                <th className="py-3 px-2 text-center w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    {t('لا توجد سجلات مطابقة للشروط المحددة', 'Aucune transaction trouvée', 'No hay transacciones')}
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => {
                  const isExpanded = expandedRowId === entry.id;
                  const isFraud =
                    entry.status === 'ghost_refuel' ||
                    entry.status === 'overfill_fraud' ||
                    entry.status === 'duplicate_swipe';

                  return (
                    <React.Fragment key={entry.id}>
                      <tr
                        onClick={() => setExpandedRowId(isExpanded ? null : entry.id)}
                        className={`cursor-pointer transition-colors ${
                          isFraud
                            ? 'bg-rose-500/5 hover:bg-rose-500/10'
                            : entry.status === 'variance'
                            ? 'bg-amber-500/5 hover:bg-amber-500/10'
                            : 'hover:bg-muted/40'
                        }`}
                      >
                        {/* Truck Plate & Card */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <MatriculeBadge plate={entry.cardTransaction.truckPlate} size="sm" />
                            {getProviderBadge(entry.provider)}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            {entry.cardTransaction.cardNumber}
                            {entry.cardTransaction.cardHolder ? ` • ${entry.cardTransaction.cardHolder}` : ''}
                          </div>
                        </td>

                        {/* Station & Date */}
                        <td className="py-3 px-3">
                          <span className="font-bold text-foreground block truncate max-w-[200px]">
                            {entry.cardTransaction.stationName}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono block">
                            {new Date(entry.cardTransaction.timestamp).toLocaleString(
                              locale === 'ar' ? 'ar-MA' : 'fr-FR',
                              { dateStyle: 'short', timeStyle: 'short' }
                            )}
                          </span>
                        </td>

                        {/* Liters: Card vs Receipt */}
                        <td className="py-3 px-3 text-center font-mono">
                          <div className="font-bold text-foreground">
                            {entry.cardTransaction.liters.toFixed(1)} L
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {entry.matchedReceipt ? (
                              <>
                                {t('الوصل', 'Reçu')}: {entry.matchedReceipt.receiptLiters.toFixed(1)} L{' '}
                                {entry.volumeVarianceLiters !== 0 && (
                                  <span
                                    className={`font-bold ${
                                      entry.volumeVarianceLiters > 0 ? 'text-amber-600' : 'text-emerald-600'
                                    }`}
                                  >
                                    ({entry.volumeVarianceLiters > 0 ? `+${entry.volumeVarianceLiters}` : entry.volumeVarianceLiters}L)
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="italic">{t('لا يوجد وصل', 'Pas de reçu')}</span>
                            )}
                          </div>
                        </td>

                        {/* Amount: MAD */}
                        <td className="py-3 px-3 text-center font-mono">
                          <div className="font-bold text-foreground">
                            {entry.cardTransaction.totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            @{entry.cardTransaction.unitPrice.toFixed(2)} {entry.cardTransaction.currency}/L
                          </div>
                        </td>

                        {/* GPS Distance Verification */}
                        <td className="py-3 px-3 text-center">
                          {entry.stationDistanceToGpsKm !== undefined ? (
                            <div className="flex flex-col items-center">
                              <span
                                className={`font-mono font-bold text-xs flex items-center gap-1 ${
                                  entry.stationDistanceToGpsKm > 25.0
                                    ? 'text-rose-600 animate-pulse font-extrabold'
                                    : entry.stationDistanceToGpsKm > 15.0
                                    ? 'text-amber-600'
                                    : 'text-emerald-600'
                                }`}
                              >
                                <MapPin className="w-3.5 h-3.5" />
                                {entry.stationDistanceToGpsKm.toFixed(1)} km
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {entry.stationDistanceToGpsKm <= 15.0
                                  ? t('بالسياج المعتمد', 'Dans la zone', 'En zona')
                                  : t('شاحنة بعيدة!', 'Véhicule éloigné !', 'Vehículo lejos')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic font-sans">
                              {t('غير متوفر', 'N/A', 'N/A')}
                            </span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-3 text-center">
                          {getStatusBadge(entry.status)}
                        </td>

                        {/* Expand toggle */}
                        <td className="py-3 px-2 text-center text-muted-foreground">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </td>
                      </tr>

                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr className="bg-muted/30">
                          <td colSpan={7} className="p-3.5 border-t border-b border-border/80">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                <span className="font-bold text-foreground flex items-center gap-1.5">
                                  <Layers className="w-4 h-4 text-primary" />
                                  {t('تفاصيل المطابقة الثلاثية للمصادقة الميدانية', 'Détails du Rapprochement Tripartite')}
                                </span>
                                <span className="font-mono text-muted-foreground">
                                  ID: {entry.id} • {t('مؤشر الثقة', 'Confiance')}:{' '}
                                  <strong className="text-foreground">{entry.confidenceScore}%</strong>
                                </span>
                              </div>

                              {/* Anomalies List */}
                              {entry.anomalies.length > 0 ? (
                                <div className="space-y-1.5">
                                  {entry.anomalies.map((anom, aIdx) => (
                                    <div
                                      key={aIdx}
                                      className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                                        anom.severity === 'critical'
                                          ? 'bg-rose-500/10 border-rose-500/40 text-rose-800 dark:text-rose-200'
                                          : 'bg-amber-500/10 border-amber-500/40 text-amber-800 dark:text-amber-200'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between font-bold">
                                        <span>
                                          {locale === 'fr'
                                            ? anom.titleFr
                                            : locale === 'es'
                                            ? anom.titleEs
                                            : anom.titleAr}
                                        </span>
                                        <Badge
                                          variant={anom.severity === 'critical' ? 'destructive' : 'secondary'}
                                          className="text-[10px]"
                                        >
                                          {anom.category}
                                        </Badge>
                                      </div>
                                      <p className="text-[11px] opacity-90 leading-relaxed">
                                        {locale === 'fr'
                                          ? anom.descriptionFr
                                          : locale === 'es'
                                          ? anom.descriptionEs
                                          : anom.descriptionAr}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span>
                                    {t(
                                      'تم التحقق بنجاح من تطابق تذكرة البطاقة مع وصل السائق وتموضع GPS وسعة الخزان بنسبة 100%.',
                                      'Rapprochement validé : ticket carte, reçu terrain, GPS et réservoir parfaitement concordants.',
                                      'Conciliación verificada: tarjeta, recibo, GPS y depósito concordantes al 100%.'
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Import Statement Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-xl w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-border">
              <div className="flex items-center gap-2 text-foreground font-bold">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                <span>
                  {t(
                    'استيراد كشف حساب بطاقات الوقود الإلكتروني',
                    'Importer un Relevé Pétrolier Numérique',
                    'Importar Extracto Petrolero Digital'
                  )}
                </span>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  {t('مزود بطاقة الوقود', 'Pétrolier / Émetteur', 'Proveedor')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedProvider('afriquia')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                      selectedProvider === 'afriquia'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    Afriquia Oasis
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedProvider('totalenergies')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                      selectedProvider === 'totalenergies'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    TotalEnergies Fleet
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedProvider('shell')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                      selectedProvider === 'shell'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    Shell Card
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  {t(
                    'ألصق محتوى ملف الـ CSV أو الكشف الرقمي',
                    'Coller le contenu du relevé CSV',
                    'Pegar contenido CSV del extracto'
                  )}
                </label>
                <textarea
                  value={csvInput}
                  onChange={(e) => setCsvInput(e.target.value)}
                  placeholder={`N° Carte, Immatriculation, Date, Heure, Station, Volume, PU, Montant\n7082-9910-4401, 12345-A-1, 2026-10-08, 14:30, Afriquia Tanger Med, 650.0, 12.80, 8320.00`}
                  rows={8}
                  className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUploadModal(false)}
                className="text-xs"
              >
                {t('إلغاء', 'Annuler', 'Cancelar')}
              </Button>
              <Button
                size="sm"
                onClick={handleUploadCsv}
                disabled={loading || !csvInput.trim()}
                className="text-xs bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Upload className="w-3.5 h-3.5 me-1.5" />
                {t('معالجة ومطابقة فورية', 'Rapprocher', 'Conciliar')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

