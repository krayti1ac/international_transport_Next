'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { TransportRoute } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Plus, Pencil, Trash2, Navigation, X } from 'lucide-react';
import { CardViewToggle, useCardViewMode } from '@/components/ui/card-view-toggle';
import { DEFAULT_ROUTES } from '@/lib/default-data';
import { useLanguage } from '@/components/language-provider';

type RouteType = 'outbound' | 'return';

export default function TransportRoutesPage() {
  const { t, dir, locale } = useLanguage();
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<TransportRoute | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<TransportRoute | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [cardLayout, setCardLayout] = useCardViewMode('transport_routes', 'grid');
  const { toast } = useToast();
  const supabase = useCallback(() => createClient(), []);

  const getRouteTypeLabel = (type: string) => {
    if (type === 'outbound') return t('رحلات الذهاب (تصدير)', 'Aller (Export)');
    if (type === 'return') return t('رحلات العودة (استيراد)', 'Retour (Import)');
    return type;
  };

  const fetchRoutes = useCallback(async () => {
    try {
      let query = supabase().from('transport_routes').select('*');
      if (filterType !== 'all') {
        query = query.eq('route_type', filterType);
      }
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.warn('Could not fetch transport routes from database, falling back to default data:', error);
        const filtered = DEFAULT_ROUTES.filter((r) => filterType === 'all' || r.route_type === filterType);
        setRoutes(filtered);
      } else if (data && data.length > 0) {
        setRoutes(data);
      } else {
        const filtered = DEFAULT_ROUTES.filter((r) => filterType === 'all' || r.route_type === filterType);
        setRoutes(filtered);
      }
    } catch (error: unknown) {
      console.warn('Transport routes fetch error, falling back to defaults:', error);
      const filtered = DEFAULT_ROUTES.filter((r) => filterType === 'all' || r.route_type === filterType);
      setRoutes(filtered);
    } finally {
      setLoading(false);
    }
  }, [supabase, filterType]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  const handleDelete = async (id: number) => {
    if (!confirm(t('هل أنت متأكد من حذف هذا المسار؟', 'Êtes-vous sûr de vouloir supprimer cet itinéraire ?'))) return;
    try {
      const { error } = await supabase().from('transport_routes').delete().eq('id', id);
      if (error) throw error;
      toast({ title: t('تم حذف المسار بنجاح', 'Itinéraire supprimé avec succès') });
      fetchRoutes();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('خطأ غير معروف', 'Erreur inconnue');
      toast({
        title: t('خطأ في الحذف', 'Erreur de suppression'),
        description: message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96" dir={dir}>
        <p className="text-slate-500">{t('جاري تحميل البيانات...', 'Chargement des données...')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold font-amiri">{t('قائمة المسارات', 'Liste des Itinéraires')}</h1>
        <div className="flex items-center gap-2">
          <CardViewToggle viewMode={cardLayout} onChange={setCardLayout} />
          <Button onClick={() => { setEditingRoute(null); setShowModal(true); }} className="rounded-xl h-9 text-xs">
            <Plus className={`w-4 h-4 ${dir === 'rtl' ? 'ml-1.5' : 'mr-1.5'}`} />
            {t('إضافة مسار', 'Ajouter un itinéraire')}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={filterType === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('all')}
          className="rounded-xl h-8 text-xs"
        >
          {t('الكل', 'Tous')}
        </Button>
        <Button
          variant={filterType === 'outbound' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('outbound')}
          className="rounded-xl h-8 text-xs"
        >
          🛫 {t('ذهاب (تصدير)', 'Aller (Export)')}
        </Button>
        <Button
          variant={filterType === 'return' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('return')}
          className="rounded-xl h-8 text-xs"
        >
          🛬 {t('عودة (استيراد)', 'Retour (Import)')}
        </Button>
      </div>

      {cardLayout === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {routes.map((route) => (
            <Card key={route.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedRoute(route)}>
              <CardHeader>
                <CardTitle className="font-amiri flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-500" />
                  {route.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p><span className="text-slate-500">{t('النوع:', 'Type :')}</span> {getRouteTypeLabel(route.route_type)}</p>
                  <p><span className="text-slate-500">{t('المنشأ:', 'Origine :')}</span> {route.origin}</p>
                  <p><span className="text-slate-500">{t('الوجهة:', 'Destination :')}</span> {route.destination}</p>
                  <p><span className="text-slate-500">{t('الحالة:', 'Statut :')}</span> {route.is_active ? t('فعال', 'Actif') : t('متوقف', 'Inactif')}</p>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); setEditingRoute(route); setShowModal(true); }}
                  >
                    <Pencil className={`w-4 h-4 ${dir === 'rtl' ? 'ml-1' : 'mr-1'}`} />
                    {t('تعديل', 'Modifier')}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleDelete(route.id); }}
                  >
                    <Trash2 className={`w-4 h-4 ${dir === 'rtl' ? 'ml-1' : 'mr-1'}`} />
                    {t('حذف', 'Supprimer')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {routes.map((route) => (
            <Card key={route.id} className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedRoute(route)}>
              <div className="p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                <div className="flex items-center gap-3 min-w-[200px]">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    route.route_type === 'outbound'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  }`}>
                    <Navigation className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-amiri font-bold text-foreground">
                      {route.name}
                    </CardTitle>
                    <span className="text-[11px] text-muted-foreground">
                      {route.origin} → {route.destination}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    route.route_type === 'outbound'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
                      : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25'
                  }`}>
                    {getRouteTypeLabel(route.route_type)}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    route.is_active
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
                      : 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/25'
                  }`}>
                    {route.is_active ? t('فعال', 'Actif') : t('متوقف', 'Inactif')}
                  </span>
                </div>

                <div className="flex items-center justify-between lg:justify-end gap-2.5 border-t lg:border-t-0 pt-2.5 lg:pt-0 border-border/40">
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs rounded-xl h-8 px-3"
                      onClick={(e) => { e.stopPropagation(); setEditingRoute(route); setShowModal(true); }}
                    >
                      <Pencil className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'ml-1' : 'mr-1'}`} />
                      {t('تعديل', 'Modifier')}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="text-xs rounded-xl h-8 px-2.5"
                      onClick={(e) => { e.stopPropagation(); handleDelete(route.id); }}
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

      {routes.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            {t('لا توجد مسارات. أضف مسار للبدء.', 'Aucun itinéraire. Ajoutez un itinéraire pour commencer.')}
          </CardContent>
        </Card>
      )}

      {showModal && (
        <RouteFormModal
          route={editingRoute}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchRoutes(); }}
        />
      )}

      {selectedRoute && (
        <RouteDetailModal
          route={selectedRoute}
          onClose={() => setSelectedRoute(null)}
        />
      )}
    </div>
  );
}

interface RouteFormModalProps {
  route: TransportRoute | null;
  onClose: () => void;
  onSaved: () => void;
}

function RouteFormModal({ route, onClose, onSaved }: RouteFormModalProps) {
  const { t, dir } = useLanguage();
  const [name, setName] = useState(route?.name || '');
  const [routeType, setRouteType] = useState<RouteType>(route?.route_type || 'outbound');
  const [origin, setOrigin] = useState(route?.origin || '');
  const [destination, setDestination] = useState(route?.destination || '');
  const [originLat, setOriginLat] = useState(route?.origin_latitude?.toString() || '');
  const [originLng, setOriginLng] = useState(route?.origin_longitude?.toString() || '');
  const [destLat, setDestLat] = useState(route?.destination_latitude?.toString() || '');
  const [destLng, setDestLng] = useState(route?.destination_longitude?.toString() || '');
  const [distanceKm, setDistanceKm] = useState(route?.distance_km?.toString() || '');
  const [estimatedDays, setEstimatedDays] = useState(route?.estimated_days?.toString() || '');
  const [isActive, setIsActive] = useState(route?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const supabase = useCallback(() => createClient(), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        name,
        route_type: routeType,
        origin,
        destination,
        origin_latitude: originLat ? parseFloat(originLat) : null,
        origin_longitude: originLng ? parseFloat(originLng) : null,
        destination_latitude: destLat ? parseFloat(destLat) : null,
        destination_longitude: destLng ? parseFloat(destLng) : null,
        distance_km: distanceKm ? parseFloat(distanceKm) : null,
        estimated_days: estimatedDays ? parseInt(estimatedDays) : null,
        is_active: isActive,
      };

      let error;
      if (route) {
        const result = await supabase().from('transport_routes').update(payload).eq('id', route.id);
        error = result.error;
      } else {
        const result = await supabase().from('transport_routes').insert(payload);
        error = result.error;
      }

      if (error) throw error;
      toast({ title: route ? t('تم تحديث المسار بنجاح', 'Itinéraire mis à jour avec succès') : t('تم إضافة المسار بنجاح', 'Itinéraire ajouté avec succès') });
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
      <Card className="w-full max-w-lg mx-4">
        <CardHeader>
          <CardTitle className="font-amiri">{route ? t('تعديل المسار', 'Modifier l\'itinéraire') : t('إضافة مسار جديد', 'Ajouter un itinéraire')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('اسم المسار', 'Nom de l\'itinéraire')}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors"
                placeholder={t('مثال: طنجة → ألميريا', 'Ex: Tanger → Almeria')}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('نوع المسار', 'Type d\'itinéraire')}</label>
              <select
                value={routeType}
                onChange={(e) => setRouteType(e.target.value as RouteType)}
                className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
              >
                <option value="outbound">{t('رحلات الذهاب (تصدير - Aller)', 'Aller (Export)')}</option>
                <option value="return">{t('رحلات العودة (استيراد - Retour)', 'Retour (Import)')}</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('المنشأ', 'Origine')}</label>
                <input
                  type="text"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors"
                  placeholder={t('طنجة', 'Tanger')}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('الوجهة', 'Destination')}</label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors"
                  placeholder={t('ألميريا', 'Almeria')}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('خط عرض المنشأ', 'Latitude Origine')}</label>
                <input
                  type="number"
                  step="any"
                  value={originLat}
                  onChange={(e) => setOriginLat(e.target.value)}
                  className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('خط طول المنشأ', 'Longitude Origine')}</label>
                <input
                  type="number"
                  step="any"
                  value={originLng}
                  onChange={(e) => setOriginLng(e.target.value)}
                  className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                  dir="ltr"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('خط عرض الوجهة', 'Latitude Destination')}</label>
                <input
                  type="number"
                  step="any"
                  value={destLat}
                  onChange={(e) => setDestLat(e.target.value)}
                  className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('خط طول الوجهة', 'Longitude Destination')}</label>
                <input
                  type="number"
                  step="any"
                  value={destLng}
                  onChange={(e) => setDestLng(e.target.value)}
                  className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                  dir="ltr"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('المسافة (كم)', 'Distance (km)')}</label>
                <input
                  type="number"
                  step="any"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                  className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('الأيام المتوقعة', 'Jours estimés')}</label>
                <input
                  type="number"
                  value={estimatedDays}
                  onChange={(e) => setEstimatedDays(e.target.value)}
                  className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                  dir="ltr"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="isActive" className="text-sm">{t('مسار فعال', 'Itinéraire actif')}</label>
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

interface RouteDetailModalProps {
  route: TransportRoute;
  onClose: () => void;
}

function RouteDetailModal({ route, onClose }: RouteDetailModalProps) {
  const { t, dir } = useLanguage();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose} dir={dir}>
      <Card className="w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <CardTitle className="font-amiri text-xl flex items-center gap-2 text-foreground">
            <Navigation className="w-5 h-5 text-primary" />
            {route.name}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="pt-5 space-y-4" dir={dir}>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-muted/40 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">{t('خط عرض المنشأ', 'Latitude Origine')}</p>
              <p className="font-mono text-sm font-bold text-foreground" dir="ltr">
                {route.origin_latitude?.toFixed(6) || '—'}
              </p>
            </div>
            <div className="p-3 bg-muted/40 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">{t('خط طول المنشأ', 'Longitude Origine')}</p>
              <p className="font-mono text-sm font-bold text-foreground" dir="ltr">
                {route.origin_longitude?.toFixed(6) || '—'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-muted/40 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">{t('خط عرض الوجهة', 'Latitude Destination')}</p>
              <p className="font-mono text-sm font-bold text-foreground" dir="ltr">
                {route.destination_latitude?.toFixed(6) || '—'}
              </p>
            </div>
            <div className="p-3 bg-muted/40 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">{t('خط طول الوجهة', 'Longitude Destination')}</p>
              <p className="font-mono text-sm font-bold text-foreground" dir="ltr">
                {route.destination_longitude?.toFixed(6) || '—'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-muted/40 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">{t('المسافة', 'Distance')}</p>
              <p className="text-sm font-semibold text-foreground">{route.distance_km ? `${route.distance_km} ${t('كم', 'km')}` : '—'}</p>
            </div>
            <div className="p-3 bg-muted/40 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">{t('الأيام المتوقعة', 'Jours estimés')}</p>
              <p className="text-sm font-semibold text-foreground">{route.estimated_days || '—'}</p>
            </div>
          </div>
          <div className="p-3 bg-muted/40 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground mb-1">{t('نوع المسار', 'Type d\'itinéraire')}</p>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
              route.route_type === 'outbound'
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
                : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25'
            }`}>
              {route.route_type === 'outbound' ? t('رحلات الذهاب (تصدير)', 'Aller (Export)') : t('رحلات العودة (استيراد)', 'Retour (Import)')}
            </span>
          </div>
          {route.origin_latitude && route.origin_longitude && (
            <div className="p-3 bg-blue-500/5 rounded-lg border border-blue-500/20">
              <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-1">{t('رابط الخريطة', 'Lien Carte')}</p>
              <a
                href={`https://www.google.com/maps?q=${route.origin_latitude},${route.origin_longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline font-mono"
                dir="ltr"
              >
                {route.origin_latitude.toFixed(6)}, {route.origin_longitude.toFixed(6)}
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
