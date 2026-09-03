'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { GeofenceZone } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Plus, Pencil, Trash2, Navigation, X } from 'lucide-react';
import { CardViewToggle, useCardViewMode } from '@/components/ui/card-view-toggle';

const ZONE_TYPE_LABELS: Record<string, string> = {
  port: 'ميناء',
  border: 'منطقة حدودية',
  customs: 'جمارك',
  logistics_hub: 'محطة لوجستية',
  client_warehouse: 'مستودع عميل',
  other: 'أخرى',
};

type ZoneType = 'port' | 'border' | 'customs' | 'logistics_hub' | 'client_warehouse' | 'other';

export default function GeofenceZonesPage() {
  const [zones, setZones] = useState<GeofenceZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingZone, setEditingZone] = useState<GeofenceZone | null>(null);
  const [selectedZone, setSelectedZone] = useState<GeofenceZone | null>(null);
  const [cardLayout, setCardLayout] = useCardViewMode('geofence_zones', 'grid');
  const { toast } = useToast();
  const supabase = useCallback(() => createClient(), []);

  const fetchZones = useCallback(async () => {
    try {
      const { data, error } = await supabase()
        .from('geofence_zones')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setZones(data || []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'خطأ غير معروف';
      toast({
        title: 'خطأ في تحميل البيانات',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [supabase, toast]);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  const handleDelete = async (id: number) => {
    try {
      const { error } = await supabase().from('geofence_zones').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'تم حذف المنطقة بنجاح' });
      fetchZones();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'خطأ غير معروف';
      toast({
        title: 'خطأ في الحذف',
        description: message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-slate-500">جاري تحميل البيانات...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold font-amiri">المناطق الجغرافية</h1>
        <div className="flex items-center gap-2">
          <CardViewToggle viewMode={cardLayout} onChange={setCardLayout} />
          <Button onClick={() => { setEditingZone(null); setShowModal(true); }} className="rounded-xl h-9 text-xs">
            <Plus className="w-4 h-4 ml-1.5" />
            إضافة منطقة
          </Button>
        </div>
      </div>

      {cardLayout === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map((zone) => (
            <Card key={zone.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedZone(zone)}>
              <CardHeader>
                <CardTitle className="font-amiri flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-500" />
                  {zone.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p><span className="text-slate-500">النوع:</span> {ZONE_TYPE_LABELS[zone.zone_type] || zone.zone_type}</p>
                  <p><span className="text-slate-500">الحالة:</span> {zone.is_active ? 'فعالة' : 'متوقفة'}</p>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); setEditingZone(zone); setShowModal(true); }}
                  >
                    <Pencil className="w-4 h-4 ml-1" />
                    تعديل
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleDelete(zone.id); }}
                  >
                    <Trash2 className="w-4 h-4 ml-1" />
                    حذف
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* List View Cards */
        <div className="flex flex-col gap-3">
          {zones.map((zone) => (
            <Card key={zone.id} className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedZone(zone)}>
              <div className="p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                <div className="flex items-center gap-3 min-w-[200px]">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-amiri font-bold text-foreground">
                      {zone.name}
                    </CardTitle>
                    <span className="text-[11px] text-muted-foreground">
                      {ZONE_TYPE_LABELS[zone.zone_type] || zone.zone_type}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    zone.is_active
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
                      : 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/25'
                  }`}>
                    {zone.is_active ? 'فعالة' : 'متوقفة'}
                  </span>
                </div>

                <div className="flex items-center justify-between lg:justify-end gap-2.5 border-t lg:border-t-0 pt-2.5 lg:pt-0 border-border/40">
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs rounded-xl h-8 px-3"
                      onClick={(e) => { e.stopPropagation(); setEditingZone(zone); setShowModal(true); }}
                    >
                      <Pencil className="w-3.5 h-3.5 ml-1" />
                      تعديل
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="text-xs rounded-xl h-8 px-2.5"
                      onClick={(e) => { e.stopPropagation(); handleDelete(zone.id); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {zones.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            لا توجد مناطق جغرافية. أضف منطقة للبدء.
          </CardContent>
        </Card>
      )}

      {showModal && (
        <ZoneFormModal
          zone={editingZone}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchZones(); }}
        />
      )}

      {selectedZone && (
        <ZoneDetailModal
          zone={selectedZone}
          onClose={() => setSelectedZone(null)}
        />
      )}
    </div>
  );
}

interface ZoneFormModalProps {
  zone: GeofenceZone | null;
  onClose: () => void;
  onSaved: () => void;
}

function ZoneFormModal({ zone, onClose, onSaved }: ZoneFormModalProps) {
  const [name, setName] = useState(zone?.name || '');
  const [latitude, setLatitude] = useState(zone?.latitude?.toString() || '');
  const [longitude, setLongitude] = useState(zone?.longitude?.toString() || '');
  const [radiusKm, setRadiusKm] = useState(zone?.radius_km?.toString() || '');
  const [zoneType, setZoneType] = useState<ZoneType>(zone?.zone_type || 'port');
  const [isActive, setIsActive] = useState(zone?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const supabase = useCallback(() => createClient(), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        name,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radius_km: parseFloat(radiusKm),
        zone_type: zoneType,
        is_active: isActive,
      };

      let error;
      if (zone) {
        const result = await supabase().from('geofence_zones').update(payload).eq('id', zone.id);
        error = result.error;
      } else {
        const result = await supabase().from('geofence_zones').insert(payload);
        error = result.error;
      }

      if (error) throw error;
      toast({ title: zone ? 'تم تحديث المنطقة بنجاح' : 'تم إضافة المنطقة بنجاح' });
      onSaved();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'خطأ غير معروف';
      toast({
        title: 'خطأ في الحفظ',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle className="font-amiri">{zone ? 'تعديل المنطقة' : 'إضافة منطقة جديدة'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">اسم المنطقة</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">نوع المنطقة</label>
              <select
                value={zoneType}
                onChange={(e) => setZoneType(e.target.value as ZoneType)}
                className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
              >
                <option value="port">ميناء</option>
                <option value="border">منطقة حدودية</option>
                <option value="customs">جمارك</option>
                <option value="logistics_hub">محطة لوجستية</option>
                <option value="client_warehouse">مستودع عميل</option>
                <option value="other">أخرى</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">خط العرض</label>
                <input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                  required
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">خط الطول</label>
                <input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                  required
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">نصف القطر (كم)</label>
              <input
                type="number"
                step="any"
                value={radiusKm}
                onChange={(e) => setRadiusKm(e.target.value)}
                className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                required
                dir="ltr"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="isActive" className="text-sm">منطقة فعالة</label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? 'جاري الحفظ...' : 'حفظ'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                إلغاء
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

interface ZoneDetailModalProps {
  zone: GeofenceZone;
  onClose: () => void;
}

function ZoneDetailModal({ zone, onClose }: ZoneDetailModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <Card className="w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <CardTitle className="font-amiri text-xl flex items-center gap-2 text-foreground">
            <Navigation className="w-5 h-5 text-primary" />
            {zone.name}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="pt-5 space-y-4" dir="rtl">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-muted/40 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">خط العرض (Latitude)</p>
              <p className="font-mono text-sm font-bold text-foreground" dir="ltr">{zone.latitude.toFixed(6)}</p>
            </div>
            <div className="p-3 bg-muted/40 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">خط الطول (Longitude)</p>
              <p className="font-mono text-sm font-bold text-foreground" dir="ltr">{zone.longitude.toFixed(6)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-muted/40 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">نوع المنطقة</p>
              <p className="text-sm font-semibold text-foreground">{ZONE_TYPE_LABELS[zone.zone_type] || zone.zone_type}</p>
            </div>
            <div className="p-3 bg-muted/40 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">نصف القطر</p>
              <p className="text-sm font-semibold text-foreground">{zone.radius_km} كم</p>
            </div>
          </div>
          <div className="p-3 bg-muted/40 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground mb-1">الحالة</p>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
              zone.is_active
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
                : 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/25'
            }`}>
              {zone.is_active ? 'فعالة' : 'متوقفة'}
            </span>
          </div>
          <div className="p-3 bg-blue-500/5 rounded-lg border border-blue-500/20">
            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-1">رابط الخريطة</p>
            <a
              href={`https://www.google.com/maps?q=${zone.latitude},${zone.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline font-mono"
              dir="ltr"
            >
              {zone.latitude.toFixed(6)}, {zone.longitude.toFixed(6)}
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
