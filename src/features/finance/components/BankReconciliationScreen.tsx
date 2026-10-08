'use client';

import { useState, useEffect, useCallback } from 'react';
import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/browser';
import { useLanguage } from '@/components/language-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  Upload,
  ArrowLeftRight,
  RefreshCw,
  Landmark,
  CheckCircle2,
  AlertCircle,
  Plus,
  Activity,
  FileSpreadsheet,
  Zap,
  Layers,
  FileText,
  DollarSign,
  Globe2,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import {
  autoReconcileBankStatement,
  confirmSingleSmartMatch,
  confirmBatchReconciliation,
  type ReconciliationMatch,
  type BankStatementFormat,
  type StatementBalance,
} from '@/features/finance/services/bank_reconciliation.actions';
import {
  parseBankStatementUnified,
  statementRowsToLegacyBankRows,
} from '@/features/finance/services/bank-statement-parser.service';
import type { ParsedBankRow } from '@/features/finance/services/bank-parser';
import type { TreasuryTransaction, BankAccount, Invoice } from '@/types/database';
import { AddBankAccountModal } from '@/components/add-bank-account-modal';
import { DEFAULT_BANK_ACCOUNTS, fallbackArray } from '@/lib/default-data';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export default function BankReconciliationScreen() {
  const { t, dir } = useLanguage();
  const { toast } = useToast();

  const [parsedRows, setParsedRows] = useState<ParsedBankRow[]>([]);
  const [statementMeta, setStatementMeta] = useState<{
    format: BankStatementFormat;
    accountIdentification?: string;
    statementReference?: string;
    statementNumber?: string;
    currency: string;
    openingBalance?: StatementBalance;
    closingBalance?: StatementBalance;
    totalCredit: string;
    totalDebit: string;
    transactionCount: number;
  } | null>(null);

  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [batchReconciling, setBatchReconciling] = useState(false);
  const [result, setResult] = useState<{
    matched: ReconciliationMatch[];
    unmatchedBank: ParsedBankRow[];
    unmatchedSystem: TreasuryTransaction[];
    unmatchedInvoices?: (Invoice & { client_name?: string })[];
    highConfidenceCount: number;
    totalMatchedVolume: string;
    forexGainCount?: number;
    forexLossCount?: number;
    totalForexImpact?: string;
  } | null>(null);

  const [selectedBankAccountId, setSelectedBankAccountId] = useState<number | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Load bank accounts
  const loadBankAccounts = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      const accounts = fallbackArray(data, DEFAULT_BANK_ACCOUNTS);
      setBankAccounts(accounts);
      if (accounts.length > 0 && !selectedBankAccountId) {
        setSelectedBankAccountId(accounts[0].id);
      }
    } catch {
      setBankAccounts(DEFAULT_BANK_ACCOUNTS);
      if (DEFAULT_BANK_ACCOUNTS.length > 0 && !selectedBankAccountId) {
        setSelectedBankAccountId(DEFAULT_BANK_ACCOUNTS[0].id);
      }
    }
  }, [selectedBankAccountId]);

  useEffect(() => {
    loadBankAccounts();
  }, [loadBankAccounts]);

  const handleFileUpload = useCallback(
    (file: File) => {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = (e.target?.result as string) || '';
        const parsed = parseBankStatementUnified(text, file.name);

        if (parsed.success && parsed.rows.length > 0) {
          const legacyRows = statementRowsToLegacyBankRows(parsed.rows);
          setParsedRows(legacyRows);
          setStatementMeta({
            format: parsed.format,
            accountIdentification: parsed.accountIdentification,
            statementReference: parsed.statementReference,
            statementNumber: parsed.statementNumber,
            currency: parsed.currency,
            openingBalance: parsed.openingBalance,
            closingBalance: parsed.closingBalance,
            totalCredit: parsed.totalCredit,
            totalDebit: parsed.totalDebit,
            transactionCount: parsed.transactionCount,
          });
          setErrors([]);
          setResult(null);
        } else {
          setParsedRows([]);
          setStatementMeta(null);
          setErrors([
            parsed.error ||
              t(
                'خطأ في قراءة ملف كشف الحساب البنكي',
                'Erreur de traitement du relevé bancaire',
                'Error al procesar el extracto bancario'
              ),
          ]);
        }
      };
      reader.readAsText(file);
    },
    [t]
  );

  const handleReconcile = useCallback(async () => {
    if (!selectedBankAccountId || parsedRows.length === 0) return;
    setReconciling(true);
    setResult(null);
    setErrors([]);
    try {
      const res = await autoReconcileBankStatement(parsedRows);
      if (res.success) {
        setResult({
          matched: res.matched,
          unmatchedBank: res.unmatchedBankRows,
          unmatchedSystem: res.unmatchedSystemTransactions,
          unmatchedInvoices: res.unmatchedInvoices,
          highConfidenceCount: res.highConfidenceCount,
          totalMatchedVolume: res.totalMatchedVolume,
          forexGainCount: res.forexGainCount,
          forexLossCount: res.forexLossCount,
          totalForexImpact: res.totalForexImpact,
        });
        toast({
          title: t(
            'اكتملت المطابقة الذكية',
            'Rapprochement intelligent terminé',
            'Conciliación inteligente completada'
          ),
          description: t(
            `تمت مطابقة ${res.matched.length} معاملة بنجاح (${res.highConfidenceCount} موثوقة بنسبة عالية)`,
            `${res.matched.length} transactions rapprochées (${res.highConfidenceCount} haute confiance)`,
            `${res.matched.length} transacciones conciliadas (${res.highConfidenceCount} alta confianza)`
          ),
        });
      } else {
        setErrors([
          res.error ||
            t(
              'فشل محرك المطابقة الآلي',
              'Échec du moteur de rapprochement',
              'Error en el motor de conciliación'
            ),
        ]);
      }
    } catch {
      setErrors([
        t(
          'حدث خطأ أثناء إجراء المطابقة البنكية',
          'Une erreur est survenue lors du rapprochement bancaire',
          'Ocurrió un error durante la conciliación bancaria'
        ),
      ]);
    } finally {
      setReconciling(false);
    }
  }, [selectedBankAccountId, parsedRows, t, toast]);

  const handleConfirmSingle = async (match: ReconciliationMatch) => {
    if (!selectedBankAccountId) return;
    setLoading(true);
    try {
      const res = await confirmSingleSmartMatch(match, selectedBankAccountId);
      if (res.success) {
        toast({
          title: t('تم تأكيد التسوية', 'Rapprochement confirmé', 'Conciliación confirmada'),
          description: t(
            'تم إدراج وقيد التسوية في السجلات المحاسبية والتدقيق',
            'Lettrage et écritures comptables validés avec succès',
            'Asiento y conciliación validados con éxito en contabilidad'
          ),
        });
        if (result) {
          setResult({
            ...result,
            matched: result.matched.filter((m) => m !== match),
          });
        }
      } else {
        toast({
          title: t('فشل التأكيد', 'Échec de confirmation', 'Fallo de confirmación'),
          description: res.error,
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: t('خطأ غير متوقع', 'Erreur inattendue', 'Error inesperado'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBatchConfirm = async () => {
    if (!selectedBankAccountId || !result) return;
    const highConfMatches = result.matched.filter((m) => m.confidence === 'high');
    if (highConfMatches.length === 0) return;

    setBatchReconciling(true);
    try {
      const res = await confirmBatchReconciliation(highConfMatches, selectedBankAccountId);
      toast({
        title: t(
          'تمت التسوية الجماعية',
          'Rapprochement par lot effectué',
          'Conciliación por lote completada'
        ),
        description: t(
          `تمت تسوية ${res.processedCount} معاملة موثوقة بنجاح`,
          `${res.processedCount} transactions rapprochées par lot`,
          `${res.processedCount} transacciones conciliadas por lote`
        ),
      });
      setResult({
        ...result,
        matched: result.matched.filter((m) => m.confidence !== 'high'),
      });
    } catch {
      toast({
        title: t('خطأ في التسوية الجماعية', 'Erreur rapprochement par lot', 'Error en conciliación por lote'),
        variant: 'destructive',
      });
    } finally {
      setBatchReconciling(false);
    }
  };

  const formatMoney = (amount?: number | string | null, currency?: string) => {
    const d = new Decimal(amount ?? 0);
    return `${d.toFixed(2)} ${currency || 'MAD'}`;
  };

  const getFormatBadge = (format: BankStatementFormat) => {
    switch (format) {
      case 'mt940':
        return (
          <Badge className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30 font-mono text-[11px]">
            SWIFT MT940
          </Badge>
        );
      case 'camt053':
        return (
          <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30 font-mono text-[11px]">
            ISO 20022 CAMT.053
          </Badge>
        );
      case 'ofx':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-mono text-[11px]">
            OFX / QFX
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-500/15 text-slate-700 dark:text-slate-400 border border-slate-500/30 font-mono text-[11px]">
            CSV
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir={dir}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              {t(
                'المطابقة البنكية والذكاء المحاسبي (AI MT940 / CAMT.053)',
                'Rapprochement Bancaire & IA (MT940 / CAMT.053)',
                'Conciliación Bancaria con IA (MT940 / CAMT.053)'
              )}
            </span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold font-amiri text-foreground flex items-center gap-2.5">
            <ArrowLeftRight className="w-7 h-7 text-primary" />
            {t(
              'المطابقة البنكية الذكية وتسوية العملات الأجنبية',
              'Rapprochement Bancaire Intelligent & Forex Multi-Devises',
              'Conciliación Bancaria Inteligente y Divisas Forex'
            )}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {t(
              'معالجة كشوف الحسابات القياسية (SWIFT MT940 / ISO 20022 CAMT.053 / OFX / CSV)، احتساب فروق الصرف (Forex Gain/Loss)، والربط الآلي مع الفواتير والتحويلات.',
              'Traitement des relevés bancaires (SWIFT MT940, ISO 20022 CAMT.053, OFX, CSV), calcul des gains/pertes de change (Forex) et lettrage automatisé.',
              'Procesamiento de extractos bancarios (SWIFT MT940, ISO 20022 CAMT.053, OFX, CSV), cálculo de diferencias cambiarias Forex y conciliación automatizada.'
            )}
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setIsAddAccountOpen(true)}
          className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-semibold h-10 px-4 gap-1.5 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          {t('إضافة حساب بنكي جديد', 'Ajouter un nouveau compte', 'Agregar nueva cuenta')}
        </Button>
      </div>

      {/* Account Selection & File Upload Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="border border-border shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Landmark className="w-4 h-4 text-primary" />
              {t('اختر الحساب البنكي للتسوية', 'Sélectionner le compte bancaire', 'Seleccionar cuenta bancaria')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {bankAccounts.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => setSelectedBankAccountId(acc.id)}
                  className={`w-full text-start p-3 rounded-xl border transition-all flex items-center justify-between ${
                    selectedBankAccountId === acc.id
                      ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/40'
                      : 'border-border/70 hover:bg-muted/30'
                  }`}
                >
                  <div>
                    <p className="font-semibold text-xs text-foreground">{acc.name || acc.bank_name}</p>
                    <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                      {acc.bank_name ? `${acc.bank_name} - ${acc.account_number}` : acc.account_number}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[11px] font-mono">
                    {acc.currency || 'MAD'}
                  </Badge>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border border-border shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" />
              {t(
                'رفع كشف الحساب البنكي (SWIFT MT940 / CAMT.053 / OFX / CSV)',
                'Importer le relevé bancaire (SWIFT MT940 / CAMT.053 / OFX / CSV)',
                'Importar extracto bancario (SWIFT MT940 / CAMT.053 / OFX / CSV)'
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFileUpload(file);
              }}
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                isDragging
                  ? 'border-primary bg-primary/5 scale-[0.99]'
                  : 'border-border hover:border-primary/50 bg-muted/10'
              }`}
            >
              <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-70" />
              <p className="text-xs font-semibold text-foreground">
                {fileName
                  ? fileName
                  : t(
                      'اسحب كشف الحساب البنكي إلى هنا أو اضغط للاختيار',
                      'Glissez le relevé bancaire ici ou cliquez pour choisir',
                      'Arrastre el extracto bancario aquí o haga clic para seleccionar'
                    )}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {t(
                  'يدعم كشوف الحسابات SWIFT MT940 (.sta/.mt940)، وISO 20022 CAMT.053 (.xml)، وOFX، وCSV المغربية والدولية',
                  'Supporte SWIFT MT940 (.sta/.mt940), ISO 20022 CAMT.053 (.xml), OFX et CSV marocains et internationaux',
                  'Admite SWIFT MT940 (.sta/.mt940), ISO 20022 CAMT.053 (.xml), OFX y CSV marroquíes e internacionales'
                )}
              </p>
              <input
                type="file"
                accept=".sta,.mt940,.xml,.camt,.camt053,.ofx,.qfx,.csv,text/csv,text/plain,text/xml,application/xml"
                className="hidden"
                id="statement-upload"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
              <label htmlFor="statement-upload">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 rounded-xl text-xs cursor-pointer gap-1.5"
                  onClick={() => document.getElementById('statement-upload')?.click()}
                >
                  <Upload className="w-3.5 h-3.5" />
                  {t('استعراض الملفات', 'Parcourir les fichiers', 'Explorar archivos')}
                </Button>
              </label>
            </div>

            {statementMeta && (
              <div className="p-3.5 rounded-xl bg-muted/30 border border-border text-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {getFormatBadge(statementMeta.format)}
                    {statementMeta.accountIdentification && (
                      <span className="font-mono text-[11px] bg-background/80 px-2 py-0.5 rounded border border-border text-muted-foreground">
                        RIB/IBAN: {statementMeta.accountIdentification}
                      </span>
                    )}
                    {statementMeta.statementReference && (
                      <span className="text-[11px] text-muted-foreground">
                        Ref: {statementMeta.statementReference}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs">
                    <span className="text-muted-foreground">
                      {statementMeta.transactionCount}{' '}
                      {t('معاملة مقروءة', 'lignes analysées', 'transacciones leídas')}
                    </span>
                    <span className="text-emerald-600 font-semibold" dir="ltr">
                      +{statementMeta.totalCredit} {statementMeta.currency}
                    </span>
                    <span className="text-rose-600 font-semibold" dir="ltr">
                      -{statementMeta.totalDebit} {statementMeta.currency}
                    </span>
                  </div>
                </div>

                {(statementMeta.openingBalance || statementMeta.closingBalance) && (
                  <div className="pt-2 border-t border-border/40 flex flex-wrap items-center justify-between text-[11px] text-muted-foreground font-mono">
                    {statementMeta.openingBalance && (
                      <div>
                        {t('رصيد افتتاحي:', 'Solde initial:', 'Saldo inicial:')}{' '}
                        <span className="text-foreground font-semibold">
                          {statementMeta.openingBalance.amount} {statementMeta.openingBalance.currency}
                        </span>{' '}
                        ({statementMeta.openingBalance.date})
                      </div>
                    )}
                    {statementMeta.closingBalance && (
                      <div>
                        {t('رصيد ختامي:', 'Solde final:', 'Saldo final:')}{' '}
                        <span className="text-foreground font-semibold">
                          {statementMeta.closingBalance.amount} {statementMeta.closingBalance.currency}
                        </span>{' '}
                        ({statementMeta.closingBalance.date})
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {errors.length > 0 && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1">
                {errors.map((err, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                disabled={parsedRows.length === 0 || !selectedBankAccountId || reconciling}
                onClick={handleReconcile}
                className="rounded-xl text-xs font-semibold h-10 px-5 gap-2 bg-primary text-primary-foreground shadow-xs"
              >
                {reconciling ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {t('جاري المطابقة الذكية...', 'Rapprochement en cours...', 'Conciliando...')}
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    {t(
                      'تشغيل محرك المطابقة الآلي الذكي',
                      'Lancer le Rapprochement Intelligent',
                      'Ejecutar Conciliación Inteligente'
                    )}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results Overview */}
      {result && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <Card className="border border-border shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('المعاملات المتطابقة', 'Transactions rapprochées', 'Transacciones conciliadas')}
                  </p>
                  <p className="text-xl font-bold font-mono text-foreground mt-1">
                    {result.matched.length}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('ثقة عالية (Match >= 80%)', 'Haute confiance', 'Alta confianza')}
                  </p>
                  <p className="text-xl font-bold font-mono text-emerald-600 mt-1">
                    {result.highConfidenceCount}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('حجم السيولة المطابقة', 'Volume rapproché', 'Volumen conciliado')}
                  </p>
                  <p className="text-xl font-bold font-mono text-primary mt-1" dir="ltr">
                    {result.totalMatchedVolume} MAD
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Activity className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('فروق الصرف (Forex Impact)', 'Impact Forex Devise', 'Impacto Divisas Forex')}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 font-mono text-sm font-bold">
                    {result.totalForexImpact && new Decimal(result.totalForexImpact).greaterThan(0) ? (
                      <span className="text-emerald-600 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" />
                        +{result.totalForexImpact} MAD
                      </span>
                    ) : result.totalForexImpact && new Decimal(result.totalForexImpact).lessThan(0) ? (
                      <span className="text-rose-600 flex items-center gap-1">
                        <TrendingDown className="w-4 h-4" />
                        {result.totalForexImpact} MAD
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0.00 MAD</span>
                    )}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                  <DollarSign className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Matched Transactions Table */}
          <Card className="border border-border shadow-xs overflow-hidden">
            <CardHeader className="py-3.5 px-5 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>
                  {t(
                    'المعاملات المقترحة للتسوية المباشرة والتقييد المحاسبي',
                    'Transactions prêtes pour le lettrage comptable',
                    'Transacciones listas para conciliación contable'
                  )}
                </span>
              </CardTitle>
              {result.highConfidenceCount > 0 && (
                <Button
                  type="button"
                  size="sm"
                  disabled={batchReconciling}
                  onClick={handleBatchConfirm}
                  className="rounded-xl text-xs font-semibold h-8 px-3 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  <Zap className="w-3.5 h-3.5" />
                  {batchReconciling
                    ? t('جاري التسوية الجماعية...', 'Traitement par lot...', 'Procesando lote...')
                    : t(
                        `تسوية ${result.highConfidenceCount} دفعة واحدة`,
                        `Valider ${result.highConfidenceCount} en lot`,
                        `Validar ${result.highConfidenceCount} en lote`
                      )}
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {result.matched.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  {t(
                    'لا توجد مطابقات مطروحة حالياً.',
                    'Aucune correspondance identifiée.',
                    'No se identificaron coincidencias.'
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                        <th className="py-3 px-4 text-start font-semibold">
                          {t('سطر كشف الحساب البنكي', 'Ligne Relevé', 'Línea de Extracto')}
                        </th>
                        <th className="py-3 px-4 text-start font-semibold">
                          {t('المعاملة المقابلة في النظام', 'Transaction Système', 'Transacción del Sistema')}
                        </th>
                        <th className="py-3 px-4 text-center font-semibold">
                          {t('نسبة التطابق', 'Score', 'Puntuación')}
                        </th>
                        <th className="py-3 px-4 text-start font-semibold">
                          {t('فروق الصرف والسبب', 'Forex & Raison', 'Forex y Motivo')}
                        </th>
                        <th className="py-3 px-4 text-end font-semibold">
                          {t('الإجراء', 'Action', 'Acción')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {result.matched.map((m, idx) => (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-semibold text-foreground font-mono" dir="ltr">
                              {formatMoney(m.bankRow.amount, m.bankRow.currency)}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{m.bankRow.date}</p>
                            <p className="text-[10px] text-muted-foreground line-clamp-1">
                              {m.bankRow.description}
                            </p>
                          </td>
                          <td className="py-3 px-4">
                            {m.matchType === 'treasury_transaction' && m.treasuryTransaction && (
                              <div>
                                <Badge variant="outline" className="text-[10px] mb-1">
                                  <Layers className="w-3 h-3 me-1" />
                                  {t('حركة خزينة', 'Trésorerie', 'Tesorería')} #{m.treasuryTransaction.id}
                                </Badge>
                                <p className="font-mono text-foreground" dir="ltr">
                                  {formatMoney(m.treasuryTransaction.amount, m.treasuryTransaction.currency)}
                                </p>
                                <p className="text-[10px] text-muted-foreground line-clamp-1">
                                  {m.treasuryTransaction.description}
                                </p>
                              </div>
                            )}
                            {m.matchType === 'invoice' && m.invoice && (
                              <div>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] mb-1 bg-blue-500/10 text-blue-600 border-blue-500/30"
                                >
                                  <FileText className="w-3 h-3 me-1" />
                                  {t('فاتورة عميل', 'Facture', 'Factura')} #{m.invoice.invoice_number}
                                </Badge>
                                <p className="font-semibold text-foreground">{m.invoice.client_name}</p>
                                <p className="font-mono text-muted-foreground" dir="ltr">
                                  {t('المتبقي:', 'Reste:', 'Restante:')}{' '}
                                  {formatMoney(m.invoice.remaining_amount, m.invoice.currency)}
                                </p>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold font-mono text-[11px] ${
                                m.confidence === 'high'
                                  ? 'bg-emerald-500/15 text-emerald-600'
                                  : m.confidence === 'medium'
                                  ? 'bg-blue-500/15 text-blue-600'
                                  : 'bg-amber-500/15 text-amber-600'
                              }`}
                            >
                              {m.matchScore}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[11px] text-muted-foreground space-y-1">
                            <p>{m.matchReason}</p>
                            {m.forex?.hasForex && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-1 font-mono text-[10px]">
                                {m.forex.forexType === 'gain' ? (
                                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                    <TrendingUp className="w-3 h-3 me-1" />
                                    +{m.forex.forexGainLossAmount} {m.forex.settledCurrency} (
                                    {t('ربح صرف', 'Gain de change', 'Ganancia Forex')})
                                  </Badge>
                                ) : m.forex.forexType === 'loss' ? (
                                  <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
                                    <TrendingDown className="w-3 h-3 me-1" />
                                    -{m.forex.forexGainLossAmount} {m.forex.settledCurrency} (
                                    {t('خسارة صرف', 'Perte de change', 'Pérdida Forex')})
                                  </Badge>
                                ) : null}
                                <span className="text-muted-foreground">
                                  Rate: {m.forex.exchangeRate}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-end">
                            <Button
                              type="button"
                              size="sm"
                              disabled={loading}
                              onClick={() => handleConfirmSingle(m)}
                              className="rounded-xl text-xs font-semibold h-8 px-3 gap-1 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 shadow-xs"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {t('تأكيد وقيد', 'Valider', 'Validar')}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Bank Account Modal */}
      <AddBankAccountModal
        isOpen={isAddAccountOpen}
        onClose={() => setIsAddAccountOpen(false)}
        onSuccess={() => {
          setIsAddAccountOpen(false);
          loadBankAccounts();
        }}
      />
    </div>
  );
}
