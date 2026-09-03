'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Building, Phone, MapPin, Mail, FileText,
  Truck, Calculator, Receipt, Landmark, RefreshCw
} from 'lucide-react';
import type { Client, Invoice, TripOrder } from '@/types/database';
import { FifoPaymentModal } from './FifoPaymentModal';

export function ClientDetailView({ clientId }: { clientId: number }) {
  const [client, setClient] = useState<Client | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [trips, setTrips] = useState<TripOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFifoModalOpen, setIsFifoModalOpen] = useState(false);

  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const fetchData = async () => {
    try {
      const [clientRes, invoicesRes, tripsRes] = await Promise.all([
        supabase.from('clients').select('*').eq('id', clientId).single(),
        supabase.from('invoices').select('*').eq('client_id', clientId.toString()).order('issue_date', { ascending: false }),
        supabase.from('trip_orders').select('*').or(`client_id.eq.${clientId},client_import_id.eq.${clientId}`).order('departure_date', { ascending: false })
      ]);

      if (clientRes.error) throw clientRes.error;

      setClient(clientRes.data);
      setInvoices(invoicesRes.data || []);
      setTrips(tripsRes.data || []);
    } catch (error: any) {
      toast({ title: 'خطأ في التحميل', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`client-${clientId}-updates`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: `client_id=eq.${clientId}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients', filter: `id=eq.${clientId}` }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [clientId, supabase]);

  const kpis = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaid = 0;

    invoices.forEach(inv => {
      totalInvoiced += parseFloat(inv.ttc_amount || inv.total_amount || '0');
      totalPaid += parseFloat(inv.paid_amount || '0');
    });

    return {
      totalInvoiced,
      totalPaid,
      totalDue: totalInvoiced - totalPaid,
      unpaidCount: invoices.filter(i => i.status === 'unpaid' || i.status === 'overdue' || i.status === 'partially_paid').length
    };
  }, [invoices]);

  const getInvoiceStatus = (status: string) => {
    switch (status) {
      case 'paid': return <Badge className="bg-emerald-500">مدفوعة</Badge>;
      case 'partially_paid': return <Badge className="bg-amber-500">مدفوعة جزئياً</Badge>;
      case 'overdue': return <Badge className="bg-rose-500">متأخرة</Badge>;
      default: return <Badge variant="outline" className="text-slate-500">غير مدفوعة</Badge>;
    }
  };

  if (loading) return <div className="text-center py-20 text-slate-500 flex flex-col items-center"><RefreshCw className="w-8 h-8 animate-spin mb-4" />جاري تحميل الملف المحاسبي...</div>;
  if (!client) return <div className="text-center py-20 text-rose-500">لم يتم العثور على العميل</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir="rtl">

      <Card className="border-border shadow-sm bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
                <Building className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-black font-amiri text-foreground">{client.name}</h1>
                <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Phone className="w-4 h-4"/> <span dir="ltr">{client.phone}</span></span>
                  {client.city && <span className="flex items-center gap-1"><MapPin className="w-4 h-4"/> {client.city}</span>}
                  {client.email && <span className="flex items-center gap-1"><Mail className="w-4 h-4"/> <span dir="ltr">{client.email}</span></span>}
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <Badge variant="outline" className="font-mono text-xs border-slate-300">ICE: {client.ice || 'غير مسجل'}</Badge>
                  <Badge variant="outline" className="font-mono text-xs border-slate-300">TVA: {client.tva_rate || '20'}%</Badge>
                  <Badge variant="secondary" className="text-xs">{client.client_type === 'export' ? 'عميل تصدير (Aller)' : client.client_type === 'import' ? 'عميل استيراد (Retour)' : 'شحن عام'}</Badge>
                </div>
              </div>
            </div>

            <div className="w-full md:w-auto flex flex-col gap-2">
              <Button onClick={() => setIsFifoModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto h-11 px-6 shadow-md">
                <Calculator className="w-4 h-4 ml-2" />
                تحصيل دفعة بنظام FIFO
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-muted-foreground mb-1 flex items-center gap-2"><Receipt className="w-4 h-4 text-blue-500"/> إجمالي الفواتير (TTC)</p>
            <p className="text-2xl font-bold font-mono text-foreground">{kpis.totalInvoiced.toLocaleString(undefined, {minimumFractionDigits: 2})} {client.currency}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-muted-foreground mb-1 flex items-center gap-2"><Landmark className="w-4 h-4 text-emerald-500"/> إجمالي المُحصّل</p>
            <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{kpis.totalPaid.toLocaleString(undefined, {minimumFractionDigits: 2})} {client.currency}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-rose-500">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-muted-foreground mb-1 flex items-center gap-2"><FileText className="w-4 h-4 text-rose-500"/> الديون المعلقة ({kpis.unpaidCount} فاتورة)</p>
            <p className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">{kpis.totalDue.toLocaleString(undefined, {minimumFractionDigits: 2})} {client.currency}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="invoices" className="w-full">
        <TabsList className="grid w-full sm:w-auto grid-cols-2 h-12 rounded-xl mb-4">
          <TabsTrigger value="invoices" className="rounded-lg text-sm">سجل الفواتير</TabsTrigger>
          <TabsTrigger value="trips" className="rounded-lg text-sm">تاريخ الرحلات</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="font-amiri text-lg">سجل الفواتير الصادرة</CardTitle>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">لا توجد فواتير مسجلة لهذا العميل</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="py-3 px-4 font-semibold">الرقم</th>
                        <th className="py-3 px-4 font-semibold">تاريخ الإصدار</th>
                        <th className="py-3 px-4 font-semibold">المبلغ TTC</th>
                        <th className="py-3 px-4 font-semibold">المدفوع</th>
                        <th className="py-3 px-4 font-semibold">المتبقي</th>
                        <th className="py-3 px-4 font-semibold">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {invoices.map(inv => {
                        const ttc = parseFloat(inv.ttc_amount || inv.total_amount || '0');
                        const paid = parseFloat(inv.paid_amount || '0');
                        const due = ttc - paid;

                        return (
                          <tr key={inv.id} className="hover:bg-muted/20">
                            <td className="py-3 px-4 font-mono font-medium" dir="ltr">{inv.invoice_number || `INV-${inv.id}`}</td>
                            <td className="py-3 px-4">{inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('fr-MA') : '-'}</td>
                            <td className="py-3 px-4 font-mono">{ttc.toLocaleString()}</td>
                            <td className="py-3 px-4 font-mono text-emerald-600">{paid.toLocaleString()}</td>
                            <td className="py-3 px-4 font-mono font-bold text-rose-500">{due > 0 ? due.toLocaleString() : '-'}</td>
                            <td className="py-3 px-4">{getInvoiceStatus(inv.status)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trips" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="font-amiri text-lg">الرحلات اللوجستية المرتبطة</CardTitle>
            </CardHeader>
            <CardContent>
              {trips.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">لا توجد رحلات مسجلة لهذا العميل</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {trips.map(trip => {
                    const isExport = trip.client_id === clientId;
                    return (
                      <div key={trip.id} className="p-4 border rounded-xl bg-card hover:border-primary/50 transition-colors space-y-2">
                        <div className="flex justify-between items-start">
                          <Badge variant={isExport ? 'default' : 'secondary'} className="text-[10px]">
                            {isExport ? 'تصدير (ذهاب)' : 'استيراد (عودة)'}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-mono">{trip.departure_date}</span>
                        </div>
                        <h4 className="font-bold text-sm line-clamp-1" title={isExport ? trip.route_export || trip.route : trip.route_import || trip.route}>
                          <Truck className="w-3.5 h-3.5 inline ml-1.5 text-blue-500"/>
                          {isExport ? trip.route_export || trip.route : trip.route_import || trip.route}
                        </h4>
                        <div className="flex justify-between items-center pt-2 mt-2 border-t text-xs">
                          <span className="text-muted-foreground font-mono">CMR: {isExport ? trip.cmr_export_number || trip.cmr_number : trip.cmr_import_number || 'N/A'}</span>
                          <span className="font-bold text-primary font-mono">{isExport ? trip.price_export || trip.price : trip.price_import} MAD</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {isFifoModalOpen && (
        <FifoPaymentModal
          isOpen={isFifoModalOpen}
          onClose={() => setIsFifoModalOpen(false)}
          onSuccess={fetchData}
          client={client}
          totalDue={kpis.totalDue}
        />
      )}
    </div>
  );
}