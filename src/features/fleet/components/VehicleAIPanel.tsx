'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BrainCircuit, Activity, AlertTriangle, CheckCircle, Info, RefreshCw } from 'lucide-react';
import { generateVehicleAIReport, type FleetAIReport } from '../services/fleet-ai.actions';
import { useToast } from '@/hooks/use-toast';

interface VehicleAIPanelProps {
  vehicleId: number;
  vehicleType: 'truck' | 'trailer';
}

export function VehicleAIPanel({ vehicleId, vehicleType }: VehicleAIPanelProps) {
  const [report, setReport] = useState<FleetAIReport | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchAIReport = async () => {
    setLoading(true);
    try {
      const res = await generateVehicleAIReport(vehicleId, vehicleType);
      if (res.success) {
        setReport(res);
      } else {
        toast({ title: 'فشل تحليل الذكاء الاصطناعي', description: res.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAIReport();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId, vehicleType]);

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />;
      case 'critical': return <Activity className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />;
      default: return <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />;
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center border border-dashed border-border/60 rounded-2xl flex flex-col items-center justify-center bg-muted/10">
        <BrainCircuit className="w-10 h-10 text-primary animate-pulse mb-3" />
        <p className="text-sm text-muted-foreground font-medium animate-pulse">محرك الذكاء التنبؤي يحلل سجلات المركبة...</p>
      </div>
    );
  }

  if (!report) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-slate-50 to-indigo-50/30 dark:from-slate-950 dark:to-indigo-950/20 shadow-md" dir="rtl">
      <CardHeader className="pb-2 flex flex-row items-center justify-between border-b border-border/50">
        <CardTitle className="text-primary font-amiri text-lg flex items-center gap-2">
          <BrainCircuit className="w-5 h-5" />
          التشخيص التنبؤي للأسطول (AI Health)
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={fetchAIReport} className="h-8 w-8 rounded-full">
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </Button>
      </CardHeader>
      <CardContent className="pt-4 flex flex-col md:flex-row gap-6">
        
        {/* مؤشر الصحة (Health Score) */}
        <div className="flex flex-col items-center justify-center min-w-[120px]">
          <div className="relative flex items-center justify-center w-24 h-24 rounded-full border-4 border-slate-100 dark:border-slate-800 shadow-inner">
            <svg className="absolute w-full h-full transform -rotate-90">
              <circle cx="44" cy="44" r="44" stroke="currentColor" strokeWidth="8" fill="transparent"
                className="text-slate-200 dark:text-slate-800 translate-x-1 translate-y-1" />
              <circle cx="44" cy="44" r="44" stroke="currentColor" strokeWidth="8" fill="transparent"
                strokeDasharray={`${report.healthScore * 2.76} 276`}
                className={`transition-all duration-1000 ease-out translate-x-1 translate-y-1 ${getHealthColor(report.healthScore)}`} />
            </svg>
            <div className="text-center z-10">
              <span className={`text-2xl font-black font-mono block ${getHealthColor(report.healthScore)}`}>{report.healthScore}%</span>
            </div>
          </div>
          <p className="text-xs font-bold text-muted-foreground mt-2 uppercase tracking-wide">صحة المركبة</p>
        </div>

        {/* التوصيات والرؤى (Insights) */}
        <div className="flex-1 space-y-2.5">
          {report.insights.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد ملاحظات استثنائية مسجلة مؤخراً.</p>
          ) : (
            report.insights.map((insight, idx) => (
              <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white/60 dark:bg-slate-900/60 border border-border/50 text-sm">
                {getInsightIcon(insight.type)}
                <span className="text-foreground leading-relaxed font-medium">{insight.message}</span>
              </div>
            ))
          )}
        </div>
        
      </CardContent>
    </Card>
  );
}

