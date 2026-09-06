'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { TreasuryTransaction, BankAccount, CashBox } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Search,
  Building2,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  TrendingUp,
  Receipt,
  Wallet,
  ArrowRightLeft,
  Layers,
  X
} from 'lucide-react';
import { formatCurrency, groupBalancesByCurrency } from '@/lib/forex';
import { useLanguage } from '@/components/language-provider';
import { DEFAULT_BANK_ACCOUNTS, DEFAULT_CASH_BOXES, fallbackArray } from '@/lib/default-data';

import { useTreasuryDataQuery } from '@/lib/query/hooks';
import { useQueryClient } from '@tanstack/react-query';
import Decimal from 'decimal.js';

export default function TreasuryPage() {
  const { t, dir, locale } = useLanguage();
  const { data: treasuryData, isLoading } = useTreasuryDataQuery();
  const queryClient = useQueryClient();

  const transactions = treasuryData?.transactions || [];
  const bankAccounts = treasuryData?.bankAccounts || [];
  const cashBoxes = treasuryData?.cashBoxes || [];
  const loading = isLoading;

  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    type: 'trip_revenue',
    amount: '',
    currency: 'MAD',
    destinationType: 'bank',
    destinationId: '',
    description: '',
    reference: '',
  });

  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const refreshData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['treasury-data'] });
  }, [queryClient]);

  useEffect(() => {
    const channel = supabase
      .channel('treasury-realtime-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'treasury_transactions' },
        () => {
          refreshData();
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bank_accounts' }, () => refreshData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_boxes' }, () => refreshData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshData, supabase]);

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const decAmount = new Decimal(formData.amount || 0);
      const numericAmount = decAmount.toNumber();

      const payload: Partial<TreasuryTransaction> = {
        type: formData.type,
        amount: numericAmount,
        currency: formData.currency,
        description: formData.description,
        reference: formData.reference || undefined,
        created_by: session?.user?.id,
        reconciliation_status: 'reconciled',
        bank_account_id: formData.destinationType === 'bank' ? parseInt(formData.destinationId) : undefined,
        cash_box_id: formData.destinationType === 'cashbox' ? parseInt(formData.destinationId) : undefined,
      };

      const { error } = await supabase.from('treasury_transactions').insert(payload);
      if (error) throw error;

      if (formData.destinationType === 'bank' && formData.destinationId) {
        const targetBank = bankAccounts.find((b) => b.id === parseInt(formData.destinationId));
        if (targetBank) {
          const newBal = new Decimal(targetBank.current_balance || 0).plus(decAmount).toNumber();
          await supabase.from('bank_accounts').update({ current_balance: newBal }).eq('id', targetBank.id);
        }
      }

       toast({ title: t('تم تسجيل المعاملة وتحديث الرصيد بنجاح', 'Transaction enregistrée et solde mis à jour avec succès', 'Transaction recorded and balance updated') });
      setShowModal(false);
      setFormData({
        type: 'trip_revenue',
        amount: '',
        currency: 'MAD',
        destinationType: 'bank',
        destinationId: '',
        description: '',
        reference: '',
      });
      refreshData();
    } catch (error: any) {
      toast({
        title: t('خطأ أثناء تسجيل المعاملة', 'Erreur lors de l\'enregistrement de la transaction', 'Error while recording transaction'),
        description: error?.message || t('خطأ غير متوقع', 'Erreur inattendue', 'Unexpected error'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const bankBalances = groupBalancesByCurrency(bankAccounts);
  const filteredTransactions = transactions.filter(
    (item) =>
      item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.reference?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTypeText = (type: string) => {
    switch (type) {
      case 'capital_injection':
        return t('ضخ رأس مال', 'Injection de capital', 'Capital Injection');
      case 'trip_revenue':
        return t('عائدات رحلة', 'Recette voyage', 'Trip Revenue');
      case 'expense':
        return t('مصروفات تشغيلية', 'Dépense opérationnelle', 'Operating Expenses');
      case 'transfer':
        return t('تحويل مالي', 'Virement / Transfert', 'Internal Transfer');
      case 'payment':
        return t('استلام دفعة عميل', 'Encaissement client', 'Client Payment');
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir={dir}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span>{t('الخزينة والسيولة النقدية', 'Trésorerie et liquidités', 'Treasury & Cash Liquidity')}</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold font-amiri tracking-tight text-foreground">
            {t('الحسابات البنكية والصناديق النقدية', 'Comptes bancaires et caisses', 'Bank Accounts & Cash Boxes')}
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
             {t('إدارة الأرصدة المتعددة العملات (MAD / EUR / USD) وتدفق السيولة للعمليات الدولية.', 'Gestion des soldes multi-devises (MAD / EUR / USD) et flux de liquidités.', 'Manage multi-currency balances and cash flow for international operations.')}
          </p>
        </div>

        <Button
          onClick={() => setShowModal(true)}
          className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 shadow-md font-medium text-xs sm:text-sm rounded-xl h-10 px-4 transition-all"
        >
          <Plus className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
           {t('تسجيل حركة مالية جديدة', 'Nouvelle transaction', 'New Transaction')}
        </Button>
      </div>

      {/* Bento Grid Treasury KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* MAD Liquidity Card */}
        <div className="bg-card border border-border/80 p-5 rounded-2xl flex flex-col justify-between h-40 relative overflow-hidden group shadow-xs hover:shadow-md transition-all">
          <div className={`absolute top-0 ${dir === 'rtl' ? 'right-0' : 'left-0'} w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none`} />
          <div className="relative z-10 flex justify-between items-start">
            <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
               {t('السيولة البنكية (MAD)', 'Liquidité Bancaire (MAD)', 'Bank Liquidity (MAD)')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-3xl font-extrabold font-mono text-foreground">
              {formatCurrency(bankBalances['MAD'] || 0, 'MAD')}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
               {t('الحسابات بالدرهم المغربي', 'Comptes en dirham marocain', 'Accounts in Moroccan Dirham')}
            </div>
          </div>
        </div>

        {/* EUR Liquidity Card */}
        <div className="bg-card border border-border/80 p-5 rounded-2xl flex flex-col justify-between h-40 relative overflow-hidden group shadow-xs hover:shadow-md transition-all">
          <div className={`absolute top-0 ${dir === 'rtl' ? 'right-0' : 'left-0'} w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none`} />
          <div className="relative z-10 flex justify-between items-start">
            <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
               {t('السيولة الدولية (EUR)', 'Liquidité Internationale (EUR)', 'International Liquidity (EUR)')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
              {formatCurrency(bankBalances['EUR'] || 0, 'EUR')}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
               {t('حسابات اليورو للعمليات الدولية', 'Comptes en euro pour l\'international', 'Euro accounts for international freight')}
            </div>
          </div>
        </div>

        {/* Cash Boxes Card */}
        <div className="bg-card border border-border/80 p-5 rounded-2xl flex flex-col justify-between h-40 relative overflow-hidden group shadow-xs hover:shadow-md transition-all">
          <div className={`absolute top-0 ${dir === 'rtl' ? 'right-0' : 'left-0'} w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none`} />
          <div className="relative z-10 flex justify-between items-start">
            <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
               {t('الصناديق النقدية (Cash Boxes)', 'Caisses Espèces (Cash Boxes)', 'Cash Boxes')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-3xl font-extrabold font-mono text-foreground">
              {cashBoxes.length}{' '}
               <span className="text-xs text-muted-foreground font-normal font-sans">{t('صناديق نقدية', 'caisses', 'boxes')}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
               {t('المصاريف النثرية وسلف السائقين الميدانية', 'Frais divers et avances chauffeurs', 'Petty cash & driver advances')}
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className={`absolute ${dir === 'rtl' ? 'right-3.5' : 'left-3.5'} top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4`} />
        <Input
           placeholder={t('بحث في الحركات المالية بالوصف، المرجع، أو نوع العملية...', 'Rechercher par description, référence ou type d\'opération...', 'Search transactions by description, reference, or type...')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`${dir === 'rtl' ? 'pr-10' : 'pl-10'} h-10 rounded-xl bg-card border-border/80 text-xs`}
        />
      </div>

      {/* Transactions List */}
      {loading ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <p className="text-xs text-muted-foreground">{t('جاري تحميل السجلات المالية...', 'Chargement des enregistrements financiers...', 'Loading financial records...')}</p>
        </div>
      ) : (
        <Card className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden">
          <CardHeader className="p-4 pb-3 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold font-amiri text-foreground flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" />
               {t('سجل العمليات والتدفقات المالية الأخيرة', 'Dernières opérations et flux financiers', 'Recent financial operations & cash flow')}
            </CardTitle>
            <span className="text-xs font-mono text-muted-foreground">
              {t(`${filteredTransactions.length} حركة مسجلة`, `${filteredTransactions.length} opération(s)`)}
            </span>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {filteredTransactions.map((transaction) => {
                const isPositive = Number(transaction.amount) >= 0;
                return (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-3.5 bg-muted/20 hover:bg-muted/40 transition-colors rounded-xl border border-border/50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isPositive
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isPositive ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-semibold text-foreground">{transaction.description}</p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                          <span className="font-medium bg-muted px-2 py-0.5 rounded-md text-foreground">
                            {getTypeText(transaction.type)}
                          </span>
                          {transaction.reference && (
                            <>
                              <span>•</span>
                               <span className="font-mono">{t('مرجع: ', 'Réf : ', 'Ref: ')} {transaction.reference}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-start">
                      <p
                        className={`font-bold font-mono text-sm sm:text-base ${
                          isPositive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {formatCurrency(transaction.amount, transaction.currency)}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                        {new Date(transaction.created_at).toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'fr' ? 'fr-FR' : 'en-US')}
                      </p>
                    </div>
                  </div>
                );
              })}

              {filteredTransactions.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-xs text-muted-foreground">{t('لا توجد حركات مالية مسجلة', 'Aucune transaction financière enregistrée', 'No financial transactions recorded')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <Card className="w-full max-w-lg rounded-2xl shadow-2xl border-border bg-card overflow-hidden">
            <CardHeader className="p-4 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold font-amiri text-foreground">
                 {t('تسجيل حركة مالية جديدة', 'Nouvelle transaction financière', 'New financial transaction')}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => setShowModal(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-4">
              <form onSubmit={handleCreateTransaction} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                     <label className="text-xs font-semibold text-foreground">{t('نوع العملية', 'Type d\'opération', 'Transaction type')}</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full h-9 px-3 border border-border bg-card text-foreground rounded-xl text-xs font-medium focus:ring-1 focus:ring-primary shadow-2xs"
                    >
                       <option value="trip_revenue">{t('عائدات رحلة (+)', 'Recette voyage (+)', 'Trip Revenue (+)')}</option>
                       <option value="payment">{t('استلام دفعة عميل (+)', 'Encaissement client (+)', 'Client Payment (+)')}</option>
                       <option value="capital_injection">{t('ضخ رأس مال (+)', 'Injection de capital (+)', 'Capital Injection (+)')}</option>
                       <option value="expense">{t('مصروفات تشغيلية (-)', 'Dépenses d\'exploitation (-)', 'Operating Expenses (-)')}</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                     <label className="text-xs font-semibold text-foreground">{t('العملة', 'Devise', 'Currency')}</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full h-9 px-3 border border-border bg-card text-foreground rounded-xl text-xs font-mono font-bold focus:ring-1 focus:ring-primary shadow-2xs"
                    >
                       <option value="MAD">MAD ({t('درهم مغربي', 'Dirham marocain', 'Moroccan Dirham')})</option>
                       <option value="EUR">EUR ({t('يورو', 'Euro', 'Euro')})</option>
                       <option value="USD">USD ({t('دولار', 'Dollar', 'US Dollar')})</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                   <label className="text-xs font-semibold text-foreground">{t('المبلغ (سالب للمصاريف)', 'Montant (négatif pour les dépenses)', 'Amount (negative for expenses)')}</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                    required
                    dir="ltr"
                    className="h-9 text-xs rounded-xl font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                     <label className="text-xs font-semibold text-foreground">{t('الجهة المالية', 'Entité financière', 'Financial entity')}</label>
                    <select
                      value={formData.destinationType}
                      onChange={(e) => setFormData({ ...formData, destinationType: e.target.value, destinationId: '' })}
                      className="w-full h-9 px-3 border border-border bg-card text-foreground rounded-xl text-xs font-medium focus:ring-1 focus:ring-primary shadow-2xs"
                    >
                       <option value="bank">{t('حساب بنكي', 'Compte bancaire', 'Bank Account')}</option>
                       <option value="cashbox">{t('صندوق نقدي (Cash Box)', 'Caisse (Cash Box)', 'Cash Box')}</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                     <label className="text-xs font-semibold text-foreground">{t('الحساب / الصندوق', 'Compte / Caisse', 'Account / Cash Box')}</label>
                    <select
                      value={formData.destinationId}
                      onChange={(e) => setFormData({ ...formData, destinationId: e.target.value })}
                      className="w-full h-9 px-3 border border-border bg-card text-foreground rounded-xl text-xs font-medium focus:ring-1 focus:ring-primary shadow-2xs"
                      required
                    >
                       <option value="">{t('-- اختر الحساب --', '-- Choisir le compte --', '-- Select account --')}</option>
                      {formData.destinationType === 'bank' &&
                        bankAccounts.map((b) => (
                          <option key={b.id} value={b.id}>
                             {b.bank_name || b.name || `${t('حساب', 'Compte', 'Account')} #${b.id}`} ({b.currency || 'MAD'})
                          </option>
                        ))}
                      {formData.destinationType === 'cashbox' &&
                        cashBoxes.map((c) => (
                          <option key={c.id} value={c.id}>
                             {c.name || c.code || `${t('صندوق', 'Caisse', 'Cash Box')} #${c.id}`} ({c.currency || 'MAD'})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                   <label className="text-xs font-semibold text-foreground">{t('بيان العملية (الوصف)', 'Description de l\'opération', 'Transaction description')}</label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                     placeholder={t('بيان العملية المالية...', 'Libellé de l\'opération...', 'Transaction description...')}
                    required
                    className="h-9 text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                   <label className="text-xs font-semibold text-foreground">{t('المرجع / الشيك (اختياري)', 'N° Référence / Chèque (optionnel)', 'Reference / Cheque (optional)')}</label>
                  <Input
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    placeholder="Ref: CHQ-9812..."
                    className="h-9 text-xs rounded-xl font-mono"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl h-9 text-xs font-semibold"
                  >
                     {isSubmitting ? t('جاري الحفظ...', 'Enregistrement...', 'Saving...') : t('حفظ المعاملة', 'Enregistrer la transaction', 'Save Transaction')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowModal(false)}
                    className="rounded-xl h-9 text-xs"
                  >
                     {t('إلغاء', 'Annuler', 'Cancel')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
