'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Navigation, Fuel, AlertCircle, Coins, RefreshCw } from 'lucide-react';
import { analyzeRouteProfitability, type RouteEstimation } from '../services/route-optimizer.actions';

export function SmartRouteAnalyzer() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [includeFerry, setIncludeFerry] = useState(true);
  const [loading, setLoading] = useState(false);
  const [estimation, setEstimation] = useState<RouteEstimation | null>(null);

  const { toast } = useToast();

  const handleAnalyze = async () => {
    if (!origin.trim() || !destination.trim()) {
      toast({ title: 'يرجى إدخال نقطة الانطلاق والوجهة', variant: 'destructive' });
      return;
    }
    
    setLoading(true);
    try {
      const result = await analyzeRouteProfitability(origin.trim(), destination.trim(), includeFerry);
      if (result.success) {
        setEstimation(result);
        toast({ title: 'تم اكتمال التحليل الجغرافي والمالي' });
      } else {
        toast({ title: 'فشل التحليل', description: result.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20 shadow-md bg-gradient-to-br from-slate-50 to-blue-50/20 dark:from-slate-950 dark:to-blue-950/20" dir="rtl">
      <CardHeader className="pb-3 border-b border-border/50">
        <CardTitle className="flex items-center gap-2 text-primary font-amiri text-lg">
          <Sparkles className="w-5 h-5 text-amber-500" />
          المستشار اللوجستي (AI Route Optimizer)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">مدينة الانطلاق</label>
            <Input 
              placeholder="مثال: طنجة أو Tanger" 
              value={origin} 
              onChange={e => setOrigin(e.target.value)} 
              onKeyDown={e => { if (e.key === 'Enter') handleAnalyze(); }}
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">الوجهة (المدينة)</label>
            <Input 
              placeholder="مثال: باريس أو Paris" 
              value={destination} 
              onChange={e => setDestination(e.target.value)} 
              onKeyDown={e => { if (e.key === 'Enter') handleAnalyze(); }}
            />
          </div>
          <Button onClick={handleAnalyze} disabled={loading} className="w-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'تحليل وتوقع السعر'}
          </Button>
        </div>

        <div className="flex items-center gap-2 pt-1 pb-2">
          <input 
            type="checkbox" 
            id="ferry" 
            checked={includeFerry} 
            onChange={e => setIncludeFerry(e.target.checked)} 
            className="w-4 h-4 rounded border-gray-300 accent-primary cursor-pointer" 
          />
          <label htmlFor="ferry" className="text-sm text-muted-foreground cursor-pointer select-none">
            تضمين رسوم العبّارة البحرية (Ferry Transit)
          </label>
        </div>

        {estimation && estimation.success && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in zoom-in-95 mt-4">
            
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-border flex items-start gap-3 shadow-sm">
              <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg shrink-0"><Navigation className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-muted-foreground">مسافة الرحلة الكلية</p>
                <p className="font-bold font-mono mt-0.5 text-foreground">{estimation.distanceKm?.toLocaleString()} km</p>
                <p className="text-[10px] text-muted-foreground mt-1">وقت القيادة: {estimation.durationHours} ساعة</p>
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-border flex items-start gap-3 shadow-sm">
              <div className="p-2 bg-rose-500/10 text-rose-600 rounded-lg shrink-0"><Fuel className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-muted-foreground">استهلاك الوقود التقديري</p>
                <p className="font-bold font-mono mt-0.5 text-foreground">{estimation.estimatedFuelCost?.toLocaleString()} MAD</p>
                <p className="text-[10px] text-muted-foreground mt-1">رسوم الطرق: {estimation.estimatedTollCost?.toLocaleString()} MAD</p>
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-border flex items-start gap-3 shadow-sm border-r-4 border-r-amber-500">
              <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg shrink-0"><AlertCircle className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-amber-600 font-bold">الحد الأدنى للربحية</p>
                <p className="font-bold font-mono mt-0.5 text-foreground text-lg">{estimation.minProfitablePrice?.toLocaleString()} MAD</p>
                <p className="text-[10px] text-muted-foreground mt-1">يغطي التكاليف الأساسية بصعوبة</p>
              </div>
            </div>

            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900 flex items-start gap-3 shadow-sm border-r-4 border-r-emerald-500">
              <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg shrink-0"><Coins className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">السعر المثالي المقترح</p>
                <p className="font-black font-mono mt-0.5 text-emerald-600 dark:text-emerald-400 text-xl">{estimation.suggestedPrice?.toLocaleString()} MAD</p>
                <p className="text-[10px] text-emerald-600/70 mt-1">يستهدف هامش ربح 25%</p>
              </div>
            </div>

          </div>
        )}
      </CardContent>
    </Card>
  );
}

