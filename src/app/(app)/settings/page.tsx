'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Save, Sun, Moon, Laptop, Palette, Building2, ImagePlus, Trash2, Loader2 } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [settings, setSettings] = useState({
    company_name: '',
    logo_url: null as string | null,
    owner_profit_share: '0',
    default_bank_account_id: '',
    default_tva_rate: '20',
  });
  const logoInputRef = useRef<HTMLInputElement>(null);
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
          logo_url: data.logo_url || null,
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
        logo_url: settings.logo_url || null,
        owner_profit_share: parseFloat(settings.owner_profit_share) || 0,
        default_bank_account_id: settings.default_bank_account_id ? parseInt(settings.default_bank_account_id) : null,
        default_tva_rate: parseFloat(settings.default_tva_rate) || 20,
        updated_at: new Date().toISOString(),
      };

      let { error } = await supabase.from('system_settings').upsert(payload);

      // If a column is not in Supabase schema cache, fallback to saving without it
      if (error && error.code === 'PGRST204') {
        const offending = (error.message?.match(/'([^']+)'/) || [])[1];
        if (offending && offending in payload) {
          delete (payload as any)[offending];
          const retryResult = await supabase.from('system_settings').upsert(payload);
          error = retryResult.error;
        }
      }

      // Legacy fallback for default_tva_rate
      if (error && error.message?.includes('default_tva_rate')) {
        delete payload.default_tva_rate;
        const retryResult = await supabase.from('system_settings').upsert(payload);
        error = retryResult.error;
      }

      if (error) throw error;

      // Update sidebar branding without requiring a full reload
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('company-settings-updated'));
      }

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

  const handleLogoPick = () => {
    logoInputRef.current?.click();
  };

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'الرجاء اختيار ملف صورة صالح', variant: 'destructive' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'حجم الصورة يتجاوز 2 ميجابايت', variant: 'destructive' });
      return;
    }
    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
      const path = `company/logo_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('settings')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage.from('settings').getPublicUrl(path);
      const publicUrl = pub.publicUrl;

      // Persist the URL to system_settings immediately so it is visible even before pressing save
      const updatePayload: any = {
        id: 1,
        logo_url: publicUrl,
        updated_at: new Date().toISOString(),
      };
      let { error: persistError } = await supabase.from('system_settings').upsert(updatePayload);
      if (persistError && (persistError.code === 'PGRST204' || persistError.message?.includes('logo_url'))) {
        // Column not yet visible to PostgREST cache: keep url in local state only
        console.warn('logo_url column not visible to PostgREST yet:', persistError.message);
        persistError = null;
      }
      if (persistError) throw persistError;

      // Delete the previous logo file if it existed in our bucket
      if (settings.logo_url) {
        try {
          const oldPath = settings.logo_url.split('/storage/v1/object/public/settings/')[1];
          if (oldPath) await supabase.storage.from('settings').remove([oldPath]);
        } catch (cleanupErr) {
          console.warn('Could not remove previous logo:', cleanupErr);
        }
      }

      setSettings((prev) => ({ ...prev, logo_url: publicUrl }));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('company-settings-updated'));
      }
      toast({ title: '✅ تم رفع شعار الشركة بنجاح' });
    } catch (error: any) {
      toast({
        title: 'فشل رفع الشعار',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!settings.logo_url) return;
    const previous = settings.logo_url;
    setSettings((prev) => ({ ...prev, logo_url: null }));
    try {
      const path = previous.split('/storage/v1/object/public/settings/')[1];
      if (path) await supabase.storage.from('settings').remove([path]);

      const updatePayload: any = {
        id: 1,
        logo_url: null,
        updated_at: new Date().toISOString(),
      };
      let { error: persistError } = await supabase.from('system_settings').upsert(updatePayload);
      if (persistError && (persistError.code === 'PGRST204' || persistError.message?.includes('logo_url'))) {
        persistError = null;
      }
      if (persistError) throw persistError;

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('company-settings-updated'));
      }
      toast({ title: 'تم حذف شعار الشركة' });
    } catch (error: any) {
      setSettings((prev) => ({ ...prev, logo_url: previous }));
      toast({
        title: 'فشل حذف الشعار',
        description: error.message,
        variant: 'destructive',
      });
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

          {/* شعار الشركة */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">شعار الشركة</label>
            <p className="text-xs text-muted-foreground">
              يظهر في أعلى القائمة الجانبية وفي جميع ملفات PDF الصادرة عن الشركة
            </p>
            <div className="flex items-center gap-4">
              <div className="relative w-24 h-24 rounded-xl border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                {settings.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={settings.logo_url}
                    alt="شعار الشركة"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <ImagePlus className="w-8 h-8 text-muted-foreground" />
                )}
                {uploadingLogo && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/svg,image/webp"
                  className="hidden"
                  onChange={handleLogoFile}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLogoPick}
                  disabled={uploadingLogo}
                  size="sm"
                >
                  <ImagePlus className="w-4 h-4 ml-2" />
                  {settings.logo_url ? 'تغيير الشعار' : 'رفع شعار'}
                </Button>
                {settings.logo_url && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleRemoveLogo}
                    disabled={uploadingLogo}
                    size="sm"
                    className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4 ml-2" />
                    حذف الشعار
                  </Button>
                )}
              </div>
            </div>
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
