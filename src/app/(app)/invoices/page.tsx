'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Invoice, Client, TripOrder, BankAccount, CashBox } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Search,
  FileText,
  Printer,
  Edit2,
  Trash2,
  ArrowRightLeft,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building,
  Calendar,
  Layers,
  Receipt,
  ListChecks,
  MessageCircle,
  Share2,
  RefreshCw,
  Send,
  Loader2
} from 'lucide-react';
import { InvoicePrintModal } from '@/components/invoice-print-modal';
import { InvoiceFormModal } from '@/components/invoice-form-modal';
import { FIFOPaymentModal } from '@/components/fifo-payment-modal';
import { PaymentRequestModal } from '@/components/payment-request-modal';
import { CardViewToggle, useCardViewMode } from '@/components/ui/card-view-toggle';
import {
  DEFAULT_CLIENTS,
  DEFAULT_TRIPS,
  DEFAULT_BANK_ACCOUNTS,
  DEFAULT_CASH_BOXES,
  DEFAULT_INVOICES,
  fallbackArray
} from '@/lib/default-data';
import {
  getOverdueInvoiceReminders,
  sendOverdueInvoiceReminders,
  type OverdueInvoiceReminder
} from '@/features/invoices/services/whatsapp_reminders.actions';

import { useInvoicesDataQuery } from '@/lib/query/hooks';
import { useQueryClient } from '@tanstack/react-query';
import Decimal from 'decimal.js';
import { useLanguage } from '@/components/language-provider';

