'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RepairInvoice, Truck, Trailer, Provider, TruckMaintenance } from '@/types/database';
import { MaintenanceAlertsPanel } from '@/features/maintenance/components/MaintenanceAlertsPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Wrench, Trash2, Calendar, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/forex';
import { CardViewToggle, useCardViewMode } from '@/components/ui/card-view-toggle';
import { DEFAULT_TRUCKS, DEFAULT_TRAILERS, DEFAULT_PROVIDERS, fallbackArray } from '@/lib/default-data';

export default function MaintenancePage() {
  const [invoices, setInvoices] = useState<RepairInvoice[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [trailers, setTrailers] = useState<Trailer[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [maintenance, setMaintenance] = useState<TruckMaintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cardLayout, setCardLayout] = useCardViewMode('maintenance', 'grid');
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    workshop_name: '',
    workshop_id: '',
    amount: '',
    currency: 'MAD',
    date: new Date().toISOString().split('T')[0],
    repair_path: 'workshop',
    payment_method: 'cash',
    notes: '',
  });

  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const fetchData = useCallback(async () => {
    try {
      const [invoicesRes, trucksRes, trailersRes, providersRes, maintenanceRes] = await Promise.all([
        supabase.from('repair_invoices').select('*').order('date', { ascending: false }),
        supabase.from('trucks').select('*'),
        supabase.from('trailers').select('*'),
        supabase.from('providers').select('*'),
        supabase.from('truck_maintenance').select('*'),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (trucksRes.error) throw trucksRes.error;
      if (trailersRes.error) throw trailersRes.error;
      if (providersRes.error) throw providersRes.error;

      setInvoices(invoicesRes.data || []);
      setTrucks(fallbackArray(trucksRes.data, DEFAULT_TRUCKS));
      setTrailers(fallbackArray(trailersRes.data, DEFAULT_TRAILERS));
      setProviders(fallbackArray(providersRes.data, DEFAULT_PROVIDERS));
      setMaintenance(maintenanceRes.data || []);
    } catch {
      setTrucks((prev) => fallbackArray(prev, DEFAULT_TRUCKS));
      setTrailers((prev) => fallbackArray(prev, DEFAULT_TRAILERS));
      setProviders((prev) => fallbackArray(prev, DEFAULT_PROVIDERS));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('repair-invoices-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'repair_invoices' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, supabase]);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('repair_invoices').insert({
        workshop_name: formData.workshop_name,
        workshop_id: formData.workshop_id ? parseInt(formData.workshop_id) : undefined,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        date: formData.date,
        repair_path: formData.repair_path,
        payment_method: formData.payment_method,
        notes: formData.notes || null,
      });

      if (error) throw error;
      toast({ title: 'تم تسجيل فاتورة الصيانة بنجاح' });
      setShowModal(false);
      setFormData({
        workshop_name: '',
        workshop_id: '',
        amount: '',
        currency: 'MAD',
        date: new Date().toISOString().split('T')[0],
        repair_path: 'workshop',
        payment_method: 'cash',
        notes: '',
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'خطأ أثناء التسجيل',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا السجل؟')) return;
    try {
      const { error } = await supabase.from('repair_invoices').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'تم الحذف بنجاح' });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const totalMaintenanceMAD = invoices
    .filter((inv) => inv.currency === 'MAD')
    .reduce((sum, inv) => sum + (inv.amount || 0), 0);

  const totalMaintenanceEUR = invoices
    .filter((inv) => inv.currency === 'EUR')
    .reduce((sum, inv) => sum + (inv.amount || 0), 0);

  const filteredInvoices = invoices.filter(
    (inv) =>
      inv.workshop_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.notes?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground">الصيانة والورش وقطع الغيار</h1>
          <p className="text-sm text-muted-foreground mt-0.5">متابعة فواتير الإصلاحات المحلية والدولية ومصروفات الورش</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 ml-2" />
          تسجيل فاتورة صيانة
        </Button>
      </div>

      <MaintenanceAlertsPanel trucks={trucks} maintenance={maintenance} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-r-4 border-r-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-500" />
              إجمالي الصيانة المحلية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {formatCurrency(totalMaintenanceMAD, 'MAD')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">مصاريف الصيانة داخل المغرب</p>
          </CardContent>
        </Card>

        <Card className="border-r-4 border-r-blue-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              إجمالي الصيانة الدولية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
              {formatCurrency(totalMaintenanceEUR, 'EUR')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">إصلاحات وقطع غيار في أوروبا</p>
          </CardContent>
        </Card>

        <Card className="border-r-4 border-r-emerald-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wrench className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              عدد الفواتير المسجلة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{invoices.length} فاتورة</div>
            <p className="text-xs text-muted-foreground mt-1">من {providers.length} ورشة ومزود معتمد</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="بحث بالورشة، البيان، أو الملاحظات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9 h-9 text-xs rounded-xl"
          />
        </div>
        <CardViewToggle viewMode={cardLayout} onChange={setCardLayout} />
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">جاري تحميل سجلات الصيانة...</p>
        </div>
      ) : cardLayout === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInvoices.map((invoice) => (
            <Card key={invoice.id} className="hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-amiri font-bold flex items-center gap-2 text-foreground">
                      <Wrench className="w-4 h-4 text-amber-500" />
                      {invoice.workshop_name || `ورشة #${invoice.workshop_id}`}
                    </CardTitle>
                    <span className="font-mono font-bold text-sm text-primary">
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between items-center text-foreground">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      التاريخ:
                    </span>
                    <span className="font-medium">{invoice.date}</span>
                  </div>
                  <div className="flex justify-between text-foreground">
                    <span className="text-muted-foreground">طريقة الأداء:</span>
                    <span className="font-medium capitalize">{invoice.payment_method}</span>
                  </div>
                  {invoice.notes && (
                    <div className="bg-muted/50 p-2.5 rounded-lg text-xs text-muted-foreground mt-2 border border-border">
                      {invoice.notes}
                    </div>
                  )}
                </CardContent>
              </div>
              <div className="p-4 pt-0 border-t border-border mt-3 flex justify-end">
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-xs"
                  onClick={() => handleDelete(invoice.id)}
                >
                  <Trash2 className="w-3.5 h-3.5 ml-1" />
                  حذف السجل
                </Button>
              </div>
            </Card>
          ))}
          {filteredInvoices.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">لا توجد فواتير صيانة مطابقة للبحث</p>
            </div>
          )}
        </div>
      ) : (
        /* List View Cards */
        <div className="flex flex-col gap-3">
          {filteredInvoices.map((invoice) => (
            <Card key={invoice.id} className="hover:shadow-md transition-shadow overflow-hidden">
              <div className="p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                {/* Right: Workshop & Date */}
                <div className="flex items-center gap-3 min-w-[200px]">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-amiri font-bold text-foreground">
                      {invoice.workshop_name || `ورشة #${invoice.workshop_id}`}
                    </CardTitle>
                    <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      {invoice.date}
                    </span>
                  </div>
                </div>

                {/* Middle: Amount, Payment Method, Notes */}
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5">
                    <span className="text-muted-foreground">المبلغ:</span>
                    <span className="font-mono font-bold text-sm text-primary">
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </span>
                  </div>

                  <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5 text-foreground">
                    <span className="text-muted-foreground">طريقة الأداء:</span>
                    <span className="font-medium capitalize">{invoice.payment_method}</span>
                  </div>

                  {invoice.notes && (
                    <span className="text-xs text-muted-foreground italic max-w-xs truncate" title={invoice.notes}>
                      {invoice.notes}
                    </span>
                  )}
                </div>

                {/* Left: Actions */}
                <div className="flex items-center justify-end border-t lg:border-t-0 pt-2.5 lg:pt-0 border-border/40">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="text-xs rounded-xl h-8 px-3"
                    onClick={() => handleDelete(invoice.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 ml-1" />
                    حذف السجل
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          {filteredInvoices.length === 0 && (
            <div className="text-center py-12 bg-card border border-border/80 rounded-2xl">
              <p className="text-muted-foreground">لا توجد فواتير صيانة مطابقة للبحث</p>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <Card className="w-full max-w-lg shadow-2xl border-border bg-card">
            <CardHeader>
              <CardTitle className="font-amiri text-foreground">تسجيل فاتورة صيانة / ورشة</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateInvoice} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">اسم الورشة أو المزود *</label>
                  <Input
                    value={formData.workshop_name}
                    onChange={(e) => setFormData({ ...formData, workshop_name: e.target.value })}
                    placeholder="مثال: ورشة الأمل للإصلاح / Scania Service"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">المبلغ *</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="0.00"
                      required
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">العملة</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                    >
                      <option value="MAD">MAD (درهم)</option>
                      <option value="EUR">EUR (يورو)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">تاريخ الفاتورة</label>
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">طريقة الدفع</label>
                    <select
                      value={formData.payment_method}
                      onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                      className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                    >
                      <option value="cash">نقداً (Cash)</option>
                      <option value="bank_transfer">تحويل بنكي</option>
                      <option value="check">شيك</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">بيان القطع والخدمات (Détails)</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="مثال: تبديل الفرامل وتغيير الزيت والفلاتر..."
                    rows={3}
                    className="w-full px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors"
                  />
                </div>

                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button type="submit" disabled={isSubmitting} className="flex-1">
                    {isSubmitting ? 'جاري الحفظ...' : 'حفظ الفاتورة'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                    إلغاء
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
