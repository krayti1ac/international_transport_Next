'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
  Fuel,
  Wrench,
  Activity,
} from 'lucide-react';
import { generateVehicleAIReport, type FleetAIReport } from '../services/fleet-ai.actions';
import { formatCurrency } from '@/lib/forex';

interface VehicleAIPanelProps {
  vehicleId: number;
  vehicleType?: 'truck' | 'trailer';
}

export function VehicleAIPanel({ vehicleId, vehicleType = 'truck' }: VehicleAIPanelProps) {
  const [report, setReport] = useState<FleetAIReport | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await generateVehicleAIReport(vehicleId, vehicleType);
      if (res.success) {
        setReport(res);
      }
    } finally {
      setLoading(false);
    }
  }, [vehicleId, vehicleType]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500 border-emerald-500';
    if (score >= 60) return 'text-amber-500 border-amber-500';
    return 'text-rose-500 border-rose-500';
  };

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case 'critical':
        return 'bg-rose-500/15 text-rose-600 border-rose-500/30';
      case 'warning':
        return 'bg-amber-500/15 text-amber-600 border-amber-500/30';
      case 'info':
        return 'bg-blue-500/15 text-blue-600 border-blue-500/30';
      default:
        return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30';
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />;
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5 shadow-xs overflow-hidden" dir="rtl">
      <CardHeader className="py-3 px-4 border-b border-border/60 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-amiri font-bold flex items-center gap-2 text-foreground">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>التشخيص التنبؤي وصحة المركبة (Predictive Health AI)</span>
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchReport}
          disabled={loading}
          className="h-7 w-7 p-0 rounded-lg"
          title="تحديث التحليل"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs">جاري فحص البيانات التاريخية والتشخيص التنبؤي...</p>
          </div>
        ) : !report ? (
          <p className="text-xs text-center text-muted-foreground py-4">لا تتوفر بيانات تشخيصية كافية لهذه المركبة.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-card border border-border flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-full border-4 flex items-center justify-center font-bold font-mono text-base shrink-0 ${getScoreColor(
                    report.healthScore
                  )}`}
                >
                  {report.healthScore}%
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">مؤشر الجاهزية والسلامة</p>
                  <p className="text-xs font-bold text-foreground mt-0.5">
                    {report.healthScore >= 80 ? 'حالة ممتازة' : report.healthScore >= 60 ? 'تحتاج مراقبة' : 'فحص عاجل مطلوب'}
                  </p>
                </div>
              </div>

              {vehicleType === 'truck' && (
                <div className="p-3 rounded-xl bg-card border border-border flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                    <Fuel className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">معدل الاستهلاك التقديري</p>
                    <p className="text-xs font-bold font-mono text-foreground mt-0.5">
                      {report.averageLitersPer100Km ? `${report.averageLitersPer100Km} L/100 km` : 'قيد التجميع'}
                    </p>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-card border border-border flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">صيانة آخر 6 أشهر</p>
                  <p className="text-xs font-bold font-mono text-foreground mt-0.5">
                    {formatCurrency(report.recentMaintenanceCost, 'MAD')}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-primary" />
                <span>رؤى وتوصيات الصيانة الوقائية:</span>
              </p>

              {report.insights.length === 0 ? (
                <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg text-center">
                  جميع المؤشرات الحيوية مستقرة وضمن الحدود المعتمدة.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {report.insights.map((insight, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border flex items-start gap-2.5 text-xs ${getBadgeVariant(
                        insight.type
                      )}`}
                    >
                      {getInsightIcon(insight.type)}
                      <span className="leading-relaxed">{insight.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
