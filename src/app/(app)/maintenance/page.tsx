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
import { useLanguage } from '@/components/language-provider';
import Decimal from 'decimal.js';

export default function MaintenancePage() {
  const { t, dir, locale } = useLanguage();
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
      const parsedAmount = new Decimal(formData.amount || '0').toNumber();
      const { error } = await supabase.from('repair_invoices').insert({
        workshop_name: formData.workshop_name,
        workshop_id: formData.workshop_id ? parseInt(formData.workshop_id) : undefined,
        amount: parsedAmount,
        currency: formData.currency,
        date: formData.date,
        repair_path: formData.repair_path,
        payment_method: formData.payment_method,
        notes: formData.notes || null,
      });

      if (error) throw error;
       toast({ title: t('تم تسجيل فاتورة الصيانة بنجاح', 'Facture de maintenance enregistrée avec succès', 'Maintenance invoice recorded successfully') });
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
        title: t('خطأ أثناء التسجيل', 'Erreur lors de l\'enregistrement', 'Error while recording'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('هل أنت متأكد من حذف هذا السجل؟', 'Êtes-vous sûr de vouloir supprimer cet enregistrement ?', 'Are you sure you want to delete this record?'))) return;
    try {
      const { error } = await supabase.from('repair_invoices').delete().eq('id', id);
      if (error) throw error;
      toast({ title: t('تم الحذف بنجاح', 'Supprimé avec succès', 'Deleted successfully') });
      fetchData();
    } catch (error: any) {
      toast({
        title: t('خطأ', 'Erreur', 'Error'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const totalMaintenanceMAD = invoices
    .filter((inv) => inv.currency === 'MAD')
    .reduce((sum, inv) => sum.plus(new Decimal(inv.amount || 0)), new Decimal(0))
    .toNumber();

  const totalMaintenanceEUR = invoices
    .filter((inv) => inv.currency === 'EUR')
    .reduce((sum, inv) => sum.plus(new Decimal(inv.amount || 0)), new Decimal(0))
    .toNumber();

  const filteredInvoices = invoices.filter(
    (inv) =>
      inv.workshop_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.notes?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground">
             {t('الصيانة والورش وقطع الغيار', 'Maintenance, Ateliers et Pièces de Rechange', 'Maintenance, Workshops & Spare Parts')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
             {t('متابعة فواتير الإصلاحات المحلية والدولية ومصروفات الورش', 'Suivi des factures de réparations nationales & internationales et frais d\'ateliers', 'Track local & international repair invoices and workshop expenses')}
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className={`w-4 h-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
           {t('تسجيل فاتورة صيانة', 'Enregistrer facture de maintenance', 'Record maintenance invoice')}
        </Button>
      </div>

      <MaintenanceAlertsPanel trucks={trucks} maintenance={maintenance} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-r-4 border-r-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-500" />
               {t('إجمالي الصيانة المحلية', 'Total Maintenance Nationale', 'Total Local Maintenance')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {formatCurrency(totalMaintenanceMAD, 'MAD')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
               {t('مصاريف الصيانة داخل المغرب', 'Dépenses d\'entretien au Maroc', 'Maintenance expenses in Morocco')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-r-4 border-r-blue-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
               {t('إجمالي الصيانة الدولية', 'Total Maintenance Internationale', 'Total International Maintenance')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
              {formatCurrency(totalMaintenanceEUR, 'EUR')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
               {t('إصلاحات وقطع غيار في أوروبا', 'Réparations et pièces détachées en Europe', 'Repairs and spare parts in Europe')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-r-4 border-r-emerald-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wrench className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
               {t('عدد الفواتير المسجلة', 'Nombre de Factures', 'Registered Invoices Count')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
               {invoices.length} {t('فاتورة', 'facture(s)', 'invoice(s)')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
               {t('من', 'auprès de', 'from')} {providers.length} {t('ورشة ومزود معتمد', 'ateliers & prestataires', 'workshops & approved providers')}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1">
          <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4`} />
          <Input
             placeholder={t('بحث بالورشة، البيان، أو الملاحظات...', 'Rechercher par atelier, désignation, notes...', 'Search by workshop, description, or notes...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`${dir === 'rtl' ? 'pr-9' : 'pl-9'} h-9 text-xs rounded-xl`}
          />
        </div>
        <CardViewToggle viewMode={cardLayout} onChange={setCardLayout} />
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t('جاري تحميل سجلات الصيانة...', 'Chargement des factures de maintenance...', 'Loading maintenance records...')}</p>
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
                       {invoice.workshop_name || `${t('ورشة', 'Atelier', 'Workshop')} #${invoice.workshop_id}`}
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
                       {t('التاريخ:', 'Date :', 'Date:')}
                    </span>
                    <span className="font-medium">{invoice.date}</span>
                  </div>
                  <div className="flex justify-between text-foreground">
                     <span className="text-muted-foreground">{t('طريقة الأداء:', 'Mode de paiement :', 'Payment method:')}</span>
                    <span className="font-medium capitalize">
                       {invoice.payment_method === 'cash' ? t('نقداً', 'Espèces', 'Cash') :
                        invoice.payment_method === 'bank_transfer' ? t('تحويل بنكي', 'Virement', 'Bank Transfer') :
                        invoice.payment_method === 'check' ? t('شيك', 'Chèque', 'Cheque') : invoice.payment_method}
                    </span>
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
                  <Trash2 className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'ml-1' : 'mr-1'}`} />
                  {t('حذف السجل', 'Supprimer')}
                </Button>
              </div>
            </Card>
          ))}
          {filteredInvoices.length === 0 && (
            <div className="col-span-full text-center py-12">
               <p className="text-muted-foreground">{t('لا توجد فواتير صيانة مطابقة للبحث', 'Aucune facture ne correspond à la recherche', 'No maintenance invoices match your search')}</p>
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
                       {invoice.workshop_name || `${t('ورشة', 'Atelier', 'Workshop')} #${invoice.workshop_id}`}
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
                    <span className="text-muted-foreground">{t('المبلغ:', 'Montant :')}</span>
                    <span className="font-mono font-bold text-sm text-primary">
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </span>
                  </div>

                  <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5 text-foreground">
                    <span className="text-muted-foreground">{t('طريقة الأداء:', 'Paiement :')}</span>
                    <span className="font-medium capitalize">
                       {invoice.payment_method === 'cash' ? t('نقداً', 'Espèces', 'Cash') :
                        invoice.payment_method === 'bank_transfer' ? t('تحويل بنكي', 'Virement', 'Bank Transfer') :
                        invoice.payment_method === 'check' ? t('شيك', 'Chèque', 'Cheque') : invoice.payment_method}
                    </span>
                  </div>

                  {invoice.notes && (
                    <span className="text-xs text-muted-foreground italic max-w-xs truncate" title={invoice.notes}>
                      {invoice.notes}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end border-t lg:border-t-0 pt-2.5 lg:pt-0 border-border/40">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="text-xs rounded-xl h-8 px-3"
                    onClick={() => handleDelete(invoice.id)}
                  >
                    <Trash2 className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'ml-1' : 'mr-1'}`} />
                    {t('حذف السجل', 'Supprimer', 'Delete')}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          {filteredInvoices.length === 0 && (
            <div className="text-center py-12 bg-card border border-border/80 rounded-2xl">
               <p className="text-muted-foreground">{t('لا توجد فواتير صيانة مطابقة للبحث', 'Aucune facture ne correspond à la recherche', 'No maintenance invoices match your search')}</p>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4" dir={dir}>
          <Card className="w-full max-w-lg shadow-2xl border-border bg-card">
            <CardHeader>
              <CardTitle className="font-amiri text-foreground">
                 {t('تسجيل فاتورة صيانة / ورشة', 'Enregistrer une facture de maintenance', 'Record maintenance/workshop invoice')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateInvoice} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                     {t('اسم الورشة أو المزود *', 'Nom de l\'atelier ou prestataire *', 'Workshop or provider name *')}
                  </label>
                  <Input
                    value={formData.workshop_name}
                    onChange={(e) => setFormData({ ...formData, workshop_name: e.target.value })}
                     placeholder={t('مثال: ورشة الأمل للإصلاح / Scania Service', 'Ex: Garage Al Amal / Scania Service', 'Example: Repair workshop / Service center')}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                     <label className="text-sm font-medium text-foreground">{t('المبلغ *', 'Montant *', 'Amount *')}</label>
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
                     <label className="text-sm font-medium text-foreground">{t('العملة', 'Devise', 'Currency')}</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                    >
                      <option value="MAD">MAD (درهم)</option>
                      <option value="EUR">EUR (Euro)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                     <label className="text-sm font-medium text-foreground">{t('تاريخ الفاتورة', 'Date de la facture', 'Invoice date')}</label>
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1.5">
                     <label className="text-sm font-medium text-foreground">{t('طريقة الدفع', 'Mode de paiement', 'Payment method')}</label>
                    <select
                      value={formData.payment_method}
                      onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                      className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                    >
                       <option value="cash">{t('نقداً (Cash)', 'Espèces (Cash)', 'Cash')}</option>
                       <option value="bank_transfer">{t('تحويل بنكي', 'Virement bancaire', 'Bank Transfer')}</option>
                       <option value="check">{t('شيك', 'Chèque', 'Cheque')}</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                   <label className="text-sm font-medium text-foreground">{t('بيان القطع والخدمات (Détails)', 'Détails des pièces et prestations', 'Parts and services details')}</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                     placeholder={t('مثال: تبديل الفرامل وتغيير الزيت والفلاتر...', 'Ex: Remplacement plaquettes de frein, vidange et filtres...', 'Example: Brake pads replacement, oil change and filters...')}
                    rows={3}
                    className="w-full px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors"
                  />
                </div>

                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button type="submit" disabled={isSubmitting} className="flex-1">
                     {isSubmitting ? t('جاري الحفظ...', 'Enregistrement...', 'Saving...') : t('حفظ الفاتورة', 'Enregistrer', 'Save Invoice')}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
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
