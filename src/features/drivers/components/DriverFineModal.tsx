'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, X, Save, Loader2 } from 'lucide-react';
import { createFinePenalty } from '../services/driver-fines.actions';
import type { Driver, TripOrder } from '@/types/database';
import { useLanguage } from '@/components/language-provider';

interface DriverFineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  drivers: Driver[];
  trips: TripOrder[];
  preselectedDriverId?: number;
}

export function DriverFineModal({
  isOpen,
  onClose,
  onSaved,
  drivers,
  trips,
  preselectedDriverId,
}: DriverFineModalProps) {
  const { t, dir } = useLanguage();
  const { toast } = useToast();
  const [driverId, setDriverId] = useState<string>(preselectedDriverId?.toString() || '');
  const [tripOrderId, setTripOrderId] = useState<string>('');
  const [fineType, setFineType] = useState('speeding');
  const [amount, setAmount] = useState('500');
  const [currency, setCurrency] = useState('MAD');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const fineTypes = [
    { value: 'speeding', label: t('تجاوز السرعة القانونية (Excès de Vitesse)', 'Excès de Vitesse') },
    { value: 'overload', label: t('حمولة زائدة عن الوزن المسموح (Surcharge)', 'Surcharge de poids') },
    { value: 'tachograph', label: t('مخالفة ساعات القيادة والتاكوجراف (Tachygraphe)', 'Infraction Tachygraphe / Temps de conduite') },
    { value: 'customs', label: t('غرامة جمركية / تأخير تصريح (Douane / MRN)', 'Amende douanière / Retard MRN') },
    { value: 'parking', label: t('وقوف غير مصرح أو غرامة معبر ميناء (Port / Stationnement)', 'Stationnement non autorisé / Amende portuaire') },
    { value: 'other', label: t('أخرى (Autre infraction)', 'Autre infraction') },
  ];

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverId) {
      toast({ title: t('خطأ', 'Erreur'), description: t('يرجى اختيار السائق', 'Veuillez sélectionner un chauffeur'), variant: 'destructive' });
      return;
    }

    const selectedDriver = drivers.find((d) => d.id === parseInt(driverId, 10));
    if (!selectedDriver) return;

    setSaving(true);
    try {
      const res = await createFinePenalty({
        driverId: selectedDriver.id,
        driverName: selectedDriver.name,
        tripOrderId: tripOrderId ? parseInt(tripOrderId, 10) : null,
        amount: parseFloat(amount) || 0,
        currency,
        fineType,
        description,
      });

      if (res.success) {
        toast({
          title: t('✅ تم قيد المخالفة بنجاح', '✅ Infraction enregistrée avec succès'),
          description: t('تم تسجيل المخالفة وإشعار السائق بها عبر WhatsApp.', 'Infraction enregistrée et notifiée au chauffeur par WhatsApp.'),
        });
        onSaved();
        onClose();
      } else {
        toast({ title: t('خطأ', 'Erreur'), description: res.error, variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto" dir={dir}>
      <Card className="w-full max-w-lg my-8 border-border">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/70 pb-3">
          <CardTitle className="font-amiri text-lg font-bold flex items-center gap-2 text-foreground">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <span>{t('تسجيل مخالفة / غرامة على سائق', 'Enregistrer une infraction / amende chauffeur')}</span>
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-lg">
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">{t('السائق المسؤول *', 'Chauffeur responsable *')}</label>
              <select
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                className="w-full h-10 px-3 border border-input bg-card text-foreground rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                <option value="">{t('-- اختر السائق --', '-- Sélectionner le chauffeur --')}</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.phone})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">{t('ربط برحلة دولية (اختياري)', 'Associer à un trajet (facultatif)')}</label>
              <select
                value={tripOrderId}
                onChange={(e) => setTripOrderId(e.target.value)}
                className="w-full h-10 px-3 border border-input bg-card text-foreground rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">{t('-- بدون ربط برحلة --', '-- Sans liaison trajet --')}</option>
                {trips.map((tr) => (
                  <option key={tr.id} value={tr.id}>
                    #{tr.id} — {tr.route} ({tr.departure_date})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">{t('نوع المخالفة *', 'Type d\'infraction *')}</label>
              <select
                value={fineType}
                onChange={(e) => setFineType(e.target.value)}
                className="w-full h-10 px-3 border border-input bg-card text-foreground rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {fineTypes.map((ft) => (
                  <option key={ft.value} value={ft.value}>
                    {ft.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="font-semibold text-foreground">{t('قيمة الغرامة *', 'Montant de l\'amende *')}</label>
                <Input
                  type="number"
                  step="10"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="rounded-xl h-10 font-mono text-base font-bold"
                  dir="ltr"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">{t('العملة', 'Devise')}</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full h-10 px-3 border border-input bg-card text-foreground rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="MAD">MAD (درهم)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">{t('تفاصيل وملاحظات إضافية', 'Détails et remarques complémentaires')}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder={t('أدخل سبب المخالفة، موقع الحدوث، أو رقم محضر الشرطة/الجمارك...', 'Raison de l\'infraction, lieu, numéro de PV...')}
                className="w-full p-3 border border-input bg-card text-foreground rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                disabled={saving}
                className="flex-1 h-10 font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{t('حفظ وقيد المخالفة', 'Enregistrer l\'infraction')}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="h-10 rounded-xl"
              >
                {t('إلغاء', 'Annuler')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
