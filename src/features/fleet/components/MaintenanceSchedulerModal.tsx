'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { X, Wrench, Save, Loader2 } from 'lucide-react';
import { createMaintenanceSchedule } from '../services/maintenance-schedule.actions';
import type { Truck, Trailer } from '@/types/database';

interface MaintenanceSchedulerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  trucks: Truck[];
  trailers: Trailer[];
}

const COMMON_MAINTENANCE_TYPES = [
  'تغيير زيت المحرك وفلاتر (Vidange Moteur)',
  'فحص وتغيير أقمشة الفرامل (Freins & Disques)',
  'تدوير وضبط الإطارات (Pneumatiques)',
  'صيانة جهاز تبريد المقطورة (Thermo King / Carrier)',
  'فحص دورة الهواء والتعليق (Suspension & Air)',
  'فحص ميكانيكي عام وفحص تقني (Contrôle Technique)',
];

export function MaintenanceSchedulerModal({
  isOpen,
  onClose,
  onSaved,
  trucks,
  trailers,
}: MaintenanceSchedulerModalProps) {
  const { toast } = useToast();
  const [vehicleType, setVehicleType] = useState<'truck' | 'trailer'>('truck');
  const [vehicleId, setVehicleId] = useState<string>('');
  const [maintenanceType, setMaintenanceType] = useState(COMMON_MAINTENANCE_TYPES[0]);
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
      toast({ title: 'خطأ', description: 'يرجى اختيار المركبة', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const finalType = customType.trim() || maintenanceType;
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
        toast({ title: '✅ تم جدولة موعد الصيانة الوقائية بنجاح' });
        onSaved();
        onClose();
      } else {
        toast({ title: 'خطأ', description: res.error, variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto" dir="rtl">
      <Card className="w-full max-w-lg my-8 border-border">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/70 pb-3">
          <CardTitle className="font-amiri text-lg font-bold flex items-center gap-2 text-foreground">
            <Wrench className="w-5 h-5 text-primary" />
            <span>جدولة صيانة وقائية جديدة (Preventive Maintenance)</span>
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-lg">
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">نوع المركبة المستهدفة</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={vehicleType === 'truck' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setVehicleType('truck'); setVehicleId(''); }}
                  className="flex-1 rounded-xl"
                >
                  شاحنة رأس جرار (Tracteur)
                </Button>
                <Button
                  type="button"
                  variant={vehicleType === 'trailer' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setVehicleType('trailer'); setVehicleId(''); }}
                  className="flex-1 rounded-xl"
                >
                  مقطورة (Remorque)
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">اختر المركبة *</label>
              <select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="w-full h-10 px-3 border border-input bg-card text-foreground rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                <option value="">-- اضغط للاختيار --</option>
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
              <label className="font-semibold text-foreground">نوع الصيانة الدورية</label>
              <select
                value={maintenanceType}
                onChange={(e) => setMaintenanceType(e.target.value)}
                className="w-full h-10 px-3 border border-input bg-card text-foreground rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {COMMON_MAINTENANCE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">نوع صيانة مخصص (اختياري)</label>
              <Input
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                placeholder="اتركه فارغاً لاستخدام النوع المعتمد أعلاه"
                className="rounded-xl h-10"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">تاريخ الموعد القادم *</label>
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
                <label className="font-semibold text-foreground">التكلفة التقديرية (MAD)</label>
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
              <label className="font-semibold text-foreground">ملاحظات إضافية أو معايير الفحص</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثال: يرجى فحص ضغط غاز التبريد أو تغيير فلتر الديزل"
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
                <span>حفظ وجدولة الموعد</span>
              </Button>
              <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
                إلغاء
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
