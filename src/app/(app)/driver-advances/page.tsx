'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Advance, Driver } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, Calendar } from 'lucide-react';
import { CardViewToggle, useCardViewMode } from '@/components/ui/card-view-toggle';

export default function DriverAdvancesPage() {
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardLayout, setCardLayout] = useCardViewMode('driver_advances', 'grid');
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const fetchAdvances = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        const { data: driverData, error: driverError } = await supabase
          .from('drivers')
          .select('*')
          .eq('user_id', session.user.id)
          .single<Driver>();

        if (driverError || !driverData) {
          toast({
            title: 'خطأ',
            description: 'لم يتم العثور على ملف السائق المرتبط بهذا الحساب',
            variant: 'destructive',
          });
          return;
        }

        const { data, error } = await supabase
          .from('advances')
          .select('*')
          .eq('driver_id', driverData.id)
          .order('date', { ascending: false });

        if (error) throw error;
        setAdvances(data || []);
      } catch (error: any) {
        const message = error?.message || (error instanceof Error ? error.message : 'حدث خطأ غير متوقع');
        toast({
          title: 'خطأ',
          description: message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAdvances();
  }, [supabase, toast]);

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return 'معتمد';
      case 'pending': return 'قيد الانتظار';
      case 'rejected': return 'مرفوض';
      case 'settled': return 'مسدد';
      default: return status;
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground">سلف ومصروفات السائق</h1>
          <p className="text-sm text-muted-foreground mt-0.5">متابعة طلبات السلف الشخصية، حالة الاعتماد والمبالغ المصروفة</p>
        </div>
        <CardViewToggle viewMode={cardLayout} onChange={setCardLayout} />
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">جاري تحميل السلف...</p>
        </div>
      ) : cardLayout === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {advances.map((advance) => (
            <Card key={advance.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-amiri flex items-center gap-2 text-foreground">
                    <DollarSign className="w-5 h-5 text-primary" />
                    سلفة #{advance.id}
                  </CardTitle>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    advance.status === 'approved'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
                      : advance.status === 'pending'
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25'
                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/25'
                  }`}>
                    {getStatusText(advance.status)}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المبلغ:</span>
                    <span className="font-bold text-primary font-mono">{advance.amount} {advance.currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">التاريخ:</span>
                    <span className="font-medium text-foreground flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      {advance.date}
                    </span>
                  </div>
                  {advance.reason && (
                    <div className="flex justify-between border-t border-border pt-2">
                      <span className="text-muted-foreground">السبب:</span>
                      <span className="font-medium text-foreground">{advance.reason}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {advances.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">لا توجد سلف مسجلة</p>
            </div>
          )}
        </div>
      ) : (
        /* List View Cards */
        <div className="flex flex-col gap-3">
          {advances.map((advance) => (
            <Card key={advance.id} className="hover:shadow-md transition-shadow overflow-hidden">
              <div className="p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                <div className="flex items-center gap-3 min-w-[180px]">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-amiri text-foreground">
                      سلفة #{advance.id}
                    </CardTitle>
                    <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      {advance.date}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5">
                    <span className="text-muted-foreground">المبلغ:</span>
                    <span className="font-bold text-primary font-mono text-sm">{advance.amount} {advance.currency}</span>
                  </div>

                  {advance.reason && (
                    <div className="bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-1.5">
                      <span className="text-muted-foreground">السبب:</span>
                      <span className="font-medium text-foreground">{advance.reason}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end border-t lg:border-t-0 pt-2.5 lg:pt-0 border-border/40">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    advance.status === 'approved'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
                      : advance.status === 'pending'
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25'
                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/25'
                  }`}>
                    {getStatusText(advance.status)}
                  </span>
                </div>
              </div>
            </Card>
          ))}
          {advances.length === 0 && (
            <div className="text-center py-12 bg-card border border-border/80 rounded-2xl">
              <p className="text-muted-foreground">لا توجد سلف مسجلة</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
