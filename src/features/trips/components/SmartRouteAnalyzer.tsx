'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Navigation, Fuel, AlertCircle, Coins, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { analyzeRouteProfitability, type RouteEstimation } from '../services/route-optimizer.actions';

export function SmartRouteAnalyzer() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [includeFerry, setIncludeFerry] = useState(true);
  const [loading, setLoading] = useState(false);
  const [estimation, setEstimation] = useState<RouteEstimation | null>(null);

  const { toast } = useToast();
  const { t, dir } = useLanguage();

  const handleAnalyze = async () => {
    if (!origin.trim() || !destination.trim()) {
      toast({
        title: t('يرجى إدخال نقطة الانطلاق والوجهة', 'Veuillez saisir le point de départ et la destination', 'Please enter origin and destination'),
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await analyzeRouteProfitability(origin.trim(), destination.trim(), includeFerry);
      if (result.success) {
        setEstimation(result);
        toast({
          title: t('تم اكتمال التحليل الجغرافي والمالي', 'Analyse géographique et financière terminée', 'Geographic and financial analysis completed'),
        });
      } else {
        toast({
          title: t('فشل التحليل', "Échec de l'analyse", 'Analysis failed'),
          description: result.error,
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('خطأ غير متوقع', 'Erreur inattendue', 'Unexpected error');
      toast({
        title: t('خطأ', 'Erreur', 'Error'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      className="border-primary/20 shadow-md bg-gradient-to-br from-slate-50 to-blue-50/20 dark:from-slate-950 dark:to-blue-950/20"
      dir={dir}
    >
      <CardHeader className="pb-3 border-b border-border/50">
        <CardTitle className="flex items-center gap-2 text-primary font-amiri text-lg">
          <Sparkles className="w-5 h-5 text-amber-500" />
          {t('المستشار اللوجستي (AI Route Optimizer)', 'Optimiseur d’Itinéraire IA', 'AI Route Optimizer')}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              {t('مدينة الانطلاق', 'Ville de départ', 'Origin City')}
            </label>
            <Input
              placeholder={t('مثال: طنجة أو Tanger', 'Ex: Tanger', 'e.g. Tangier')}
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAnalyze();
              }}
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              {t('الوجهة (المدينة)', 'Destination (Ville)', 'Destination (City)')}
            </label>
            <Input
              placeholder={t('مثال: باريس أو Paris', 'Ex: Paris', 'e.g. Paris')}
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAnalyze();
              }}
            />
          </div>
          <Button
            onClick={handleAnalyze}
            disabled={loading}
            className="w-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              t('تحليل وتوقع السعر', 'Analyser & Estimer', 'Analyze & Estimate')
            )}
          </Button>
        </div>

        <div className="flex items-center gap-2 pt-1 pb-2">
          <input
            type="checkbox"
            id="ferry"
            checked={includeFerry}
            onChange={(e) => setIncludeFerry(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 accent-primary cursor-pointer"
          />
          <label htmlFor="ferry" className="text-sm text-muted-foreground cursor-pointer select-none">
            {t(
              'تضمين رسوم العبّارة البحرية (Ferry Transit)',
              'Inclure les frais de ferry (Transit Ferry)',
              'Include maritime ferry fees (Ferry Transit)'
            )}
          </label>
        </div>

        {estimation && estimation.success && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in zoom-in-95 mt-4">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-border flex items-start gap-3 shadow-xs">
              <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg shrink-0">
                <Navigation className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t('مسافة الرحلة الكلية', 'Distance totale du trajet', 'Total Route Distance')}
                </p>
                <p className="font-bold font-mono mt-0.5 text-foreground">
                  {estimation.distanceKm?.toLocaleString()} km
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {t('وقت القيادة:', 'Temps de conduite :', 'Driving time:')} {estimation.durationHours}{' '}
                  {t('ساعة', 'h', 'hrs')}
                </p>
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-border flex items-start gap-3 shadow-xs">
              <div className="p-2 bg-rose-500/10 text-rose-600 rounded-lg shrink-0">
                <Fuel className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t('استهلاك الوقود التقديري', 'Consommation estimée carburant', 'Estimated Fuel Cost')}
                </p>
                <p className="font-bold font-mono mt-0.5 text-foreground">
                  {estimation.estimatedFuelCost?.toLocaleString()} MAD
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {t('رسوم الطرق:', 'Péages :', 'Tolls:')} {estimation.estimatedTollCost?.toLocaleString()} MAD
                </p>
              </div>
            </div>

            <div
              className={`p-3 bg-white dark:bg-slate-900 rounded-xl border border-border flex items-start gap-3 shadow-xs ${
                dir === 'rtl' ? 'border-r-4 border-r-amber-500' : 'border-l-4 border-l-amber-500'
              }`}
            >
              <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-amber-600 font-bold">
                  {t('الحد الأدنى للربحية', 'Prix minimum rentable', 'Min Profitable Price')}
                </p>
                <p className="font-bold font-mono mt-0.5 text-foreground text-lg">
                  {estimation.minProfitablePrice?.toLocaleString()} MAD
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {t('يغطي التكاليف الأساسية بصعوبة', 'Couvre les coûts essentiels', 'Covers basic operating expenses')}
                </p>
              </div>
            </div>

            <div
              className={`p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900 flex items-start gap-3 shadow-xs ${
                dir === 'rtl' ? 'border-r-4 border-r-emerald-500' : 'border-l-4 border-l-emerald-500'
              }`}
            >
              <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg shrink-0">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                  {t('السعر المثالي المقترح', 'Prix suggéré optimal', 'Suggested Optimal Price')}
                </p>
                <p className="font-black font-mono mt-0.5 text-emerald-600 dark:text-emerald-400 text-xl">
                  {estimation.suggestedPrice?.toLocaleString()} MAD
                </p>
                <p className="text-[10px] text-emerald-600/70 mt-1">
                  {t('يستهدف هامش ربح 25%', 'Cible 25% de marge', 'Targets 25% profit margin')}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
