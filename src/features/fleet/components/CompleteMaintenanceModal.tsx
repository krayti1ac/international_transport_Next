'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, X, Loader2 } from 'lucide-react';
import { completeMaintenanceSchedule, type EnrichedMaintenanceSchedule } from '../services/maintenance-schedule.actions';

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
  const { toast } = useToast();
  const [cost, setCost] = useState(schedule?.amount_estimate?.toString() || '0');
  const [provider, setProvider] = useState('ورشة معتمدة');
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
        providerName: provider,
        notes,
      });

      if (res.success) {
        toast({
          title: '✅ تم توثيق الصيانة بنجاح',
          description: 'تم قيد المصروف في سجلات الصيانة والخزينة، وتحديث الموعد القادم.',
        });
        onCompleted();
        onClose();
      } else {
        toast({ title: 'خطأ', description: res.error, variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto" dir="rtl">
      <Card className="w-full max-w-md my-8 border-border">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/70 pb-3">
          <CardTitle className="font-amiri text-base font-bold flex items-center gap-2 text-foreground">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>تأكيد إنجاز الصيانة ({schedule.plateNumber})</span>
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-lg">
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleConfirm} className="space-y-4 text-xs">
            <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-1">
              <p className="font-bold text-foreground text-sm">{schedule.maintenance_type}</p>
              <p className="text-muted-foreground">{schedule.model} • اللوحة: {schedule.plateNumber}</p>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">التكلفة الإجمالية الفعلية (MAD) *</label>
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
              <label className="font-semibold text-foreground">اسم الورشة أو مزود الخدمة</label>
              <Input
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="مثال: Garage Poids Lourds Tanger Med"
                className="h-10 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">إعادة الجدولة تلقائياً للدورة القادمة بعد:</label>
              <select
                value={repeatMonths}
                onChange={(e) => setRepeatMonths(e.target.value)}
                className="w-full h-10 px-3 border border-input bg-card text-foreground rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="0">بدون تكرار (إغلاق المهمة نهائياً)</option>
                <option value="3">بعد 3 أشهر</option>
                <option value="6">بعد 6 أشهر (نصف سنوي - موصى به)</option>
                <option value="12">بعد 12 شهراً (سنوي)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">تفاصيل الإصلاح وقطع الغيار المستبدلة</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="رقم الفاتورة، نوع الزيت، قطع الغيار..."
                className="h-10 rounded-xl"
              />
            </div>

            <div className="flex gap-2 pt-3 border-t border-border/70">
              <Button type="submit" disabled={loading} className="flex-1 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
                {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                اعتماد الصيانة والصرف
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
