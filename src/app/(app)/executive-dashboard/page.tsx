'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { LayoutDashboard, RefreshCw, Send, Calendar } from 'lucide-react';
import {
  getExecutiveKpis,
  type ExecutiveKpiSummary,
} from '@/features/analytics/services/executive-metrics.actions';
import { ExecutiveKpiWidgets } from '@/features/analytics/components/ExecutiveKpiWidgets';

export default function ExecutiveDashboardPage() {
  const { toast } = useToast();
  const [data, setData] = useState<ExecutiveKpiSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);

  const now = new Date();
  const [startDate, setStartDate] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getExecutiveKpis(startDate, endDate);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast({ title: 'خطأ', description: res.error, variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleManualDispatch = async () => {
    setDispatching(true);
    try {
      const res = await fetch('/api/reports/scheduled-digest', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        toast({
          title: '✅ تم توليد وأرشفة التقرير الدوري بنجاح',
          description: 'تم تسجيل التقرير في سجلات التدقيق وإرسال إشعار الملخص للإدارة.',
        });
      } else {
        toast({ title: 'خطأ', description: json.error, variant: 'destructive' });
      }
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-primary" />
            اللوحة القيادية التنفيذية (Executive Dashboard)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            المؤشرات المالية الاستراتيجية، تتبع هوامش الربح، والتقارير الشهرية المجدولة
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            onClick={handleManualDispatch}
            disabled={dispatching}
            className="rounded-xl text-xs gap-1.5 h-9 font-bold border-primary/20 hover:bg-primary/5"
          >
            <Send className={`w-3.5 h-3.5 ${dispatching ? 'animate-pulse' : ''}`} />
            <span>توليد وإرسال التقرير الآن</span>
          </Button>

          <Button
            onClick={loadData}
            disabled={loading}
            className="rounded-xl text-xs gap-1.5 h-9 font-bold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث البيانات</span>
          </Button>
        </div>
      </div>

      <Card className="border-border">
        <CardContent className="p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Calendar className="w-4 h-4 text-primary" />
            <span>تحديد النطاق الزمني للتحليل:</span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span>من:</span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 text-xs font-mono rounded-lg w-36"
                dir="ltr"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span>إلى:</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 text-xs font-mono rounded-lg w-36"
                dir="ltr"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="py-20 text-center flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <RefreshCw className="w-7 h-7 animate-spin text-primary" />
          <p className="text-xs">جاري تجميع وتحليل البيانات التنفيذية...</p>
        </div>
      ) : data ? (
        <ExecutiveKpiWidgets data={data} />
      ) : (
        <div className="py-12 text-center text-xs text-muted-foreground">
          تعذر تحميل المؤشرات التنفيذية لهذه الفترة.
        </div>
      )}
    </div>
  );
}
