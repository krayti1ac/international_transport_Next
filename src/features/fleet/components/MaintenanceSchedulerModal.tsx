'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { X, Wrench, Save, Loader2 } from 'lucide-react';
import { createMaintenanceSchedule } from '../services/maintenance-schedule.actions';
import type { Truck, Trailer } from '@/types/database';
import { useLanguage } from '@/components/language-provider';

interface MaintenanceSchedulerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  trucks: Truck[];
  trailers: Trailer[];
}

const COMMON_MAINTENANCE_TYPES = [
  { ar: 'تغيير زيت المحرك وفلاتر (Vidange Moteur)', fr: 'Vidange huile moteur & filtres (Vidange Moteur)' },
  { ar: 'فحص وتغيير أقمشة الفرامل (Freins & Disques)', fr: 'Contrôle & changement des freins (Freins & Disques)' },
  { ar: 'تدوير وضبط الإطارات (Pneumatiques)', fr: 'Permutation et géométrie des pneus (Pneumatiques)' },
  { ar: 'صيانة جهاز تبريد المقطورة (Thermo King / Carrier)', fr: 'Maintenance groupe frigorifique (Thermo King / Carrier)' },
  { ar: 'فحص دورة الهواء والتعليق (Suspension & Air)', fr: 'Vérification circuit d\'air & suspensions (Suspension & Air)' },
  { ar: 'فحص ميكانيكي عام وفحص تقني (Contrôle Technique)', fr: 'Visite technique & contrôle général (Contrôle Technique)' },
];

export function MaintenanceSchedulerModal({
  isOpen,
  onClose,
  onSaved,
  trucks,
  trailers,
}: MaintenanceSchedulerModalProps) {
  const { t, dir } = useLanguage();
  const { toast } = useToast();
  const [vehicleType, setVehicleType] = useState<'truck' | 'trailer'>('truck');
  const [vehicleId, setVehicleId] = useState<string>('');
  const [maintenanceTypeIndex, setMaintenanceTypeIndex] = useState(0);
  const [customType, setCustomType] = useState('');
  const [scheduledDate, setScheduledDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [amountEstimate, setAmountEstimate] = useState('2500');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId) {
      toast({ title: t('خطأ', 'Erreur'), description: t('يرجى اختيار المركبة', 'Veuillez sélectionner un véhicule'), variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const selectedObj = COMMON_MAINTENANCE_TYPES[maintenanceTypeIndex];
      const fallbackType = selectedObj ? selectedObj.ar : '';
      const finalType = customType.trim() || fallbackType;
      const res = await createMaintenanceSchedule({
        vehicleType,
        vehicleId: parseInt(vehicleId, 10),
        maintenanceType: finalType,
        scheduledDate,
        amountEstimate: parseFloat(amountEstimate) || 0,
        currency: 'MAD',
        notes,
      });

      if (res.success) {
        toast({ title: t('✅ تم جدولة موعد الصيانة الوقائية بنجاح', '✅ Maintenance programmée avec succès') });
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
            <Wrench className="w-5 h-5 text-primary" />
            <span>{t('جدولة صيانة وقائية جديدة', 'Planification de Maintenance Préventive')}</span>
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-lg">
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">{t('نوع المركبة المستهدفة', 'Type de véhicule')}</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={vehicleType === 'truck' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setVehicleType('truck'); setVehicleId(''); }}
                  className="flex-1 rounded-xl"
                >
                  {t('شاحنة رأس جرار (Tracteur)', 'Tracteur Routier')}
                </Button>
                <Button
                  type="button"
                  variant={vehicleType === 'trailer' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setVehicleType('trailer'); setVehicleId(''); }}
                  className="flex-1 rounded-xl"
                >
                  {t('مقطورة (Remorque)', 'Semi-remorque')}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">{t('اختر المركبة *', 'Sélectionner le véhicule *')}</label>
              <select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="w-full h-10 px-3 border border-input bg-card text-foreground rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                <option value="">{t('-- اضغط للاختيار --', '-- Cliquez pour choisir --')}</option>
                {vehicleType === 'truck'
                  ? trucks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.plate_number} — {t.model}
                      </option>
                    ))
                  : trailers.map((tr) => (
                      <option key={tr.id} value={tr.id}>
                        {tr.plate_number} — {tr.model}
                      </option>
                    ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">{t('نوع الصيانة الدورية', 'Type de révision périodique')}</label>
              <select
                value={maintenanceTypeIndex}
                onChange={(e) => setMaintenanceTypeIndex(parseInt(e.target.value, 10))}
                className="w-full h-10 px-3 border border-input bg-card text-foreground rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {COMMON_MAINTENANCE_TYPES.map((type, idx) => (
                  <option key={idx} value={idx}>
                    {t(type.ar, type.fr)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">{t('نوع صيانة مخصص (اختياري)', 'Type personnalisé (Optionnel)')}</label>
              <Input
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                placeholder={t('اتركه فارغاً لاستخدام النوع المعتمد أعلاه', 'Laisser vide pour utiliser le type sélectionné ci-dessus')}
                className="rounded-xl h-10"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">{t('تاريخ الموعد القادم *', 'Date prévue *')}</label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="rounded-xl h-10 font-mono"
                  dir="ltr"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">{t('التكلفة التقديرية (MAD)', 'Coût estimé (MAD)')}</label>
                <Input
                  type="number"
                  step="50"
                  value={amountEstimate}
                  onChange={(e) => setAmountEstimate(e.target.value)}
                  className="rounded-xl h-10 font-mono font-bold"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">{t('ملاحظات إضافية أو معايير الفحص', 'Notes complémentaires ou points de contrôle')}</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('مثال: يرجى فحص ضغط غاز التبريد أو تغيير فلتر الديزل', 'Ex: Vérifier la pression du gaz frigo ou changer le filtre gasoil')}
                className="rounded-xl h-10"
              />
            </div>

            <div className="flex gap-2 pt-3 border-t border-border/70">
              <Button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl font-bold gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{t('حفظ وجدولة الموعد', 'Enregistrer et planifier')}</span>
              </Button>
              <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
                {t('إلغاء', 'Annuler')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
