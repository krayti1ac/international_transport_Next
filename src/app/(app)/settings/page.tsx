'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  Save,
  Sun,
  Moon,
  Laptop,
  Palette,
  Building2,
  ImagePlus,
  Trash2,
  Loader2,
  Languages,
} from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { useLanguage } from '@/components/language-provider';
import { useAuth } from '@/components/auth-provider';

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  useEffect(() => {
    if (tabParam === 'users') {
      router.replace('/users');
    } else if (tabParam === 'doc_types') {
      router.replace('/documents/types');
    }
  }, [tabParam, router]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [settings, setSettings] = useState({
    company_name: '',
    ice: '',
    currency: 'MAD',
    logo_url: null as string | null,
    owner_profit_share: '0',
    default_bank_account_id: '',
    default_tva_rate: '20',
  });
  const logoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { locale, dir, setLocale, t } = useLanguage();
  const { user, company, companyId, refreshCompany } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    fetchSettings();
  }, [companyId, user?.company_id]);

  const fetchSettings = async () => {
    try {
      const savedLocalTva = typeof window !== 'undefined' ? localStorage.getItem('app_default_tva_rate') : null;
      const targetCompanyId = companyId || user?.company_id || 1;

      // 1. Fetch company data from companies table
      let fetchedCompany: any = null;
      try {
        const { data: compData, error: compErr } = await supabase
          .from('companies')
          .select('*')
          .eq('id', targetCompanyId)
          .maybeSingle();
        if (!compErr && compData) {
          fetchedCompany = compData;
        }
      } catch (cErr) {
        console.warn('Could not fetch companies row:', cErr);
      }

      // 2. Fetch system settings
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.warn('Could not fetch system_settings:', error.message);
      }

      setSettings({
        company_name: fetchedCompany?.name || data?.company_name || company?.name || '',
        ice: fetchedCompany?.ice || company?.ice || '',
        currency: fetchedCompany?.currency || company?.currency || 'MAD',
        logo_url: fetchedCompany?.logo_url ?? data?.logo_url ?? company?.logo_url ?? null,
        owner_profit_share: data?.owner_profit_share?.toString() || '0',
        default_bank_account_id: data?.default_bank_account_id?.toString() || '',
        default_tva_rate: (data?.default_tva_rate !== undefined && data?.default_tva_rate !== null)
          ? data.default_tva_rate.toString()
          : (savedLocalTva || '20'),
      });
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

      const targetCompanyId = companyId || user?.company_id || 1;

      // 1. Save to companies table
      try {
        const { error: compUpdateErr } = await supabase
          .from('companies')
          .update({
            name: settings.company_name,
            ice: settings.ice,
            currency: settings.currency,
            logo_url: settings.logo_url || null,
          })
          .eq('id', targetCompanyId);

        if (compUpdateErr) {
          console.warn('Could not update companies table:', compUpdateErr.message);
        }
      } catch (cSaveErr) {
        console.warn('Failed saving to companies:', cSaveErr);
      }

      // 2. Save to system_settings for legacy backward compatibility
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

      // Update company context & sidebar branding without requiring a full reload
      await refreshCompany();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('company-settings-updated'));
      }

      toast({
        title: t('تم حفظ الإعدادات بنجاح', 'Paramètres enregistrés avec succès', 'Configuración guardada con éxito'),
      });
    } catch (error: any) {
      toast({
        title: t('خطأ في حفظ الإعدادات', "Erreur lors de l'enregistrement des paramètres", 'Error al guardar la configuración'),
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
      toast({ title: t('✅ تم رفع شعار الشركة بنجاح', '✅ Logo téléchargé avec succès', '✅ Logotipo subido con éxito') });
    } catch (error: any) {
      toast({
        title: t('فشل رفع الشعار', 'Échec du téléchargement du logo', 'Error al subir el logotipo'),
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
      toast({ title: t('تم حذف شعار الشركة', 'Logo supprimé', 'Logotipo eliminado con éxito') });
    } catch (error: any) {
      setSettings((prev) => ({ ...prev, logo_url: previous }));
      toast({
        title: t('فشل حذف الشعار', 'Échec de suppression du logo', 'Error al eliminar el logotipo'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary ms-2" />
        <p className="text-muted-foreground">{t('جاري تحميل الإعدادات...', 'Chargement des paramètres...', 'Cargando configuración...')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto space-y-6 max-w-2xl" dir={dir}>
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold font-amiri text-foreground">
          {t('إعدادات النظام', 'Paramètres du système', 'Configuración del sistema')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            'تخصيص لغة ومظهر النظام وبيانات الشركة الأساسية',
            "Personnalisation de la langue, du thème et de l'entreprise",
            'Personalización de idioma, apariencia y datos de la empresa'
          )}
        </p>
      </div>

      {/* Settings Content */}
      <div className="space-y-6">
          {/* لغة النظام (Bascule Ar/Fr/Es) */}
          <Card>
            <CardHeader>
              <CardTitle className="font-amiri flex items-center gap-2">
                <Languages className="w-5 h-5 text-primary" />
                {t('لغة النظام (Langue du système)', 'Langue du système', 'Idioma del sistema (System Language)')}
              </CardTitle>
              <CardDescription>
                {t(
                  'اختر اللغة المفضلة لواجهة النظام، يتم تذكر وحفظ هذا التفضيل لحسابك بشكل مستقل',
                  "Choisissez la langue de l'interface, cette préférence est mémorisée pour votre compte",
                  'Seleccione el idioma preferido para la interfaz del sistema, esta preferencia se guardará para su cuenta'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* خيار العربية */}
                <button
                  type="button"
                  onClick={async () => {
                    await setLocale('ar', user?.id || user?.email);
                    toast({ title: '🇸🇦 تم تفعيل اللغة العربية وحفظ التفضيل' });
                  }}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all cursor-pointer text-center relative ${
                    locale === 'ar'
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/20 shadow-xs'
                      : 'border-border bg-card hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-500 font-bold text-sm">
                    AR
                  </div>
                  <div>
                    <p className="font-bold text-sm text-foreground">العربية</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('واجهة باللغة العربية (من اليمين إلى اليسار)', 'Interface en arabe (RTL)', 'Interfaz en árabe (RTL)')}
                    </p>
                  </div>
                  {locale === 'ar' && (
                    <span className="inline-block px-2 py-0.5 text-[11px] font-semibold bg-primary text-white rounded-full">
                      {t('مفعّل', 'Activé', 'Activado')}
                    </span>
                  )}
                </button>

                {/* خيار الفرنسية */}
                <button
                  type="button"
                  onClick={async () => {
                    await setLocale('fr', user?.id || user?.email);
                    toast({ title: '🇫🇷 Langue française activée et préférence enregistrée' });
                  }}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all cursor-pointer text-center relative ${
                    locale === 'fr'
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/20 shadow-xs'
                      : 'border-border bg-card hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-sky-500/15 flex items-center justify-center text-sky-500 font-bold text-sm">
                    FR
                  </div>
                  <div>
                    <p className="font-bold text-sm text-foreground">Français</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('واجهة باللغة الفرنسية (من اليسار إلى اليمين)', 'Interface en français (LTR)', 'Interfaz en francés (LTR)')}
                    </p>
                  </div>
                  {locale === 'fr' && (
                    <span className="inline-block px-2 py-0.5 text-[11px] font-semibold bg-primary text-white rounded-full">
                      {t('مفعّل', 'Activé', 'Activado')}
                    </span>
                  )}
                </button>

                {/* خيار الإسبانية */}
                <button
                  type="button"
                  onClick={async () => {
                    await setLocale('es', user?.id || user?.email);
                    toast({ title: '🇪🇸 Idioma español activado y preferencia guardada' });
                  }}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all cursor-pointer text-center relative ${
                    locale === 'es'
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/20 shadow-xs'
                      : 'border-border bg-card hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-500 font-bold text-sm">
                    ES
                  </div>
                  <div>
                    <p className="font-bold text-sm text-foreground">Español</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('واجهة باللغة الإسبانية (من اليسار إلى اليمين)', 'Interface en espagnol (LTR)', 'Interfaz en español (LTR)')}
                    </p>
                  </div>
                  {locale === 'es' && (
                    <span className="inline-block px-2 py-0.5 text-[11px] font-semibold bg-primary text-white rounded-full">
                      {t('مفعّل', 'Activé', 'Activado')}
                    </span>
                  )}
                </button>
              </div>
            </CardContent>
          </Card>

          {/* مظهر النظام والألوان */}
          <Card>
            <CardHeader>
              <CardTitle className="font-amiri flex items-center gap-2">
                <Palette className="w-5 h-5 text-primary" />
                {t('مظهر النظام والألوان (Theme Mode)', "Mode d'affichage et thèmes (Theme Mode)", 'Modo de visualización y temas')}
              </CardTitle>
              <CardDescription>
                {t('اختر الوضع المناسب لراحة عينيك أثناء العمل على النظام', 'Choisissez le mode adapté au confort de vos yeux', 'Elija el modo adecuado para su comodidad visual al trabajar en el sistema')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTheme('light');
                    toast({ title: t('☀️ تم تفعيل الوضع الفاتح', '☀️ Mode clair activé', '☀️ Modo claro activado') });
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
                    <p className="font-bold text-sm text-foreground">{t('الوضع الفاتح', 'Mode clair', 'Modo claro')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('مظهر نهاري مشرق وعالي الوضوح', 'Apparence claire et lumineuse', 'Aspecto diurno brillante y alta claridad')}
                    </p>
                  </div>
                  {theme === 'light' && (
                    <span className="inline-block px-2 py-0.5 text-[11px] font-semibold bg-primary text-white rounded-full">
                      {t('مفعّل', 'Activé', 'Activado')}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTheme('dark');
                    toast({ title: t('🌙 تم تفعيل الوضع الداكن', '🌙 Mode sombre activé', '🌙 Modo oscuro activado') });
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
                    <p className="font-bold text-sm text-foreground">{t('الوضع الداكن', 'Mode sombre', 'Modo oscuro')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('مريح للعينين في الإضاءة الخافتة', 'Confortable pour les yeux', 'Cómodo para la vista en ambientes con poca luz')}
                    </p>
                  </div>
                  {theme === 'dark' && (
                    <span className="inline-block px-2 py-0.5 text-[11px] font-semibold bg-primary text-white rounded-full">
                      {t('مفعّل', 'Activé', 'Activado')}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTheme('system');
                    toast({ title: t('🖥️ تم تفعيل المزامنة مع النظام', '🖥️ Synchronisation avec le système activée', '🖥️ Sincronización con el sistema activada') });
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
                    <p className="font-bold text-sm text-foreground">{t('تلقائي (حسب جهازك)', 'Automatique (système)', 'Automático (según su dispositivo)')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('يتغير تلقائياً مع إعدادات جهازك', "S'adapte automatiquement", 'Se adapta automáticamente a la configuración del dispositivo')}
                    </p>
                  </div>
                  {theme === 'system' && (
                    <span className="inline-block px-2 py-0.5 text-[11px] font-semibold bg-primary text-white rounded-full">
                      {t('مفعّل', 'Activé', 'Activado')}
                    </span>
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
                {t('الإعدادات العامة للشركة', "Paramètres généraux de l'entreprise", 'Configuración general de la empresa')}
              </CardTitle>
              <CardDescription>
                {t('البيانات الأساسية التي تظهر في الفواتير ومطبوعات CMR', 'Informations de base pour les factures et documents CMR', 'Datos básicos que aparecen en facturas e impresiones CMR')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('اسم الشركة', "Nom de l'entreprise", 'Nombre de la empresa')}</label>
                <Input
                  value={settings.company_name}
                  onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                  placeholder={t('مثال: شركة النقل الدولي واللوجستيك', 'Ex: Société de Transport International', 'Ej: Empresa de Transporte Internacional y Logística')}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('التعريف الموحد للمقاولة (ICE)', "Identifiant Commun de l'Entreprise (ICE)", 'Identificador Común de la Empresa (ICE)')}</label>
                  <Input
                    value={settings.ice}
                    onChange={(e) => setSettings({ ...settings, ice: e.target.value })}
                    placeholder="000123456789000"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('العملة الافتراضية للشركة', 'Devise par défaut', 'Moneda predeterminada de la empresa')}</label>
                  <Input
                    value={settings.currency}
                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                    placeholder="MAD"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* شعار الشركة */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('شعار الشركة', "Logo de l'entreprise", 'Logotipo de la empresa')}</label>
                <p className="text-xs text-muted-foreground">
                  {t(
                    'يظهر في أعلى القائمة الجانبية وفي جميع ملفات PDF الصادرة عن الشركة',
                    'Affiché en haut du menu latéral et sur les documents PDF émis',
                    'Aparece en la parte superior del menú lateral y en todos los documentos PDF emitidos'
                  )}
                </p>
                <div className="flex items-center gap-4">
                  <div className="relative w-24 h-24 rounded-xl border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {settings.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={settings.logo_url}
                        alt={t('شعار الشركة', "Logo de l'entreprise", 'Logotipo de la empresa')}
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
                      {settings.logo_url ? t('تغيير الشعار', 'Changer le logo', 'Cambiar logotipo') : t('رفع شعار', 'Télécharger un logo', 'Subir logotipo')}
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
                        {t('حذف الشعار', 'Supprimer le logo', 'Eliminar logotipo')}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('نسبة الضريبة الافتراضية TVA (%)', 'Taux de TVA par défaut (%)', 'Tasa de IVA predeterminada (%)')}</label>
                  <Input
                    type="number"
                    value={settings.default_tva_rate}
                    onChange={(e) => setSettings({ ...settings, default_tva_rate: e.target.value })}
                    placeholder="20"
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground">{t('تُطبق هذه النسبة تلقائياً على جميع العملاء الخاضعين للضريبة', 'Ce taux est appliqué par défaut aux clients assujettis', 'Esta tasa se aplica por defecto a todos los clientes sujetos a impuestos')}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t('نسبة ربح المالك (%)', 'Part de profit du propriétaire (%)', 'Participación en el beneficio del propietario (%)')}</label>
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
                <label className="text-sm font-medium text-foreground">{t('معرف الحساب البنكي الافتراضي', 'ID du compte bancaire par défaut', 'ID de cuenta bancaria predeterminada')}</label>
                <Input
                  type="number"
                  value={settings.default_bank_account_id}
                  onChange={(e) => setSettings({ ...settings, default_bank_account_id: e.target.value })}
                  placeholder={t('معرف الحساب البنكي', 'Identifiant compte bancaire', 'ID de cuenta bancaria')}
                  dir="ltr"
                />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                <Save className="w-4 h-4 ml-2" />
                {saving ? t('جاري الحفظ...', 'Enregistrement en cours...', 'Guardando...') : t('حفظ الإعدادات', 'Enregistrer les paramètres', 'Guardar configuración')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-primary ms-2" />
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
