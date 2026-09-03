'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Save, Sun, Moon, Laptop, Palette, Building2 } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    company_name: '',
    owner_profit_share: '0',
    default_bank_account_id: '',
    default_tva_rate: '20',
  });
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const savedLocalTva = typeof window !== 'undefined' ? localStorage.getItem('app_default_tva_rate') : null;

      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.warn('Could not fetch system_settings:', error.message);
      }
      if (data) {
        setSettings({
          company_name: data.company_name || '',
          owner_profit_share: data.owner_profit_share?.toString() || '0',
          default_bank_account_id: data.default_bank_account_id?.toString() || '',
          default_tva_rate: (data.default_tva_rate !== undefined && data.default_tva_rate !== null)
            ? data.default_tva_rate.toString()
            : (savedLocalTva || '20'),
        });
      } else if (savedLocalTva) {
        setSettings((prev) => ({ ...prev, default_tva_rate: savedLocalTva }));
      }
    } catch (error: any) {
      toast({
        title: 'خطأ في تحميل الإعدادات',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('app_default_tva_rate', settings.default_tva_rate || '20');
      }

      const payload: any = {
        id: 1,
        company_name: settings.company_name,
        owner_profit_share: parseFloat(settings.owner_profit_share) || 0,
        default_bank_account_id: settings.default_bank_account_id ? parseInt(settings.default_bank_account_id) : null,
        default_tva_rate: parseFloat(settings.default_tva_rate) || 20,
        updated_at: new Date().toISOString(),
      };

      let { error } = await supabase.from('system_settings').upsert(payload);

      // If column is not in Supabase schema cache, fallback to saving without it
      if (error && (error.message?.includes('default_tva_rate') || error.code === 'PGRST204')) {
        delete payload.default_tva_rate;
        const retryResult = await supabase.from('system_settings').upsert(payload);
        error = retryResult.error;
      }

      if (error) throw error;

      toast({
        title: 'تم حفظ الإعدادات بنجاح',
      });
    } catch (error: any) {
      toast({
        title: 'خطأ في حفظ الإعدادات',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">جاري تحميل الإعدادات...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold font-amiri text-foreground">إعدادات النظام</h1>
        <p className="text-sm text-muted-foreground mt-1">تخصيص مظهر النظام، بيانات الشركة، والنسب المالية</p>
      </div>

      {/* مظهر النظام والألوان */}
      <Card>
        <CardHeader>
          <CardTitle className="font-amiri flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            مظهر النظام والألوان (Theme Mode)
          </CardTitle>
          <CardDescription>اختر الوضع المناسب لراحة عينيك أثناء العمل على النظام</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => {
                setTheme('light');
                toast({ title: '☀️ تم تفعيل الوضع الفاتح' });
              }}
              className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all cursor-pointer text-center relative ${
                theme === 'light'
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/20 shadow-xs'
                  : 'border-border bg-card hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-500">
                <Sun className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">الوضع الفاتح</p>
                <p className="text-xs text-muted-foreground mt-0.5">مظهر نهاري مشرق وعالي الوضوح</p>
              </div>
              {theme === 'light' && (
                <span className="inline-block px-2 py-0.5 text-[11px] font-semibold bg-primary text-white rounded-full">مفعّل</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setTheme('dark');
                toast({ title: '🌙 تم تفعيل الوضع الداكن' });
              }}
              className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all cursor-pointer text-center relative ${
                theme === 'dark'
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/20 shadow-xs'
                  : 'border-border bg-card hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center text-blue-400">
                <Moon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">الوضع الداكن</p>
                <p className="text-xs text-muted-foreground mt-0.5">مريح للعينين في الإضاءة الخافتة</p>
              </div>
              {theme === 'dark' && (
                <span className="inline-block px-2 py-0.5 text-[11px] font-semibold bg-primary text-white rounded-full">مفعّل</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setTheme('system');
                toast({ title: '🖥️ تم تفعيل المزامنة مع النظام' });
              }}
              className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all cursor-pointer text-center relative ${
                theme === 'system'
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/20 shadow-xs'
                  : 'border-border bg-card hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-slate-500/15 flex items-center justify-center text-slate-400">
                <Laptop className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">تلقائي (حسب جهازك)</p>
                <p className="text-xs text-muted-foreground mt-0.5">يتغير تلقائياً مع إعدادات جهازك</p>
              </div>
              {theme === 'system' && (
                <span className="inline-block px-2 py-0.5 text-[11px] font-semibold bg-primary text-white rounded-full">مفعّل</span>
              )}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* بيانات الشركة */}
      <Card>
        <CardHeader>
          <CardTitle className="font-amiri flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            الإعدادات العامة للشركة
          </CardTitle>
          <CardDescription>البيانات الأساسية التي تظهر في الفواتير ومطبوعات CMR</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">اسم الشركة</label>
            <Input
              value={settings.company_name}
              onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
              placeholder="مثال: شركة النقل الدولي واللوجستيك"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">نسبة الضريبة الافتراضية TVA (%)</label>
              <Input
                type="number"
                value={settings.default_tva_rate}
                onChange={(e) => setSettings({ ...settings, default_tva_rate: e.target.value })}
                placeholder="20"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">تُطبق هذه النسبة تلقائياً على جميع العملاء الخاضعين للضريبة</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">نسبة ربح المالك (%)</label>
              <Input
                type="number"
                value={settings.owner_profit_share}
                onChange={(e) => setSettings({ ...settings, owner_profit_share: e.target.value })}
                placeholder="0"
                dir="ltr"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">معرف الحساب البنكي الافتراضي</label>
            <Input
              type="number"
              value={settings.default_bank_account_id}
              onChange={(e) => setSettings({ ...settings, default_bank_account_id: e.target.value })}
              placeholder="معرف الحساب البنكي"
              dir="ltr"
            />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            <Save className="w-4 h-4 ml-2" />
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
