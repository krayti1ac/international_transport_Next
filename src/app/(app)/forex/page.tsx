'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/components/language-provider';
import {
  CircleDollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Plus,
  Calendar,
  AlertTriangle,
  Copy,
  Check,
} from 'lucide-react';

const FOREX_SQL_MIGRATION = `-- 1. إنشاء جدول أسعار الصرف اليومية
CREATE TABLE IF NOT EXISTS public.forex_rates (
  id BIGSERIAL PRIMARY KEY,
  rate_date DATE NOT NULL UNIQUE,
  eur_to_mad NUMERIC(12, 4) NOT NULL,
  mad_to_eur NUMERIC(12, 6) NOT NULL,
  source VARCHAR(50) DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forex_rates_date ON public.forex_rates(rate_date DESC);

-- 2. إنشاء جدول فروق الصرف المحققة
CREATE TABLE IF NOT EXISTS public.forex_gain_loss_entries (
  id BIGSERIAL PRIMARY KEY,
  trip_id BIGINT,
  invoice_id BIGINT,
  original_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  original_currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
  original_rate NUMERIC(12, 4) NOT NULL DEFAULT 0,
  settlement_rate NUMERIC(12, 4) NOT NULL DEFAULT 0,
  realized_gain_loss NUMERIC(14, 2) NOT NULL DEFAULT 0,
  entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('gain', 'loss')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. تفعيل صلاحيات الحماية (RLS)
ALTER TABLE public.forex_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forex_gain_loss_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'forex_rates' AND policyname = 'Authenticated users can view forex_rates') THEN
    CREATE POLICY "Authenticated users can view forex_rates" ON public.forex_rates FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'forex_rates' AND policyname = 'Admins and secretaries can manage forex_rates') THEN
    CREATE POLICY "Admins and secretaries can manage forex_rates" ON public.forex_rates FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'secretary')))
      WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'secretary')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'forex_rates' AND policyname = 'Service role full access on forex_rates') THEN
    CREATE POLICY "Service role full access on forex_rates" ON public.forex_rates FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'forex_gain_loss_entries' AND policyname = 'Authenticated users can view forex_gain_loss') THEN
    CREATE POLICY "Authenticated users can view forex_gain_loss" ON public.forex_gain_loss_entries FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'forex_gain_loss_entries' AND policyname = 'Admins and secretaries can manage forex_gain_loss') THEN
    CREATE POLICY "Admins and secretaries can manage forex_gain_loss" ON public.forex_gain_loss_entries FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'secretary')))
      WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'secretary')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'forex_gain_loss_entries' AND policyname = 'Service role full access on forex_gain_loss') THEN
    CREATE POLICY "Service role full access on forex_gain_loss" ON public.forex_gain_loss_entries FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4. إدراج سعر أولي لليوم
INSERT INTO public.forex_rates (rate_date, eur_to_mad, mad_to_eur, source)
VALUES (CURRENT_DATE, 10.8542, 0.092130, 'api_live')
ON CONFLICT (rate_date) DO NOTHING;

NOTIFY pgrst, 'reload schema';`;

interface ForexRate {
  id?: number;
  rate_date: string;
  eur_to_mad: number;
  mad_to_eur: number;
  source?: string;
  created_at?: string;
}

interface ForexGainLossEntry {
  id: number;
  trip_id?: number | null;
  invoice_id?: number | null;
  original_amount: number;
  original_currency: string;
  original_rate: number;
  settlement_rate: number;
  realized_gain_loss: number;
  entry_type: 'gain' | 'loss';
  created_at?: string;
}

