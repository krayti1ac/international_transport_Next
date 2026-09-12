'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Save, Building, PlaneTakeoff, PlaneLanding, Upload, Sparkles, Trash2, MapPin, Receipt, ChevronsUpDown, ChevronsDownUp } from 'lucide-react';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { GpsLinkInput } from '@/components/ui/gps-link-input';
import { useLanguage } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { validateICE } from '@/lib/bulk-import';
import type { Client } from '@/types/database';
import { ClientAvatar } from '@/components/clients/ClientAvatar';
import { PRESET_CLIENT_LOGOS, resolveClientLogo } from '@/lib/client-photos';
import { compressImageFile } from '@/lib/driver-photos';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (clientData: Partial<Client>) => Promise<void>;
  initialData?: Client | null;
}

const defaultFormData: Partial<Client> = {
  name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  ice: '',
  currency: 'MAD',
  client_type: 'export',
  is_active: true,
  invoice_with_tva: true,
  tva_rate: '20',
  shipping_address_line1: '',
  shipping_city: '',
  shipping_postal_code: '',
  shipping_country: 'Morocco',
  billing_address_line1: '',
  billing_city: '',
  billing_postal_code: '',
  billing_country: 'Morocco',
  logo_url: '',
  loading_gps_url: '',
  unloading_gps_url: '',
};

type ClientSectionId = 'gps' | 'logo' | 'tax';

