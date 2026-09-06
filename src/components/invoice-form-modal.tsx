'use client';

import { useState, useEffect, useMemo } from 'react';
import Decimal from 'decimal.js';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Save, FileText } from 'lucide-react';
import type { Invoice, Client, TripOrder } from '@/types/database';
import { DEFAULT_CLIENTS, DEFAULT_TRIPS, fallbackArray } from '@/lib/default-data';
import { useLanguage } from '@/components/language-provider';

Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Invoice>) => Promise<void>;
  clients: Client[];
  trips: TripOrder[];
  initialData?: Invoice | null;
}

export function InvoiceFormModal({
  isOpen,
  onClose,
  onSave,
  clients,
  trips,
  initialData,
}: InvoiceModalProps) {
  const { t, dir, locale } = useLanguage();
  const availableClients = fallbackArray(clients, DEFAULT_CLIENTS);
  const availableTrips = fallbackArray(trips, DEFAULT_TRIPS);

  const [loading, setLoading] = useState(false);
  const [systemTvaRate, setSystemTvaRate] = useState<string>('20');
  const supabase = useMemo(() => createClient(), []);

  const [formData, setFormData] = useState<Partial<Invoice>>(
    initialData || {
      invoice_number: '',
      client_id: '',
      total_amount: '0',
      ht_amount: '0',
      tva_rate: '20',
      tva_amount: '0',
      ttc_amount: '0',
      status: 'unpaid',
      currency: 'MAD',
      input_mode: 'manual',
      issue_date: '',
      due_date: '',
      bank_info_text: 'RIB: 007 780 0001234567890123 45 - ATTIJARIWAFA BANK',
      route: '',
      trip_order_id: undefined,
    }
  );

  useEffect(() => {
    async function fetchSystemSettings() {
      try {
        const localTva = typeof window !== 'undefined' ? localStorage.getItem('app_default_tva_rate') : null;
        if (localTva) {
          setSystemTvaRate(localTva);
        }

        const { data } = await supabase.from('system_settings').select('*').single();
        if (data && data.default_tva_rate !== undefined && data.default_tva_rate !== null) {
          setSystemTvaRate(data.default_tva_rate.toString());
        }
      } catch {
        // use fallback
      }
    }
    fetchSystemSettings();
  }, [supabase]);

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData((prev) => ({
        ...prev,
        invoice_number: prev.invoice_number || `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
        issue_date: prev.issue_date || new Date().toISOString().split('T')[0],
        due_date: prev.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      }));
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  // Recalculate TVA and TTC with strict Decimal.js
  const handleHTChange = (htVal: string, tvaRateVal: string) => {
    const ht = new Decimal(htVal || 0);
    const rate = new Decimal(tvaRateVal || 0);
    const tva = ht.times(rate).dividedBy(100);
    const ttc = ht.plus(tva);

    setFormData((prev) => ({
      ...prev,
      ht_amount: htVal,
      tva_rate: tvaRateVal,
      tva_amount: tva.toFixed(2),
      ttc_amount: ttc.toFixed(2),
      total_amount: ttc.toFixed(2),
    }));
  };

  const handleClientChange = (clientIdStr: string) => {
    const cId = parseInt(clientIdStr);
    const selectedClient = clients.find((c) => c.id === cId);
    if (selectedClient) {
      const isTva = selectedClient.invoice_with_tva !== false;
      const rate = isTva ? (systemTvaRate || '20') : '0';
      const ht = new Decimal(formData.ht_amount || '0');
      const tva = ht.times(new Decimal(rate || 0)).dividedBy(100);
      const ttc = ht.plus(tva);

      setFormData((prev) => ({
        ...prev,
        client_id: cId.toString(),
        currency: selectedClient.currency || 'MAD',
        tva_rate: rate,
        tva_amount: tva.toFixed(2),
        ttc_amount: ttc.toFixed(2),
        total_amount: ttc.toFixed(2),
      }));
    } else {
      setFormData((prev) => ({ ...prev, client_id: clientIdStr }));
    }
  };

  const handleTripChange = (tripIdStr: string) => {
    const tId = parseInt(tripIdStr);
    const selectedTrip = trips.find((t) => t.id === tId);
    if (selectedTrip) {
      const price = new Decimal(selectedTrip.price || 0);
      const rate = new Decimal(formData.tva_rate || '20');
      const tva = price.times(rate).dividedBy(100);
      const ttc = price.plus(tva);

      setFormData((prev) => ({
        ...prev,
        trip_order_id: tId,
        route: selectedTrip.route || prev.route,
        client_id: selectedTrip.client_id ? selectedTrip.client_id.toString() : prev.client_id,
        ht_amount: price.toString(),
        tva_amount: tva.toFixed(2),
        ttc_amount: ttc.toFixed(2),
        total_amount: ttc.toFixed(2),
      }));
    } else {
      setFormData((prev) => ({ ...prev, trip_order_id: undefined }));
    }
  };

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
            <FileText className="w-5 h-5 text-primary" />
            {initialData ? t('تعديل الفاتورة', 'Modifier la facture') : t('إنشاء فاتورة جديدة', 'Nouvelle facture')}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4" dir={dir}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t('العميل *', 'Client *')}</label>
                <select
                  value={formData.client_id || ''}
                  onChange={(e) => handleClientChange(e.target.value)}
                  className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                  required
                >
                  <option value="">{`-- ${t('اختر العميل', 'Sélectionner le client')} --`}</option>
                  {availableClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t('ربط برحلة شحن (اختياري)', 'Associer à un voyage (Optionnel)')}</label>
                <select
                  value={formData.trip_order_id || ''}
                  onChange={(e) => handleTripChange(e.target.value)}
                  className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="">{`-- ${t('غير مرتبطة برحلة', 'Non associé à un voyage')} --`}</option>
                  {availableTrips.map((t) => (
                    <option key={t.id} value={t.id}>
                      #{t.id} - {t.route} ({t.price} MAD)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t('رقم الفاتورة *', 'N° de Facture *')}</label>
                <Input
                  value={formData.invoice_number || ''}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  required
                  dir="ltr"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t('تاريخ الإصدار *', "Date d'émission *")}</label>
                <Input
                  type="date"
                  value={formData.issue_date || ''}
                  onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                  required
                  dir="ltr"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t('تاريخ الاستحقاق *', "Date d'échéance *")}</label>
                <Input
                  type="date"
                  value={formData.due_date || ''}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  required
                  dir="ltr"
                />
              </div>
            </div>

            {/* Calculations and Taxes */}
            <div className="p-4 bg-muted/60 dark:bg-slate-900/60 rounded-xl border border-border space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t('المبلغ الصافي (HT) *', 'Montant HT *')}</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.ht_amount || ''}
                    onChange={(e) => handleHTChange(e.target.value, formData.tva_rate || '20')}
                    required
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t('نسبة الضريبة TVA (%)', 'Taux TVA (%)')}</label>
                  <Input
                    type="number"
                    value={formData.tva_rate || '20'}
                    onChange={(e) => handleHTChange(formData.ht_amount || '0', e.target.value)}
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t('قيمة الضريبة (TVA)', 'Montant TVA')}</label>
                  <Input
                    value={formData.tva_amount || '0.00'}
                    disabled
                    className="bg-muted font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-border font-bold text-base text-primary">
                <span>{t('المجموع النهائي (TTC):', 'Total TTC :')}</span>
                <span className="font-mono text-lg">{formData.ttc_amount || '0.00'} {formData.currency}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t('حالة الدفع', 'Statut de paiement')}</label>
                <select
                  value={formData.status || 'unpaid'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="unpaid">{t('غير مدفوعة (Non payée)', 'Non payée')}</option>
                  <option value="partially_paid">{t('مدفوعة جزئياً', 'Partiellement payée')}</option>
                  <option value="paid">{t('مدفوعة بالكامل (Payée)', 'Payée')}</option>
                  <option value="overdue">{t('متأخرة عن الدفع', 'En retard de paiement')}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t('المسار (Route)', 'Trajet (Route)')}</label>
                <Input
                  value={formData.route || ''}
                  onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                  placeholder={t('طنجة -> فالنسيا', 'Tanger -> Valence')}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-border">
              <Button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />
                {loading ? t('جاري الحفظ...', 'Enregistrement...') : initialData?.id ? t('تحديث الفاتورة', 'Mettre à jour') : t('إصدار الفاتورة', 'Créer la facture')}
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
