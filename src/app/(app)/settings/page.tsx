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
  Mail,
  Server,
  Key,
  Eye,
  EyeOff,
  Wifi,
  CheckCheck,
  ShieldAlert,
  Send,
  Compass,
  Ship,
  Globe2,
  Coins,
} from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { useLanguage } from '@/components/language-provider';
import { useAuth } from '@/components/auth-provider';
import {
  testCompanyEmailConnectionAction,
  testCompanyTelegramConnectionAction,
  updateCompanyEmailSettingsAction,
} from '@/features/super-admin/services/company.actions';
import type { MailProviderType, CompanyCorridorScope } from '@/types/database';

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
    corridor_scope: 'dual' as CompanyCorridorScope,
    enabled_currencies: ['MAD', 'EUR', 'MRU', 'XOF'] as string[],
    multi_currency_enabled: true,
    logo_url: null as string | null,
    owner_profit_share: '0',
    default_bank_account_id: '',
    default_tva_rate: '20',
  });
  const [emailSettings, setEmailSettings] = useState<{
    email_domain: string;
    mail_provider: MailProviderType;
    smtp_host: string;
    smtp_port: string;
    imap_host: string;
    imap_port: string;
    email_user: string;
    email_password: string;
    has_email_password: boolean;
    alert_phone: string;
    alert_email: string;
    telegram_chat_id: string;
  }>({
    email_domain: '',
    mail_provider: 'cpanel',
    smtp_host: '',
    smtp_port: '465',
    imap_host: '',
    imap_port: '993',
    email_user: '',
    email_password: '',
    has_email_password: false,
    alert_phone: '',
    alert_email: '',
    telegram_chat_id: '',
  });
  const [showMailPassword, setShowMailPassword] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
  } | null>(null);
  const [savingMail, setSavingMail] = useState(false);

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
          const domainClean = (compData.email_domain || '').replace(/^@+/, '').trim().toLowerCase();
          const prov = (compData.mail_provider || 'cpanel') as MailProviderType;
          setEmailSettings({
            email_domain: domainClean,
            mail_provider: prov,
            smtp_host: compData.smtp_host || (prov === 'hostinger' ? 'smtp.hostinger.com' : prov === 'ovh' ? 'ssl0.ovh.net' : domainClean ? `mail.${domainClean}` : ''),
            smtp_port: String(compData.smtp_port || 465),
            imap_host: compData.imap_host || (prov === 'hostinger' ? 'imap.hostinger.com' : prov === 'ovh' ? 'ssl0.ovh.net' : domainClean ? `mail.${domainClean}` : ''),
            imap_port: String(compData.imap_port || 993),
            email_user: compData.email_user || (domainClean ? `operations@${domainClean}` : ''),
            email_password: compData.email_password ? '••••••••' : '',
            has_email_password: Boolean(compData.email_password),
            alert_phone: compData.alert_phone || (targetCompanyId === 1 ? '212694585307' : ''),
            alert_email: compData.alert_email || compData.email_user || '',
            telegram_chat_id: compData.telegram_chat_id || (targetCompanyId === 1 ? '-100192837465' : ''),
          });
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

      const resolvedCorridorScope = (fetchedCompany?.corridor_scope ||
        data?.corridor_scope ||
        company?.corridor_scope ||
        'dual') as CompanyCorridorScope;

      const resolvedEnabledCurrencies =
        Array.isArray(fetchedCompany?.enabled_currencies) && fetchedCompany.enabled_currencies.length > 0
          ? fetchedCompany.enabled_currencies
          : Array.isArray(data?.enabled_currencies) && data.enabled_currencies.length > 0
            ? data.enabled_currencies
            : Array.isArray(company?.enabled_currencies) && company.enabled_currencies.length > 0
              ? company.enabled_currencies
              : ['MAD', 'EUR', 'MRU', 'XOF'];

      const resolvedMultiCurrency =
        fetchedCompany?.multi_currency_enabled ??
        data?.multi_currency_enabled ??
        company?.multi_currency_enabled ??
        true;

      setSettings({
        company_name: fetchedCompany?.name || data?.company_name || company?.name || '',
        ice: fetchedCompany?.ice || company?.ice || '',
        currency: fetchedCompany?.currency || company?.currency || 'MAD',
        corridor_scope: resolvedCorridorScope,
        enabled_currencies: resolvedEnabledCurrencies,
        multi_currency_enabled: Boolean(resolvedMultiCurrency),
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
        localStorage.setItem('app_corridor_scope', settings.corridor_scope || 'dual');
        localStorage.setItem(
          'app_enabled_currencies',
          JSON.stringify(
            settings.enabled_currencies.length > 0 ? settings.enabled_currencies : [settings.currency || 'MAD']
          )
        );
      }

      const targetCompanyId = companyId || user?.company_id || 1;

      // 1. Save to companies table
      try {
        const companyPayload: Record<string, any> = {
          name: settings.company_name,
          ice: settings.ice,
          currency: settings.currency,
          corridor_scope: settings.corridor_scope || 'dual',
          enabled_currencies:
            settings.enabled_currencies.length > 0 ? settings.enabled_currencies : [settings.currency || 'MAD'],
          multi_currency_enabled: settings.multi_currency_enabled,
          logo_url: settings.logo_url || null,
        };

        const { error: compUpdateErr } = await supabase
          .from('companies')
          .update(companyPayload)
          .eq('id', targetCompanyId);

        if (compUpdateErr) {
          // Fallback to base columns if migration not yet applied on remote DB
          await supabase
            .from('companies')
            .update({
              name: settings.company_name,
              ice: settings.ice,
              currency: settings.currency,
              logo_url: settings.logo_url || null,
            })
            .eq('id', targetCompanyId);
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
        corridor_scope: settings.corridor_scope || 'dual',
        enabled_currencies:
          settings.enabled_currencies.length > 0 ? settings.enabled_currencies : [settings.currency || 'MAD'],
        multi_currency_enabled: settings.multi_currency_enabled,
        updated_at: new Date().toISOString(),
      };

      let { error } = await supabase.from('system_settings').upsert(payload);

      // If a column is not in Supabase schema cache, fallback to saving without it
      if (error && (error.code === 'PGRST204' || error.message?.includes('column'))) {
        delete payload.corridor_scope;
        delete payload.enabled_currencies;
        delete payload.multi_currency_enabled;
        const retryResult = await supabase.from('system_settings').upsert(payload);
        error = retryResult.error;
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

  const applyTenantProviderDefaults = (provider: MailProviderType) => {
    const clean = emailSettings.email_domain || 'domain.com';
    if (provider === 'cpanel') {
      setEmailSettings((prev) => ({
        ...prev,
        mail_provider: provider,
        smtp_host: `mail.${clean}`,
        smtp_port: '465',
        imap_host: `mail.${clean}`,
        imap_port: '993',
        email_user: prev.email_user || `operations@${clean}`,
      }));
    } else if (provider === 'hostinger') {
      setEmailSettings((prev) => ({
        ...prev,
        mail_provider: provider,
        smtp_host: 'smtp.hostinger.com',
        smtp_port: '465',
        imap_host: 'imap.hostinger.com',
        imap_port: '993',
        email_user: prev.email_user || `operations@${clean}`,
      }));
    } else if (provider === 'ovh') {
      setEmailSettings((prev) => ({
        ...prev,
        mail_provider: provider,
        smtp_host: 'ssl0.ovh.net',
        smtp_port: '465',
        imap_host: 'ssl0.ovh.net',
        imap_port: '993',
        email_user: prev.email_user || `operations@${clean}`,
      }));
    } else {
      setEmailSettings((prev) => ({ ...prev, mail_provider: provider }));
    }
  };

  const handleTestTenantEmailConnection = async () => {
    const targetCompanyId = companyId || user?.company_id || 1;
    if (!emailSettings.smtp_host) {
      toast({ title: 'مضيف SMTP مطلوب', variant: 'destructive' });
      return;
    }
    if (!emailSettings.email_user) {
      toast({ title: 'البريد الإلكتروني مطلوب', variant: 'destructive' });
      return;
    }

    setTestingConnection(true);
    setTestResult(null);

    const res = await testCompanyEmailConnectionAction({
      companyId: targetCompanyId,
      mail_provider: emailSettings.mail_provider,
      smtp_host: emailSettings.smtp_host,
      smtp_port: parseInt(emailSettings.smtp_port, 10) || 465,
      imap_host: emailSettings.imap_host || null,
      imap_port: parseInt(emailSettings.imap_port, 10) || 993,
      email_user: emailSettings.email_user,
      email_password: emailSettings.email_password || undefined,
    });

    setTestingConnection(false);

    if (res.success) {
      setTestResult({ success: true, message: res.message || '✅ تم التحقق من مصافحة خادم البريد بنجاح!' });
      toast({ title: t('✅ تم الاتصال بنجاح', '✅ Connexion réussie', '✅ Conexión exitosa') });
    } else {
      setTestResult({ success: false, error: res.error || 'تعذر الاتصال بالخادم' });
      toast({ title: t('فشل الاتصال', 'Échec de connexion', 'Error de conexión'), description: res.error, variant: 'destructive' });
    }
  };

  const handleTestTenantTelegramConnection = async () => {
    const targetCompanyId = companyId || user?.company_id || 1;
    if (!emailSettings.telegram_chat_id.trim()) {
      toast({
        title: t(
          'معرف محادثة تيليجرام مطلوب',
          'ID de discussion Telegram requis',
          'ID de chat de Telegram obligatorio'
        ),
        variant: 'destructive',
      });
      return;
    }

    setTestingTelegram(true);
    setTelegramTestResult(null);

    const res = await testCompanyTelegramConnectionAction({
      companyId: targetCompanyId,
      companyName: settings.company_name || company?.name || 'TransSalges',
      telegram_chat_id: emailSettings.telegram_chat_id.trim(),
    });

    setTestingTelegram(false);

    if (res.success) {
      setTelegramTestResult({
        success: true,
        message: res.message || '✅ تم إرسال إشعار الاختبار عبر تيليجرام بنجاح!',
      });
      toast({
        title: t(
          '✅ تم إرسال إشعار تيليجرام',
          '✅ Notification Telegram envoyée',
          '✅ Notificación de Telegram enviada'
        ),
        description: res.message,
      });
    } else {
      setTelegramTestResult({
        success: false,
        error: res.error || 'تعذر إرسال إشعار الاختبار عبر تيليجرام',
      });
      toast({
        title: t(
          'فشل اختبار تيليجرام',
          'Échec du test Telegram',
          'Error en la prueba de Telegram'
        ),
        description: res.error,
        variant: 'destructive',
      });
    }
  };

  const handleSaveTenantEmailSettings = async () => {
    const targetCompanyId = companyId || user?.company_id || 1;
    setSavingMail(true);
    try {
      const res = await updateCompanyEmailSettingsAction({
        companyId: targetCompanyId,
        mail_provider: emailSettings.mail_provider,
        smtp_host: emailSettings.smtp_host || null,
        smtp_port: parseInt(emailSettings.smtp_port, 10) || 465,
        imap_host: emailSettings.imap_host || null,
        imap_port: parseInt(emailSettings.imap_port, 10) || 993,
        email_user: emailSettings.email_user || null,
        email_password: emailSettings.email_password || undefined,
        alert_phone: emailSettings.alert_phone || null,
        alert_email: emailSettings.alert_email || null,
        telegram_chat_id: emailSettings.telegram_chat_id || null,
      });

      if (!res.success) {
        toast({
          title: t('فشل حفظ إعدادات البريد', "Échec de l'enregistrement", 'Error al guardar'),
          description: res.error,
          variant: 'destructive',
        });
      } else {
        toast({
          title: t('✅ تم حفظ إعدادات خادم البريد بنجاح', '✅ Paramètres de messagerie enregistrés', '✅ Configuración de correo guardada'),
        });
        setEmailSettings((prev) => ({
          ...prev,
          has_email_password: Boolean(emailSettings.email_password && emailSettings.email_password.trim() !== ''),
          email_password: '••••••••',
        }));
      }
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setSavingMail(false);
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
                  <label className="text-sm font-medium text-foreground">
                    {t('العملة الأساسية الافتراضية للشركة', 'Devise de base par défaut', 'Moneda base predeterminada')}
                  </label>
                  <select
                    value={settings.currency}
                    onChange={(e) => {
                      const nextCurr = e.target.value;
                      setSettings((prev) => ({
                        ...prev,
                        currency: nextCurr,
                        enabled_currencies: prev.enabled_currencies.includes(nextCurr)
                          ? prev.enabled_currencies
                          : [...prev.enabled_currencies, nextCurr],
                      }));
                    }}
                    dir="ltr"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="MAD">MAD — الدرهم المغربي (Dirham Marocain)</option>
                    <option value="EUR">EUR — اليورو الأوروبي (Euro Européen)</option>
                    <option value="MRU">MRU — الأوقية الموريتانية (Ouguiya Mauritanien)</option>
                    <option value="XOF">XOF — فرنك غرب إفريقيا سيفا (Franc CFA BCEAO)</option>
                  </select>
                </div>
              </div>

              {/* 1. التخصيص الجغرافي والتشغيلي للممرات (Corridors Customization) */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
                <div className="flex items-center gap-2">
                  <Compass className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <h4 className="font-bold text-sm text-foreground">
                      {t(
                        '1. التخصيص الجغرافي والتشغيلي للممرات (Corridors Customization)',
                        '1. Personnalisation géographique et opérationnelle des corridors',
                        '1. Personalización geográfica y operativa de corredores'
                      )}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t(
                        'حدد نطاق الممرات الدولية لنشاط شركتك لتكييف حساب رسوم العبّارات والمعابر آلياً',
                        "Définissez le périmètre des corridors internationaux de votre entreprise",
                        'Defina el alcance de los corredores internacionales de su empresa'
                      )}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* الممر الأوروبي فقط */}
                  <button
                    type="button"
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        corridor_scope: 'european_only',
                      }))
                    }
                    className={`p-3 rounded-xl border-2 text-start transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                      settings.corridor_scope === 'european_only'
                        ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/20'
                        : 'border-border bg-card hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400">
                          <Ship className="w-4 h-4" />
                          {t('الممر الأوروبي فقط', 'Corridor Européen seul', 'Solo Corredor Europeo')}
                        </span>
                        {settings.corridor_scope === 'european_only' && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded-full">
                            {t('مفعّل', 'Actif', 'Activo')}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {t(
                          'تخصص حصري بين المغرب وإسبانيا/فرنسا وأوروبا، مع الاحتساب الآلي لرسوم العبّارات والموانئ (طنجة المتوسط، الجزيرة الخضراء، ألميريا).',
                          'Maroc ↔ Espagne/France/Europe avec calcul automatique des frais de ferry et ports (Tanger Med, Algésiras, Almería).',
                          'Marruecos ↔ España/Francia/Europa con cálculo automático de tarifas de ferry y puertos (Tánger Med, Algeciras, Almería).'
                        )}
                      </p>
                    </div>
                  </button>

                  {/* الممر الإفريقي البري فقط */}
                  <button
                    type="button"
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        corridor_scope: 'african_only',
                      }))
                    }
                    className={`p-3 rounded-xl border-2 text-start transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                      settings.corridor_scope === 'african_only'
                        ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/20'
                        : 'border-border bg-card hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                          <Compass className="w-4 h-4" />
                          {t('الممر الإفريقي البري فقط', 'Corridor Africain seul', 'Solo Corredor Africano')}
                        </span>
                        {settings.corridor_scope === 'african_only' && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-600 text-white rounded-full">
                            {t('مفعّل', 'Actif', 'Activo')}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {t(
                          'خطوط التجارة نحو موريتانيا والسنغال وجنوب الصحراء، مع تجاوز العبّارات البحرية وتفعيل رسوم الكركارات وعبّارة روصو والبطاقة البنية (ECOWAS).',
                          'Axes Mauritanie, Sénégal et Afrique subsaharienne (Guerguerat, bac de Rosso, Carte Brune CEDEAO).',
                          'Rutas hacia Mauritania, Senegal y África subsahariana (Guerguerat, ferry de Rosso, Carta Marrón CEDEAO).'
                        )}
                      </p>
                    </div>
                  </button>

                  {/* الممر المزدوج (الممرّين معاً) */}
                  <button
                    type="button"
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        corridor_scope: 'dual',
                      }))
                    }
                    className={`p-3 rounded-xl border-2 text-start transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                      settings.corridor_scope === 'dual'
                        ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20'
                        : 'border-border bg-card hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <Globe2 className="w-4 h-4" />
                          {t('الممر المزدوج (الممرّين معاً)', 'Double Corridor (EU + Afrique)', 'Doble Corredor (UE + África)')}
                        </span>
                        {settings.corridor_scope === 'dual' && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-600 text-white rounded-full">
                            {t('مفعّل', 'Actif', 'Activo')}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {t(
                          'الجمع بين الممرين الأوروبي والإفريقي في آنٍ واحد من نفس لوحة التحكم مع فصل دقيق في تحليل الربحية (P&L) لكل مسار.',
                          'Gestion simultanée des corridors Nord (Europe) et Sud (Afrique) avec séparation analytique P&L.',
                          'Gestión simultánea de los corredores Norte (Europa) y Sur (África) con separación analítica de P&L.'
                        )}
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. التخصيص المالي والعملات (Multi-Currency Customization) */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-amber-500 shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm text-foreground">
                        {t(
                          '2. التخصيص المالي والعملات (Multi-Currency Customization)',
                          '2. Personnalisation financière et multi-devises',
                          '2. Personalización financiera y multimoneda'
                        )}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t(
                          'اختر العملات المفعلة في الفواتير والخزينة ومحرك فروق أسعار الصرف المحققة (Realized Forex Gain/Loss) بدقة Decimal.js',
                          'Sélectionnez les devises actives et le moteur de change réalisé (Realized Forex) avec précision Decimal.js',
                          'Seleccione las monedas activas y el motor de diferencias cambiarias (Realized Forex) con precisión Decimal.js'
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick Currency Presets */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        currency: 'MAD',
                        enabled_currencies: ['MAD'],
                        multi_currency_enabled: false,
                      }))
                    }
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                      settings.enabled_currencies.length === 1 && settings.enabled_currencies[0] === 'MAD'
                        ? 'bg-primary text-white border-primary'
                        : 'bg-card border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    🇲🇦 {t('الدرهم المغربي (MAD) حصرياً', 'MAD uniquement', 'Solo MAD')}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        currency: 'EUR',
                        enabled_currencies: ['EUR'],
                        multi_currency_enabled: false,
                      }))
                    }
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                      settings.enabled_currencies.length === 1 && settings.enabled_currencies[0] === 'EUR'
                        ? 'bg-primary text-white border-primary'
                        : 'bg-card border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    🇪🇺 {t('اليورو (EUR) حصرياً', 'EUR uniquement', 'Solo EUR')}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        enabled_currencies: ['MAD', 'EUR'],
                        multi_currency_enabled: true,
                      }))
                    }
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                      settings.enabled_currencies.length === 2 &&
                      settings.enabled_currencies.includes('MAD') &&
                      settings.enabled_currencies.includes('EUR')
                        ? 'bg-primary text-white border-primary'
                        : 'bg-card border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    🚢 {t('الممر الأوروبي (MAD + EUR)', 'Corridor EU (MAD + EUR)', 'Corredor UE (MAD + EUR)')}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        enabled_currencies: ['MAD', 'MRU', 'XOF'],
                        multi_currency_enabled: true,
                      }))
                    }
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                      settings.enabled_currencies.length === 3 &&
                      settings.enabled_currencies.includes('MAD') &&
                      settings.enabled_currencies.includes('MRU') &&
                      settings.enabled_currencies.includes('XOF')
                        ? 'bg-primary text-white border-primary'
                        : 'bg-card border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    🌍 {t('الممر الإفريقي (MAD + MRU + XOF)', 'Corridor Afrique (MAD + MRU + XOF)', 'Corredor África (MAD + MRU + XOF)')}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        enabled_currencies: ['MAD', 'EUR', 'MRU', 'XOF'],
                        multi_currency_enabled: true,
                      }))
                    }
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                      settings.enabled_currencies.length === 4
                        ? 'bg-primary text-white border-primary'
                        : 'bg-card border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    🌐 {t('التعامل بكل العملات معاً (Multi-Currency Ledgers)', 'Toutes les devises (Multi-Currency Ledgers)', 'Todas las monedas (Multi-Currency Ledgers)')}
                  </button>
                </div>

                {/* Individual Currency Checkboxes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(
                    [
                      {
                        code: 'MAD',
                        flag: '🇲🇦',
                        title: t('الدرهم المغربي (MAD)', 'Dirham Marocain (MAD)', 'Dirham Marroquí (MAD)'),
                        desc: t(
                          'للمعاملات المحلية والدولية المرتبطة بالبنوك المغربية والـ LCN',
                          'Opérations locales et banques marocaines (LCN / SIMT)',
                          'Operaciones locales y bancos marroquíes (LCN / SIMT)'
                        ),
                      },
                      {
                        code: 'EUR',
                        flag: '🇪🇺',
                        title: t('اليورو الأوروبي (EUR)', 'Euro Européen (EUR)', 'Euro Europeo (EUR)'),
                        desc: t(
                          'للتعاملات مع الموردين والمشترين في إسبانيا وفرنسا والاتحاد الأوروبي (SEPA)',
                          'Clients et fournisseurs en Espagne, France et UE (SEPA)',
                          'Clientes y proveedores en España, Francia y UE (SEPA)'
                        ),
                      },
                      {
                        code: 'MRU',
                        flag: '🇲🇷',
                        title: t('الأوقية الموريتانية (MRU)', 'Ouguiya Mauritanien (MRU)', 'Uguiya Mauritano (MRU)'),
                        desc: t(
                          'لمسارات نواذيبو ونواكشوط ورسوم العبور الموريتانية',
                          'Axes Nouadhibou, Nouakchott et frais de transit mauritaniens',
                          'Rutas Nuadibú, Nuakchot y tasas de tránsito mauritanas'
                        ),
                      },
                      {
                        code: 'XOF',
                        flag: '🇸🇳',
                        title: t('فرنك سيفا غرب إفريقيا (XOF)', 'Franc CFA BCEAO (XOF)', 'Franco CFA África Occidental (XOF)'),
                        desc: t(
                          'لمسارات داكار والسنغال ودول المجموعة الاقتصادية لغرب إفريقيا (ECOWAS)',
                          'Axes Dakar, Sénégal et zone CEDEAO / UEMOA',
                          'Rutas Dakar, Senegal y zona CEDEAO / UEMOA'
                        ),
                      },
                    ] as const
                  ).map((item) => {
                    const isChecked = settings.enabled_currencies.includes(item.code);
                    return (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => {
                          setSettings((prev) => {
                            const exists = prev.enabled_currencies.includes(item.code);
                            const nextList = exists
                              ? prev.enabled_currencies.filter((c) => c !== item.code)
                              : [...prev.enabled_currencies, item.code];
                            const safeList = nextList.length > 0 ? nextList : [prev.currency || 'MAD'];
                            return {
                              ...prev,
                              enabled_currencies: safeList,
                              multi_currency_enabled: safeList.length > 1 ? true : prev.multi_currency_enabled,
                            };
                          });
                        }}
                        className={`p-2.5 rounded-xl border text-start transition-all cursor-pointer flex items-start gap-2.5 ${
                          isChecked
                            ? 'border-primary bg-primary/10 shadow-xs'
                            : 'border-border bg-card opacity-75 hover:opacity-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          readOnly
                          className="mt-1 rounded border-input accent-primary h-4 w-4 pointer-events-none"
                        />
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-foreground">
                            {item.flag} {item.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground leading-snug">{item.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Multi-Currency Ledgers & Realized Forex Toggle */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border cursor-pointer">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-foreground block">
                      {t(
                        'تفعيل دفاتر الأستاذ متعددة العملات وفروق الصرف المحققة (Realized Forex Gain/Loss)',
                        'Activer les grands livres multi-devises et écarts de change réalisés (Realized Forex)',
                        'Activar libros mayores multimoneda y diferencias de cambio realizadas (Realized Forex)'
                      )}
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      {t(
                        'متابعة الخزينة والسيولة بكل عملة على حدة مع احتساب آلي لأرباح وخسائر الصرف بدقة Decimal.js المطلقة',
                        'Suivi de la trésorerie par devise avec calcul automatique des gains/pertes de change via Decimal.js',
                        'Seguimiento de tesorería por moneda con cálculo automático de ganancias/pérdidas cambiarias vía Decimal.js'
                      )}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.multi_currency_enabled}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        multi_currency_enabled: e.target.checked,
                      }))
                    }
                    className="rounded border-input accent-primary h-4 w-4 shrink-0 ms-3 cursor-pointer"
                  />
                </label>
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
                {saving ? t('جاري الحفظ...', 'Enregistrement en cours...', 'Guardando...') : t('حفظ الإعدادات', 'Enregistrer les paramètres', 'Guardar configuration')}
              </Button>
            </CardContent>
          </Card>

          {/* إعدادات خادم البريد والمراسلات (Admin Email Settings) */}
          {(user?.role === 'admin' || user?.role === 'super_admin') && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-5 h-5 text-primary" />
                    <div>
                      <CardTitle className="font-amiri text-base">
                        {t('إعدادات خادم البريد والمراسلات (SMTP & IMAP)', 'Configuration du serveur de messagerie', 'Configuración del servidor de correo')}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {t(
                          'تخصيص ومراجعة خادم البريد الخاص بشركتك لإرسال الإشعارات واستقبال رسائل الرحلات',
                          'Personnalisez le serveur de messagerie de votre entreprise',
                          'Personalice el servidor de correo de su empresa'
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20">
                    @{emailSettings.email_domain || 'transsalges.com'}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                {/* Mail Provider Selection */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    {t('مزود الخدمة المعتمد', 'Fournisseur de messagerie', 'Proveedor de correo')}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(
                      [
                        { id: 'cpanel', label: 'cPanel (تلقائي)' },
                        { id: 'hostinger', label: 'Hostinger' },
                        { id: 'ovh', label: 'OVH Telecom' },
                        { id: 'custom', label: 'مخصص (Custom)' },
                      ] as const
                    ).map((prov) => (
                      <button
                        key={prov.id}
                        type="button"
                        onClick={() => applyTenantProviderDefaults(prov.id)}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          emailSettings.mail_provider === prov.id
                            ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                            : 'border-border bg-card text-muted-foreground hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <p className="font-bold text-xs">{prov.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* SMTP Server & Port */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <Server className="w-3.5 h-3.5 text-sky-500" />
                      <span>{t('خادم إرسال البريد (SMTP Host)', "Serveur d'envoi SMTP", 'Servidor de envío SMTP')}</span>
                    </label>
                    <Input
                      value={emailSettings.smtp_host}
                      onChange={(e) => setEmailSettings({ ...emailSettings, smtp_host: e.target.value })}
                      placeholder="mail.domain.com"
                      dir="ltr"
                      className="rounded-xl h-10 font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      {t('منفذ SMTP', 'Port SMTP', 'Puerto SMTP')}
                    </label>
                    <Input
                      type="number"
                      value={emailSettings.smtp_port}
                      onChange={(e) => setEmailSettings({ ...emailSettings, smtp_port: e.target.value })}
                      placeholder="465"
                      dir="ltr"
                      className="rounded-xl h-10 font-mono text-xs"
                    />
                  </div>
                </div>

                {/* IMAP Server & Port */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <Server className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{t('خادم استقبال البريد (IMAP Host)', 'Serveur de réception IMAP', 'Servidor de recepción IMAP')}</span>
                    </label>
                    <Input
                      value={emailSettings.imap_host}
                      onChange={(e) => setEmailSettings({ ...emailSettings, imap_host: e.target.value })}
                      placeholder="mail.domain.com"
                      dir="ltr"
                      className="rounded-xl h-10 font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      {t('منفذ IMAP', 'Port IMAP', 'Puerto IMAP')}
                    </label>
                    <Input
                      type="number"
                      value={emailSettings.imap_port}
                      onChange={(e) => setEmailSettings({ ...emailSettings, imap_port: e.target.value })}
                      placeholder="993"
                      dir="ltr"
                      className="rounded-xl h-10 font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Email User & Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      {t('البريد التشغيلي (Email User)', 'Adresse email opérationnelle', 'Correo operativo')}
                    </label>
                    <Input
                      value={emailSettings.email_user}
                      onChange={(e) => setEmailSettings({ ...emailSettings, email_user: e.target.value })}
                      placeholder="operations@domain.com"
                      dir="ltr"
                      className="rounded-xl h-10 font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                        <Key className="w-3.5 h-3.5 text-amber-500" />
                        <span>{t('كلمة مرور البريد', 'Mot de passe de messagerie', 'Contraseña de correo')}</span>
                      </label>
                      <span className="text-[10px] text-muted-foreground">
                        {emailSettings.has_email_password ? t('(محفوظة ومقنعة)', '(enregistré)', '(guardado)') : t('(غير محددة)', '(vide)', '(vacío)')}
                      </span>
                    </div>
                    <div className="relative flex items-center" dir="ltr">
                      <Input
                        type={showMailPassword ? 'text' : 'password'}
                        value={emailSettings.email_password}
                        onChange={(e) => setEmailSettings({ ...emailSettings, email_password: e.target.value })}
                        placeholder={emailSettings.has_email_password ? 'اتركه فارغاً للإبقاء عليها' : 'أدخل كلمة المرور'}
                        className="rounded-xl h-10 font-mono text-xs pr-8"
                      />
                      <button
                        type="button"
                        onClick={() => setShowMailPassword(!showMailPassword)}
                        className="absolute right-2.5 text-muted-foreground hover:text-foreground"
                      >
                        {showMailPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Telegram Bot & Alert Channels Section */}
                <div className="p-3.5 rounded-xl bg-sky-500/5 border border-sky-500/20 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                        <Send className="w-3.5 h-3.5 text-sky-500" />
                        <span>
                          {t(
                            'قناة بوت تيليجرام السحابية وتنبيهات الإدارة (Telegram Bot & Alerts)',
                            'Canal Telegram Bot & Alertes Direction',
                            'Canal Telegram Bot y Alertas de Dirección'
                          )}
                        </span>
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {t(
                          'معرف مجموعة عمليات الشركة لاستقبال إشعارات الرحلات والتقارير الصباحية وتفعيل أوامر /track و /reefer',
                          'ID du groupe Telegram pour recevoir les alertes et utiliser /track et /reefer',
                          'ID del grupo de Telegram para recibir alertas y usar /track y /reefer'
                        )}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={testingTelegram}
                      onClick={handleTestTenantTelegramConnection}
                      className="rounded-xl h-8 px-3 text-xs gap-1.5 font-bold bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 border border-sky-500/30 shrink-0"
                    >
                      {testingTelegram ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {testingTelegram
                          ? t('جاري إرسال الاختبار...', 'Envoi du test...', 'Enviando prueba...')
                          : t('اختبار إشعار تيليجرام فوري', 'Tester notification Telegram', 'Probar notificación Telegram')}
                      </span>
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-foreground">
                        {t('معرف مجموعة تيليجرام (telegram_chat_id)', 'Telegram Chat ID du groupe', 'Telegram Chat ID del grupo')}
                      </label>
                      <Input
                        value={emailSettings.telegram_chat_id}
                        onChange={(e) =>
                          setEmailSettings({ ...emailSettings, telegram_chat_id: e.target.value })
                        }
                        placeholder="-100192837465"
                        dir="ltr"
                        className="rounded-xl h-10 font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-foreground">
                        {t('رقم واتساب تنبيهات الإدارة (alert_phone)', 'Numéro WhatsApp Direction', 'Número WhatsApp Dirección')}
                      </label>
                      <Input
                        value={emailSettings.alert_phone}
                        onChange={(e) =>
                          setEmailSettings({ ...emailSettings, alert_phone: e.target.value })
                        }
                        placeholder="212694585307"
                        dir="ltr"
                        className="rounded-xl h-10 font-mono text-xs"
                      />
                    </div>
                  </div>

                  {telegramTestResult && (
                    <div
                      className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                        telegramTestResult.success
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      {telegramTestResult.success ? (
                        <CheckCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                      ) : (
                        <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                      )}
                      <span className="leading-snug">
                        {telegramTestResult.message || telegramTestResult.error}
                      </span>
                    </div>
                  )}
                </div>

                {/* Test Connection Banner */}
                {testResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      testResult.success
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                    )}
                    <span className="leading-snug">{testResult.message || testResult.error}</span>
                  </div>
                )}

                {/* Buttons: Test Handshake & Save */}
                <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={testingConnection}
                    onClick={handleTestTenantEmailConnection}
                    className="w-full sm:w-auto rounded-xl gap-2 text-xs font-bold"
                  >
                    {testingConnection ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Wifi className="w-4 h-4 text-primary" />
                    )}
                    <span>{testingConnection ? t('جاري اختبار المصافحة...', 'Test en cours...', 'Probando...') : t('اختبار الاتصال بالخادم', 'Tester la connexion', 'Probar conexión')}</span>
                  </Button>
                  <Button
                    type="button"
                    disabled={savingMail}
                    onClick={handleSaveTenantEmailSettings}
                    className="w-full sm:flex-1 rounded-xl gap-2 font-bold text-xs"
                  >
                    {savingMail ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>{savingMail ? t('جاري الحفظ...', 'Enregistrement...', 'Guardando...') : t('حفظ إعدادات خادم البريد', 'Enregistrer les paramètres de messagerie', 'Guardar configuración de correo')}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
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
