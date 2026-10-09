'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import Decimal from 'decimal.js';
import { useLanguage } from '@/components/language-provider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/forex';
import {
  Building2,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Landmark,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Calendar,
  ShieldCheck,
  Check,
  Globe2,
} from 'lucide-react';
import {
  getEligibleSettlementsForTransferAction,
  createBulkTransferBatchAction,
  executeBulkTransferBatchAction,
} from '../services/bulk-transfer.actions';
import type {
  BulkPaymentMethod,
  BulkFormatType,
  EligibleSettlementForTransfer,
} from '../types/bulk-transfer.types';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

interface BulkTransferBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function BulkTransferBatchModal({
  isOpen,
  onClose,
  onSuccess,
}: BulkTransferBatchModalProps) {
  const { t, dir } = useLanguage();
  const isRTL = dir === 'rtl';
  const [, startTransition] = useTransition();

  const [loading, setLoading] = useState(false);
  const [eligibleList, setEligibleList] = useState<EligibleSettlementForTransfer[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<BulkPaymentMethod>('moroccan_lcn_virement');
  const [formatType, setFormatType] = useState<BulkFormatType>('csv_banking');
  const [executionDate, setExecutionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [sourceRib, setSourceRib] = useState('007780000012345678901209');
  const [debtorIban, setDebtorIban] = useState('MA64007780000012345678901209');
  const [debtorBic, setDebtorBic] = useState('BCPOMAMC');
  const [autoSettle, setAutoSettle] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    batchRef: string;
    fileName: string;
    count: number;
    total: number;
    checksum?: string;
  } | null>(null);

  // Sync formatType when paymentMethod changes
  const handlePaymentMethodChange = (method: BulkPaymentMethod) => {
    setPaymentMethod(method);
    if (method === 'sepa_credit_transfer') {
      setFormatType('pain_001_001_03');
    } else {
      setFormatType('csv_banking');
    }
  };

  // Load settlements
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setErrorMessage(null);
      setSuccessResult(null);
      getEligibleSettlementsForTransferAction()
        .then((res) => {
          if (res.success && res.data) {
            setEligibleList(res.data);
            // Default select all valid items
            setSelectedIds(res.data.map((item) => item.statement_id));
          } else {
            setErrorMessage(res.error || 'فشل جلب الكشوفات المؤهلة');
          }
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  // Aggregate selected items via Decimal.js
  const { selectedCount, totalAmountDec } = useMemo(() => {
    const selected = eligibleList.filter((it) => selectedIds.includes(it.statement_id));
    let sum = new Decimal(0);
    for (const item of selected) {
      sum = sum.plus(new Decimal(item.net_payout_mad || 0));
    }
    return {
      selectedCount: selected.length,
      totalAmountDec: sum,
    };
  }, [eligibleList, selectedIds]);

  const toggleSelectAll = () => {
    if (selectedIds.length === eligibleList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(eligibleList.map((item) => item.statement_id));
    }
  };

  const toggleItem = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Generate & Download File
  const handleGenerateAndDownload = async () => {
    if (selectedIds.length === 0) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await createBulkTransferBatchAction({
        paymentMethod,
        formatType,
        executionDate,
        currency: paymentMethod === 'sepa_credit_transfer' ? 'EUR' : 'MAD',
        sourceRib: paymentMethod === 'moroccan_lcn_virement' ? sourceRib : undefined,
        debtorIban: paymentMethod === 'sepa_credit_transfer' ? debtorIban : undefined,
        debtorBic: paymentMethod === 'sepa_credit_transfer' ? debtorBic : undefined,
        statementIds: selectedIds,
        notes: `دفعة تحويلات ${executionDate} - ${selectedCount} مستفيد`,
      });

      if (!res.success || !res.generatedFile || !res.batch) {
        setErrorMessage(res.error || 'فشل توليد دفعة التحويل البنكي');
        setIsSubmitting(false);
        return;
      }

      // Direct file download in browser
      const blob = new Blob([res.generatedFile.fileContent], {
        type: res.generatedFile.mimeType,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.generatedFile.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Auto-execute if requested
      if (autoSettle && res.batch.id) {
        await executeBulkTransferBatchAction({ batchId: res.batch.id });
      }

      setSuccessResult({
        batchRef: res.batch.batch_reference,
        fileName: res.generatedFile.fileName,
        count: res.generatedFile.transactionsCount,
        total: res.generatedFile.totalAmount,
        checksum: res.generatedFile.checksumSha256,
      });

      startTransition(() => {
        onSuccess?.();
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطأ أثناء المعالجة البنكية';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 text-primary rounded-xl">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-foreground">
                {t(
                  'محرك التحويلات البنكية المجمعة (SEPA XML & LCN)',
                  'Moteur de Virement Bancaire de Masse (SEPA & LCN)',
                  'Motor de Transferencias Bancarias Masivas (SEPA & LCN)'
                )}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                {t(
                  'توليد ملفات التحويل المصرفي القياسية لأجور السائقين وفق بروتوكول ISO 20022 والمعايير البنكية المغربية',
                  'Génération des fichiers de virement bancaire standardisés selon ISO 20022 et normes interbancaires marocaines',
                  'Generación de archivos bancarios masivos según ISO 20022 y normas interbancarias marroquíes'
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {errorMessage && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-sm flex items-center gap-2">
            <XCircle className="w-5 h-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successResult ? (
          <div className="py-6 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-foreground">
              {t(
                'تم توليد وتحميل الملف البنكي بنجاح!',
                'Fichier bancaire généré et téléchargé avec succès !',
                '¡Archivo bancario generado y descargado con éxito!'
              )}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {t(
                `تم إنشاء دفعة التحويل ${successResult.batchRef} لـ ${successResult.count} مستفيد بإجمالي ${formatCurrency(successResult.total, paymentMethod === 'sepa_credit_transfer' ? 'EUR' : 'MAD')}.`,
                `Le lot ${successResult.batchRef} a été créé pour ${successResult.count} bénéficiaires avec un total de ${formatCurrency(successResult.total, paymentMethod === 'sepa_credit_transfer' ? 'EUR' : 'MAD')}.`,
                `El lote ${successResult.batchRef} se generó para ${successResult.count} beneficiarios con un total de ${formatCurrency(successResult.total, paymentMethod === 'sepa_credit_transfer' ? 'EUR' : 'MAD')}.`
              )}
            </p>

            <div className="bg-muted/50 rounded-xl p-4 w-full max-w-lg text-start space-y-2 border">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{t('اسم الملف:', 'Nom du fichier :', 'Nombre del archivo:')}</span>
                <span className="font-mono font-medium">{successResult.fileName}</span>
              </div>
              {successResult.checksum && (
                <div className="flex flex-col gap-0.5 text-xs">
                  <span className="text-muted-foreground">{t('بصمة التشفير (SHA-256):', 'Empreinte SHA-256 :', 'Huella SHA-256:')}</span>
                  <span className="font-mono text-[10px] break-all bg-background p-1.5 rounded border">
                    {successResult.checksum}
                  </span>
                </div>
              )}
              {autoSettle && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium pt-1">
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {t(
                      'تم اعتماد الكشوفات وتحويل حالتها تلقائياً إلى "مسواة" (Settled).',
                      'Décomptes approuvés et passés automatiquement à "Réglé" (Settled).',
                      'Liquidaciones marcadas automáticamente como "Saldadas" (Settled).'
                    )}
                  </span>
                </div>
              )}
            </div>

            <Button onClick={onClose} className="mt-2">
              {t('إغلاق النافذة', 'Fermer', 'Cerrar')}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Bento Grid: Config Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Payment Protocol Selector */}
              <div className="bg-card border rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                  <Globe2 className="w-4 h-4 text-primary" />
                  <span>{t('نظام التحويل المصرفي', 'Système de Virement', 'Sistema de Transferencia')}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handlePaymentMethodChange('moroccan_lcn_virement')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                      paymentMethod === 'moroccan_lcn_virement'
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                        : 'border-border hover:bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <Building2 className="w-5 h-5 mb-1" />
                    <span className="text-xs">
                      {t('البنوك المغربية (LCN)', 'Maroc (LCN / RIB)', 'Marruecos (LCN / RIB)')}
                    </span>
                    <span className="text-[10px] opacity-75">MAD (24 Chiffres)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePaymentMethodChange('sepa_credit_transfer')}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                      paymentMethod === 'sepa_credit_transfer'
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                        : 'border-border hover:bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <Landmark className="w-5 h-5 mb-1" />
                    <span className="text-xs">
                      {t('أوروبا (SEPA XML)', 'Europe (SEPA XML)', 'Europa (SEPA XML)')}
                    </span>
                    <span className="text-[10px] opacity-75">EUR (ISO 20022)</span>
                  </button>
                </div>
              </div>

              {/* Format & Execution Date */}
              <div className="bg-card border rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span>{t('صيغة الملف وتاريخ التنفيذ', 'Format & Date d\'Exécution', 'Formato y Fecha')}</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      {t('صيغة الملف المصرفي:', 'Format bancaire :', 'Formato bancario:')}
                    </label>
                    <select
                      value={formatType}
                      onChange={(e) => setFormatType(e.target.value as BulkFormatType)}
                      className="w-full bg-background border rounded-lg p-2 text-xs font-medium"
                    >
                      {paymentMethod === 'moroccan_lcn_virement' ? (
                        <>
                          <option value="csv_banking">
                            {t('CSV بنكي معتمد (Attijari / BCP / BMCE)', 'CSV Bancaire Entreprises', 'CSV Bancario Empresas')}
                          </option>
                          <option value="moroccan_lcn_virement">
                            {t('ملف نصي ثابت LCN Interbancaire (.txt)', 'Fichier Plat Fixe LCN (.txt)', 'Archivo Fijo LCN (.txt)')}
                          </option>
                        </>
                      ) : (
                        <option value="pain_001_001_03">
                          {t('ISO 20022 Pain.001.001.03 XML', 'ISO 20022 Pain.001.001.03 XML', 'ISO 20022 Pain.001.001.03 XML')}
                        </option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      {t('تاريخ التحويل:', 'Date d\'exécution :', 'Fecha de ejecución:')}
                    </label>
                    <input
                      type="date"
                      value={executionDate}
                      onChange={(e) => setExecutionDate(e.target.value)}
                      className="w-full bg-background border rounded-lg p-2 text-xs font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Source Account Details */}
              <div className="bg-card border rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span>{t('حساب الشركة المحول منه', 'Compte Émetteur', 'Cuenta Emisora')}</span>
                </div>
                {paymentMethod === 'moroccan_lcn_virement' ? (
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      {t('رقم حساب الشركة (RIB 24 رقماً):', 'RIB Société (24 Chiffres) :', 'RIB Empresa (24 Dígitos):')}
                    </label>
                    <input
                      type="text"
                      value={sourceRib}
                      onChange={(e) => setSourceRib(e.target.value)}
                      className="w-full bg-background border rounded-lg p-2 text-xs font-mono"
                      maxLength={24}
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-0.5">
                        {t('IBAN الشركة:', 'IBAN Société :', 'IBAN Empresa:')}
                      </label>
                      <input
                        type="text"
                        value={debtorIban}
                        onChange={(e) => setDebtorIban(e.target.value)}
                        className="w-full bg-background border rounded-lg p-1.5 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-0.5">
                        {t('BIC/SWIFT الشركة:', 'BIC/SWIFT Société :', 'BIC/SWIFT Empresa:')}
                      </label>
                      <input
                        type="text"
                        value={debtorBic}
                        onChange={(e) => setDebtorBic(e.target.value)}
                        className="w-full bg-background border rounded-lg p-1.5 text-xs font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Beneficiaries Table */}
            <div className="border rounded-2xl overflow-hidden bg-card">
              <div className="p-3 bg-muted/40 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleSelectAll}
                    className="h-7 text-xs px-2.5"
                  >
                    {selectedIds.length === eligibleList.length
                      ? t('إلغاء تحديد الكل', 'Désélectionner tout', 'Deseleccionar todo')
                      : t('تحديد الكل', 'Sélectionner tout', 'Seleccionar todo')}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {t(
                      `تم تحديد ${selectedCount} من أصل ${eligibleList.length} كشف`,
                      `${selectedCount} sur ${eligibleList.length} sélectionnés`,
                      `${selectedCount} de ${eligibleList.length} seleccionados`
                    )}
                  </span>
                </div>

                <div className="text-sm font-bold text-foreground">
                  <span className="text-muted-foreground text-xs me-1">
                    {t('المجموع المجمع:', 'Total à virer :', 'Total a transferir:')}
                  </span>
                  <span className="text-primary font-mono">
                    {formatCurrency(
                      totalAmountDec.toNumber(),
                      paymentMethod === 'sepa_credit_transfer' ? 'EUR' : 'MAD'
                    )}
                  </span>
                </div>
              </div>

              {loading ? (
                <div className="p-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <span className="text-sm">{t('جاري جلب الكشوفات المؤهلة...', 'Chargement des décomptes...', 'Cargando liquidaciones...')}</span>
                </div>
              ) : eligibleList.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground space-y-1">
                  <AlertTriangle className="w-8 h-8 mx-auto text-amber-500 mb-2" />
                  <p className="text-sm font-medium">
                    {t(
                      'لا توجد كشوفات معتمدة بانتظار التحويل المصرفي',
                      'Aucun décompte approuvé en attente de virement',
                      'No hay liquidaciones aprobadas pendientes de transferencia'
                    )}
                  </p>
                  <p className="text-xs">
                    {t(
                      'تأكد من اعتماد كشوفات تسوية السائقين ومطابقتها قبل إنشاء الدفعة.',
                      'Veuillez d\'abord valider les décomptes dans l\'onglet de clôture fiscale.',
                      'Valide las liquidaciones antes de generar el lote bancario.'
                    )}
                  </p>
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto divide-y">
                  {eligibleList.map((item) => {
                    const isSelected = selectedIds.includes(item.statement_id);
                    const isRibValid = item.is_rib_valid;
                    const isIbanValid = item.is_iban_valid;
                    const accountValid =
                      paymentMethod === 'sepa_credit_transfer' ? isIbanValid : isRibValid;

                    return (
                      <div
                        key={item.statement_id}
                        onClick={() => toggleItem(item.statement_id)}
                        className={`p-3 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                          isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-primary border-primary text-primary-foreground'
                                : 'border-muted-foreground/30'
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </div>

                          <div>
                            <div className="font-semibold text-foreground flex items-center gap-2">
                              <span>{item.driver_name}</span>
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {item.statement_number}
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-2 mt-0.5">
                              <span>
                                {paymentMethod === 'sepa_credit_transfer'
                                  ? item.bank_iban || t('لا يوجد IBAN', 'Pas d\'IBAN', 'Sin IBAN')
                                  : item.bank_rib || t('لا يوجد RIB', 'Pas de RIB', 'Sin RIB')}
                              </span>
                              {item.bank_name && (
                                <span className="text-[10px] bg-muted px-1.5 py-0.2 rounded">
                                  {item.bank_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-end">
                          <div>
                            <div className="font-bold text-foreground font-mono text-sm">
                              {formatCurrency(
                                item.net_payout_mad,
                                paymentMethod === 'sepa_credit_transfer' ? 'EUR' : 'MAD'
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {item.period_start} → {item.period_end}
                            </div>
                          </div>

                          {accountValid ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 flex items-center gap-1"
                            >
                              <ShieldCheck className="w-3 h-3" />
                              <span>{t('حساب سليم', 'Valide', 'Válido')}</span>
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20 flex items-center gap-1"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              <span>{t('تنبيه تدقيق', 'À vérifier', 'Revisar')}</span>
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Auto-Settle Checkbox */}
            <div className="flex items-center gap-2 text-xs bg-muted/30 p-3 rounded-xl border">
              <input
                type="checkbox"
                id="autoSettleCheck"
                checked={autoSettle}
                onChange={(e) => setAutoSettle(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary cursor-pointer"
              />
              <label htmlFor="autoSettleCheck" className="text-foreground cursor-pointer">
                {t(
                  'اعتماد الكشوفات وتحويل حالتها تلقائياً إلى "مسواة" (Settled) فور توليد الملف المصرفي',
                  'Mettre à jour automatiquement le statut des décomptes à "Réglé" (Settled) après génération',
                  'Actualizar automáticamente el estado de las liquidaciones a "Saldado" tras la generación'
                )}
              </label>
            </div>
          </div>
        )}

        {!successResult && (
          <DialogFooter className="flex items-center justify-between border-t pt-4">
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
              {t('إلغاء', 'Annuler', 'Cancelar')}
            </Button>

            <Button
              onClick={handleGenerateAndDownload}
              disabled={isSubmitting || selectedCount === 0 || loading}
              className="gap-2 bg-primary text-primary-foreground font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('جاري التوليد والتحميل...', 'Génération...', 'Generando...')}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>
                    {formatType === 'pain_001_001_03'
                      ? t('توليد وتحميل ملف SEPA XML', 'Générer & Télécharger SEPA XML', 'Generar y Descargar SEPA XML')
                      : formatType === 'moroccan_lcn_virement'
                      ? t('توليد وتحميل ملف LCN (.txt)', 'Générer & Télécharger LCN (.txt)', 'Generar y Descargar LCN (.txt)')
                      : t('توليد وتحميل CSV بنكي', 'Générer & Télécharger CSV Bancaire', 'Generar y Descargar CSV Bancario')}
                  </span>
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
