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
} from 'lucide-react';
import {
  autoReconcileBankStatement,
  confirmSingleSmartMatch,
  confirmBatchReconciliation,
  type ReconciliationMatch,
} from '@/features/finance/services/bank_reconciliation.actions';
import {
  parseBankStatement,
  type ParsedBankRow,
} from '@/features/finance/services/bank-parser';
import type { TreasuryTransaction, BankAccount, Invoice } from '@/types/database';
import { AddBankAccountModal } from '@/components/add-bank-account-modal';
import { DEFAULT_BANK_ACCOUNTS, fallbackArray } from '@/lib/default-data';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export default function BankReconciliationScreen() {
  const { t, dir, locale } = useLanguage();
  const { toast } = useToast();

  const [parsedRows, setParsedRows] = useState<ParsedBankRow[]>([]);
  const [statementMeta, setStatementMeta] = useState<{
    format: 'csv' | 'ofx';
    totalCredit: string;
    totalDebit: string;
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

  const handleFileUpload = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      const parsed = parseBankStatement(text, file.name);
      if (parsed.success && parsed.rows.length > 0) {
        setParsedRows(parsed.rows);
        setStatementMeta({
          format: parsed.format,
          totalCredit: parsed.totalCredit,
          totalDebit: parsed.totalDebit,
        });
        setErrors([]);
        setResult(null);
      } else {
        setParsedRows([]);
        setStatementMeta(null);
        setErrors([parsed.error || t('خطأ في معالجة الملف', 'Erreur de traitement du fichier')]);
      }
    };
    reader.readAsText(file);
  }, [t]);

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
        });
        toast({
          title: t('اكتملت المطابقة الذكية', 'Rapprochement intelligent terminé'),
          description: t(
            `تمت مطابقة ${res.matched.length} معاملة بنجاح (${res.highConfidenceCount} موثوقة بنسبة عالية)`,
            `${res.matched.length} transactions rapprochées (${res.highConfidenceCount} haute confiance)`
          ),
        });
      } else {
        setErrors([res.error || t('فشل محرك المطابقة', 'Échec du moteur de rapprochement')]);
      }
    } catch {
      setErrors([t('حدث خطأ أثناء إجراء المطابقة', 'Une erreur est survenue lors du rapprochement')]);
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
          title: t('تم تأكيد التسوية', 'Rapprochement confirmé'),
          description: t('تم إدراج وقيد التسوية في السجلات المحاسبية', 'Lettrage et écritures validés avec succès'),
        });
        if (result) {
          setResult({
            ...result,
            matched: result.matched.filter((m) => m !== match),
          });
        }
      } else {
        toast({
          title: t('فشل التأكيد', 'Échec de confirmation'),
          description: res.error,
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: t('خطأ غير متوقع', 'Erreur inattendue'),
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
        title: t('تمت التسوية الجماعية', 'Rapprochement par lot effectué'),
        description: t(
          `تمت تسوية ${res.processedCount} معاملة موثوقة بنجاح`,
          `${res.processedCount} transactions rapprochées par lot`
        ),
      });
      setResult({
        ...result,
        matched: result.matched.filter((m) => m.confidence !== 'high'),
      });
    } catch {
      toast({
        title: t('خطأ في التسوية الجماعية', 'Erreur rapprochement par lot'),
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir={dir}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{t('المطابقة البنكية والذكاء المحاسبي', 'Rapprochement Bancaire & IA')}</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold font-amiri text-foreground flex items-center gap-2.5">
            <ArrowLeftRight className="w-7 h-7 text-primary" />
            {t('المطابقة البنكية الذكية (Smart Bank Reconciliation)', 'Rapprochement Bancaire Intelligent')}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {t(
              'معالجة كشوف الحسابات (CSV / OFX)، احتساب نسبة التطابق (Matching Score)، والربط الفوري مع المعاملات والفواتير.',
              'Traitement des relevés bancaires (CSV / OFX), calcul du score de correspondance et lettrage avec factures et trésorerie.'
            )}
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setIsAddAccountOpen(true)}
          className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-semibold h-10 px-4 gap-1.5 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          {t('إضافة حساب بنكي جديد', 'Ajouter un nouveau compte')}
        </Button>
      </div>

      {/* Account Selection & File Upload Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="border border-border shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Landmark className="w-4 h-4 text-primary" />
              {t('اختر الحساب البنكي للتسوية', 'Sélectionner le compte bancaire')}
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
                    <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{acc.bank_name ? `${acc.bank_name} - ${acc.account_number}` : acc.account_number}</p>
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
              {t('رفع واستيراد كشف الحساب البنكي (CSV / OFX / QFX)', 'Importer le relevé bancaire')}
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
                {fileName ? fileName : t('اسحب كشف الحساب إلى هنا أو اضغط للاختيار', 'Glissez le fichier ici ou cliquez pour choisir')}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {t('يدعم كشوف الحسابات المغربية والأوروبية بصيغ CSV و OFX و QFX', 'Prend en charge les formats CSV marocains/européens, OFX et QFX')}
              </p>
              <input
                type="file"
                accept=".csv,.ofx,.qfx,text/csv,text/plain"
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
                  {t('استعراض الملفات', 'Parcourir les fichiers')}
                </Button>
              </label>
            </div>

            {statementMeta && (
              <div className="flex flex-wrap items-center justify-between p-3 rounded-xl bg-muted/30 border border-border text-xs gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="uppercase font-mono text-[10px]">
                    {statementMeta.format}
                  </Badge>
                  <span className="text-muted-foreground">
                    {parsedRows.length} {t('سطر مقروء', 'lignes analysées')}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="text-emerald-600 font-semibold" dir="ltr">
                    +{statementMeta.totalCredit}
                  </span>
                  <span className="text-rose-600 font-semibold" dir="ltr">
                    -{statementMeta.totalDebit}
                  </span>
                </div>
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
                    {t('جاري المطابقة الذكية...', 'Rapprochement en cours...')}
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    {t('تشغيل محرك المطابقة الآلي', 'Lancer le Rapprochement Intelligent')}
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
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
            <Card className="border border-border shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{t('المعاملات المتطابقة', 'Transactions rapprochées')}</p>
                  <p className="text-xl font-bold font-mono text-foreground mt-1">{result.matched.length}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{t('ثقة عالية (Match >= 80%)', 'Haute confiance')}</p>
                  <p className="text-xl font-bold font-mono text-emerald-600 mt-1">{result.highConfidenceCount}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{t('حجم السيولة المطابقة', 'Volume rapproché')}</p>
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
                  <p className="text-xs text-muted-foreground">{t('أسطر غير مسواة', 'Lignes en attente')}</p>
                  <p className="text-xl font-bold font-mono text-amber-600 mt-1">{result.unmatchedBank.length}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Matched Transactions Table */}
          <Card className="border border-border shadow-xs overflow-hidden">
            <CardHeader className="py-3.5 px-5 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{t('المعاملات المقترحة للتسوية المباشرة', 'Transactions prêtes pour le lettrage')}</span>
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
                    ? t('جاري التسوية الجماعية...', 'Traitement par lot...')
                    : t(`تسوية ${result.highConfidenceCount} دفعة واحدة`, `Valider ${result.highConfidenceCount} en lot`)}
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {result.matched.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  {t('لا توجد مطابقات مطروحة حالياً.', 'Aucune correspondance identifiée.')}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                        <th className="py-3 px-4 text-start font-semibold">{t('سطر كشف الحساب البنكي', 'Ligne Relevé')}</th>
                        <th className="py-3 px-4 text-start font-semibold">{t('المعاملة المقابلة في النظام', 'Transaction Système')}</th>
                        <th className="py-3 px-4 text-center font-semibold">{t('نسبة التطابق', 'Score')}</th>
                        <th className="py-3 px-4 text-start font-semibold">{t('سبب المطابقة', 'Raison')}</th>
                        <th className="py-3 px-4 text-end font-semibold">{t('الإجراء', 'Action')}</th>
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
                            <p className="text-[10px] text-muted-foreground line-clamp-1">{m.bankRow.description}</p>
                          </td>
                          <td className="py-3 px-4">
                            {m.matchType === 'treasury_transaction' && m.treasuryTransaction && (
                              <div>
                                <Badge variant="outline" className="text-[10px] mb-1">
                                  <Layers className="w-3 h-3 me-1" />
                                  {t('حركة خزينة', 'Trésorerie')} #{m.treasuryTransaction.id}
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
                                <Badge variant="outline" className="text-[10px] mb-1 bg-blue-500/10 text-blue-600 border-blue-500/30">
                                  <FileText className="w-3 h-3 me-1" />
                                  {t('فاتورة عميل', 'Facture')} #{m.invoice.invoice_number}
                                </Badge>
                                <p className="font-semibold text-foreground">{m.invoice.client_name}</p>
                                <p className="font-mono text-muted-foreground" dir="ltr">
                                  {t('المتبقي:', 'Reste:')} {formatMoney(m.invoice.remaining_amount, m.invoice.currency)}
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
                          <td className="py-3 px-4 text-[11px] text-muted-foreground">
                            {m.matchReason}
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
                              {t('تأكيد وقيد', 'Valider')}
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
