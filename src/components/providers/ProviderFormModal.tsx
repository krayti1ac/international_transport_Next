'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Save, Wrench, Upload, Sparkles, Trash2, Phone, Mail, MapPin } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import type { Provider } from '@/types/database';
import { ProviderAvatar } from '@/components/providers/ProviderAvatar';
import { PRESET_PROVIDER_PHOTOS, resolveProviderPhoto } from '@/lib/provider-photos';
import { compressImageFile } from '@/lib/driver-photos';

interface ProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (providerData: Partial<Provider>) => Promise<void>;
  initialData?: Provider | null;
}

const defaultFormData: Partial<Provider> = {
  name: '',
  type: 'workshop',
  phone: '',
  email: '',
  address: '',
  is_active: true,
  logo_url: '',
};

export function ProviderFormModal({ isOpen, onClose, onSave, initialData }: ProviderModalProps) {
  const { t, dir } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<Partial<Provider>>(initialData || defaultFormData);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        const resolvedPhoto = initialData.logo_url || initialData.photo_url || resolveProviderPhoto(initialData) || '';
        setFormData({
          ...defaultFormData,
          ...initialData,
          logo_url: resolvedPhoto,
        });
      } else {
        setFormData(defaultFormData);
      }
      setShowPresets(false);
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
        title: t('فشل في معالجة الصورة', 'Échec du traitement de l\'image'),
        variant: 'destructive',
      });
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelectPreset = (url: string, category?: string) => {
    setFormData((prev) => ({
      ...prev,
      logo_url: url,
      type: category && prev.type === 'workshop' ? category : prev.type,
    }));
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
    if (!formData.name || formData.name.trim() === '') {
      toast({
        title: t('حقل إلزامي', 'Champ requis'),
        description: t('يرجى إدخال اسم المزود أو الورشة', 'Veuillez saisir le nom du prestataire ou atelier'),
        variant: 'destructive',
      });
      return;
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
      <Card className="w-full max-w-xl my-8 shadow-2xl border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <CardTitle className="font-amiri text-xl flex items-center gap-2 text-foreground">
            <Wrench className="w-5 h-5 text-amber-500" />
            {initialData ? t('تعديل بيانات المزود / الورشة', 'Modifier le prestataire / atelier') : t('إضافة مزود / ورشة جديدة', 'Ajouter un prestataire / atelier')}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4" dir={dir}>
            {/* الشعار أو صورة الورشة */}
            <div className="p-3.5 bg-muted/40 border border-border rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>{t('شعار أو صورة المزود / الورشة', 'Logo ou image du prestataire')}</span>
                </label>
                {formData.logo_url && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveLogo}
                    className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2"
                  >
                    <Trash2 className="w-3.5 h-3.5 me-1" />
                    {t('إزالة الشعار', 'Supprimer')}
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-4">
                <ProviderAvatar
                  name={formData.name || 'مزود'}
                  type={formData.type}
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
                      <Upload className="w-3.5 h-3.5 text-amber-500" />
                      <span>
                        {compressing
                          ? t('جاري المعالجة...', 'Traitement...')
                          : t('رفع صورة من الجهاز', 'Importer une image')}
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
                      <span>{t('نماذج ورشات جاهزة', 'Modèles prédéfinis')}</span>
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {t('يدعم PNG, JPG, WebP. يتم تحسين وحفظ الصورة فوراً.', 'PNG, JPG, WebP supportés. Optimisation automatique.')}
                  </p>
                </div>
              </div>

              {/* معرض نماذج الورشات والمزودين */}
              {showPresets && (
                <div className="pt-2 border-t border-border/60">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    {t('اختر التخصص والرمز المناسب للورشة:', 'Choisissez la spécialité ou le logo :')}
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                    {PRESET_PROVIDER_PHOTOS.map((preset) => {
                      const isSelected = formData.logo_url === preset.url;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleSelectPreset(preset.url, preset.category)}
                          className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all hover:scale-105 cursor-pointer text-start ${
                            isSelected
                              ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500'
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

            {/* الاسم ونوع النشاط */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  {t('اسم المزود أو الورشة *', 'Nom du prestataire / atelier *')}
                </label>
                <Input
                  required
                  placeholder={t('مثال: حفيض الروايد / جمال فانتوز', 'Ex: Jamal Ventouse / Hafid Pneus')}
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  {t('نوع التخصص / النشاط', 'Type / Spécialité')}
                </label>
                <select
                  value={formData.type || 'workshop'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
                >
                  <option value="workshop">{t('ميكانيك عام وورشة (Atelier / Garage)', 'Atelier / Garage Mécanique')}</option>
                  <option value="tires">{t('عجلات وبنشرات (الروايد / Pneumatiques)', 'Pneumatiques & Roues')}</option>
                  <option value="suspension">{t('نوابض ولامات (ليباس / Suspension)', 'Suspension & Lames')}</option>
                  <option value="bodywork">{t('طولة وفانتوز (Tôlerie & Ventouse)', 'Tôlerie & Ventouse')}</option>
                  <option value="electric">{t('كهرباء وتشخيص (Électricité & Diagnostic)', 'Électricité & Diagnostic')}</option>
                  <option value="fuel">{t('محطة وقود ومازوت (Station Carburant)', 'Station Carburant')}</option>
                  <option value="frigo_maintenance">{t('تبريد الشاحنات (Frigo & Climatisation)', 'Frigo & Climatisation')}</option>
                  <option value="oil">{t('زيوت وتشحيم (Vidange & Graissage)', 'Vidange & Graissage')}</option>
                  <option value="parts">{t('قطع غيار (Pièces de Rechange)', 'Pièces de Rechange')}</option>
                  <option value="wash">{t('غسيل الشاحنات (Lavage Poids Lourds)', 'Lavage Poids Lourds')}</option>
                  <option value="ferry">{t('ملاحة وعبّارات (Ferry Maritime)', 'Ferry Maritime')}</option>
                </select>
              </div>
            </div>

            {/* الهاتف والبريد */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  {t('رقم الهاتف', 'Téléphone')}
                </label>
                <Input
                  dir="ltr"
                  placeholder="+212 600 00 00 00"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  {t('البريد الإلكتروني', 'E-mail')}
                </label>
                <Input
                  dir="ltr"
                  type="email"
                  placeholder="contact@atelier.ma"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            {/* العنوان */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {t('العنوان / المدينة', 'Adresse / Ville')}
              </label>
              <Input
                placeholder={t('مثال: الحي الصناعي سيدي معروف، الدار البيضاء', 'Ex: Zone Industrielle, Tanger')}
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            {/* أزرار الحفظ والإلغاء */}
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                {t('إلغاء', 'Annuler')}
              </Button>
              <Button type="submit" size="sm" disabled={loading} className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white">
                <Save className="w-4 h-4" />
                <span>{loading ? t('جاري الحفظ...', 'Enregistrement...') : t('حفظ البيانات', 'Enregistrer')}</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
