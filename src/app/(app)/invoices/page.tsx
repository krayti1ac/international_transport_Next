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

function InvoicesPageContent() {
  const searchParams = useSearchParams();
  const actionParam = searchParams.get('action');
  const statusParam = searchParams.get('status');
  const tabParam = searchParams.get('tab');

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [trips, setTrips] = useState<TripOrder[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [cashBoxes, setCashBoxes] = useState<CashBox[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchInvoices = useCallback(async () => {
    try {
      const [invoicesRes, clientsRes, tripsRes, banksRes, cashBoxesRes] = await Promise.all([
        supabase.from('invoices').select('*').order('issue_date', { ascending: false }),
        supabase.from('clients').select('*').order('name'),
        supabase.from('trip_orders').select('*').order('created_at', { ascending: false }),
        supabase.from('bank_accounts').select('*').order('name'),
        supabase.from('cash_boxes').select('*').order('name'),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;

      setInvoices(fallbackArray(invoicesRes.data, DEFAULT_INVOICES));
      setClients(fallbackArray(clientsRes.data, DEFAULT_CLIENTS));
      setTrips(fallbackArray(tripsRes.data, DEFAULT_TRIPS));
      setBankAccounts(fallbackArray(banksRes.data, DEFAULT_BANK_ACCOUNTS));
      setCashBoxes(fallbackArray(cashBoxesRes.data, DEFAULT_CASH_BOXES));
    } catch {
      setInvoices((prev) => fallbackArray(prev, DEFAULT_INVOICES));
      setClients((prev) => fallbackArray(prev, DEFAULT_CLIENTS));
      setTrips((prev) => fallbackArray(prev, DEFAULT_TRIPS));
      setBankAccounts((prev) => fallbackArray(prev, DEFAULT_BANK_ACCOUNTS));
      setCashBoxes((prev) => fallbackArray(prev, DEFAULT_CASH_BOXES));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

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
    fetchInvoices();
    loadReminders();

    const channel = supabase
      .channel('invoices-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        fetchInvoices();
        loadReminders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInvoices, loadReminders, supabase]);

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
        toast({ title: 'تم تعديل الفاتورة بنجاح' });
      } else {
        const { error } = await supabase.from('invoices').insert(invoiceData);
        if (error) throw error;
        toast({ title: 'تم إنشاء الفاتورة بنجاح' });
      }
      fetchInvoices();
    } catch (error: any) {
      toast({
        title: 'خطأ أثناء الحفظ',
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
      toast({ title: `تم تغيير حالة الفاتورة إلى "${getStatusText(status)}"` });
      fetchInvoices();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteInvoice = async (id: number) => {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذه الفاتورة؟')) return;

    try {
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'تم حذف الفاتورة بنجاح' });
      fetchInvoices();
    } catch (error: any) {
      toast({
        title: 'خطأ أثناء الحذف',
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
          title: '✅ تم إرسال التذكيرات بنجاح',
          description: `تم توجيه ${res.sentCount} إشعار سداد للعملاء عبر WhatsApp.`,
        });
        loadReminders();
      } else {
        toast({
          title: 'خطأ أثناء إرسال التذكيرات',
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
      return 'متأخرة عن الدفع';
    }
    switch (status) {
      case 'paid':
        return 'مدفوعة بالكامل';
      case 'partially_paid':
        return 'مدفوعة جزئياً';
      case 'unpaid':
        return 'غير مدفوعة';
      case 'overdue':
        return 'متأخرة';
      default:
        return status || 'غير محدد';
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
  const totalAmountMAD = invoices.reduce(
    (acc, inv) => (inv.currency !== 'EUR' ? acc + parseFloat(String(inv.total_amount || 0)) : acc),
    0
  );
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
    <div className="space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>الإدارة المالية والمحاسبة</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold font-amiri tracking-tight text-foreground">
            الفواتير وطلبات الدفع الدولية
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            إصدار الفواتير الرسمية، إنشاء طلبات السداد (Demandes de Paiement)، ومتابعة التحصيلات بنظام FIFO.
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
            إنشاء طلب الدفع
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
            تحصيل دفعة (FIFO)
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
            إنشاء فاتورة جديدة
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
            سجل الفواتير
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
            إشعارات طلبات الدفع (WhatsApp)
            {overdueCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500 text-white font-mono animate-pulse">
                {overdueCount} متأخرة
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
                <span className="text-xs font-bold text-muted-foreground uppercase">إجمالي الفواتير الصادرة</span>
                <div className="text-2xl font-extrabold font-mono text-foreground mt-1">
                  {totalAmountMAD.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">د.م.</span>
                </div>
                <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                  {invoices.length} فاتورة مسجلة
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-card border border-border/80 p-4 rounded-2xl flex items-center justify-between shadow-xs">
              <div>
                <span className="text-xs font-bold text-muted-foreground uppercase">الفواتير المحصلة</span>
                <div className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                  {paidCount} <span className="text-xs text-muted-foreground font-normal">/ {invoices.length}</span>
                </div>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">تم السداد بالكامل</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-card border border-border/80 p-4 rounded-2xl flex items-center justify-between shadow-xs">
              <div>
                <span className="text-xs font-bold text-muted-foreground uppercase">بانتظار التحصيل / متأخر</span>
                <div className="text-2xl font-extrabold font-mono text-rose-600 dark:text-rose-400 mt-1">
                  {unpaidCount} <span className="text-xs text-muted-foreground font-normal">مطالبة</span>
                </div>
                <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">مستحقة للمتابعة</span>
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
                { id: 'all', label: 'الكل' },
                { id: 'paid', label: 'مدفوعة' },
                { id: 'partially_paid', label: 'جزئية' },
                { id: 'unpaid', label: 'غير مدفوعة' },
                { id: 'overdue', label: 'متأخرة' },
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
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="بحث برقم الفاتورة أو المرجع أو العميل..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-9 h-9 text-xs rounded-xl bg-card border-border/80"
                />
              </div>
            </div>
          </div>

          {/* Invoices List */}
          {loading ? (
            <div className="text-center py-16 bg-card rounded-2xl border border-border">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
              <p className="text-xs text-muted-foreground">جاري تحميل الفواتير...</p>
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
                                {invoice.invoice_number || `فاتورة #${invoice.id}`}
                              </CardTitle>
                              <span className="text-[11px] text-muted-foreground font-semibold">
                                {client?.name || `عميل #${invoice.client_id}`}
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
                            <span>طلب دفع: {invoice.payment_request_ref}</span>
                          </div>
                        )}
                      </CardHeader>

                      <CardContent className="p-4 space-y-2.5 text-xs">
                        <div className="flex justify-between py-1 border-b border-border/30">
                          <span className="text-muted-foreground">المبلغ الإجمالي:</span>
                          <span className="font-mono font-extrabold text-foreground text-sm">
                            {parseFloat(String(invoice.total_amount || 0)).toLocaleString()} {invoice.currency || 'د.م.'}
                          </span>
                        </div>
                        {invoice.paid_amount && parseFloat(String(invoice.paid_amount)) > 0 && (
                          <div className="flex justify-between py-1 border-b border-border/30 text-emerald-600 dark:text-emerald-400">
                            <span>المدفوع:</span>
                            <span className="font-mono font-bold">
                              {parseFloat(String(invoice.paid_amount)).toLocaleString()} {invoice.currency || 'د.م.'}
                            </span>
                          </div>
                        )}
                        {invoice.issue_date && (
                          <div className="flex justify-between py-1 border-b border-border/30">
                            <span className="text-muted-foreground">تاريخ الإصدار:</span>
                            <span className="font-mono text-foreground">
                              {new Date(invoice.issue_date).toLocaleDateString('ar-MA')}
                            </span>
                          </div>
                        )}
                        {invoice.due_date && (
                          <div className="flex justify-between py-1 border-b border-border/30">
                            <span className="text-muted-foreground">تاريخ الاستحقاق:</span>
                            <span className="font-mono text-destructive font-medium">
                              {new Date(invoice.due_date).toLocaleDateString('ar-MA')}
                            </span>
                          </div>
                        )}
                        {invoice.route && (
                          <div className="flex justify-between py-1 text-[11px]">
                            <span className="text-muted-foreground">المسار:</span>
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
                          <option value="unpaid">غير مدفوعة</option>
                          <option value="partially_paid">مدفوعة جزئياً</option>
                          <option value="paid">مدفوعة بالكامل</option>
                          <option value="overdue">متأخرة</option>
                        </select>

                        {/* Payment Request Trigger */}
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 rounded-lg text-amber-600 hover:bg-amber-500/10"
                          title="إنشاء / تصدير طلب الدفع"
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
                          title="تعديل الفاتورة"
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
                          title="حذف الفاتورة"
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
                          طباعة الفاتورة
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
                          طلب الدفع
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}

              {filteredInvoices.length === 0 && (
                <div className="col-span-full text-center py-16 bg-card rounded-2xl border border-border">
                  <p className="text-xs text-muted-foreground">لا توجد فواتير مطابقة لخيارات البحث</p>
                </div>
              )}
            </div>
          ) : (
            /* List View */
            <div className="flex flex-col gap-3">
              {filteredInvoices.map((invoice) => {
                const client = clients.find((c) => c.id === Number(invoice.client_id));
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
                            {invoice.invoice_number || `فاتورة #${invoice.id}`}
                          </CardTitle>
                          <span className="text-[11px] text-muted-foreground font-semibold">
                            {client?.name || `عميل #${invoice.client_id}`}
                          </span>
                          {invoice.payment_request_ref && (
                            <span className="block text-[10px] text-amber-600 font-mono mt-0.5">
                              طلب دفع: {invoice.payment_request_ref}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Middle: Amount, Payments, Dates */}
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5">
                          <span className="text-muted-foreground text-[11px]">المبلغ الإجمالي:</span>
                          <span className="font-mono font-extrabold text-foreground text-sm">
                            {parseFloat(String(invoice.total_amount || 0)).toLocaleString()} {invoice.currency || 'د.م.'}
                          </span>
                        </div>

                        <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-2">
                          <span className="text-muted-foreground text-[11px]">المدفوع:</span>
                          <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                            {parseFloat(String(invoice.paid_amount || 0)).toLocaleString()}
                          </span>
                          <span className="text-muted-foreground text-[10px]">|</span>
                          <span className="text-muted-foreground text-[11px]">المتبقي:</span>
                          <span className="font-mono font-bold text-destructive">
                            {(
                              parseFloat(String(invoice.total_amount || 0)) -
                              parseFloat(String(invoice.paid_amount || 0))
                            ).toLocaleString()}
                          </span>
                        </div>

                        {invoice.issue_date && (
                          <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="font-mono text-foreground text-[11px]">
                              {new Date(invoice.issue_date).toLocaleDateString('ar-MA')}
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
                            title="إنشاء طلب دفع"
                          >
                            <Receipt className="w-3.5 h-3.5 ml-1" />
                            طلب دفع
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs rounded-xl h-8 px-2.5"
                            onClick={() => setActiveInvoice(invoice)}
                            title="معاينة وطباعة الفاتورة"
                          >
                            <Printer className="w-3.5 h-3.5 text-primary ml-1" />
                            طباعة
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs rounded-xl h-8 px-2.5"
                            onClick={() => {
                              setEditingInvoice(invoice);
                              setIsFormModalOpen(true);
                            }}
                            title="تعديل الفاتورة"
                          >
                            <Edit2 className="w-3.5 h-3.5 ml-1" />
                            تعديل
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-destructive hover:bg-destructive/10 rounded-xl h-8 px-2"
                            onClick={() => handleDeleteInvoice(invoice.id)}
                            title="حذف الفاتورة"
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
                  <p className="text-xs text-muted-foreground">لا توجد فواتير مطابقة لخيارات البحث</p>
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
                  إشعارات ومطالبات سداد الفواتير المتأخرة
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  إرسال تذكيرات رسمية بطلبات الدفع للعملاء عبر تطبيق واتساب لتقليص دورة التحصيل النقدي.
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
                  تحديث
                </Button>

                <Button
                  size="sm"
                  onClick={handleSendAllReminders}
                  disabled={sendingAllReminders || reminders.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs h-9 gap-1.5 font-semibold"
                >
                  <Send className="w-3.5 h-3.5" />
                  {sendingAllReminders ? 'جاري الإرسال...' : 'إرسال تذكيرات جماعية'}
                </Button>
              </div>
            </div>

            <div className="mt-4">
              {remindersLoading ? (
                <div className="text-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                  <p className="text-xs text-muted-foreground">جاري استرجاع إشعارات طلبات الدفع...</p>
                </div>
              ) : reminders.length === 0 ? (
                <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed border-border">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-foreground">لا توجد فواتير متأخرة حالياً!</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    جميع الفواتير والمطالبات سارية ضمن آجال الاستحقاق المحددة.
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
                            متأخرة بـ {daysOverdue} يوم
                          </span>
                          <span className="text-xs font-mono text-muted-foreground">
                            #{invoice.invoice_number}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          المبلغ المستحق: <span className="font-mono font-bold text-foreground">{invoice.total_amount} {invoice.currency}</span>
                          {client.phone && <span className="mr-3">هاتف: {client.phone}</span>}
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
                          <Receipt className="w-3.5 h-3.5 ml-1" />
                          طلب دفع
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
                          <ArrowRightLeft className="w-3.5 h-3.5 ml-1" />
                          تسجيل سداد
                        </Button>

                        <a
                          href={whatsappLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          إرسال واتساب
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
        onSaved={() => fetchInvoices()}
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
          fetchInvoices();
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
