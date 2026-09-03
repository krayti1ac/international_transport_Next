'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
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
  XCircle,
  Plus,
  Activity,
  Clock,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import {
  autoReconcileBankStatement,
  confirmBankReconciliation,
} from '@/features/finance/services/bank_reconciliation.actions';
import type { BankStatementRow, ReconciliationMatch } from '@/features/finance/services/bank_reconciliation.actions';
import type { TreasuryTransaction, BankAccount } from '@/types/database';
import { AddBankAccountModal } from '@/components/add-bank-account-modal';
import { DEFAULT_BANK_ACCOUNTS, fallbackArray } from '@/lib/default-data';

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function detectCurrency(text: string): string {
  const upper = text.toUpperCase();
  if (upper.includes('EUR') || upper.includes('EURO') || upper.includes('EUROS')) return 'EUR';
  if (upper.includes('USD') || upper.includes('DOLLAR')) return 'USD';
  return 'MAD';
}

export default function BankReconciliationScreen() {
  const [parsedRows, setParsedRows] = useState<BankStatementRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [result, setResult] = useState<{
    matched: ReconciliationMatch[];
    unmatchedBank: BankStatementRow[];
    unmatchedSystem: TreasuryTransaction[];
  } | null>(null);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<number | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [allPendingTx, setAllPendingTx] = useState<TreasuryTransaction[]>([]);
  const [loadingHealth, setLoadingHealth] = useState(false);

  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const parseCsvToRows = useCallback((csvText: string): BankStatementRow[] => {
    const lines = csvText.trim().split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];

    const headerLower = lines[0].toLowerCase();
    const colIdx = {
      date: headerLower.search(/\b(date|transaction_date|dateopened)\b/),
      desc: headerLower.search(/\b(description|narration|details|memo|libelle)\b/),
      amt: headerLower.search(/\b(amount|montant|debit|credit|value)\b/),
      ref: headerLower.search(/\b(reference|ref|num|trx|id|cheque|numero)\b/),
    };

    const rows: BankStatementRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const dateStr = colIdx.date >= 0 ? cols[colIdx.date]?.trim() ?? '' : '';
      const desc = colIdx.desc >= 0 ? cols[colIdx.desc]?.trim() ?? '' : '';
      const amtStr = colIdx.amt >= 0 ? cols[colIdx.amt]?.trim() ?? '' : '';
      const ref = colIdx.ref >= 0 ? cols[colIdx.ref]?.trim() : undefined;

      let parsedDate = dateStr || new Date().toISOString().split('T')[0];
      const dateMatch = dateStr.match(/(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})/);
      if (dateMatch) {
        const parts = dateMatch[0].split(/[\/\-.]/);
        if (parts[0].length === 4) {
          parsedDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } else {
          parsedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      const cleanAmt = amtStr.replace(/[^0-9.,\-]/g, '').replace(/,/g, '.');
      const amount = parseFloat(cleanAmt);
      if (Number.isNaN(amount)) continue;

      const currency = detectCurrency((desc || '') + ' ' + (lines[i] || ''));

      rows.push({
        date: parsedDate,
        amount: parseFloat(amount.toFixed(2)),
        description: desc || 'No description',
        reference: ref,
        currency,
      });
    }
    return rows;
  }, []);

  const fetchBankAccounts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .order('id', { ascending: true });
      if (error) throw error;
      const rows = fallbackArray(((data ?? []) as BankAccount[]).filter((a) => a.is_active !== false), DEFAULT_BANK_ACCOUNTS);
      if (rows.length > 0) {
        setSelectedBankAccountId((prev) => (prev && rows.some((r) => r.id === prev) ? prev : rows[0].id));
      }
      setBankAccounts(rows);
    } catch {
      const rows = DEFAULT_BANK_ACCOUNTS;
      if (rows.length > 0) {
        setSelectedBankAccountId((prev) => (prev && rows.some((r) => r.id === prev) ? prev : rows[0].id));
      }
      setBankAccounts(rows);
    }
  }, [supabase]);

  useEffect(() => {
    fetchBankAccounts();
  }, [fetchBankAccounts]);

  const fetchAccountHealth = useCallback(async () => {
    if (!selectedBankAccountId) {
      setAllPendingTx([]);
      return;
    }
    setLoadingHealth(true);
    try {
      const { data, error } = await supabase
        .from('treasury_transactions')
        .select('*')
        .eq('bank_account_id', selectedBankAccountId)
        .neq('reconciliation_status', 'reconciled')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      setAllPendingTx((data ?? []) as TreasuryTransaction[]);
    } catch {
      setAllPendingTx([]);
    } finally {
      setLoadingHealth(false);
    }
  }, [supabase, selectedBankAccountId]);

  useEffect(() => {
    fetchAccountHealth();
  }, [fetchAccountHealth]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) || '';
      try {
        const rows = parseCsvToRows(text);
        setParsedRows(rows);
        setErrors(rows.length === 0 ? ['الملف فارغ أو لا يحتوي على بيانات صالحة'] : []);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'خطأ في قراءة الملف';
        setErrors([message]);
      }
    };
    reader.readAsText(file);
  }, [parseCsvToRows]);

  const handleReconcile = useCallback(async () => {
    if (!selectedBankAccountId || parsedRows.length === 0) return;
    setLoading(true);
    setResult(null);
    setErrors([]);
    try {
      const res = await autoReconcileBankStatement(parsedRows, selectedBankAccountId);
      setResult({
        matched: res.matched || [],
        unmatchedBank: res.unmatchedBankRows || [],
        unmatchedSystem: res.unmatchedSystemTransactions || [],
      });
      toast({ title: `تمت المطابقة: ${res.matched?.length || 0} معاملة` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'خطأ في المطابقة';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [parsedRows, selectedBankAccountId, toast]);

  const handleConfirmMatch = useCallback(
    async (txId: number) => {
      setReconciling(true);
      try {
        const match = result?.matched.find((m) => m.treasuryTransaction.id === txId);
        if (!match) return;
        const ref = match.bankRow.reference || match.bankRow.description || 'bank_reconciled';
        const res = await confirmBankReconciliation(txId, ref);
        if (res.success) {
          setResult((prev) =>
            prev
              ? {
                  ...prev,
                  matched: prev.matched.filter((m) => m.treasuryTransaction.id !== txId),
                  unmatchedSystem: prev.unmatchedSystem.filter((tx) => tx.id !== txId),
                }
              : prev
          );
          toast({ title: 'تم تأكيد المطابقة' });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'خطأ';
        toast({ title: message, variant: 'destructive' });
      } finally {
        setReconciling(false);
      }
    },
    [result, toast]
  );

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR');
    } catch {
      return dateStr;
    }
  };

  const accountHealth = useMemo(() => {
    const now = Date.now();
    const buckets = { fresh: 0, aging: 0, stale: 0, critical: 0 };
    const sumByCurrency: Record<string, number> = {};
    const staleItems: TreasuryTransaction[] = [];

    for (const tx of allPendingTx) {
      const ageDays = Math.floor((now - new Date(tx.created_at).getTime()) / 86400000);
      if (ageDays > 90) buckets.critical++;
      else if (ageDays > 60) buckets.stale++;
      else if (ageDays > 30) buckets.aging++;
      else buckets.fresh++;

      const cur = tx.currency || 'MAD';
      sumByCurrency[cur] = (sumByCurrency[cur] ?? 0) + (tx.type === 'income' ? tx.amount : -tx.amount);

      if (ageDays > 60) staleItems.push(tx);
    }

    const selected = bankAccounts.find((a) => a.id === selectedBankAccountId);
    return { buckets, sumByCurrency, staleItems, selected };
  }, [allPendingTx, bankAccounts, selectedBankAccountId]);

  const formatCurrency = (amount: number, currency: string) => `${amount.toFixed(2)} ${currency}`;

  const getMatchStrength = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return { label: 'ثقة عالية', color: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/25' };
      case 'medium':
        return { label: 'ثقة متوسطة', color: 'bg-blue-500/15 text-blue-700 border-blue-500/25' };
      default:
        return { label: 'ثقة ضعيفة', color: 'bg-amber-500/15 text-amber-700 border-amber-500/25' };
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6 text-primary" />
            التسوية البنكية التلقائية
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            مطابقة كشوف الحساب مع المعاملات المسجلة
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setIsAddAccountOpen(true)}
          className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-semibold h-9 px-3 gap-1.5 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          إضافة حساب بنكي جديد
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">1. تحميل كشف الحساب البنكي</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">الحساب البنكي</label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddAccountOpen(true)}
                  className="h-6 text-xs text-primary hover:text-primary/80 gap-1 px-1.5 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  إضافة حساب
                </Button>
              </div>
              <select
                value={selectedBankAccountId ?? ''}
                onChange={(e) => setSelectedBankAccountId(e.target.value ? Number(e.target.value) : null)}
                className="w-full h-10 px-3 border border-input rounded-lg bg-card text-foreground text-sm focus:ring-2 focus:ring-ring shadow-2xs [color-scheme:light] dark:[color-scheme:dark]"
              >
                <option value="">-- اختر الحساب البنكي --</option>
                {bankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name || a.bank_name || `حساب #${a.id}`} ({a.currency || 'MAD'})
                  </option>
                ))}
              </select>

              {bankAccounts.length === 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 mt-2">
                  <span>لا توجد حسابات بنكية مسجلة حالياً. يُرجى إضافة حسابك البنكي.</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setIsAddAccountOpen(true)}
                    className="h-7 text-xs border-amber-500/30 text-amber-800 dark:text-amber-300 font-medium"
                  >
                    + إضافة حساب بنكي الآن
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">ملف كشف الحساب (CSV)</label>
              <div className="relative">
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="bank-csv-upload"
                />
                <label
                  htmlFor="bank-csv-upload"
                  className="flex items-center gap-2 h-10 px-4 border border-dashed border-input rounded-lg bg-card hover:bg-accent cursor-pointer transition-colors"
                >
                  <Upload className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground truncate">
                    {fileName || 'اختر ملف CSV أو اسحبه هنا...'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {errors.length > 0 && (
            <Card className="border-rose-500/20">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-500 mt-0.5" />
                  <div>
                    <p className="font-semibold text-rose-600 text-sm">أخطاء في قراءة الملف:</p>
                    <ul className="text-xs text-rose-600/80 mt-1 space-y-0.5">
                      {errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Button
            onClick={handleReconcile}
            disabled={loading || !parsedRows.length || !selectedBankAccountId}
            className="w-full h-11 text-base font-semibold"
          >
            {loading || reconciling ? (
              <>
                <RefreshCw className="w-4 h-4 ml-2 animate-spin" />
                جاري المطابقة التلقائية...
              </>
            ) : (
              <>
                <ArrowLeftRight className="w-4 h-4 ml-2" />
                مطابقة تلقائية ({parsedRows.length} صف)
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {selectedBankAccountId && (
        <Card className="border-slate-500/15">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-foreground">
              <Activity className="w-5 h-5 text-primary" />
              صحة الحساب البنكي
              {loadingHealth && <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {accountHealth.selected
                ? `${accountHealth.selected.name || accountHealth.selected.bank_name} • رصيد مُسجَّل: ${formatCurrency(accountHealth.selected.current_balance, accountHealth.selected.currency)}`
                : 'لم يتم اختيار حساب'}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
                  <Clock className="w-3.5 h-3.5" /> ≤ 30 يوم
                </div>
                <p className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                  {accountHealth.buckets.fresh}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
                <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                  <Clock className="w-3.5 h-3.5" /> 31-60 يوم
                </div>
                <p className="text-xl font-bold font-mono text-amber-700 dark:text-amber-400 mt-1">
                  {accountHealth.buckets.aging}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/15">
                <div className="flex items-center gap-2 text-xs text-orange-700 dark:text-orange-400">
                  <Clock className="w-3.5 h-3.5" /> 61-90 يوم
                </div>
                <p className="text-xl font-bold font-mono text-orange-700 dark:text-orange-400 mt-1">
                  {accountHealth.buckets.stale}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/15">
                <div className="flex items-center gap-2 text-xs text-rose-700 dark:text-rose-400">
                  <Clock className="w-3.5 h-3.5" /> {">"} 90 يوم (حرج)
                </div>
                <p className="text-xl font-bold font-mono text-rose-700 dark:text-rose-400 mt-1">
                  {accountHealth.buckets.critical}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              {Object.entries(accountHealth.sumByCurrency).map(([cur, net]) => (
                <div
                  key={cur}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${
                    net >= 0
                      ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                      : 'bg-rose-500/5 border-rose-500/20 text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {net >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  <span className="font-mono font-semibold">{formatCurrency(net, cur)}</span>
                  <span className="text-muted-foreground">صافي معلَّق</span>
                </div>
              ))}
            </div>

            {accountHealth.staleItems.length > 0 && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/5 border border-rose-500/15">
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  معاملات معلَّقة منذ أكثر من 60 يوم ({accountHealth.staleItems.length})
                </p>
                <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {accountHealth.staleItems.slice(0, 5).map((tx) => (
                    <li key={tx.id} className="text-xs text-muted-foreground flex justify-between">
                      <span className="truncate">#{tx.id} - {tx.description?.substring(0, 40)}</span>
                      <span className="font-mono shrink-0">{formatCurrency(tx.amount, tx.currency)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">إجمالي صفوف CSV</p>
                <p className="text-2xl font-bold font-mono text-foreground">{parsedRows.length}</p>
              </CardContent>
            </Card>
            <Card className="border-emerald-500/20">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-emerald-600 uppercase tracking-wider">مطابقات تلقائية</p>
                <p className="text-2xl font-bold font-mono text-emerald-600">{result.matched.length}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-500/20">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-amber-600 uppercase tracking-wider">غير مطابق</p>
                <p className="text-2xl font-bold font-mono text-amber-600">
                  {result.unmatchedBank.length + result.unmatchedSystem.length}
                </p>
              </CardContent>
            </Card>
          </div>

          {result.matched.length > 0 && (
            <Card className="border-emerald-500/15">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-700 text-base">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  المطابقات التلقائية ({result.matched.length})
                </CardTitle>
                <p className="text-xs text-muted-foreground">اضغط &quot;تأكيد&quot; لترسيم كل مطابقة</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.matched.map((match, idx) => {
                    const strength = getMatchStrength(match.confidence);
                    return (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15 flex items-center justify-between gap-4 flex-wrap"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={strength.color}>{strength.label}</Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">صف #{idx + 1}</p>
                              <p className="font-mono font-medium text-foreground">
                                {formatCurrency(match.bankRow.amount, match.bankRow.currency)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(match.bankRow.date)} - {match.bankRow.description}
                              </p>
                            </div>
                            <div className="flex items-center justify-center">
                              <ArrowLeftRight className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">معاملة #{match.treasuryTransaction.id}</p>
                              <p className="font-mono font-medium text-foreground">
                                {formatCurrency(match.treasuryTransaction.amount, match.treasuryTransaction.currency)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {match.treasuryTransaction.description?.substring(0, 50)}
                                {match.treasuryTransaction.reference && ` (Ref: ${match.treasuryTransaction.reference})`}
                              </p>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-2">{match.matchReason}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleConfirmMatch(match.treasuryTransaction.id)}
                          disabled={reconciling}
                          className="shrink-0 bg-emerald-600 hover:bg-emerald-700"
                        >
                          {reconciling ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 ml-1" />
                              تأكيد
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  صفوف كشف الحساب غير المطابقة ({result.unmatchedBank.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.unmatchedBank.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-6">لا توجد صفوف غير مطابقة</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {result.unmatchedBank.map((row, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/10 text-xs">
                        <div className="flex justify-between items-start">
                          <span className="font-mono font-bold text-rose-600">
                            {formatCurrency(row.amount, row.currency)}
                          </span>
                          <span className="text-muted-foreground">{formatDate(row.date)}</span>
                        </div>
                        <p className="text-muted-foreground mt-1">{row.description}</p>
                        {row.reference && <p className="text-muted-foreground">Ref: {row.reference}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Landmark className="w-4 h-4" />
                  المعاملات النظامية غير المسوية ({result.unmatchedSystem.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.unmatchedSystem.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-6">لا توجد معاملات غير مسوية</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {result.unmatchedSystem.map((tx) => (
                      <div key={tx.id} className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 text-xs">
                        <div className="flex justify-between items-start">
                          <span className="font-mono font-bold text-amber-600">
                            {formatCurrency(tx.amount, tx.currency)}
                          </span>
                          <Badge variant="outline" className="text-[10px]">{tx.reconciliation_status}</Badge>
                        </div>
                        <p className="text-muted-foreground mt-1">{tx.description?.substring(0, 60)}</p>
                        {tx.reference && <p className="text-muted-foreground">Ref: {tx.reference}</p>}
                        <p className="text-muted-foreground">
                          {new Date(tx.created_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <AddBankAccountModal
        isOpen={isAddAccountOpen}
        onClose={() => setIsAddAccountOpen(false)}
        onSuccess={(newAcc: BankAccount) => {
          fetchBankAccounts();
          if (newAcc?.id) {
            setSelectedBankAccountId(newAcc.id);
          }
        }}
      />
    </div>
  );
}