export default function ForexPage() {
  const { t, dir } = useLanguage();
  const [activeTab, setActiveTab] = useState<'rates' | 'gain_loss'>('rates');
  const [rates, setRates] = useState<ForexRate[]>([]);
  const [gainLossEntries, setGainLossEntries] = useState<ForexGainLossEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncingLive, setIsSyncingLive] = useState(false);
  const [isAddRateOpen, setIsAddRateOpen] = useState(false);
  const [isTableMissing, setIsTableMissing] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Form for manual rate
  const [manualRate, setManualRate] = useState({
    rate_date: '',
    eur_to_mad: '',
    mad_to_eur: '',
  });

  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    setManualRate((prev) => ({
      ...prev,
      rate_date: new Date().toISOString().split('T')[0],
    }));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ratesRes, glRes] = await Promise.all([
        supabase.from('forex_rates').select('*').order('rate_date', { ascending: false }),
        supabase.from('forex_gain_loss_entries').select('*').order('created_at', { ascending: false }),
      ]);

      if (ratesRes.error) {
        if (ratesRes.error.code === 'PGRST205') {
          setIsTableMissing(true);
        }
      } else if (ratesRes.data) {
        setRates(ratesRes.data as ForexRate[]);
        setIsTableMissing(false);
      }

      if (glRes.data) {
        setGainLossEntries(glRes.data as ForexGainLossEntry[]);
      }
    } catch (err: unknown) {
      console.error('Error loading forex data:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Live Sync using backend API route (/api/forex/sync) with fallback
  const handleSyncLive = async () => {
    setIsSyncingLive(true);
    try {
      // 1. Try server-side sync API first
      const res = await fetch('/api/forex/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        const rateVal = new Decimal(data.rate.eur_to_mad).toFixed(4);
        toast({
          title: t('تم التحديث بنجاح', 'Mise à jour réussie'),
          description: t(`سعر اليوم: 1 EUR = ${rateVal} MAD`, `Taux du jour: 1 EUR = ${rateVal} MAD`),
        });
        setIsTableMissing(false);
        loadData();
        return;
      }

      if (data?.error === 'TABLE_MISSING' || data?.code === 'PGRST205') {
        setIsTableMissing(true);
        setShowSqlModal(true);
        throw new Error(t('جداول أسعار الصرف غير موجودة في Supabase. يرجى تطبيق كود الـ SQL المرفق.', 'Les tables Forex sont introuvables dans Supabase. Veuillez appliquer la migration SQL.'));
      }

      // 2. Client-side fallback if server route failed for another reason
      const extRes = await fetch('https://open.er-api.com/v6/latest/EUR');
      if (!extRes.ok) throw new Error(data?.message || t('فشل الاتصال بمزود أسعار الصرف', 'Échec de connexion au fournisseur de taux'));
      const extData = await extRes.json();
      const rawEurMad = extData?.rates?.MAD;
      if (!rawEurMad) throw new Error(t('لم يتم العثور على سعر صرف الدرهم', 'Taux de change MAD introuvable'));

      const eurToMadDec = new Decimal(rawEurMad);
      const madToEurDec = new Decimal(1).dividedBy(eurToMadDec);
      const today = new Date().toISOString().split('T')[0];

      const { error } = await supabase.from('forex_rates').upsert(
        {
          rate_date: today,
          eur_to_mad: Number(eurToMadDec.toFixed(4)),
          mad_to_eur: Number(madToEurDec.toFixed(6)),
          source: 'api_live',
        },
        { onConflict: 'rate_date' }
      );

      if (error) {
        if (error.code === 'PGRST205') {
          setIsTableMissing(true);
          setShowSqlModal(true);
          throw new Error(t('جدول forex_rates غير موجود في Supabase. يرجى تطبيق كود الـ SQL.', 'La table forex_rates est introuvable dans Supabase. Veuillez exécuter le script SQL.'));
        }
        throw new Error(error.message || t('فشل حفظ سعر الصرف في قاعدة البيانات', 'Échec d’enregistrement du taux de change'));
      }

      toast({
        title: t('تم التحديث بنجاح', 'Mise à jour réussie'),
        description: t(`سعر اليوم: 1 EUR = ${eurToMadDec.toFixed(4)} MAD`, `Taux du jour: 1 EUR = ${eurToMadDec.toFixed(4)} MAD`),
      });
      setIsTableMissing(false);
      loadData();
    } catch (err: unknown) {
      const postgrestErr = err as { message?: string };
      const msg = err instanceof Error ? err.message : postgrestErr?.message || t('تعذر جلب سعر الصرف', 'Impossible de récupérer le taux de change');
      toast({
        title: t('خطأ في جلب السعر الحي', 'Erreur lors de la récupération du taux direct'),
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSyncingLive(false);
    }
  };

  const handleManualRateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let eurMadDec: Decimal;
    let madEurDec: Decimal;

    try {
      eurMadDec = new Decimal(manualRate.eur_to_mad);
      if (eurMadDec.lte(0)) throw new Error();
    } catch {
      toast({ title: t('خطأ', 'Erreur'), description: t('يرجى إدخال سعر EUR إلى MAD بشكل صحيح', 'Veuillez saisir un taux EUR -> MAD valide'), variant: 'destructive' });
      return;
    }

    try {
      if (!manualRate.mad_to_eur || isNaN(Number(manualRate.mad_to_eur)) || Number(manualRate.mad_to_eur) <= 0) {
        madEurDec = new Decimal(1).dividedBy(eurMadDec);
      } else {
        madEurDec = new Decimal(manualRate.mad_to_eur);
      }
    } catch {
      madEurDec = new Decimal(1).dividedBy(eurMadDec);
    }

    try {
      const { error } = await supabase.from('forex_rates').upsert(
        {
          rate_date: manualRate.rate_date,
          eur_to_mad: Number(eurMadDec.toFixed(4)),
          mad_to_eur: Number(madEurDec.toFixed(6)),
          source: 'manual',
        },
        { onConflict: 'rate_date' }
      );

      if (error) {
        if (error.code === 'PGRST205') {
          setIsTableMissing(true);
          setShowSqlModal(true);
          throw new Error(t('جدول forex_rates غير موجود في Supabase. يرجى تطبيق كود الـ SQL المرفق أولاً.', 'Table forex_rates introuvable dans Supabase. Veuillez appliquer le script SQL.'));
        }
        throw new Error(error.message || t('فشل في حفظ سعر الصرف', 'Échec de l’enregistrement'));
      }

      toast({ title: t('تم الحفظ', 'Enregistré'), description: t('تم تسجيل سعر الصرف بنجاح', 'Taux de change enregistré avec succès') });
      setIsTableMissing(false);
      setIsAddRateOpen(false);
      setManualRate({
        rate_date: new Date().toISOString().split('T')[0],
        eur_to_mad: '',
        mad_to_eur: '',
      });
      loadData();
    } catch (err: unknown) {
      const postgrestErr = err as { message?: string };
      const msg = err instanceof Error ? err.message : postgrestErr?.message || t('فشل في حفظ سعر الصرف', 'Échec d’enregistrement');
      toast({ title: t('خطأ', 'Erreur'), description: msg, variant: 'destructive' });
    }
  };

  // Calculations for Gain/Loss using Decimal.js
  const totalGain = useMemo(() => {
    return gainLossEntries
      .filter((e) => e.entry_type === 'gain')
      .reduce((acc, curr) => acc.plus(new Decimal(curr.realized_gain_loss || 0)), new Decimal(0));
  }, [gainLossEntries]);

  const totalLoss = useMemo(() => {
    return gainLossEntries
      .filter((e) => e.entry_type === 'loss')
      .reduce((acc, curr) => acc.plus(new Decimal(curr.realized_gain_loss || 0)), new Decimal(0));
  }, [gainLossEntries]);

  const netGainLoss = useMemo(() => {
    return totalGain.minus(totalLoss);
  }, [totalGain, totalLoss]);

  const latestRate = rates[0];

  return (
    <div className="space-y-6" dir={dir}>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-amiri text-foreground flex items-center gap-2">
            <CircleDollarSign className="w-7 h-7 text-purple-400" />
            {t('أسعار الصرف وفروق العملات المحققة (Forex)', 'Taux de change et écarts de conversion (Forex)')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              'متابعة أسعار صرف اليورو والدرهم المغربي وحساب الفروقات الربحية والمحققة للرحلات والفواتير الدولية.',
              'Suivi des taux de change EUR/MAD et calcul des gains/pertes de change réalisés pour les voyages et factures internationales.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSyncLive}
            disabled={isSyncingLive}
            variant="outline"
            className="border-purple-500/40 text-purple-400 hover:bg-purple-500/10 flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncingLive ? 'animate-spin' : ''}`} />
            <span>{t('تحديث السعر المباشر الآن', 'Actualiser le taux direct')}</span>
          </Button>

          <Button
            onClick={() => setIsAddRateOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2 shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('إضافة سعر يدوي', 'Ajouter un taux manuel')}</span>
          </Button>
        </div>
      </div>

      {/* Missing table warning banner */}
      {isTableMissing && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-amber-300">
                {t('جداول أسعار الصرف (Forex) بحاجة للإنشاء في قاعدة بيانات Supabase', 'Tables Forex requises dans la base Supabase')}
              </h4>
              <p className="text-xs text-amber-200/80 mt-1">
                {t(
                  'سبب ظهور الخطأ: جدول forex_rates لم يتم تفعيله بعد في Supabase. يمكنك نسخ كود الـ SQL وتشغيله بنقرة زر واحدة في لوحة التحكم.',
                  'Cause: La table forex_rates n’est pas encore créée dans Supabase. Copiez et exécutez le script SQL ci-dessous dans l’éditeur SQL.'
                )}
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => setShowSqlModal(true)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shrink-0 cursor-pointer shadow-sm"
          >
            {t('عرض ونسخ كود الـ SQL', 'Afficher et copier le script SQL')}
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border/80">
        <button
          type="button"
          onClick={() => setActiveTab('rates')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'rates'
              ? 'border-purple-500 text-purple-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <CircleDollarSign className="w-4 h-4" />
          <span>{t('سجل أسعار الصرف', 'Historique des taux')} ({rates.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('gain_loss')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'gain_loss'
              ? 'border-purple-500 text-purple-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>{t('فروق الصرف المحققة', 'Écarts de change réalisés')} ({gainLossEntries.length})</span>
        </button>
      </div>

      {/* TAB 1: RATES */}
      {activeTab === 'rates' && (
        <div className="space-y-4">
          {/* Top Live Rates Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card/70 border-border/70 backdrop-blur-sm shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {t('آخر سعر صرف مسجل (EUR → MAD)', 'Dernier taux enregistré (EUR → MAD)')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-400">
                  {latestRate ? `1 € = ${latestRate.eur_to_mad} MAD` : t('غير محدد', 'Non défini')}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('بتاريخ: ', 'Date: ')} {latestRate?.rate_date || '—'} ({latestRate?.source === 'api_live' ? t('سعر حي', 'Taux direct') : t('يدوي', 'Manuel')})
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/70 border-border/70 backdrop-blur-sm shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {t('السعر المقابل (MAD → EUR)', 'Taux inverse (MAD → EUR)')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-400">
                  {latestRate ? `1 MAD = ${latestRate.mad_to_eur} €` : t('غير محدد', 'Non défini')}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('معدل التحويل للدرهم إلى اليورو', 'Taux de conversion MAD vers EUR')}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/70 border-border/70 backdrop-blur-sm shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {t('إجمالي الأيام المسجلة', 'Total des jours enregistrés')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{rates.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('تاريخ توثيق أسعار العملات', 'Historique de documentation des devises')}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Rates Table */}
          <Card className="bg-card border-border/80 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className={`w-full text-xs ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="p-3">{t('التاريخ', 'Date')}</th>
                    <th className="p-3">{t('سعر اليورو مقابل الدرهم (1 EUR)', 'Taux EUR/MAD (1 EUR)')}</th>
                    <th className="p-3">{t('سعر الدرهم مقابل اليورو (1 MAD)', 'Taux MAD/EUR (1 MAD)')}</th>
                    <th className="p-3">{t('المصدر', 'Source')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted-foreground">
                        {t('جاري تحميل أسعار الصرف...', 'Chargement des taux de change...')}
                      </td>
                    </tr>
                  ) : rates.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted-foreground">
                        {t('لا توجد أسعار صرف مسجلة. انقر على "تحديث السعر المباشر الآن" للمزامنة.', 'Aucun taux enregistré. Cliquez sur "Actualiser le taux direct" pour synchroniser.')}
                      </td>
                    </tr>
                  ) : (
                    rates.map((rate, idx) => (
                      <tr key={rate.id || idx} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-mono font-medium text-foreground flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-purple-400" />
                          {rate.rate_date}
                        </td>
                        <td className="p-3 font-bold text-purple-400">
                          {rate.eur_to_mad} MAD
                        </td>
                        <td className="p-3 font-mono text-muted-foreground">
                          {rate.mad_to_eur} €
                        </td>
                        <td className="p-3">
                          <Badge
                            variant="outline"
                            className={
                              rate.source === 'api_live'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            }
                          >
                            {rate.source === 'api_live' ? t('⚡ API مباشر', '⚡ API Direct') : t('يدوي', 'Manuel')}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: GAIN / LOSS */}
      {activeTab === 'gain_loss' && (
        <div className="space-y-4">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card/70 border-border/70 backdrop-blur-sm shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {t('إجمالي أرباح الصرف (FX Gain)', 'Gains de change totaux (FX Gain)')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-400 flex items-center gap-1">
                  <TrendingUp className="w-5 h-5" />
                  +{totalGain.toFixed(2)} MAD
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('مكاسب ناتجة عن تغير سعر التحويل', 'Gains issus des fluctuations de change')}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/70 border-border/70 backdrop-blur-sm shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {t('إجمالي خسائر الصرف (FX Loss)', 'Pertes de change totales (FX Loss)')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-rose-400 flex items-center gap-1">
                  <TrendingDown className="w-5 h-5" />
                  -{totalLoss.toFixed(2)} MAD
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('فروقات سلبية عند التسوية', 'Écarts défavorables au règlement')}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/70 border-border/70 backdrop-blur-sm shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {t('صافي فروق الصرف المحققة', 'Résultat net de change réalisé')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${netGainLoss.gte(0) ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {netGainLoss.gte(0) ? `+${netGainLoss.toFixed(2)}` : netGainLoss.toFixed(2)} MAD
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('الرصيد الصافي للأرباح والخسائر', 'Solde net des gains et pertes')}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gain/Loss Table */}
          <Card className="bg-card border-border/80 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className={`w-full text-xs ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="p-3">{t('رقم العملية', 'N° Opération')}</th>
                    <th className="p-3">{t('المرجع (رحلة / فاتورة)', 'Référence (Voyage / Facture)')}</th>
                    <th className="p-3">{t('المبلغ الأصلي', 'Montant d’origine')}</th>
                    <th className="p-3">{t('السعر الأولي', 'Taux initial')}</th>
                    <th className="p-3">{t('سعر التسوية', 'Taux de règlement')}</th>
                    <th className="p-3">{t('الفرق المحقق', 'Écart réalisé')}</th>
                    <th className="p-3 text-center">{t('الحالة', 'Statut')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {gainLossEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        {t('لا توجد فروق صرف محققة مسجلة حتى الآن.', 'Aucun écart de change enregistré pour le moment.')}
                      </td>
                    </tr>
                  ) : (
                    gainLossEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-mono">#{entry.id}</td>
                        <td className="p-3">
                          {entry.trip_id ? (
                            <span className="font-semibold text-foreground">{t(`رحلة #${entry.trip_id}`, `Voyage #${entry.trip_id}`)}</span>
                          ) : entry.invoice_id ? (
                            <span className="font-semibold text-foreground">{t(`فاتورة #${entry.invoice_id}`, `Facture #${entry.invoice_id}`)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 font-bold">
                          {entry.original_amount} {entry.original_currency}
                        </td>
                        <td className="p-3 font-mono">{entry.original_rate} MAD</td>
                        <td className="p-3 font-mono">{entry.settlement_rate} MAD</td>
                        <td className="p-3 font-bold">
                          <span className={entry.entry_type === 'gain' ? 'text-emerald-400' : 'text-rose-400'}>
                            {entry.entry_type === 'gain' ? '+' : '-'}
                            {new Decimal(entry.realized_gain_loss || 0).toFixed(2)} MAD
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <Badge
                            className={
                              entry.entry_type === 'gain'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                            }
                          >
                            {entry.entry_type === 'gain' ? t('ربح تحويل', 'Gain de change') : t('خسارة تحويل', 'Perte de change')}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Manual Rate Modal */}
      {isAddRateOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <CircleDollarSign className="w-5 h-5 text-purple-400" />
                {t('إضافة سعر صرف يدوي', 'Ajouter un cours manuel')}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddRateOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualRateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1 font-medium">{t('التاريخ', 'Date')}</label>
                <Input
                  type="date"
                  required
                  value={manualRate.rate_date}
                  onChange={(e) => setManualRate({ ...manualRate, rate_date: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-medium">
                  {t('1 EUR = كم بالدرهم المغربي (MAD)؟', '1 EUR = combien en Dirhams marocains (MAD) ?')}
                </label>
                <Input
                  type="number"
                  step="0.0001"
                  required
                  placeholder={t('مثال: 10.8500', 'Ex: 10.8500')}
                  value={manualRate.eur_to_mad}
                  onChange={(e) => {
                    const val = e.target.value;
                    let inv = '';
                    try {
                      const num = new Decimal(val);
                      if (num.gt(0)) {
                        inv = new Decimal(1).dividedBy(num).toFixed(6);
                      }
                    } catch {
                      inv = '';
                    }
                    setManualRate({ ...manualRate, eur_to_mad: val, mad_to_eur: inv });
                  }}
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1 font-medium">
                  {t('1 MAD = كم باليورو (EUR)؟ (تلقائي)', '1 MAD = combien en Euros (EUR) ? (automatique)')}
                </label>
                <Input
                  type="number"
                  step="0.000001"
                  placeholder={t('مثال: 0.092166', 'Ex: 0.092166')}
                  value={manualRate.mad_to_eur}
                  onChange={(e) => setManualRate({ ...manualRate, mad_to_eur: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border mt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsAddRateOpen(false)}
                >
                  {t('إلغاء', 'Annuler')}
                </Button>
                <Button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700 text-white cursor-pointer"
                >
                  {t('حفظ سعر الصرف', 'Enregistrer le cours')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SQL Migration Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl p-5 space-y-4 shadow-2xl animate-in fade-in-50 zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                {t('كود ترحيل قاعدة البيانات (SQL Migration)', 'Migration Base de Données (SQL)')}
              </h3>
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {t(
                'قم بنسخ هذا الاستعلام ولصقه في Supabase Dashboard > SQL Editor ثم الضغط على Run لتفعيل ميزة وتخزين أسعار الصرف فوراً وبشكل دائم.',
                'Copiez cette requête et collez-la dans Supabase Dashboard > SQL Editor, puis cliquez sur Run pour activer et persister les tables Forex.'
              )}
            </p>

            <div className="relative flex-1 min-h-0 bg-slate-950 text-slate-200 rounded-lg p-3 font-mono text-xs overflow-auto border border-border/60 dir-ltr text-left">
              <pre>{FOREX_SQL_MIGRATION}</pre>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-border">
              <span className="text-[11px] text-muted-foreground dir-ltr">
                {t('الملف: ', 'Fichier : ')}<code className="text-purple-400 font-mono">supabase/migrations/20260904_create_forex_tables.sql</code>
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSqlModal(false)}
                >
                  {t('إغلاق', 'Fermer')}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(FOREX_SQL_MIGRATION);
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 3000);
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedSql ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedSql ? t('تم النسخ!', 'Copié !') : t('نسخ كود الـ SQL', 'Copier le script SQL')}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
