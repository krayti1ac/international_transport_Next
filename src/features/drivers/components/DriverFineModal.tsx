'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, X, Save, Loader2 } from 'lucide-react';
import { createFinePenalty } from '../services/driver-fines.actions';
import type { Driver, TripOrder } from '@/types/database';

interface DriverFineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  drivers: Driver[];
  trips: TripOrder[];
  preselectedDriverId?: number;
}

const FINE_TYPES = [
  { value: 'speeding', label: 'تجاوز السرعة القانونية (Excès de Vitesse)' },
  { value: 'overload', label: 'حمولة زائدة عن الوزن المسموح (Surcharge)' },
  { value: 'tachograph', label: 'مخالفة ساعات القيادة والتاكوجراف (Tachygraphe)' },
  { value: 'customs', label: 'غرامة جمركية / تأخير تصريح (Douane / MRN)' },
  { value: 'parking', label: 'وقوف غير مصرح أو غرامة معبر ميناء (Port / Stationnement)' },
  { value: 'other', label: 'أخرى (Autre infraction)' },
];

export function DriverFineModal({
  isOpen,
  onClose,
  onSaved,
  drivers,
  trips,
  preselectedDriverId,
}: DriverFineModalProps) {
  const { toast } = useToast();
  const [driverId, setDriverId] = useState<string>(preselectedDriverId?.toString() || '');
  const [tripOrderId, setTripOrderId] = useState<string>('');
  const [fineType, setFineType] = useState(FINE_TYPES[0].value);
  const [amount, setAmount] = useState('500');
  const [currency, setCurrency] = useState('MAD');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverId) {
      toast({ title: 'خطأ', description: 'يرجى اختيار السائق', variant: 'destructive' });
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
          title: '✅ تم قيد المخالفة بنجاح',
          description: 'تم تسجيل المخالفة وإشعار السائق بها عبر WhatsApp.',
        });
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
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <span>تسجيل مخالفة / غرامة على سائق</span>
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-lg">
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">السائق المسؤول *</label>
              <select
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                className="w-full h-10 px-3 border border-input bg-card text-foreground rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                <option value="">-- اختر السائق --</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.phone})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">ربط برحلة دولية (اختياري)</label>
              <select
                value={tripOrderId}
                onChange={(e) => setTripOrderId(e.target.value)}
                className="w-full h-10 px-3 border border-input bg-card text-foreground rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">-- بدون ربط برحلة --</option>
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    #{t.id} — {t.route} ({t.departure_date})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">نوع المخالفة *</label>
              <select
                value={fineType}
                onChange={(e) => setFineType(e.target.value)}
                className="w-full h-10 px-3 border border-input bg-card text-foreground rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {FINE_TYPES.map((ft) => (
                  <option key={ft.value} value={ft.value}>
                    {ft.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="font-semibold text-foreground">قيمة الغرامة *</label>
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
                <label className="font-semibold text-foreground">العملة</label>
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
              <label className="font-semibold text-foreground">البيان وتفاصيل محضر المخالفة</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="رقم المحضر، مكان المخالفة (مثال: رادار الطريق السيار طنجة-القنيطرة)..."
                className="rounded-xl h-10"
              />
            </div>

            <div className="flex gap-2 pt-3 border-t border-border/70">
              <Button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>تسجيل وإشعار السائق</span>
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
