'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { TransportRoute } from '@/types/database';
import Decimal from 'decimal.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Plus, Pencil, Trash2, Navigation, X, Fuel, Coins, Calculator, RefreshCw, Ship, Sparkles, Anchor, Compass } from 'lucide-react';
import { CardViewToggle, useCardViewMode } from '@/components/ui/card-view-toggle';
import { DEFAULT_ROUTES } from '@/lib/default-data';
import { useLanguage } from '@/components/language-provider';
import {
  calculateInternationalRoute,
  DEFAULT_FERRY_TICKET_COST,
  DEFAULT_TRIPTIK_COST,
  DEFAULT_TRANSIT_ALMERIA_COST,
  DEFAULT_MARSA_MAROC_COST,
  DEFAULT_TOTAL_PORT_FEES,
  DEFAULT_TRUCK_FUEL_RATE,
  DEFAULT_FUEL_PRICE_PER_LITER,
} from '@/lib/route-calculator';

type RouteType = 'outbound' | 'return';

function getRoutePortFees(route: TransportRoute): number | null {
  const fe = route.ferry_cost ?? 0;
  const tr = route.triptik_cost ?? 0;
  const ta = route.transit_almeria_cost ?? 0;
  const mm = route.marsa_maroc_cost ?? 0;
  const total = new Decimal(fe).plus(tr).plus(ta).plus(mm);
  return total.isZero() ? null : total.toNumber();
}