function InvoicesPageContent() {
  const { t, dir, locale } = useLanguage();
  const searchParams = useSearchParams();
  const actionParam = searchParams.get('action');
  const statusParam = searchParams.get('status');
  const tabParam = searchParams.get('tab');

  const { data: invoicesData, isLoading } = useInvoicesDataQuery();
  const queryClient = useQueryClient();

  const invoices = invoicesData?.invoices || [];
  const clients = invoicesData?.clients || [];
  const trips = invoicesData?.trips || [];
  const bankAccounts = invoicesData?.bankAccounts || [];
  const cashBoxes = invoicesData?.cashBoxes || [];
  const loading = isLoading;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(statusParam || 'all');
  const [activeTab, setActiveTab] = useState<'invoices' | 'payment_notifications'>(
    tabParam === 'payment_notifications' ? 'payment_notifications' : 'invoices'
  );
  const [cardLayout, setCardLayout] = useCardViewMode('invoices', 'grid');

  // Modals state
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isFIFOPaymentOpen, setIsFIFOPaymentOpen] = useState(false);
  const [isPaymentRequestOpen, setIsPaymentRequestOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [paymentRequestInvoice, setPaymentRequestInvoice] = useState<Invoice | null>(null);
  const [fifoClientId, setFifoClientId] = useState<number | ''>('');

  // Reminders
  const [reminders, setReminders] = useState<OverdueInvoiceReminder[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [sendingAllReminders, setSendingAllReminders] = useState(false);

  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const refreshInvoices = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['invoices-data'] });
  }, [queryClient]);

  const loadReminders = useCallback(async () => {
    setRemindersLoading(true);
    try {
      const res = await getOverdueInvoiceReminders();
      if (res.success && res.reminders) {
        setReminders(res.reminders);
      }
    } catch (e) {
      console.error('Error fetching reminders', e);
    } finally {
      setRemindersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReminders();

    const channel = supabase
      .channel('invoices-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        refreshInvoices();
        loadReminders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshInvoices, loadReminders, supabase]);

  // Handle URL Query Params
  useEffect(() => {
    if (actionParam === 'payment_request') {
      setIsPaymentRequestOpen(true);
    } else if (actionParam === 'new') {
      setEditingInvoice(null);
      setIsFormModalOpen(true);
    } else if (actionParam === 'fifo_payment' || actionParam === 'payment') {
      setIsFIFOPaymentOpen(true);
    }

    if (statusParam) {
      setStatusFilter(statusParam);
      setActiveTab('invoices');
    } else {
      setStatusFilter('all');
    }

    if (tabParam === 'payment_notifications') {
      setActiveTab('payment_notifications');
    } else if (!tabParam) {
      setActiveTab('invoices');
    }
  }, [actionParam, statusParam, tabParam]);

  const handleSaveInvoice = async (invoiceData: Partial<Invoice>) => {
    try {
      if (editingInvoice) {
        const { error } = await supabase
          .from('invoices')
          .update(invoiceData)
          .eq('id', editingInvoice.id);
        if (error) throw error;
        toast({ title: t('تم تعديل الفاتورة بنجاح', 'Facture modifiée avec succès') });
      } else {
        const { error } = await supabase.from('invoices').insert(invoiceData);
        if (error) throw error;
        toast({ title: t('تم إنشاء الفاتورة بنجاح', 'Facture créée avec succès') });
      }
      refreshInvoices();
    } catch (error: any) {
      toast({
        title: t('خطأ أثناء الحفظ', "Erreur lors de l'enregistrement"),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleUpdateStatus = async (invoiceId: number, status: string) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status })
        .eq('id', invoiceId);
      if (error) throw error;
      toast({ title: `${t('تم تغيير حالة الفاتورة إلى', 'Statut de facture mis à jour :')} "${getStatusText(status)}"` });
      refreshInvoices();
    } catch (error: any) {
      toast({
        title: t('خطأ', 'Erreur'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteInvoice = async (id: number) => {
    if (!confirm(t('هل أنت متأكد من رغبتك في حذف هذه الفاتورة؟', 'Êtes-vous sûr de vouloir supprimer cette facture ?'))) return;

    try {
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
      toast({ title: t('تم حذف الفاتورة بنجاح', 'Facture supprimée avec succès') });
      refreshInvoices();
    } catch (error: any) {
      toast({
        title: t('خطأ أثناء الحذف', 'Erreur lors de la suppression'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSendAllReminders = async () => {
    setSendingAllReminders(true);
    try {
      const res = await sendOverdueInvoiceReminders();
      if (res.success) {
        toast({
          title: t('✅ تم إرسال التذكيرات بنجاح', '✅ Rappels envoyés avec succès'),
          description: t(`تم توجيه ${res.sentCount} إشعار سداد للعملاء عبر WhatsApp.`, `${res.sentCount} notifications de paiement envoyées via WhatsApp.`),
        });
        loadReminders();
      } else {
        toast({
          title: t('خطأ أثناء إرسال التذكيرات', "Erreur lors de l'envoi des rappels"),
          description: res.error,
          variant: 'destructive',
        });
      }
    } finally {
      setSendingAllReminders(false);
    }
  };

  const isInvoiceOverdue = useCallback((inv: Invoice) => {
    if (inv.status === 'paid') return false;
    if (inv.status === 'overdue') return true;
    if (inv.due_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(inv.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    }
    return false;
  }, []);

  const getStatusText = (statusOrInvoice: Invoice | string) => {
    const isObj = typeof statusOrInvoice === 'object' && statusOrInvoice !== null;
    const status = isObj ? statusOrInvoice.status : statusOrInvoice;
    if (isObj && isInvoiceOverdue(statusOrInvoice) && status !== 'paid') {
      return t('متأخرة عن الدفع', 'En retard de paiement');
    }
    switch (status) {
      case 'paid':
        return t('مدفوعة بالكامل', 'Payée en totalité');
      case 'partially_paid':
        return t('مدفوعة جزئياً', 'Partiellement payée');
      case 'unpaid':
        return t('غير مدفوعة', 'Non payée');
      case 'overdue':
        return t('متأخرة', 'En retard');
      default:
        return status || t('غير محدد', 'Non défini');
    }
  };

  const getStatusColor = (statusOrInvoice: Invoice | string) => {
    const isObj = typeof statusOrInvoice === 'object' && statusOrInvoice !== null;
    const status = isObj ? statusOrInvoice.status : statusOrInvoice;
    if (isObj && isInvoiceOverdue(statusOrInvoice) && status !== 'paid') {
      return 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/25';
    }
    switch (status) {
      case 'paid':
        return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25';
      case 'partially_paid':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25';
      case 'unpaid':
        return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25';
      case 'overdue':
        return 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/25';
      default:
        return 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/25';
    }
  };

  // KPIs
  const totalAmountMAD = useMemo(() => {
    return invoices.reduce(
      (acc, inv) => (inv.currency !== 'EUR' ? acc.plus(new Decimal(inv.total_amount || 0)) : acc),
      new Decimal(0)
    ).toNumber();
  }, [invoices]);
  const paidCount = invoices.filter((i) => i.status === 'paid').length;
  const overdueCount = invoices.filter((i) => isInvoiceOverdue(i)).length;
  const unpaidCount = invoices.filter((i) => i.status !== 'paid').length;

  const filteredInvoices = invoices.filter((invoice) => {
    const client = clients.find((c) => c.id === Number(invoice.client_id));
    const clientName = client?.name || '';
    const isOverdue = isInvoiceOverdue(invoice);

    const matchesSearch =
      invoice.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.status?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (invoice.payment_request_ref &&
        invoice.payment_request_ref.toLowerCase().includes(searchQuery.toLowerCase()));

    let matchesStatus = true;
    if (statusFilter === 'all') {
      matchesStatus = true;
    } else if (statusFilter === 'overdue') {
      matchesStatus = isOverdue;
    } else if (statusFilter === 'unpaid') {
      matchesStatus = invoice.status === 'unpaid' && !isOverdue;
    } else {
      matchesStatus = invoice.status === statusFilter;
    }

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir={dir}>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{t('الإدارة المالية والمحاسبة', 'Gestion Financière & Comptabilité')}</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold font-amiri tracking-tight text-foreground">
            {t('الفواتير وطلبات الدفع الدولية', 'Factures & Demandes de Paiement')}
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            {t(
              'إصدار الفواتير الرسمية، إنشاء طلبات السداد (Demandes de Paiement)، ومتابعة التحصيلات بنظام FIFO.',
              'Émission des factures officielles, demandes de paiement et suivi des encaissements FIFO.'
            )}
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Create Payment Request Button */}
          <Button
            onClick={() => {
              setPaymentRequestInvoice(null);
              setIsPaymentRequestOpen(true);
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm rounded-xl h-10 px-3.5 font-semibold shadow-2xs gap-1.5"
          >
            <Receipt className="w-4 h-4" />
            {t('إنشاء طلب الدفع', 'Demande de paiement')}
          </Button>

          {/* FIFO Payment Button */}
          <Button
            variant="outline"
            onClick={() => {
              setFifoClientId('');
              setIsFIFOPaymentOpen(true);
            }}
            className="border-emerald-600/40 bg-card hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm rounded-xl h-10 px-3.5 font-semibold shadow-2xs gap-1.5"
          >
            <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
            {t('تحصيل دفعة (FIFO)', 'Encaissement (FIFO)')}
          </Button>

          {/* Create Invoice Button */}
          <Button
            onClick={() => {
              setEditingInvoice(null);
              setIsFormModalOpen(true);
            }}
            className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 shadow-md font-medium text-xs sm:text-sm rounded-xl h-10 px-3.5 transition-all gap-1.5"
          >
            <Plus className="w-4 h-4" />
            {t('إنشاء فاتورة جديدة', 'Nouvelle facture')}
          </Button>
        </div>
      </div>

      {/* Navigation Tabs between Invoices and Payment Notifications */}
      <div className="flex items-center justify-between border-b border-border/60 pb-1">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'invoices'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            <FileText className="w-4 h-4" />
            {t('سجل الفواتير', 'Registre des factures')}
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-foreground/20 font-mono">
              {invoices.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('payment_notifications')}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'payment_notifications'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            <ListChecks className="w-4 h-4" />
            {t('إشعارات طلبات الدفع (WhatsApp)', 'Rappels WhatsApp')}
            {overdueCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500 text-white font-mono animate-pulse">
                {overdueCount} {t('متأخرة', 'en retard')}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'invoices' ? (
        /* Invoices Tab */
        <>
          {/* Bento Grid Invoices KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card border border-border/80 p-4 rounded-2xl flex items-center justify-between shadow-xs">
              <div>
                <span className="text-xs font-bold text-muted-foreground uppercase">{t('إجمالي الفواتير الصادرة', 'Total Facturé')}</span>
                <div className="text-2xl font-extrabold font-mono text-foreground mt-1">
                  {totalAmountMAD.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">{locale === 'fr' ? 'MAD' : 'د.م.'}</span>
                </div>
                <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                  {invoices.length} {t('فاتورة مسجلة', 'factures enregistrées')}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-card border border-border/80 p-4 rounded-2xl flex items-center justify-between shadow-xs">
              <div>
                <span className="text-xs font-bold text-muted-foreground uppercase">{t('الفواتير المحصلة', 'Factures Encaissées')}</span>
                <div className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                  {paidCount} <span className="text-xs text-muted-foreground font-normal">/ {invoices.length}</span>
                </div>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">{t('تم السداد بالكامل', 'Entièrement payées')}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-card border border-border/80 p-4 rounded-2xl flex items-center justify-between shadow-xs">
              <div>
                <span className="text-xs font-bold text-muted-foreground uppercase">{t('بانتظار التحصيل / متأخر', 'En attente / Retard')}</span>
                <div className="text-2xl font-extrabold font-mono text-rose-600 dark:text-rose-400 mt-1">
                  {unpaidCount} <span className="text-xs text-muted-foreground font-normal">{t('مطالبة', 'créances')}</span>
                </div>
                <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{t('مستحقة للمتابعة', 'À relancer')}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/40 p-2 rounded-2xl border border-border/60">
            <div className="flex flex-wrap gap-1.5 bg-card p-1 rounded-xl border border-border/60 shadow-2xs">
              {[
                { id: 'all', label: t('الكل', 'Tout') },
                { id: 'paid', label: t('مدفوعة', 'Payées') },
                { id: 'partially_paid', label: t('جزئية', 'Partielles') },
                { id: 'unpaid', label: t('غير مدفوعة', 'Impayées') },
                { id: 'overdue', label: t('متأخرة', 'En retard') },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    statusFilter === tab.id
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-1 max-w-lg justify-end">
              <CardViewToggle viewMode={cardLayout} onChange={setCardLayout} />

              <div className="relative flex-1">
                <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4`} />
                <Input
                   placeholder={t('بحث برقم الفاتورة أو الحالة أو العميل...', 'Rechercher par n° de facture, statut ou client...', 'Search by invoice number, status, or client...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`${dir === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3'} h-9 text-xs rounded-xl bg-card border-border/80`}
                />
              </div>
            </div>
          </div>

          {/* Invoices List */}
          {loading ? (
            <div className="text-center py-16 bg-card rounded-2xl border border-border">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
              <p className="text-xs text-muted-foreground">{t('جاري تحميل الفواتير...', 'Chargement des factures...')}</p>
            </div>
          ) : cardLayout === 'grid' ? (
            /* Grid View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredInvoices.map((invoice) => {
                const client = clients.find((c) => c.id === Number(invoice.client_id));
                return (
                  <Card
                    key={invoice.id}
                    className="rounded-2xl border border-border/80 bg-card hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                  >
                    <div>
                      <CardHeader className="p-4 pb-3 border-b border-border/40 bg-muted/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div>
                              <CardTitle className="text-base font-bold font-mono text-foreground">
                                {invoice.invoice_number || `${t('فاتورة', 'Facture')} #${invoice.id}`}
                              </CardTitle>
                              <span className="text-[11px] text-muted-foreground font-semibold">
                                {client?.name || `${t('عميل', 'Client')} #${invoice.client_id}`}
                              </span>
                            </div>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${getStatusColor(invoice)}`}>
                            {getStatusText(invoice)}
                          </span>
                        </div>

                        {invoice.payment_request_ref && (
                          <div className="mt-2 pt-2 border-t border-border/30 flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 font-mono">
                            <Receipt className="w-3.5 h-3.5 text-amber-600" />
                            <span>{t('طلب دفع:', 'Demande :')} {invoice.payment_request_ref}</span>
                          </div>
                        )}
                      </CardHeader>

                      <CardContent className="p-4 space-y-2.5 text-xs">
                        <div className="flex justify-between py-1 border-b border-border/30">
                          <span className="text-muted-foreground">{t('المبلغ الإجمالي:', 'Montant Total :')}</span>
                          <span className="font-mono font-extrabold text-foreground text-sm">
                            {new Decimal(invoice.total_amount || 0).toNumber().toLocaleString()} {invoice.currency || (locale === 'fr' ? 'MAD' : 'د.م.')}
                          </span>
                        </div>
                        {invoice.paid_amount && new Decimal(invoice.paid_amount).greaterThan(0) && (
                          <div className="flex justify-between py-1 border-b border-border/30 text-emerald-600 dark:text-emerald-400">
                            <span>{t('المدفوع:', 'Payé :')}</span>
                            <span className="font-mono font-bold">
                              {new Decimal(invoice.paid_amount).toNumber().toLocaleString()} {invoice.currency || (locale === 'fr' ? 'MAD' : 'د.م.')}
                            </span>
                          </div>
                        )}
                        {invoice.issue_date && (
                          <div className="flex justify-between py-1 border-b border-border/30">
                            <span className="text-muted-foreground">{t('تاريخ الإصدار:', "Date d'émission :")}</span>
                            <span className="font-mono text-foreground">
                               {new Date(invoice.issue_date).toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'fr' ? 'fr-FR' : 'en-US')}
                            </span>
                          </div>
                        )}
                        {invoice.due_date && (
                          <div className="flex justify-between py-1 border-b border-border/30">
                            <span className="text-muted-foreground">{t('تاريخ الاستحقاق:', "Date d'échéance :")}</span>
                            <span className="font-mono text-destructive font-medium">
                               {new Date(invoice.due_date).toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'fr' ? 'fr-FR' : 'en-US')}
                            </span>
                          </div>
                        )}
                        {invoice.route && (
                          <div className="flex justify-between py-1 text-[11px]">
                            <span className="text-muted-foreground">{t('المسار:', 'Trajet :')}</span>
                            <span className="font-medium text-foreground truncate max-w-[170px]">{invoice.route}</span>
                          </div>
                        )}
                      </CardContent>
                    </div>

                    <div className="p-3 border-t border-border/40 bg-muted/10 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={invoice.status}
                          onChange={(e) => handleUpdateStatus(invoice.id, e.target.value)}
                          className="text-xs px-2.5 py-1 border border-border rounded-lg bg-card text-foreground flex-1 font-medium shadow-2xs"
                        >
                          <option value="unpaid">{t('غير مدفوعة', 'Non payée')}</option>
                          <option value="partially_paid">{t('مدفوعة جزئياً', 'Partiellement payée')}</option>
                          <option value="paid">{t('مدفوعة بالكامل', 'Payée')}</option>
                          <option value="overdue">{t('متأخرة', 'En retard')}</option>
                        </select>

                        {/* Payment Request Trigger */}
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 rounded-lg text-amber-600 hover:bg-amber-500/10"
                          title={t('إنشاء / تصدير طلب الدفع', 'Demande de paiement')}
                          onClick={() => {
                            setPaymentRequestInvoice(invoice);
                            setIsPaymentRequestOpen(true);
                          }}
                        >
                          <Receipt className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 rounded-lg"
                          title={t('تعديل الفاتورة', 'Modifier la facture')}
                          onClick={() => {
                            setEditingInvoice(invoice);
                            setIsFormModalOpen(true);
                          }}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-lg"
                          title={t('حذف الفاتورة', 'Supprimer la facture')}
                          onClick={() => handleDeleteInvoice(invoice.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center justify-center gap-1.5 text-xs rounded-xl h-8 bg-card"
                          onClick={() => setActiveInvoice(invoice)}
                        >
                          <Printer className="w-3.5 h-3.5 text-primary" />
                          {t('طباعة الفاتورة', 'Imprimer')}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center justify-center gap-1.5 text-xs rounded-xl h-8 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                          onClick={() => {
                            setPaymentRequestInvoice(invoice);
                            setIsPaymentRequestOpen(true);
                          }}
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          {t('طلب الدفع', 'Demande')}
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}

              {filteredInvoices.length === 0 && (
                <div className="col-span-full text-center py-16 bg-card rounded-2xl border border-border">
                  <p className="text-xs text-muted-foreground">{t('لا توجد فواتير مطابقة لخيارات البحث', 'Aucune facture correspondant aux critères')}</p>
                </div>
              )}
            </div>
          ) : (
            /* List View */
            <div className="flex flex-col gap-3">
              {filteredInvoices.map((invoice) => {
                const client = clients.find((c) => c.id === Number(invoice.client_id));
                const balanceDue = new Decimal(invoice.total_amount || 0).minus(new Decimal(invoice.paid_amount || 0)).toFixed(2);
                return (
                  <Card
                    key={invoice.id}
                    className="rounded-2xl border border-border/80 bg-card hover:shadow-md transition-all overflow-hidden"
                  >
                    <div className="p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                      {/* Right: Invoice # & Client */}
                      <div className="flex items-center gap-3 min-w-[220px]">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-bold font-mono text-foreground">
                            {invoice.invoice_number || `${t('فاتورة', 'Facture')} #${invoice.id}`}
                          </CardTitle>
                          <span className="text-[11px] text-muted-foreground font-semibold">
                            {client?.name || `${t('عميل', 'Client')} #${invoice.client_id}`}
                          </span>
                          {invoice.payment_request_ref && (
                            <span className="block text-[10px] text-amber-600 font-mono mt-0.5">
                              {t('طلب دفع:', 'Demande :')} {invoice.payment_request_ref}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Middle: Amount, Payments, Dates */}
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5">
                          <span className="text-muted-foreground text-[11px]">{t('المبلغ الإجمالي:', 'Montant Total :')}</span>
                          <span className="font-mono font-extrabold text-foreground text-sm">
                            {new Decimal(invoice.total_amount || 0).toNumber().toLocaleString()} {invoice.currency || (locale === 'fr' ? 'MAD' : 'د.م.')}
                          </span>
                        </div>

                        <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-2">
                          <span className="text-muted-foreground text-[11px]">{t('المدفوع:', 'Payé :')}</span>
                          <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                            {new Decimal(invoice.paid_amount || 0).toNumber().toLocaleString()}
                          </span>
                          <span className="text-muted-foreground text-[10px]">|</span>
                          <span className="text-muted-foreground text-[11px]">{t('المتبقي:', 'Reste :')}</span>
                          <span className="font-mono font-bold text-destructive">
                            {new Decimal(balanceDue).toNumber().toLocaleString()}
                          </span>
                        </div>

                        {invoice.issue_date && (
                          <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="font-mono text-foreground text-[11px]">
                               {new Date(invoice.issue_date).toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'fr' ? 'fr-FR' : 'en-US')}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Left: Status & Actions */}
                      <div className="flex items-center justify-between lg:justify-end gap-2 border-t lg:border-t-0 pt-2 lg:pt-0 border-border/40">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${getStatusColor(invoice)}`}>
                          {getStatusText(invoice)}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs rounded-xl h-8 px-2.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                            onClick={() => {
                              setPaymentRequestInvoice(invoice);
                              setIsPaymentRequestOpen(true);
                            }}
                            title={t('إنشاء طلب دفع', 'Demande de paiement')}
                          >
                            <Receipt className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'ml-1' : 'mr-1'}`} />
                            {t('طلب دفع', 'Demande')}
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs rounded-xl h-8 px-2.5"
                            onClick={() => setActiveInvoice(invoice)}
                            title={t('معاينة وطباعة الفاتورة', 'Aperçu et impression', 'Preview & Print Invoice')}
                          >
                            <Printer className={`w-3.5 h-3.5 text-primary ${dir === 'rtl' ? 'ml-1' : 'mr-1'}`} />
                            {t('طباعة', 'Imprimer')}
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs rounded-xl h-8 px-2.5"
                            onClick={() => {
                              setEditingInvoice(invoice);
                              setIsFormModalOpen(true);
                            }}
                            title={t('تعديل الفاتورة', 'Modifier la facture')}
                          >
                            <Edit2 className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'ml-1' : 'mr-1'}`} />
                            {t('تعديل', 'Modifier')}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-destructive hover:bg-destructive/10 rounded-xl h-8 px-2"
                            onClick={() => handleDeleteInvoice(invoice.id)}
                            title={t('حذف الفاتورة', 'Supprimer la facture')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}

              {filteredInvoices.length === 0 && (
                <div className="text-center py-16 bg-card rounded-2xl border border-border">
                  <p className="text-xs text-muted-foreground">{t('لا توجد فواتير مطابقة لخيارات البحث', 'Aucune facture correspondant aux critères')}</p>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* Payment Notifications & Overdue Reminders Tab */
        <div className="space-y-4">
          <div className="bg-card border border-border/80 p-4 sm:p-6 rounded-2xl shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-emerald-600" />
                  {t('إشعارات ومطالبات سداد الفواتير المتأخرة', 'Notifications & Rappels de Paiement')}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {t(
                    'إرسال تذكيرات رسمية بطلبات الدفع للعملاء عبر تطبيق واتساب لتقليص دورة التحصيل النقدي.',
                    'Envoyer des relances officielles par WhatsApp pour accélérer les encaissements.'
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadReminders}
                  disabled={remindersLoading}
                  className="rounded-xl text-xs h-9 gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${remindersLoading ? 'animate-spin' : ''}`} />
                  {t('تحديث', 'Actualiser')}
                </Button>

                <Button
                  size="sm"
                  onClick={handleSendAllReminders}
                  disabled={sendingAllReminders || reminders.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs h-9 gap-1.5 font-semibold"
                >
                  <Send className="w-3.5 h-3.5" />
                  {sendingAllReminders ? t('جاري الإرسال...', 'Envoi en cours...') : t('إرسال تذكيرات جماعية', 'Envoyer rappels groupés')}
                </Button>
              </div>
            </div>

            <div className="mt-4">
              {remindersLoading ? (
                <div className="text-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                  <p className="text-xs text-muted-foreground">{t('جاري استرجاع إشعارات طلبات الدفع...', 'Récupération des rappels...')}</p>
                </div>
              ) : reminders.length === 0 ? (
                <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed border-border">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-foreground">{t('لا توجد فواتير متأخرة حالياً!', 'Aucune facture en retard actuellement !')}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('جميع الفواتير والمطالبات سارية ضمن آجال الاستحقاق المحددة.', 'Toutes les créances sont dans les délais de paiement accordés.')}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {reminders.map(({ invoice, client, daysOverdue, whatsappLink }) => (
                    <div
                      key={invoice.id}
                      className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{client.name}</span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 font-bold border border-rose-500/20">
                            {t('متأخرة بـ', 'En retard de')} {daysOverdue} {t('يوم', 'j')}
                          </span>
                          <span className="text-xs font-mono text-muted-foreground">
                            #{invoice.invoice_number}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t('المبلغ المستحق:', 'Montant dû :')} <span className="font-mono font-bold text-foreground">{invoice.total_amount} {invoice.currency}</span>
                          {client.phone && <span className={`${dir === 'rtl' ? 'mr-3' : 'ml-3'}`}>{t('هاتف:', 'Tél :')} {client.phone}</span>}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPaymentRequestInvoice(invoice);
                            setIsPaymentRequestOpen(true);
                          }}
                          className="h-8 text-xs rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                        >
                          <Receipt className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'ml-1' : 'mr-1'}`} />
                          {t('طلب دفع', 'Demande')}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setFifoClientId(Number(client.id));
                            setIsFIFOPaymentOpen(true);
                          }}
                          className="h-8 text-xs rounded-xl text-emerald-600 border-emerald-500/30"
                        >
                          <ArrowRightLeft className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'ml-1' : 'mr-1'}`} />
                          {t('تسجيل سداد', 'Encaisser')}
                        </Button>

                        <a
                          href={whatsappLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          {t('إرسال واتساب', 'WhatsApp')}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {/* 1. Payment Request Modal */}
      <PaymentRequestModal
        isOpen={isPaymentRequestOpen}
        onClose={() => setIsPaymentRequestOpen(false)}
        clients={clients}
        invoices={invoices}
        bankAccounts={bankAccounts}
        initialInvoice={paymentRequestInvoice}
        onSaved={() => refreshInvoices()}
        onOpenFIFOPayment={(client) => {
          if (client) setFifoClientId(client.id);
          setIsFIFOPaymentOpen(true);
        }}
      />

      {/* 2. Invoice Create / Edit Modal */}
      <InvoiceFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSave={handleSaveInvoice}
        clients={clients}
        trips={trips}
        initialData={editingInvoice}
      />

      {/* 3. FIFO Payment Collection Modal */}
      <FIFOPaymentModal
        isOpen={isFIFOPaymentOpen}
        onClose={() => setIsFIFOPaymentOpen(false)}
        clients={clients}
        bankAccounts={bankAccounts}
        cashBoxes={cashBoxes}
        initialClientId={fifoClientId}
        onPaymentProcessed={() => {
          refreshInvoices();
          loadReminders();
        }}
      />

      {/* 4. Invoice Official Print Modal */}
      {activeInvoice && (
        <InvoicePrintModal
          isOpen={!!activeInvoice}
          onClose={() => setActiveInvoice(null)}
          invoice={activeInvoice}
          client={clients.find((c) => c.id === Number(activeInvoice.client_id))}
        />
      )}
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]" dir="rtl">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <InvoicesPageContent />
    </Suspense>
  );
}