export function ClientFormModal({ isOpen, onClose, onSave, initialData }: ClientModalProps) {
  const { t, dir } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<Partial<Client>>(initialData || defaultFormData);

  // إدارة قسم واحد نشط فقط (Mutual Exclusion Accordion)
  const [activeSection, setActiveSection] = useState<ClientSectionId | null>(null);

  const toggleSection = (section: ClientSectionId) => {
    setActiveSection((prev) => (prev === section ? null : section));
  };

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        const resolvedLogo = initialData.logo_url || resolveClientLogo(initialData) || '';
        setFormData({
          ...defaultFormData,
          ...initialData,
          logo_url: resolvedLogo,
          loading_gps_url: initialData.loading_gps_url || '',
          unloading_gps_url: initialData.unloading_gps_url || '',
        });
      } else {
        setFormData(defaultFormData);
      }
      setShowPresets(false);
      setActiveSection(null);
    }
  }, [initialData, isOpen]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: t('نوع الملف غير مدعوم', 'Type de fichier non supporté'),
        description: t('يرجى اختيار صورة صالحة (PNG, JPG, WebP)', 'Veuillez sélectionner une image valide (PNG, JPG, WebP)'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setCompressing(true);
      const dataUrl = await compressImageFile(file, 320, 0.85);
      setFormData((prev) => ({ ...prev, logo_url: dataUrl }));
      toast({
        title: t('تم تحميل الشعار بنجاح', 'Logo chargé avec succès'),
      });
    } catch {
      toast({
        title: t('فشل في معالجة الشعار', 'Échec du traitement du logo'),
        variant: 'destructive',
      });
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelectPreset = (url: string) => {
    setFormData((prev) => ({ ...prev, logo_url: url }));
    setShowPresets(false);
    toast({
      title: t('تم اختيار الشعار', 'Logo sélectionné'),
    });
  };

  const handleRemoveLogo = () => {
    setFormData((prev) => ({ ...prev, logo_url: '' }));
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.ice && formData.ice.trim() !== '') {
      const iceResult = validateICE(formData.ice);
      if (!iceResult.valid) {
        toast({
          title: t('رقم ICE غير صحيح', 'Numéro ICE invalide'),
          description: iceResult.message || t('يجب أن يتكون رقم ICE من 15 رقماً بالضبط.', 'Le numéro ICE doit comporter exactement 15 chiffres.'),
          variant: 'destructive',
        });
        return;
      }
    }

    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
      <Card className="w-full max-w-2xl my-8 shadow-2xl border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <CardTitle className="font-amiri text-xl flex items-center gap-2 text-foreground">
            <Building className="w-5 h-5 text-primary" />
            {initialData ? t('تعديل بيانات العميل', 'Modifier les informations du client') : t('إضافة عميل جديد', 'Ajouter un nouveau client')}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>

        {/* شريط التحكم بالطي والتمدد مع تلميح السلوك المنسق */}
        <div className="flex items-center justify-between px-6 py-2 border-b border-border/50 bg-muted/20 text-xs text-muted-foreground">
          <span className="text-[11px]">
            {t('أقسام ثانوية قابلة للطي (فتح قسم يطوي القسم السابق تلقائياً):', 'Sections repliables (l\'ouverture d\'une section replie la précédente) :')}
          </span>
          <button
            type="button"
            onClick={() => setActiveSection((prev) => (prev ? null : 'gps'))}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition-colors border border-primary/25 cursor-pointer shadow-2xs"
          >
            {activeSection ? (
              <>
                <ChevronsDownUp className="w-3.5 h-3.5" />
                <span>{t('طي القسم المفتوح', 'Replier la section')}</span>
              </>
            ) : (
              <>
                <ChevronsUpDown className="w-3.5 h-3.5" />
                <span>{t('فتح إحداثيات GPS', 'Ouvrir GPS')}</span>
              </>
            )}
          </button>
        </div>

        <CardContent className="pt-4 max-h-[80vh] overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4" dir={dir}>

            {/* نوع الرحلات: ذهاب أو عودة حصرياً */}
            {/* نوع الرحلات: ذهاب أو عودة حصرياً (مباشر دائماً) */}
            <div className="space-y-2 p-3 bg-muted/40 border border-border rounded-xl">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <span>{t('تخصيص العميل للرحلات *', 'Affectation du client aux trajets *')}</span>
                  <span className="text-[11px] font-normal text-muted-foreground">{t('(ذهاب أو عودة فقط — لا يمكن الجمع بينهما)', '(Aller ou retour uniquement — exclusif)')}</span>
                </label>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  (formData.client_type || 'export') === 'export'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
                    : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25'
                }`}>
                  {(formData.client_type || 'export') === 'export' ? t('عميل رحلات الذهاب', 'Client Trajets Aller') : t('عميل رحلات العودة', 'Client Trajets Retour')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* خيار رحلات الذهاب */}
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, client_type: 'export' })}
                  className={`p-3 rounded-lg border-2 text-start transition-all flex flex-col gap-1 cursor-pointer ${
                    (formData.client_type || 'export') === 'export'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100 shadow-xs'
                      : 'border-border bg-card hover:bg-accent text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm flex items-center gap-1.5 text-foreground">
                      <PlaneTakeoff className="w-4 h-4 text-emerald-600" />
                      {t('رحلات الذهاب (تصدير - Aller)', 'Trajets Aller (Export)')}
                    </span>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      (formData.client_type || 'export') === 'export' ? 'border-emerald-600 bg-emerald-600' : 'border-muted-foreground'
                    }`}>
                      {(formData.client_type || 'export') === 'export' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t('شحنات التصدير المتوجهة من المغرب إلى أوروبا', 'Expéditions export du Maroc vers l\'Europe')}
                  </p>
                </button>

                {/* خيار رحلات العودة */}
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, client_type: 'import' })}
                  className={`p-3 rounded-lg border-2 text-start transition-all flex flex-col gap-1 cursor-pointer ${
                    formData.client_type === 'import'
                      ? 'border-blue-500 bg-blue-500/10 text-blue-950 dark:text-blue-100 shadow-xs'
                      : 'border-border bg-card hover:bg-accent text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm flex items-center gap-1.5 text-foreground">
                      <PlaneLanding className="w-4 h-4 text-blue-600" />
                      {t('رحلات العودة (استيراد - Retour)', 'Trajets Retour (Import)')}
                    </span>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      formData.client_type === 'import' ? 'border-blue-600 bg-blue-600' : 'border-muted-foreground'
                    }`}>
                      {formData.client_type === 'import' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t('شحنات الاستيراد المتوجهة من أوروبا إلى المغرب', 'Expéditions import d\'Europe vers le Maroc')}
                  </p>
                </button>
              </div>
            </div>

            {/* الحقول الأساسية للعميل */}
            {/* الحقول الأساسية للعميل - دائماً ظاهرة */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t('اسم الشركة / العميل *', 'Nom de l\'entreprise / client *')}</label>
                <Input
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('شركة النقل والتوزيع...', 'Société de transport...')}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t('رقم الهاتف *', 'Numéro de téléphone *')}</label>
                <Input
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+212600000000"
                  required
                  dir="ltr"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t('المدينة *', 'Ville *')}</label>
                <Input
                  value={formData.city || ''}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder={t('الدار البيضاء / طنجة / مدريد', 'Casablanca / Tanger / Madrid')}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t('البريد الإلكتروني', 'Email')}</label>
                <Input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="client@domain.com"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{t('العنوان الرئيسي', 'Adresse principale')}</label>
              <Input
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder={t('العنوان الكامل للشركة أو المستودع...', 'Adresse complète de l\'entreprise...')}
              />
            </div>

            {/* الأقسام القابلة للطي بنظام الأكورديون (قسم واحد نشط فقط) */}
            <div className="space-y-3 pt-2">
              {/* 1. إحداثيات ومواقع GPS عبر روابط خرائط جوجل (WhatsApp Links) */}
              <CollapsibleSection
                title={t('مواقع التحميل والتفريغ GPS (روابط واتساب)', 'Localisations GPS Chargement / Déchargement')}
                subtitle={t('روابط خرائط Google كما يرسلها العميل عبر واتساب لتوجيه السائقين مباشرة', 'Liens Google Maps WhatsApp pour le guidage des chauffeurs')}
                icon={<MapPin className="w-4 h-4 text-rose-500" />}
                variant="rose"
                isOpen={activeSection === 'gps'}
                onToggle={() => toggleSection('gps')}
                badge={
                  formData.loading_gps_url || formData.unloading_gps_url ? (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/25">
                      ✓ {t('تم حفظ مواقع GPS', 'GPS configuré')}
                    </span>
                  ) : null
                }
              >
                <div className="space-y-4 p-3 bg-muted/40 border border-border rounded-xl">
                  {/* موقع الشحن / التحميل */}
                  <GpsLinkInput
                    id="client-loading-gps"
                    label={t('رابط GPS موقع التحميل والشحن (Loading Location)', 'Lien GPS lieu de chargement')}
                    value={formData.loading_gps_url || ''}
                    onChange={(val) => setFormData({ ...formData, loading_gps_url: val })}
                    placeholder="https://maps.app.goo.gl/aWf5HSKLVguTqTcn7"
                    description={t(
                      'رابط خرائط Google لموقع شحن وتحميل بضاعة هذا العميل (يرسلها العميل عبر الواتساب)',
                      'Lien Google Maps du lieu de chargement envoyé par le client via WhatsApp'
                    )}
                  />

                  {/* موقع التفريغ والتسليم */}
                  <GpsLinkInput
                    id="client-unloading-gps"
                    label={t('رابط GPS موقع التفريغ والتسليم (Unloading Location)', 'Lien GPS lieu de déchargement')}
                    value={formData.unloading_gps_url || ''}
                    onChange={(val) => setFormData({ ...formData, unloading_gps_url: val })}
                    placeholder="https://maps.app.goo.gl/wYZcQsTCP2ymKpQL6"
                    description={t(
                      'رابط خرائط Google لمستودع أو نقطة تفريغ بضاعة هذا العميل (يرسلها العميل عبر الواتساب)',
                      'Lien Google Maps du lieu de déchargement envoyé par le client via WhatsApp'
                    )}
                  />
                </div>
              </CollapsibleSection>

              {/* 2. شعار وهوية العميل */}
              <CollapsibleSection
                title={t('شعار أو صورة العميل', 'Logo ou image du client')}
                subtitle={t('رفع شعار مخصص أو اختيار من النماذج القطاعية الجاهزة', 'Téléversez un logo ou choisissez un modèle')}
                icon={<Sparkles className="w-4 h-4 text-amber-500" />}
                variant="amber"
                isOpen={activeSection === 'logo'}
                onToggle={() => toggleSection('logo')}
                badge={
                  formData.logo_url ? (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                      ✓ {t('تم تحديد الشعار', 'Logo défini')}
                    </span>
                  ) : null
                }
              >
                <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-3">
                  <div className="flex items-center gap-4">
                    <ClientAvatar
                      name={formData.name || 'عميل'}
                      logoUrl={formData.logo_url}
                      size="xl"
                      shape="rounded"
                      className="ring-2 ring-border shadow-xs shrink-0"
                    />

                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={compressing}
                          onClick={() => fileInputRef.current?.click()}
                          className="gap-1.5 text-xs h-8"
                        >
                          <Upload className="w-3.5 h-3.5 text-primary" />
                          <span>
                            {compressing
                              ? t('جاري المعالجة...', 'Traitement...')
                              : t('رفع شعار من الجهاز', 'Importer un logo')}
                          </span>
                        </Button>

                        <Button
                          type="button"
                          variant={showPresets ? 'secondary' : 'outline'}
                          size="sm"
                          onClick={() => setShowPresets(!showPresets)}
                          className="gap-1.5 text-xs h-8"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>{t('نماذج شعارات جاهزة', 'Logos prédéfinis')}</span>
                        </Button>

                        {formData.logo_url && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleRemoveLogo}
                            className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2"
                          >
                            <Trash2 className="w-3.5 h-3.5 me-1" />
                            {t('إزالة', 'Supprimer')}
                          </Button>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {t('يدعم PNG, JPG, WebP. يتم ضغط الصورة تلقائياً.', 'PNG, JPG, WebP supportés. Compression automatique.')}
                      </p>
                    </div>
                  </div>

                  {/* معرض الشعارات الجاهزة */}
                  {showPresets && (
                    <div className="pt-2 border-t border-border/60">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        {t('اختر نموذج شعار قطاعي:', 'Choisissez un modèle sectoriel :')}
                      </p>
                      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                        {PRESET_CLIENT_LOGOS.map((preset) => {
                          const isSelected = formData.logo_url === preset.url;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => handleSelectPreset(preset.url)}
                              className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all hover:scale-105 cursor-pointer ${
                                isSelected
                                  ? 'border-primary bg-primary/10 ring-2 ring-primary'
                                  : 'border-border bg-card hover:border-muted-foreground/40'
                              }`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={preset.url}
                                alt={preset.label}
                                className="w-10 h-10 rounded-md object-contain bg-white/60 p-0.5"
                              />
                              <span className="text-[10px] text-center text-foreground font-medium truncate w-full">
                                {preset.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleSection>

              {/* 3. البيانات الضريبية والمالية */}
              <CollapsibleSection
                title={t('البيانات الضريبية والمالية وحالة الحساب', 'Fiscalité & Facturation')}
                subtitle={t('رقم التعريف الضريبي (ICE)، عملة الفوترة، تطبيق الضريبة، وحالة العميل', 'ICE, Devise, TVA et Statut')}
                icon={<Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                variant="blue"
                isOpen={activeSection === 'tax'}
                onToggle={() => toggleSection('tax')}
                badge={
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25">
                    {formData.currency || 'MAD'}{' '}
                    • {formData.invoice_with_tva !== false ? t('ضريبة مفعلة', 'TVA') : t('معفى', 'Sans TVA')}{' '}
                    • {formData.is_active !== false ? t('نشط', 'Actif') : t('متوقف', 'Inactif')}
                  </span>
                }
              >
                <div className="space-y-3 p-3 bg-muted/40 border border-border rounded-xl">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('رقم التعريف الضريبي (ICE)', 'Identifiant fiscal (ICE)')}</label>
                    <Input
                      value={formData.ice || ''}
                      onChange={(e) => setFormData({ ...formData, ice: e.target.value })}
                      placeholder="002345678000091"
                      dir="ltr"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">{t('عملة الفوترة الافتراضية', 'Devise de facturation')}</label>
                      <select
                        value={formData.currency || 'MAD'}
                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                        className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                      >
                        <option value="MAD">{t('MAD (درهم مغربي)', 'MAD (Dirham marocain)')}</option>
                        <option value="EUR">{t('EUR (يورو)', 'EUR (Euro)')}</option>
                        <option value="USD">{t('USD (دولار)', 'USD (Dollar)')}</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">{t('تطبيق الضريبة (TVA)', 'Application de la TVA')}</label>
                      <select
                        value={formData.invoice_with_tva !== false ? 'true' : 'false'}
                        onChange={(e) => setFormData({ ...formData, invoice_with_tva: e.target.value === 'true' })}
                        className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                      >
                        <option value="true">{t('خاضع للضريبة (مفعلة)', 'Assujetti à la TVA (Actif)')}</option>
                        <option value="false">{t('معفى من الضريبة (غير مفعلة)', 'Exonéré de TVA (Inactif)')}</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">{t('حالة العميل', 'Statut du client')}</label>
                      <select
                        value={formData.is_active ? 'true' : 'false'}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                        className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                      >
                        <option value="true">{t('نشط (Actif)', 'Actif')}</option>
                        <option value="false">{t('غير نشط (Inactif)', 'Inactif')}</option>
                      </select>
                    </div>
                  </div>
                </div>
              </CollapsibleSection>
            </div>

            <div className="flex gap-2 pt-4 border-t border-border">
              <Button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />
                {loading ? t('جاري الحفظ...', 'Enregistrement...') : initialData?.id ? t('تحديث بيانات العميل', 'Mettre à jour le client') : t('حفظ العميل', 'Enregistrer le client')}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                {t('إلغاء', 'Annuler')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
