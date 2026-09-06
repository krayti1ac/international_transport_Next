'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Save, Building, PlaneTakeoff, PlaneLanding } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import type { Client } from '@/types/database';

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
};

export function ClientFormModal({ isOpen, onClose, onSave, initialData }: ClientModalProps) {
  const { t, dir } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Client>>(initialData || defaultFormData);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          ...defaultFormData,
          ...initialData,
        });
      } else {
        setFormData(defaultFormData);
      }
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4" dir={dir}>
            {/* نوع الرحلات: ذهاب أو عودة حصرياً */}
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t('رقم التعريف الضريبي (ICE)', 'Identifiant fiscal (ICE)')}</label>
                <Input
                  value={formData.ice || ''}
                  onChange={(e) => setFormData({ ...formData, ice: e.target.value })}
                  placeholder="002345678000091"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t('المدينة *', 'Ville *')}</label>
                <Input
                  value={formData.city || ''}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder={t('الدار البيضاء / طنجة / مدريد', 'Casablanca / Tanger / Madrid')}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{t('العنوان الرئيسي', 'Adresse principale')}</label>
              <Input
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder={t('العنوان الكامل للشركة...', 'Adresse complète de l\'entreprise...')}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-border pt-3">
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
