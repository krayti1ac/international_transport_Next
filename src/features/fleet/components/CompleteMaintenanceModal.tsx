'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, X, Loader2 } from 'lucide-react';
import { completeMaintenanceSchedule, type EnrichedMaintenanceSchedule } from '../services/maintenance-schedule.actions';
import { useLanguage } from '@/components/language-provider';

interface CompleteMaintenanceModalProps {
  schedule: EnrichedMaintenanceSchedule | null;
  onClose: () => void;
  onCompleted: () => void;
}

export function CompleteMaintenanceModal({
  schedule,
  onClose,
  onCompleted,
}: CompleteMaintenanceModalProps) {
  const { t, dir } = useLanguage();
  const { toast } = useToast();
  const [cost, setCost] = useState(schedule?.amount_estimate?.toString() || '0');
  const [provider, setProvider] = useState('');
  const [repeatMonths, setRepeatMonths] = useState<string>('6');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!schedule) return null;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await completeMaintenanceSchedule({
        scheduleId: schedule.id,
        actualCost: parseFloat(cost) || 0,
        repeatMonths: parseInt(repeatMonths, 10),
        providerName: provider || t('ورشة معتمدة', 'Atelier agréé'),
        notes,
      });

      if (res.success) {
        toast({
          title: t('✅ تم توثيق الصيانة بنجاح', '✅ Maintenance validée avec succès'),
          description: t('تم قيد المصروف في سجلات الصيانة والخزينة، وتحديث الموعد القادم.', 'Dépense enregistrée et prochaine date planifiée.'),
        });
        onCompleted();
        onClose();
      } else {
        toast({ title: t('خطأ', 'Erreur'), description: res.error, variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto" dir={dir}>
      <Card className="w-full max-w-md my-8 border-border">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/70 pb-3">
          <CardTitle className="font-amiri text-base font-bold flex items-center gap-2 text-foreground">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{t('تأكيد إنجاز الصيانة', 'Validation de la maintenance')} ({schedule.plateNumber})</span>
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-lg">
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleConfirm} className="space-y-4 text-xs">
            <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-1">
              <p className="font-bold text-foreground text-sm">{schedule.maintenance_type}</p>
              <p className="text-muted-foreground">{schedule.model} • {t('اللوحة:', 'Plaque :')} {schedule.plateNumber}</p>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">{t('التكلفة الإجمالية الفعلية (MAD) *', 'Coût réel total (MAD) *')}</label>
              <Input
                type="number"
                step="10"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="h-10 rounded-xl font-mono text-base font-bold"
                dir="ltr"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">{t('اسم الورشة أو مزود الخدمة', 'Atelier ou Prestataire')}</label>
              <Input
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder={t('مثال: Garage Poids Lourds Tanger Med', 'Ex: Garage Poids Lourds Tanger Med')}
                className="h-10 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">{t('إعادة الجدولة تلقائياً للدورة القادمة بعد:', 'Replanification automatique après :')}</label>
              <select
                value={repeatMonths}
                onChange={(e) => setRepeatMonths(e.target.value)}
                className="w-full h-10 px-3 border border-input bg-card text-foreground rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="0">{t('بدون تكرار (إغلاق المهمة نهائياً)', 'Sans répétition (Clôturer définitivement)')}</option>
                <option value="3">{t('بعد 3 أشهر', 'Après 3 mois')}</option>
                <option value="6">{t('بعد 6 أشهر (نصف سنوي - موصى به)', 'Après 6 mois (Semestriel - Recommandé)')}</option>
                <option value="12">{t('بعد 12 شهراً (سنوي)', 'Après 12 mois (Annuel)')}</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">{t('تفاصيل الإصلاح وقطع الغيار المستبدلة', 'Détails de l\'intervention et pièces changées')}</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('رقم الفاتورة، نوع الزيت، قطع الغيار...', 'N° facture, type d\'huile, pièces...')}
                className="rounded-xl h-10"
              />
            </div>

            <div className="flex gap-2 pt-3 border-t border-border/70">
              <Button type="submit" disabled={loading} className="flex-1 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
                {loading ? <Loader2 className={`w-4 h-4 animate-spin ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} /> : null}
                {t('اعتماد الصيانة والصرف', 'Valider et Enregistrer')}
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
