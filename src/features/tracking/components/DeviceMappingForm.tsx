'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/components/language-provider';
import type { TraccarDeviceMapping, TraccarDevice } from '@/types/database';

interface DeviceMappingFormProps {
  mapping: TraccarDeviceMapping | null;
  trucks: { id: number; plate_number: string }[];
  traccarDevices: TraccarDevice[];
  onClose: () => void;
  onSaved: () => void;
}

export default function DeviceMappingForm({ mapping, trucks, traccarDevices, onClose, onSaved }: DeviceMappingFormProps) {
  const { t, dir } = useLanguage();
  const [selectedDeviceId, setSelectedDeviceId] = useState(mapping?.traccar_device_id?.toString() || '');
  const [selectedTruckId, setSelectedTruckId] = useState(mapping?.truck_id?.toString() || '');
  const [isActive, setIsActive] = useState(mapping?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const selectedDevice = traccarDevices.find(d => d.id.toString() === selectedDeviceId);

  useEffect(() => {
    if (mapping) {
      setSelectedDeviceId(mapping.traccar_device_id?.toString() || '');
      setSelectedTruckId(mapping.truck_id?.toString() || '');
      setIsActive(mapping.is_active ?? true);
    }
  }, [mapping]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const supabase = (await import('@/lib/supabase/browser')).createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Unauthorized');

      const { data: profile } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) throw new Error('No company found');

      const payload = {
        company_id: profile.company_id,
        traccar_device_id: parseInt(selectedDeviceId, 10),
        traccar_unique_id: selectedDevice?.uniqueId || selectedDeviceId,
        truck_id: parseInt(selectedTruckId, 10),
        is_active: isActive,
      };

      let error;
      if (mapping) {
        const result = await supabase
          .from('traccar_device_mappings')
          .update(payload)
          .eq('id', mapping.id);
        error = result.error;
      } else {
        const result = await supabase
          .from('traccar_device_mappings')
          .insert(payload);
        error = result.error;
      }

      if (error) throw error;
      toast({ title: mapping ? t('تم تحديث الربط بنجاح', 'Lien mis à jour avec succès') : t('تم إنشاء الربط بنجاح', 'Lien créé avec succès') });
      onSaved();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('خطأ غير معروف', 'Erreur inconnue');
      toast({
        title: t('خطأ في الحفظ', 'Erreur d\'enregistrement'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir={dir}>
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle className="font-amiri">
            {mapping ? t('تعديل الربط', 'Modifier le lien') : t('ربط جهاز جديد', 'Nouvel appareil')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('جهاز Traccar', 'Appareil Traccar')}
              </label>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                <option value="">{t('اختر جهازاً', 'Sélectionner un appareil')}</option>
                {traccarDevices.map((device) => (
                  <option key={device.id} value={device.id.toString()}>
                    {device.name} ({device.uniqueId})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                {t('الشاحنة', 'Camion')}
              </label>
              <select
                value={selectedTruckId}
                onChange={(e) => setSelectedTruckId(e.target.value)}
                className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                <option value="">{t('اختر شاحنة', 'Sélectionner un camion')}</option>
                {trucks.map((truck) => (
                  <option key={truck.id} value={truck.id.toString()}>
                    {truck.plate_number}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <label htmlFor="isActive" className="text-sm cursor-pointer">
                {t('تفعيل الربط', 'Activer le lien')}
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? t('جاري الحفظ...', 'Enregistrement...') : t('حفظ', 'Enregistrer')}
              </Button>
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                {t('إلغاء', 'Annuler')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