export default function TransportRoutesPage() {
  const { t, dir } = useLanguage();
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
                  {route.distance_km ? (
                    <p><span className="text-slate-500">{t('المسافة:', 'Distance :')}</span> {route.distance_km} {t('كم', 'km')}</p>
                  ) : null}
                  {route.cost !== undefined && route.cost !== null ? (
                    <div className="pt-1 border-t border-border/50 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 flex items-center gap-1 text-xs">
                          <Coins className="w-3.5 h-3.5 text-amber-500" />
                          {t('سعر الشحن:', 'Prix de fret :')}
                        </span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                          {route.cost.toLocaleString()} MAD
                        </span>
                      </div>
                      {getRoutePortFees(route) ? (
                        <div className="flex items-center justify-between text-[11px] text-blue-600 dark:text-blue-400">
                          <span className="flex items-center gap-1">
                            <Ship className="w-3 h-3" />
                            {t('الرسوم المينائية:', 'Frais portuaires :')}
                          </span>
                          <span className="font-mono font-semibold">
                            {getRoutePortFees(route)?.toLocaleString()} MAD
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
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
                  {route.distance_km ? (
                    <span className="text-xs text-muted-foreground font-medium">
                      {route.distance_km} {t('كم', 'km')}
                    </span>
                  ) : null}
                  {route.cost !== undefined && route.cost !== null ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 font-mono">
                      {route.cost.toLocaleString()} MAD
                    </span>
                  ) : null}
                  {getRoutePortFees(route) ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25 font-mono flex items-center gap-1">
                      <Ship className="w-3 h-3" />
                      {getRoutePortFees(route)?.toLocaleString()} MAD
                    </span>
                  ) : null}
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
  const [roadDistanceKm, setRoadDistanceKm] = useState(route?.road_distance_km?.toString() || '');
  const [ferryDistanceKm, setFerryDistanceKm] = useState(route?.ferry_distance_km?.toString() || '');
  const [estimatedDays, setEstimatedDays] = useState(route?.estimated_days?.toString() || '');

  // Cost & Fuel calculation fields
  const [fuelPricePerLiter, setFuelPricePerLiter] = useState(route?.fuel_price_per_liter?.toString() || '13.00');
  const [fuelConsumptionRate, setFuelConsumptionRate] = useState(route?.fuel_consumption_rate?.toString() || '36.0');
  const [fuelCost, setFuelCost] = useState(() => {
    if (route?.fuel_cost !== undefined && route?.fuel_cost !== null) return route.fuel_cost.toString();
    const effectiveKm = route?.road_distance_km || route?.distance_km;
    if (effectiveKm) {
      const dist = new Decimal(effectiveKm);
      const fp = new Decimal(route?.fuel_price_per_liter || 13.0);
      const cr = new Decimal(route?.fuel_consumption_rate || 36.0);
      return dist.dividedBy(100).times(cr).times(fp).toFixed(2);
    }
    return '';
  });
  const [ferryCost, setFerryCost] = useState(route?.ferry_cost?.toString() || (route ? '' : DEFAULT_FERRY_TICKET_COST.toString()));
  const [triptikCost, setTriptikCost] = useState(route?.triptik_cost?.toString() || (route ? '' : DEFAULT_TRIPTIK_COST.toString()));
  const [transitAlmeriaCost, setTransitAlmeriaCost] = useState(route?.transit_almeria_cost?.toString() || (route ? '' : DEFAULT_TRANSIT_ALMERIA_COST.toString()));
  const [marsaMarocCost, setMarsaMarocCost] = useState(route?.marsa_maroc_cost?.toString() || (route ? '' : DEFAULT_MARSA_MAROC_COST.toString()));
  const [customsCost, setCustomsCost] = useState(route?.customs_cost?.toString() || '0');
  const [otherExpenses, setOtherExpenses] = useState(route?.other_expenses?.toString() || '0');

  const totalPortFees = useMemo(() => {
    try {
      const f = new Decimal(ferryCost || 0);
      const tr = new Decimal(triptikCost || 0);
      const ta = new Decimal(transitAlmeriaCost || 0);
      const m = new Decimal(marsaMarocCost || 0);
      return f.plus(tr).plus(ta).plus(m).toFixed(2);
    } catch {
      return '0.00';
    }
  }, [ferryCost, triptikCost, transitAlmeriaCost, marsaMarocCost]);

  const [cost, setCost] = useState(() => {
    if (route?.cost !== undefined && route?.cost !== null) return route.cost.toString();
    const effectiveKm = route?.road_distance_km || route?.distance_km;
    if (effectiveKm) {
      const dist = new Decimal(effectiveKm);
      const fp = new Decimal(route?.fuel_price_per_liter || 13.0);
      const cr = new Decimal(route?.fuel_consumption_rate || 36.0);
      const customs = new Decimal(route?.customs_cost || 0);
      const other = new Decimal(route?.other_expenses || 0);
      const fe = new Decimal(route?.ferry_cost ?? DEFAULT_FERRY_TICKET_COST);
      const tr = new Decimal(route?.triptik_cost ?? DEFAULT_TRIPTIK_COST);
      const ta = new Decimal(route?.transit_almeria_cost ?? DEFAULT_TRANSIT_ALMERIA_COST);
      const mm = new Decimal(route?.marsa_maroc_cost ?? DEFAULT_MARSA_MAROC_COST);
      const fc = dist.dividedBy(100).times(cr).times(fp);
      return fc.plus(fe).plus(tr).plus(ta).plus(mm).plus(customs).plus(other).toFixed(2);
    }
    return '';
  });
  const [isManualCost, setIsManualCost] = useState(false);

  const [isActive, setIsActive] = useState(route?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const supabase = useCallback(() => createClient(), []);

  // Strict Decimal.js calculation helper
  const calculateCosts = useCallback(
    (
      dist: string,
      roadDist: string,
      fuelP: string,
      consR: string,
      feCost: string,
      trCost: string,
      taCost: string,
      mmCost: string,
      customs: string,
      other: string
    ) => {
      try {
        const effectiveRoad = roadDist ? new Decimal(roadDist) : new Decimal(dist || 0);
        const fp = new Decimal(fuelP || 0);
        const cr = new Decimal(consR || 0);
        const fe = new Decimal(feCost || 0);
        const tr = new Decimal(trCost || 0);
        const ta = new Decimal(taCost || 0);
        const mm = new Decimal(mmCost || 0);
        const c = new Decimal(customs || 0);
        const o = new Decimal(other || 0);

        // Fuel is consumed ONLY on road driving distance
        const calcFuel = effectiveRoad.dividedBy(100).times(cr).times(fp);
        const calcTotal = calcFuel.plus(fe).plus(tr).plus(ta).plus(mm).plus(c).plus(o);

        return {
          calcFuel: calcFuel.isZero() ? '' : calcFuel.toFixed(2),
          calcTotal: calcTotal.isZero() ? '' : calcTotal.toFixed(2),
        };
      } catch {
        return { calcFuel: '', calcTotal: '' };
      }
    },
    []
  );

  const handleDistanceChange = (val: string) => {
    setDistanceKm(val);
    if (!isManualCost) {
      const { calcFuel, calcTotal } = calculateCosts(
        val,
        roadDistanceKm,
        fuelPricePerLiter,
        fuelConsumptionRate,
        ferryCost,
        triptikCost,
        transitAlmeriaCost,
        marsaMarocCost,
        customsCost,
        otherExpenses
      );
      setFuelCost(calcFuel);
      setCost(calcTotal);
    }
  };

  const handleRoadDistanceChange = (val: string) => {
    setRoadDistanceKm(val);
    if (!isManualCost) {
      const { calcFuel, calcTotal } = calculateCosts(
        distanceKm,
        val,
        fuelPricePerLiter,
        fuelConsumptionRate,
        ferryCost,
        triptikCost,
        transitAlmeriaCost,
        marsaMarocCost,
        customsCost,
        otherExpenses
      );
      setFuelCost(calcFuel);
      setCost(calcTotal);
    }
  };

  const handleFuelPriceChange = (val: string) => {
    setFuelPricePerLiter(val);
    if (!isManualCost) {
      const { calcFuel, calcTotal } = calculateCosts(
        distanceKm,
        roadDistanceKm,
        val,
        fuelConsumptionRate,
        ferryCost,
        triptikCost,
        transitAlmeriaCost,
        marsaMarocCost,
        customsCost,
        otherExpenses
      );
      setFuelCost(calcFuel);
      setCost(calcTotal);
    }
  };

  const handleFuelConsumptionChange = (val: string) => {
    setFuelConsumptionRate(val);
    if (!isManualCost) {
      const { calcFuel, calcTotal } = calculateCosts(
        distanceKm,
        roadDistanceKm,
        fuelPricePerLiter,
        val,
        ferryCost,
        triptikCost,
        transitAlmeriaCost,
        marsaMarocCost,
        customsCost,
        otherExpenses
      );
      setFuelCost(calcFuel);
      setCost(calcTotal);
    }
  };

  const handleFerryCostChange = (val: string) => {
    setFerryCost(val);
    if (!isManualCost) {
      const { calcFuel, calcTotal } = calculateCosts(
        distanceKm,
        roadDistanceKm,
        fuelPricePerLiter,
        fuelConsumptionRate,
        val,
        triptikCost,
        transitAlmeriaCost,
        marsaMarocCost,
        customsCost,
        otherExpenses
      );
      setFuelCost(calcFuel);
      setCost(calcTotal);
    }
  };

  const handleTriptikCostChange = (val: string) => {
    setTriptikCost(val);
    if (!isManualCost) {
      const { calcFuel, calcTotal } = calculateCosts(
        distanceKm,
        roadDistanceKm,
        fuelPricePerLiter,
        fuelConsumptionRate,
        ferryCost,
        val,
        transitAlmeriaCost,
        marsaMarocCost,
        customsCost,
        otherExpenses
      );
      setFuelCost(calcFuel);
      setCost(calcTotal);
    }
  };

  const handleTransitAlmeriaCostChange = (val: string) => {
    setTransitAlmeriaCost(val);
    if (!isManualCost) {
      const { calcFuel, calcTotal } = calculateCosts(
        distanceKm,
        roadDistanceKm,
        fuelPricePerLiter,
        fuelConsumptionRate,
        ferryCost,
        triptikCost,
        val,
        marsaMarocCost,
        customsCost,
        otherExpenses
      );
      setFuelCost(calcFuel);
      setCost(calcTotal);
    }
  };

  const handleMarsaMarocCostChange = (val: string) => {
    setMarsaMarocCost(val);
    if (!isManualCost) {
      const { calcFuel, calcTotal } = calculateCosts(
        distanceKm,
        roadDistanceKm,
        fuelPricePerLiter,
        fuelConsumptionRate,
        ferryCost,
        triptikCost,
        transitAlmeriaCost,
        val,
        customsCost,
        otherExpenses
      );
      setFuelCost(calcFuel);
      setCost(calcTotal);
    }
  };

  const handleCustomsCostChange = (val: string) => {
    setCustomsCost(val);
    if (!isManualCost) {
      const { calcFuel, calcTotal } = calculateCosts(
        distanceKm,
        roadDistanceKm,
        fuelPricePerLiter,
        fuelConsumptionRate,
        ferryCost,
        triptikCost,
        transitAlmeriaCost,
        marsaMarocCost,
        val,
        otherExpenses
      );
      setFuelCost(calcFuel);
      setCost(calcTotal);
    }
  };

  const handleOtherExpensesChange = (val: string) => {
    setOtherExpenses(val);
    if (!isManualCost) {
      const { calcFuel, calcTotal } = calculateCosts(
        distanceKm,
        roadDistanceKm,
        fuelPricePerLiter,
        fuelConsumptionRate,
        ferryCost,
        triptikCost,
        transitAlmeriaCost,
        marsaMarocCost,
        customsCost,
        val
      );
      setFuelCost(calcFuel);
      setCost(calcTotal);
    }
  };

  const handleAutoCalculateGPS = () => {
    const oLat = parseFloat(originLat);
    const oLng = parseFloat(originLng);
    const dLat = parseFloat(destLat);
    const dLng = parseFloat(destLng);

    if (isNaN(oLat) || isNaN(oLng) || isNaN(dLat) || isNaN(dLng)) {
      toast({
        title: t('تنبيه', 'Attention'),
        description: t('يرجى إدخال إحداثيات GPS للمنشأ والوجهة أولاً لحساب المسار تلقائياً', 'Veuillez saisir les coordonnées GPS d\'abord'),
        variant: 'destructive',
      });
      return;
    }

    const breakdown = calculateInternationalRoute({
      originLat: oLat,
      originLng: oLng,
      destLat: dLat,
      destLng: dLng,
      fuelPricePerLiter: parseFloat(fuelPricePerLiter) || DEFAULT_FUEL_PRICE_PER_LITER,
      fuelConsumptionRate: parseFloat(fuelConsumptionRate) || DEFAULT_TRUCK_FUEL_RATE,
      customsCost: parseFloat(customsCost) || 0,
      otherExpenses: parseFloat(otherExpenses) || 0,
      ferryCost: ferryCost !== '' ? parseFloat(ferryCost) : undefined,
      triptikCost: triptikCost !== '' ? parseFloat(triptikCost) : undefined,
      transitAlmeriaCost: transitAlmeriaCost !== '' ? parseFloat(transitAlmeriaCost) : undefined,
      marsaMarocCost: marsaMarocCost !== '' ? parseFloat(marsaMarocCost) : undefined,
    });

    setDistanceKm(breakdown.totalDistanceKm.toString());
    setRoadDistanceKm(breakdown.roadDistanceKm.toString());
    setFerryDistanceKm(breakdown.ferryDistanceKm.toString());
    setFuelCost(breakdown.fuelCost.toFixed(2));
    setFerryCost(breakdown.ferryCost.toFixed(2));
    setTriptikCost(breakdown.triptikCost.toFixed(2));
    setTransitAlmeriaCost(breakdown.transitAlmeriaCost.toFixed(2));
    setMarsaMarocCost(breakdown.marsaMarocCost.toFixed(2));
    setCost(breakdown.totalFreightCost.toFixed(2));
    setIsManualCost(false);

    toast({
      title: t('تم احتساب المسار والتكاليف آلياً', 'Itinéraire et frais calculés avec succès'),
      description: breakdown.isCrossStrait
        ? t(
            `مسار بحري وبري: ${breakdown.roadDistanceKm} كم بالبر + ${breakdown.ferryDistanceKm} كم بالعبارة. تم احتساب الباخرة (${breakdown.ferryCost} MAD) والتريبتك (${breakdown.triptikCost} MAD) والترانزيت (${breakdown.transitAlmeriaCost} MAD) ومرسى المغرب (${breakdown.marsaMarocCost} MAD).`,
            `Route combinée : ${breakdown.roadDistanceKm} km route + ${breakdown.ferryDistanceKm} km mer.`
          )
        : t(`مسار بري مباشر: ${breakdown.roadDistanceKm} كم.`, `Itinéraire routier direct : ${breakdown.roadDistanceKm} km.`),
    });
  };

  const handleRecalculate = () => {
    setIsManualCost(false);
    const { calcFuel, calcTotal } = calculateCosts(
      distanceKm,
      roadDistanceKm,
      fuelPricePerLiter,
      fuelConsumptionRate,
      ferryCost,
      triptikCost,
      transitAlmeriaCost,
      marsaMarocCost,
      customsCost,
      otherExpenses
    );
    setFuelCost(calcFuel);
    setCost(calcTotal);
  };

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
        road_distance_km: roadDistanceKm ? parseFloat(roadDistanceKm) : null,
        ferry_distance_km: ferryDistanceKm ? parseFloat(ferryDistanceKm) : null,
        estimated_days: estimatedDays ? parseInt(estimatedDays) : null,
        cost: cost ? parseFloat(cost) : null,
        fuel_cost: fuelCost ? parseFloat(fuelCost) : null,
        fuel_price_per_liter: fuelPricePerLiter ? parseFloat(fuelPricePerLiter) : null,
        fuel_consumption_rate: fuelConsumptionRate ? parseFloat(fuelConsumptionRate) : null,
        ferry_cost: ferryCost ? parseFloat(ferryCost) : null,
        triptik_cost: triptikCost ? parseFloat(triptikCost) : null,
        transit_almeria_cost: transitAlmeriaCost ? parseFloat(transitAlmeriaCost) : null,
        marsa_maroc_cost: marsaMarocCost ? parseFloat(marsaMarocCost) : null,
        customs_cost: customsCost ? parseFloat(customsCost) : null,
        other_expenses: otherExpenses ? parseFloat(otherExpenses) : null,
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto" dir={dir}>
      <Card className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
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
                  placeholder="35.7595"
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
                  placeholder="-5.8340"
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
                  placeholder="36.8423"
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
                  placeholder="-2.4623"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Auto Calculate via GPS */}
            <div className="flex items-center justify-between p-2.5 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 rounded-xl">
              <span className="text-xs text-muted-foreground">
                {t('احسب المسافة البرية والبحرية والوقود ومصاريف العبور تلقائياً وفق إحداثيات GPS', 'Calculer les distances et frais via les coordonnées GPS')}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAutoCalculateGPS}
                className="text-xs h-8 gap-1.5 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded-lg shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {t('حساب المسار وتكاليف العبور آلياً', 'Calculer via GPS')}
              </Button>
            </div>

            {/* Distances: Total, Road, Ferry, Days */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">{t('المسافة الإجمالية (كم) *', 'Distance totale (km) *')}</label>
                <input
                  type="number"
                  step="any"
                  value={distanceKm}
                  onChange={(e) => handleDistanceChange(e.target.value)}
                  className="w-full h-9 px-3 py-1.5 border border-input bg-card text-foreground rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                  placeholder="180"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">{t('المسافة البرية (كم)', 'Distance routière (km)')}</label>
                <input
                  type="number"
                  step="any"
                  value={roadDistanceKm}
                  onChange={(e) => handleRoadDistanceChange(e.target.value)}
                  className="w-full h-9 px-3 py-1.5 border border-input bg-card text-foreground rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                  placeholder="150"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 flex items-center gap-1">
                  <Ship className="w-3 h-3 text-blue-500" />
                  {t('المسافة البحرية (كم)', 'Traversée maritime (km)')}
                </label>
                <input
                  type="number"
                  step="any"
                  value={ferryDistanceKm}
                  onChange={(e) => setFerryDistanceKm(e.target.value)}
                  className="w-full h-9 px-3 py-1.5 border border-input bg-card text-foreground rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                  placeholder="30"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">{t('الأيام المتوقعة', 'Jours estimés')}</label>
                <input
                  type="number"
                  value={estimatedDays}
                  onChange={(e) => setEstimatedDays(e.target.value)}
                  className="w-full h-9 px-3 py-1.5 border border-input bg-card text-foreground rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                  placeholder="2"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Cost and Fuel Pricing Calculation Section */}
            <div className="p-4 bg-muted/40 rounded-xl border border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold text-foreground">
                    {t('حساب تكلفة المسار وسعر الشحن المرجعي', 'Calcul du coût de l\'itinéraire et fret')}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRecalculate}
                  className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className="w-3 h-3" />
                  {t('إعادة الحساب التلقائي', 'Recalcul automatique')}
                </Button>
              </div>

              {/* Fuel Price & Consumption Rate */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    {t('سعر المحروقات الحالي (MAD/لتر)', 'Prix carburant actuel (MAD/L)')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={fuelPricePerLiter}
                    onChange={(e) => handleFuelPriceChange(e.target.value)}
                    className="w-full h-9 px-3 py-1.5 border border-input bg-card text-foreground rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                    placeholder="13.00"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    {t('معدل الاستهلاك (لتر / 100 كم أو %)', 'Consommation (L/100km)')}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={fuelConsumptionRate}
                    onChange={(e) => handleFuelConsumptionChange(e.target.value)}
                    className="w-full h-9 px-3 py-1.5 border border-input bg-card text-foreground rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                    placeholder="36.0"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Maritime & Port Expenses (الباخرة، التريبتك، ترانزيت ألميريا، مرسى المغرب) */}
              <div className="pt-2 border-t border-border/50 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Ship className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    {t('الرسوم المينائية ومصاريف العبور الدولي (MAD)', 'Frais portuaires & transit maritime (MAD)')}
                  </span>
                  <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                    {t('مجموع الرسوم:', 'Total :')} {totalPortFees} MAD <span className="font-sans font-normal text-[10px] text-muted-foreground">({t('قابلة للتعديل', 'modifiables')})</span>
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-foreground mb-1">
                      {t('الباخرة / العبارة', 'Billet Bateau / Ferry')}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={ferryCost}
                      onChange={(e) => handleFerryCostChange(e.target.value)}
                      className="w-full h-8 px-2.5 py-1 border border-input bg-card text-foreground rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                      placeholder="4500.00"
                      dir="ltr"
                    />
                    <span className="text-[10px] text-muted-foreground block mt-0.5">{t('افتراضي: 4,500', 'Défaut: 4 500')}</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-foreground mb-1">
                      {t('التريبتك (Triptik / CPD)', 'Triptyque (CPD)')}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={triptikCost}
                      onChange={(e) => handleTriptikCostChange(e.target.value)}
                      className="w-full h-8 px-2.5 py-1 border border-input bg-card text-foreground rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                      placeholder="500.00"
                      dir="ltr"
                    />
                    <span className="text-[10px] text-muted-foreground block mt-0.5">{t('افتراضي: 500', 'Défaut: 500')}</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-foreground mb-1">
                      {t('ترانزيت ألميريا / الجزيرة', 'Transit Almería / Algés.')}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={transitAlmeriaCost}
                      onChange={(e) => handleTransitAlmeriaCostChange(e.target.value)}
                      className="w-full h-8 px-2.5 py-1 border border-input bg-card text-foreground rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                      placeholder="1200.00"
                      dir="ltr"
                    />
                    <span className="text-[10px] text-muted-foreground block mt-0.5">{t('افتراضي: 1,200', 'Défaut: 1 200')}</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-foreground mb-1">
                      {t('مناولة مرسى المغرب', 'Marsa Maroc (Port)')}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={marsaMarocCost}
                      onChange={(e) => handleMarsaMarocCostChange(e.target.value)}
                      className="w-full h-8 px-2.5 py-1 border border-input bg-card text-foreground rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                      placeholder="800.00"
                      dir="ltr"
                    />
                    <span className="text-[10px] text-muted-foreground block mt-0.5">{t('افتراضي: 800', 'Défaut: 800')}</span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {t(
                    '* الرسوم المينائية مدرجة كقيم مرجعية قياسية وموحدة، ويمكنك تعديل أي بند منها بحرية وتحديث تكلفة الشحن فوراً.',
                    '* Frais portuaires unifiés en tant que valeurs de référence, modifiables à tout moment.'
                  )}
                </p>
              </div>

              {/* Fuel, Customs, Other */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/50">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Fuel className="w-3 h-3 text-amber-500" />
                    {t('المحروقات (برياً فقط) (MAD)', 'Carburant (Route) (MAD)')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={fuelCost}
                    onChange={(e) => {
                      setFuelCost(e.target.value);
                      setIsManualCost(true);
                    }}
                    className="w-full h-9 px-3 py-1.5 border border-input bg-card text-foreground rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                    placeholder="0.00"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    {t('مصاريف التعشير / الجمارك (MAD)', 'Frais de dédouanement (MAD)')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={customsCost}
                    onChange={(e) => handleCustomsCostChange(e.target.value)}
                    className="w-full h-9 px-3 py-1.5 border border-input bg-card text-foreground rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                    placeholder="0.00"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    {t('مصاريف ثابتة أخرى (MAD)', 'Autres frais fixes (MAD)')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={otherExpenses}
                    onChange={(e) => handleOtherExpensesChange(e.target.value)}
                    className="w-full h-9 px-3 py-1.5 border border-input bg-card text-foreground rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                    placeholder="0.00"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-border/60">
                <label className="block text-xs font-bold text-foreground mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    {t('سعر الشحن الإجمالي المقترح (MAD)', 'Prix de fret global recommandé (MAD)')}
                  </span>
                  {isManualCost && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">
                      {t('(معدل يدوياً)', '(Modifié manuellement)')}
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={cost}
                  onChange={(e) => {
                    setCost(e.target.value);
                    setIsManualCost(true);
                  }}
                  className="w-full h-10 px-3 py-2 border border-emerald-500/50 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200 rounded-lg text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                  placeholder="0.00"
                  dir="ltr"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {t(
                    'المعادلة: المحروقات (المسافة البرية ÷ 100 × معدل الاستهلاك × سعر اللتر) + الباخرة + التريبتك + ترانزيت ألميريا + مرسى المغرب + التعشير + مصاريف أخرى',
                    'Formule : Carburant (Route) + Bateau + Triptyque + Transit Almería + Marsa Maroc + Dédouanement + Autres'
                  )}
                </p>
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={onClose} dir={dir}>
      <Card className="w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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
          {/* Financial & Pricing Summary Card */}
          <div className="p-4 bg-muted/40 rounded-xl border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-bold text-foreground">
                  {t('سعر الشحن المرجعي للمسار', 'Prix de fret de référence')}
                </span>
              </div>
              <span className="text-base font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {route.cost !== undefined && route.cost !== null ? `${route.cost.toLocaleString()} MAD` : '—'}
              </span>
            </div>

            {/* Unified Port & Maritime Expenses Section */}
            <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Ship className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  {t('الرسوم المينائية ومصاريف العبور الدولي المعتمدة', 'Frais portuaires & transit maritime')}
                </span>
                <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-300">
                  {t('المجموع:', 'Total :')} {((route.ferry_cost ?? 4500) + (route.triptik_cost ?? 500) + (route.transit_almeria_cost ?? 1200) + (route.marsa_maroc_cost ?? 800)).toLocaleString()} MAD
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2 bg-card rounded-lg border border-border/60">
                  <p className="text-muted-foreground text-[10px] mb-0.5">{t('الباخرة / العبارة', 'Billet Bateau')}</p>
                  <p className="font-semibold font-mono text-foreground">
                    {route.ferry_cost !== undefined && route.ferry_cost !== null ? `${route.ferry_cost.toLocaleString()} MAD` : '4,500 MAD'}
                  </p>
                </div>
                <div className="p-2 bg-card rounded-lg border border-border/60">
                  <p className="text-muted-foreground text-[10px] mb-0.5">{t('التريبتك (Triptik)', 'Triptyque')}</p>
                  <p className="font-semibold font-mono text-foreground">
                    {route.triptik_cost !== undefined && route.triptik_cost !== null ? `${route.triptik_cost.toLocaleString()} MAD` : '500 MAD'}
                  </p>
                </div>
                <div className="p-2 bg-card rounded-lg border border-border/60">
                  <p className="text-muted-foreground text-[10px] mb-0.5">{t('ترانزيت ألميريا', 'Transit Almería')}</p>
                  <p className="font-semibold font-mono text-foreground">
                    {route.transit_almeria_cost !== undefined && route.transit_almeria_cost !== null ? `${route.transit_almeria_cost.toLocaleString()} MAD` : '1,200 MAD'}
                  </p>
                </div>
                <div className="p-2 bg-card rounded-lg border border-border/60">
                  <p className="text-muted-foreground text-[10px] mb-0.5">{t('مرسى المغرب', 'Marsa Maroc')}</p>
                  <p className="font-semibold font-mono text-foreground">
                    {route.marsa_maroc_cost !== undefined && route.marsa_maroc_cost !== null ? `${route.marsa_maroc_cost.toLocaleString()} MAD` : '800 MAD'}
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {t('* بنود مرجعية موحدة لهذا المسار، وقابلة للتعديل عند تسجيل أي رحلة جديدة.', '* Valeurs de référence modifiables pour chaque voyage.')}
              </p>
            </div>

            {/* Land & Customs Expenses */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-border/50 text-xs">
              <div className="p-2.5 bg-card rounded-lg border border-border/50">
                <p className="text-muted-foreground text-[11px] flex items-center gap-1 mb-0.5">
                  <Fuel className="w-3 h-3 text-amber-500" />
                  {t('المحروقات (برياً)', 'Carburant')}
                </p>
                <p className="font-semibold font-mono text-foreground">
                  {route.fuel_cost !== undefined && route.fuel_cost !== null ? `${route.fuel_cost.toLocaleString()} MAD` : '—'}
                </p>
              </div>
              <div className="p-2.5 bg-card rounded-lg border border-border/50">
                <p className="text-muted-foreground text-[11px] mb-0.5">{t('التعشير والجمارك', 'Dédouanement')}</p>
                <p className="font-semibold font-mono text-foreground">
                  {route.customs_cost !== undefined && route.customs_cost !== null ? `${route.customs_cost.toLocaleString()} MAD` : '—'}
                </p>
              </div>
              <div className="p-2.5 bg-card rounded-lg border border-border/50">
                <p className="text-muted-foreground text-[11px] mb-0.5">{t('مصاريف أخرى', 'Autres frais')}</p>
                <p className="font-semibold font-mono text-foreground">
                  {route.other_expenses !== undefined && route.other_expenses !== null ? `${route.other_expenses.toLocaleString()} MAD` : '—'}
                </p>
              </div>
            </div>

            {(route.fuel_price_per_liter || route.fuel_consumption_rate || route.road_distance_km || route.ferry_distance_km) && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground pt-1 px-1">
                {route.road_distance_km && <span>{t('طريق:', 'Route :')} {route.road_distance_km} كم</span>}
                {route.ferry_distance_km && <span>{t('بحر:', 'Mer :')} {route.ferry_distance_km} كم</span>}
                {route.fuel_price_per_liter && <span>{t('سعر اللتر:', 'Prix/L :')} {route.fuel_price_per_liter} MAD</span>}
                {route.fuel_consumption_rate && <span>{t('الاستهلاك:', 'Conso :')} {route.fuel_consumption_rate}%</span>}
              </div>
            )}
          </div>

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
