'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/browser';
import type { TraccarDeviceMapping, TraccarDevice, TraccarConfig } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, RefreshCw, Link2 } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import DeviceMappingForm from '@/features/tracking/components/DeviceMappingForm';

interface DeviceMappingTableProps {
  mappings: TraccarDeviceMapping[];
  trucks: { id: number; plate_number: string }[];
  onSaved: () => void;
  config: TraccarConfig | null;
}

export default function DeviceMappingTable({ mappings, trucks, onSaved, config }: DeviceMappingTableProps) {
  const { t, dir } = useLanguage();
  const [showModal, setShowModal] = useState(false);
  const [editingMapping, setEditingMapping] = useState<TraccarDeviceMapping | null>(null);
  const [traccarDevices, setTraccarDevices] = useState<TraccarDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const { toast } = useToast();
  const supabase = useCallback(() => createClient(), []);

  const fetchTraccarDevices = useCallback(async () => {
    if (!config) return;
    setLoadingDevices(true);
    try {
      const response = await fetch('/api/tracking/traccar-devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId: config.id }),
      });
      const result = await response.json();
      if (response.ok) {
        setTraccarDevices(result.devices || []);
      } else {
        toast({
          title: t('خطأ في تحميل الأجهزة', 'Erreur lors du chargement des appareils'),
          description: result.error || t('تحقق من إعدادات Traccar', 'Vérifiez la configuration Traccar'),
          variant: 'destructive',
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('خطأ غير معروف', 'Erreur inconnue');
      toast({ title: message, variant: 'destructive' });
    } finally {
      setLoadingDevices(false);
    }
  }, [config, toast, t]);

  useEffect(() => {
    if (config) {
      fetchTraccarDevices();
    }
  }, [config, fetchTraccarDevices]);

  const handleDelete = async (id: number) => {
    if (!confirm(t('هل أنت متأكد من حذف هذا الربط؟', 'Êtes-vous sûr de vouloir supprimer ce lien ?'))) return;
    try {
      const { error } = await supabase().from('traccar_device_mappings').delete().eq('id', id);
      if (error) throw error;
      toast({ title: t('تم حذف الربط بنجاح', 'Lien supprimé avec succès') });
      onSaved();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('خطأ غير معروف', 'Erreur inconnue');
      toast({ title: t('خطأ في الحذف', 'Erreur lors de la suppression'), description: message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6" dir={dir}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-amiri flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              {t('ربط أجهزة Traccar بالشاحنات', 'Appareils Traccar liés aux camions')}
            </CardTitle>
            <div className="flex gap-2">
              {config && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchTraccarDevices}
                  disabled={loadingDevices}
                >
                  {loadingDevices ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    t('تحديث الأجهزة', 'Actualiser les appareils')
                  )}
                </Button>
              )}
              <Button onClick={() => { setEditingMapping(null); setShowModal(true); }} className="rounded-xl h-9 text-xs">
                <Plus className={`w-4 h-4 ${dir === 'rtl' ? 'ml-1.5' : 'mr-1.5'}`} />
                {t('ربط جهاز جديد', 'Nouvel appareil')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!config ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">{t('يرجى إعداد خادم Traccar أولاً', 'Veuillez d\'abord configurer le serveur Traccar')}</p>
            </div>
          ) : mappings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">{t('لا توجد أجهزة مرتبطة حالياً', 'Aucun appareil lié pour le moment')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {mappings.map((mapping) => (
                <div
                  key={mapping.id}
                  className="flex items-center justify-between p-4 border border-border rounded-xl bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${mapping.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {t('جهاز Traccar:', 'Appareil Traccar:')} {mapping.traccar_unique_id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('الشاحنة:', 'Camion:')} {trucks.find(t => t.id === mapping.truck_id)?.plate_number || `#${mapping.truck_id}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      mapping.is_active
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-500/15 text-slate-700 dark:text-slate-300'
                    }`}>
                      {mapping.is_active ? t('فعال', 'Actif') : t('متوقف', 'Inactif')}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setEditingMapping(mapping); setShowModal(true); }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(mapping.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showModal && (
        <DeviceMappingForm
          mapping={editingMapping}
          trucks={trucks}
          traccarDevices={traccarDevices}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); onSaved(); }}
        />
      )}
    </div>
  );
}
