'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Save, Navigation, PlaneTakeoff, PlaneLanding, Coins, Ship } from 'lucide-react';
import { TruckIcon, TrailerIcon } from '@/components/icons/vehicle-icons';
import { useLanguage } from '@/components/language-provider';
import Decimal from 'decimal.js';
import type { TripOrder, Client, Driver, Truck, Trailer, TransportRoute } from '@/types/database';
import { DEFAULT_CLIENTS, DEFAULT_DRIVERS, DEFAULT_TRUCKS, DEFAULT_TRAILERS, fallbackArray } from '@/lib/default-data';
import { useAutoIssueReporter } from '@/hooks/useAutoIssueReporter';

interface TripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (tripData: Partial<TripOrder>) => Promise<void>;
  clients: Client[];
  drivers: Driver[];
  trucks: Truck[];
  trailers?: Trailer[];
  transportRoutes: TransportRoute[];
  initialData?: TripOrder | null;
}

export function TripFormModal({
  isOpen,
  onClose,
  onSubmit,
  clients,
  drivers,
  trucks,
  trailers = [],
  transportRoutes,
  initialData,
}: TripModalProps) {
  const availableClients = fallbackArray(clients, DEFAULT_CLIENTS);
  const availableDrivers = fallbackArray(drivers, DEFAULT_DRIVERS);
  const availableTrucks = fallbackArray(trucks, DEFAULT_TRUCKS);
  const availableTrailers = fallbackArray(trailers, DEFAULT_TRAILERS);
  const availableRoutes = fallbackArray(transportRoutes, []);

  // العملاء مخصصون إما لرحلات الذهاب أو رحلات العودة حصرياً (وليس معاً)
  const exportClients = useMemo(
    () => availableClients.filter((c) => (c.client_type || 'export') === 'export'),
    [availableClients]
  );
  const importClients = useMemo(
    () => availableClients.filter((c) => c.client_type === 'import'),
    [availableClients]
  );

  const outboundRoutes = useMemo(
    () => availableRoutes.filter((r) => r.route_type === 'outbound' && r.is_active),
    [availableRoutes]
  );
  const returnRoutes = useMemo(
    () => availableRoutes.filter((r) => r.route_type === 'return' && r.is_active),
    [availableRoutes]
  );

  const { dir, t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'fleet'>('export');

  const { reportValidation, reportSubmissionError, reportCalculationAnomaly } = useAutoIssueReporter({
    screenName: 'إدارة وتسجيل الرحلات الدولية',
    screenRoute: '/trips',
    componentName: 'TripFormModal',
    defaultSeverity: 'medium',
  });

  const [formData, setFormData] = useState<Partial<TripOrder>>({
    route: '',
    route_export: '',
    route_import: '',
    price: 0,
    price_export: 0,
    price_import: 0,
    departure_date: '',
    unloading_date_export: '',
    loading_date_import: '',
    unloading_date_import: '',
    status: 'pending',
    cmr_number: '',
    cmr_export_number: '',
    cmr_import_number: '',
    client_id: undefined,
    client_import_id: undefined,
    driver_id: undefined,
    truck_id: undefined,
    trailer_id: undefined,
    ferry_company: 'Baleària / FRS',
    ferry_localizador: '',
    ferry_company_import: 'Baleària / FRS',
    ferry_localizador_import: '',
    ferry_cost: 4500,
    triptik_cost: 500,
    transit_almeria_cost: 1200,
    marsa_maroc_cost: 800,
    goods_description_export: '',
    goods_description_import: '',
    weight_export: undefined,
    weight_import: undefined,
    shipping_latitude: undefined,
    shipping_longitude: undefined,
    unloading_latitude: undefined,
    unloading_longitude: undefined,
  });

  const totalTripPortFees = useMemo(() => {
    try {
      const f = new Decimal(formData.ferry_cost ?? 0);
      const tr = new Decimal(formData.triptik_cost ?? 0);
      const ta = new Decimal(formData.transit_almeria_cost ?? 0);
      const m = new Decimal(formData.marsa_maroc_cost ?? 0);
      return f.plus(tr).plus(ta).plus(m).toFixed(2);
    } catch {
      return '0.00';
    }
  }, [formData.ferry_cost, formData.triptik_cost, formData.transit_almeria_cost, formData.marsa_maroc_cost]);

  // Deduplicate drivers by name to avoid repeated entries in the dropdown,
  // prioritizing currently selected driver if active.
  const uniqueDrivers = useMemo(() => {
    const map = new Map<string, Driver>();
    for (const driver of availableDrivers) {
      const nameKey = driver.name?.trim().toLowerCase();
      if (!nameKey) continue;
      if (!map.has(nameKey) || driver.id === formData.driver_id) {
        map.set(nameKey, driver);
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'ar', { sensitivity: 'base' })
    );
  }, [availableDrivers, formData.driver_id]);

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setFormData({
        ...initialData,
        route_export: initialData.route_export || initialData.route || '',
        route_import: initialData.route_import || '',
        price_export: initialData.price_export || initialData.price || 0,
        price_import: initialData.price_import || 0,
        cmr_export_number: initialData.cmr_export_number || initialData.cmr_number || '',
        cmr_import_number: initialData.cmr_import_number || '',
        goods_description_export: initialData.goods_description_export || '',
        goods_description_import: initialData.goods_description_import || '',
        ferry_cost: initialData.ferry_cost ?? 4500,
        triptik_cost: initialData.triptik_cost ?? 500,
        transit_almeria_cost: initialData.transit_almeria_cost ?? 1200,
        marsa_maroc_cost: initialData.marsa_maroc_cost ?? 800,
      });
    } else {
      const ts = Date.now().toString().slice(-5);
      setFormData({
        route: '',
        route_export: '',
        route_import: '',
        price: 0,
        price_export: 0,
        price_import: 0,
        departure_date: new Date().toISOString().split('T')[0],
        unloading_date_export: '',
        loading_date_import: '',
        unloading_date_import: '',
        status: 'pending',
        cmr_number: `CMR-EXP-${ts}`,
        cmr_export_number: `CMR-EXP-${ts}`,
        cmr_import_number: `CMR-IMP-${ts}`,
        client_id: undefined,
        client_import_id: undefined,
        driver_id: undefined,
        truck_id: undefined,
        trailer_id: undefined,
        ferry_company: 'Baleària / FRS',
        ferry_localizador: '',
        ferry_company_import: 'Baleària / FRS',
        ferry_localizador_import: '',
        ferry_cost: 4500,
        triptik_cost: 500,
        transit_almeria_cost: 1200,
        marsa_maroc_cost: 800,
        goods_description_export: '',
        goods_description_import: '',
        shipping_latitude: undefined,
        shipping_longitude: undefined,
        unloading_latitude: undefined,
        unloading_longitude: undefined,
      });
    }
  }, [initialData, isOpen, exportClients, importClients]);

  const handleDriverChange = (driverIdStr: string) => {
    const dId = parseInt(driverIdStr);
    const selectedDriver = drivers.find((d) => d.id === dId);
    const defTruckId = selectedDriver?.default_truck_id;
    const defTruck = trucks.find((t) => t.id === defTruckId);

    setFormData((prev) => ({
      ...prev,
      driver_id: dId || undefined,
      truck_id: prev.truck_id || defTruckId || undefined,
      trailer_id: prev.trailer_id || defTruck?.default_trailer_id || undefined,
    }));
  };

  const computeRoutePriceForTruck = (selectedRoute: TransportRoute, truckId?: number) => {
    const selectedTruck = availableTrucks.find((t) => t.id === truckId);
    const truckFuelRate = selectedTruck?.fuel_consumption_rate ?? selectedRoute.fuel_consumption_rate ?? 36.0;
    const fuelPrice = selectedRoute.fuel_price_per_liter ?? 13.0;
    const roadKm = selectedRoute.road_distance_km ?? selectedRoute.distance_km ?? 0;

    const fuelDec = new Decimal(roadKm).dividedBy(100).times(new Decimal(truckFuelRate)).times(new Decimal(fuelPrice));
    const ferryDec = new Decimal(selectedRoute.ferry_cost ?? 0);
    const triptikDec = new Decimal(selectedRoute.triptik_cost ?? 0);
    const transitDec = new Decimal(selectedRoute.transit_almeria_cost ?? 0);
    const marsaDec = new Decimal(selectedRoute.marsa_maroc_cost ?? 0);
    const customsDec = new Decimal(selectedRoute.customs_cost ?? 0);
    const otherDec = new Decimal(selectedRoute.other_expenses ?? 0);

    const sumDec = fuelDec
      .plus(ferryDec)
      .plus(triptikDec)
      .plus(transitDec)
      .plus(marsaDec)
      .plus(customsDec)
      .plus(otherDec);

    const finalTotal = sumDec.greaterThan(0) ? sumDec : new Decimal(selectedRoute.cost || 0);

    return {
      totalCost: parseFloat(finalTotal.toFixed(2)),
      fuelCost: parseFloat(fuelDec.toFixed(2)),
      ferryCost: parseFloat(ferryDec.toFixed(2)),
      triptikCost: parseFloat(triptikDec.toFixed(2)),
      transitAlmeriaCost: parseFloat(transitDec.toFixed(2)),
      marsaMarocCost: parseFloat(marsaDec.toFixed(2)),
      truckFuelRate,
    };
  };

  const handleTruckChange = (truckIdStr: string) => {
    const tId = parseInt(truckIdStr);
    const selectedTruck = trucks.find((t) => t.id === tId);

    setFormData((prev) => {
      const next: Partial<TripOrder> = {
        ...prev,
        truck_id: tId || undefined,
        driver_id: prev.driver_id || selectedTruck?.default_driver_id || undefined,
        trailer_id: prev.trailer_id || selectedTruck?.default_trailer_id || undefined,
      };

      // Recalculate export price if route was already chosen
      if (prev.route_export) {
        const selectedExportRoute = outboundRoutes.find(
          (r) => `${r.origin} → ${r.destination}` === prev.route_export || r.name === prev.route_export
        );
        if (selectedExportRoute) {
          const breakdown = computeRoutePriceForTruck(selectedExportRoute, tId);
          next.price_export = breakdown.totalCost;
        }
      }

      // Recalculate import price if route was already chosen
      if (prev.route_import) {
        const selectedImportRoute = returnRoutes.find(
          (r) => `${r.origin} → ${r.destination}` === prev.route_import || r.name === prev.route_import
        );
        if (selectedImportRoute) {
          const breakdown = computeRoutePriceForTruck(selectedImportRoute, tId);
          next.price_import = breakdown.totalCost;
        }
      }

      const exp = new Decimal(next.price_export || 0);
      const imp = new Decimal(next.price_import || 0);
      next.price = exp.plus(imp).toNumber();

      return next;
    });
  };

  const handleRouteExportChange = (routeStr: string) => {
    const selectedRoute = outboundRoutes.find(
      (r) => `${r.origin} → ${r.destination}` === routeStr || r.name === routeStr
    );

    setFormData((prev) => {
      const next: Partial<TripOrder> = { ...prev, route_export: routeStr };

      if (selectedRoute) {
        // Auto-populate export price if route has cost
        if (selectedRoute.cost !== undefined && selectedRoute.cost !== null) {
          const exp = new Decimal(selectedRoute.cost);
          const imp = new Decimal(prev.price_import || 0);
          next.price_export = exp.toNumber();
          next.price = exp.plus(imp).toNumber();
        }
        const breakdown = computeRoutePriceForTruck(selectedRoute, prev.truck_id);
        const exp = new Decimal(breakdown.totalCost);
        const imp = new Decimal(prev.price_import || 0);
        next.price_export = exp.toNumber();
        next.price = exp.plus(imp).toNumber();

        // Pass along maritime expenses
        next.ferry_cost = breakdown.ferryCost;
        next.triptik_cost = breakdown.triptikCost;
        next.transit_almeria_cost = breakdown.transitAlmeriaCost;
        next.marsa_maroc_cost = breakdown.marsaMarocCost;

        // Auto-populate loading GPS
        if (selectedRoute.origin_latitude !== undefined && selectedRoute.origin_latitude !== null) {
          next.shipping_latitude = selectedRoute.origin_latitude;
        }
        if (selectedRoute.origin_longitude !== undefined && selectedRoute.origin_longitude !== null) {
          next.shipping_longitude = selectedRoute.origin_longitude;
        }

        // Default unloading GPS to route destination if not set
        if (!next.unloading_latitude && selectedRoute.destination_latitude !== undefined && selectedRoute.destination_latitude !== null) {
          next.unloading_latitude = selectedRoute.destination_latitude;
        }
        if (!next.unloading_longitude && selectedRoute.destination_longitude !== undefined && selectedRoute.destination_longitude !== null) {
          next.unloading_longitude = selectedRoute.destination_longitude;
        }
      }

      return next;
    });
  };

  const handleRouteImportChange = (routeStr: string) => {
    const selectedRoute = returnRoutes.find(
      (r) => `${r.origin} → ${r.destination}` === routeStr || r.name === routeStr
    );

    setFormData((prev) => {
      const next: Partial<TripOrder> = { ...prev, route_import: routeStr };

      if (selectedRoute) {
        // Auto-populate import price if route has cost
        if (selectedRoute.cost !== undefined && selectedRoute.cost !== null) {
          const exp = new Decimal(prev.price_export || 0);
          const imp = new Decimal(selectedRoute.cost);
          next.price_import = imp.toNumber();
          next.price = exp.plus(imp).toNumber();
        }
        const breakdown = computeRoutePriceForTruck(selectedRoute, prev.truck_id);
        const exp = new Decimal(prev.price_export || 0);
        const imp = new Decimal(breakdown.totalCost);
        next.price_import = imp.toNumber();
        next.price = exp.plus(imp).toNumber();

        // Unloading GPS for import leg
        if (selectedRoute.destination_latitude !== undefined && selectedRoute.destination_latitude !== null) {
          next.unloading_latitude = selectedRoute.destination_latitude;
        }
        if (selectedRoute.destination_longitude !== undefined && selectedRoute.destination_longitude !== null) {
          next.unloading_longitude = selectedRoute.destination_longitude;
        }
      }

      return next;
    });
  };

  const handlePriceExportChange = (val: number) => {
    setFormData((prev) => {
      const exp = new Decimal(val || 0);
      const imp = new Decimal(prev.price_import || 0);
      return {
        ...prev,
        price_export: exp.toNumber(),
        price: exp.plus(imp).toNumber(),
      };
    });
  };

  const handlePriceImportChange = (val: number) => {
    setFormData((prev) => {
      const exp = new Decimal(prev.price_export || 0);
      const imp = new Decimal(val || 0);
      return {
        ...prev,
        price_import: imp.toNumber(),
        price: exp.plus(imp).toNumber(),
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // التحقق التلقائي من مسار الرحلة
    if (!formData.route_export && !formData.route) {
      reportValidation({
        fieldName: 'route_export',
        rejectedValue: formData.route_export,
        validationRule: 'تحديد مسار التصدير أو المسار العام إلزامي للرحلة',
        errorMessage: 'يرجى اختيار مسار التصدير أو تحديد مسار للرحلة الدولية',
        formData: formData as Record<string, unknown>,
        severity: 'medium',
      });
    }

    // التحقق التلقائي من ربط الرحلة بعميل
    if (!formData.client_id && !formData.client_import_id) {
      reportValidation({
        fieldName: 'client_id',
        rejectedValue: formData.client_id,
        validationRule: 'العميل إلزامي لربط الرحلة',
        errorMessage: 'يرجى اختيار عميل التصدير أو عميل الاستيراد لربط الرحلة',
        formData: formData as Record<string, unknown>,
        severity: 'medium',
      });
    }

    // التحقق من صحة رقم الـ CMR إن وجد
    const cmrVal = formData.cmr_export_number || formData.cmr_number;
    if (cmrVal && cmrVal.trim().length < 3) {
      reportValidation({
        fieldName: 'cmr_export_number',
        rejectedValue: cmrVal,
        validationRule: 'رقم الـ CMR يجب ألا يقل عن 3 خانات',
        errorMessage: `رقم الـ CMR المدخل "${cmrVal}" قصير جداً أو غير مكتمل`,
        formData: formData as Record<string, unknown>,
        severity: 'low',
      });
    }

    let totalPrice = 0;
    try {
      const exp = new Decimal(formData.price_export || 0);
      const imp = new Decimal(formData.price_import || 0);
      if (exp.isNegative() || imp.isNegative()) {
        reportCalculationAnomaly({
          fieldName: 'price',
          formula: 'price_export + price_import',
          inputs: { price_export: formData.price_export, price_import: formData.price_import },
          errorMessage: 'لا يمكن أن تكون تسعيرة الشحن سالبة',
          formData: formData as Record<string, unknown>,
          severity: 'high',
        });
      }
      totalPrice = exp.plus(imp).toNumber();
    } catch {
      reportCalculationAnomaly({
        fieldName: 'price',
        formula: 'price_export + price_import',
        inputs: { price_export: formData.price_export, price_import: formData.price_import },
        errorMessage: 'فشل جمع تسعيرة التصدير والاستيراد للرحلة',
        formData: formData as Record<string, unknown>,
        severity: 'medium',
      });
    }

    setLoading(true);

    const fullRoute = formData.route_export && formData.route_import
      ? `${formData.route_export} ⇄ ${formData.route_import}`
      : formData.route_export || formData.route || 'مسار دولي';

    const payload: Partial<TripOrder> = {
      ...formData,
      route: fullRoute,
      price: totalPrice > 0 ? totalPrice : (formData.price || 0),
      cmr_number: formData.cmr_export_number || formData.cmr_number,
      shipping_latitude: formData.shipping_latitude,
      shipping_longitude: formData.shipping_longitude,
      unloading_latitude: formData.unloading_latitude,
      unloading_longitude: formData.unloading_longitude,
      ferry_cost: formData.ferry_cost,
      triptik_cost: formData.triptik_cost,
      transit_almeria_cost: formData.transit_almeria_cost,
      marsa_maroc_cost: formData.marsa_maroc_cost,
    };

    try {
      await onSubmit(payload);
      onClose();
    } catch (error: unknown) {
      reportSubmissionError({
        operationName: 'حفظ دورة الرحلة الدولية (TripFormModal: onSubmit)',
        error,
        formData: payload as Record<string, unknown>,
        severity: 'high',
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto"
      dir={dir}
      onClick={onClose}
    >
      <Card
        className="w-full max-w-3xl my-8 shadow-2xl border-border bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <div>
            <CardTitle className="font-amiri text-xl flex items-center gap-2 text-foreground">
              <Navigation className="w-5 h-5 text-primary" />
              {initialData ? t('تعديل دورة الرحلة الدولية', 'Modifier le cycle de voyage international') : t('تسجيل رحلة دولية (ذهاب + عودة)', 'Nouveau voyage international (Aller + Retour)')}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {t('إدارة رحلة التصدير (Aller) ورحلة الاستيراد (Retour) في نفس الدورة', 'Gestion de l\'exportation (Aller) et de l\'importation (Retour) dans la même rotation')}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>

        {/* Tab Switcher */}
        <div className="flex border-b border-border bg-muted/40 p-1 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'export'
                ? 'bg-card text-primary shadow-xs border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <PlaneTakeoff className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            {t('1. رحلة الذهاب (تصدير - Aller)', '1. Trajet Aller (Export)')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'import'
                ? 'bg-card text-primary shadow-xs border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <PlaneLanding className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            {t('2. رحلة العودة (استيراد - Retour)', '2. Trajet Retour (Import)')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fleet')}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'fleet'
                ? 'bg-card text-primary shadow-xs border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <TruckIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            {t('3. السائق والأسطول والحالة', '3. Chauffeur, Flotte & Statut')}
          </button>
        </div>

        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* TAB 1: EXPORT / ALLER */}
            {activeTab === 'export' && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-200">
                  <span className="font-semibold flex items-center gap-1.5">
                    <PlaneTakeoff className="w-4 h-4 text-emerald-600" />
                    {t('بيانات الشحنة المصدرة من المغرب إلى أوروبا (Export Leg)', 'Cargaison exportée Maroc → Europe (Aller)')}
                  </span>
                  <span className="font-mono font-bold">
                    {t('سعر الذهاب:', 'Prix Aller :')} {(formData.price_export || 0).toLocaleString()} MAD
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground flex items-center justify-between">
                      <span>{t('عميل التصدير (رحلات الذهاب) *', 'Client Export (Aller) *')}</span>
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <PlaneTakeoff className="w-3 h-3" />
                        {t('عملاء الذهاب فقط', 'Clients Aller uniquement')}
                      </span>
                    </label>
                    <select
                      value={formData.client_id || ''}
                      onChange={(e) => {
                        const cId = parseInt(e.target.value) || undefined;
                        setFormData({
                          ...formData,
                          client_id: cId,
                        });
                      }}
                      className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring shadow-2xs [color-scheme:light] dark:[color-scheme:dark]"
                      required
                    >
                      <option value="">{t('-- اختر عميل رحلة الذهاب --', '-- Sélectionner le client Aller --')}</option>
                      {exportClients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.city ? `- (${c.city})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('مسار الذهاب (Route Aller) *', 'Itinéraire Aller (Route Aller) *')}</label>
                    <label className="text-sm font-medium text-foreground flex items-center justify-between">
                      <span>{t('مسار الذهاب (Route Aller) *', 'Itinéraire Aller (Route Aller) *')}</span>
                      {formData.route_export && (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-normal">
                          {t('✓ السعر و GPS تلقائي', '✓ Prix & GPS auto')}
                        </span>
                      )}
                    </label>
                    <select
                      value={formData.route_export || ''}
                      onChange={(e) => handleRouteExportChange(e.target.value)}
                      className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring shadow-2xs [color-scheme:light] dark:[color-scheme:dark]"
                      required
                    >
                      <option value="">{t('-- اختر مسار الذهاب --', '-- Sélectionner l\'itinéraire Aller --')}</option>
                      {outboundRoutes.map((r) => (
                        <option key={r.id} value={`${r.origin} → ${r.destination}`}>
                          {r.name} {r.distance_km ? `(${r.distance_km} ${t('كم', 'km')})` : ''}
                          {r.name} {r.distance_km ? `(${r.distance_km} ${t('كم', 'km')})` : ''} {r.cost ? `— [${r.cost.toLocaleString()} MAD]` : ''}
                        </option>
                      ))}
                    </select>
                    {formData.route_export && (
                      <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[11px] space-y-1">
                        <div className="flex items-center justify-between font-semibold text-foreground">
                          <span className="flex items-center gap-1">
                            <Coins className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            {t('سعر الشحن المرجعي للذهاب:', 'Prix de fret Aller :')}
                          </span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {(formData.price_export || 0).toLocaleString()} MAD
                          </span>
                        </div>
                        <p className="text-muted-foreground text-[10px]">
                          {t('يشمل المحروقات (على الطرق البرية فقط وفق معدل الشاحنة)، الباخرة، التريبتك، ترانزيت ألميريا، مرسى المغرب والتعشير', 'Comprend carburant routier selon le camion, bateau, triptyque, transit, port et dédouanement')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('رقم CMR التصدير (CMR Aller) *', 'N° CMR Aller *')}</label>
                    <Input
                      value={formData.cmr_export_number || ''}
                      onChange={(e) => setFormData({ ...formData, cmr_export_number: e.target.value })}
                      placeholder="CMR-EXP-001"
                      required
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('تاريخ الانطلاق (Départ) *', 'Date départ (Départ) *')}</label>
                    <Input
                      type="date"
                      value={formData.departure_date || ''}
                      onChange={(e) => setFormData({ ...formData, departure_date: e.target.value })}
                      required
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('تاريخ تفريغ التصدير (Déchargement)', 'Date déchargement Aller')}</label>
                    <Input
                      type="date"
                      value={formData.unloading_date_export || ''}
                      onChange={(e) => setFormData({ ...formData, unloading_date_export: e.target.value })}
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('سعر شحن الذهاب (MAD/EUR) *', 'Prix fret Aller (MAD/EUR) *')}</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.price_export || ''}
                      onChange={(e) => handlePriceExportChange(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      required
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('شركة العبّارة للذهاب (Bateau Aller)', 'Compagnie maritime Aller')}</label>
                    <Input
                      value={formData.ferry_company || ''}
                      onChange={(e) => setFormData({ ...formData, ferry_company: e.target.value })}
                      placeholder="FRS / Balearia"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('رقم حجز باخرة الذهاب (Localizador)', 'N° réservation ferry Aller')}</label>
                    <Input
                      value={formData.ferry_localizador || ''}
                      onChange={(e) => setFormData({ ...formData, ferry_localizador: e.target.value })}
                      placeholder="LOC-EXP-9921"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Unified Port & Maritime Fees Card (الرسوم المينائية ومصاريف العبور الدولي) */}
                <div className="p-3.5 bg-blue-500/5 border border-blue-500/20 rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Ship className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      {t('الرسوم المينائية ومصاريف العبور الدولي (MAD)', 'Frais portuaires & transit maritime (MAD)')}
                    </span>
                    <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25">
                      {t('مجموع الرسوم:', 'Total frais :')} {totalTripPortFees} MAD <span className="font-sans font-normal text-[10px] text-muted-foreground">({t('قابلة للتعديل', 'modifiables')})</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground block">
                        {t('الباخرة / العبارة', 'Billet Bateau / Ferry')}
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.ferry_cost ?? ''}
                        onChange={(e) => setFormData({ ...formData, ferry_cost: parseFloat(e.target.value) || 0 })}
                        placeholder="4500.00"
                        className="h-8 text-xs font-mono"
                        dir="ltr"
                      />
                      <span className="text-[10px] text-muted-foreground block">{t('افتراضي: 4,500 MAD', 'Défaut: 4 500 MAD')}</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground block">
                        {t('التريبتك (Triptik / CPD)', 'Triptyque (CPD)')}
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.triptik_cost ?? ''}
                        onChange={(e) => setFormData({ ...formData, triptik_cost: parseFloat(e.target.value) || 0 })}
                        placeholder="500.00"
                        className="h-8 text-xs font-mono"
                        dir="ltr"
                      />
                      <span className="text-[10px] text-muted-foreground block">{t('افتراضي: 500 MAD', 'Défaut: 500 MAD')}</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground block">
                        {t('ترانزيت ألميريا / الجزيرة', 'Transit Almería / Algés.')}
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.transit_almeria_cost ?? ''}
                        onChange={(e) => setFormData({ ...formData, transit_almeria_cost: parseFloat(e.target.value) || 0 })}
                        placeholder="1200.00"
                        className="h-8 text-xs font-mono"
                        dir="ltr"
                      />
                      <span className="text-[10px] text-muted-foreground block">{t('افتراضي: 1,200 MAD', 'Défaut: 1 200 MAD')}</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground block">
                        {t('مناولة مرسى المغرب', 'Marsa Maroc (Port)')}
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.marsa_maroc_cost ?? ''}
                        onChange={(e) => setFormData({ ...formData, marsa_maroc_cost: parseFloat(e.target.value) || 0 })}
                        placeholder="800.00"
                        className="h-8 text-xs font-mono"
                        dir="ltr"
                      />
                      <span className="text-[10px] text-muted-foreground block">{t('افتراضي: 800 MAD', 'Défaut: 800 MAD')}</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-muted-foreground">
                    {t(
                      '* يتم تحميل الرسوم المرجعية من المسار ويمكنك تعديل أي بند منها بحرية لهذه الرحلة وفق الفواتير الفعلية أو الموسم.',
                      '* Valeurs de référence pré-remplies et modifiables selon les factures réelles de ce voyage.'
                    )}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('وصف بضاعة التصدير (Marchandise)', 'Description marchandise Aller')}</label>
                    <Input
                      value={formData.goods_description_export || ''}
                      onChange={(e) => setFormData({ ...formData, goods_description_export: e.target.value })}
                      placeholder={t('خضروات، فواكه، نسيج، قطع غيار...', 'Légumes, fruits, textile, pièces...')}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('الوزن التقريبي (طن)', 'Poids estimé (T)')}</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.weight_export || ''}
                      onChange={(e) => setFormData({ ...formData, weight_export: parseFloat(e.target.value) || undefined })}
                      placeholder={t('مثال: 22.5', 'Ex: 22.5')}
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-2">📍 {t('منطقة الشحن (GPS)', 'Lieu de chargement (GPS)')}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">{t('خط العرض', 'Latitude')}</label>
                      <Input
                        type="number"
                        step="any"
                        value={formData.shipping_latitude ?? ''}
                        onChange={(e) => setFormData({ ...formData, shipping_latitude: e.target.value ? parseFloat(e.target.value) : undefined })}
                        placeholder={t('منطقة الشحن', 'Lieu de chargement')}
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">{t('خط الطول', 'Longitude')}</label>
                      <Input
                        type="number"
                        step="any"
                        value={formData.shipping_longitude ?? ''}
                        onChange={(e) => setFormData({ ...formData, shipping_longitude: e.target.value ? parseFloat(e.target.value) : undefined })}
                        placeholder={t('منطقة الشحن', 'Lieu de chargement')}
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{t('يتم تحديد إحداثيات الشحن والتفريغ لكل رحلة على حدة (غير مرتبطة ببيانات العميل)', 'Coordonnées GPS spécifiques à ce voyage')}</p>
                </div>
              </div>
            )}

            {/* TAB 2: IMPORT / RETOUR */}
            {activeTab === 'import' && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-between text-xs text-blue-900 dark:text-blue-200">
                  <span className="font-semibold flex items-center gap-1.5">
                    <PlaneLanding className="w-4 h-4 text-blue-600" />
                    {t('بيانات الشحنة المستوردة من أوروبا إلى المغرب (Import Leg)', 'Cargaison importée Europe → Maroc (Retour)')}
                  </span>
                  <span className="font-mono font-bold">
                    {t('سعر العودة:', 'Prix Retour :')} {(formData.price_import || 0).toLocaleString()} MAD
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground flex items-center justify-between">
                      <span>{t('عميل الاستيراد (رحلات العودة)', 'Client Import (Retour)')}</span>
                      <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
                        <PlaneLanding className="w-3 h-3" />
                        {t('عملاء العودة فقط', 'Clients Retour uniquement')}
                      </span>
                    </label>
                    <select
                      value={formData.client_import_id || ''}
                      onChange={(e) => {
                        const cId = parseInt(e.target.value) || undefined;
                        setFormData({
                          ...formData,
                          client_import_id: cId,
                        });
                      }}
                      className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring shadow-2xs [color-scheme:light] dark:[color-scheme:dark]"
                    >
                      <option value="">{t('-- اختر عميل رحلة العودة (إن وُجد) --', '-- Sélectionner le client Retour (si applicable) --')}</option>
                      {importClients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.city ? `- (${c.city})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('مسار العودة (Route Retour)', 'Itinéraire Retour (Route Retour)')}</label>
                    <label className="text-sm font-medium text-foreground flex items-center justify-between">
                      <span>{t('مسار العودة (Route Retour)', 'Itinéraire Retour (Route Retour)')}</span>
                      {formData.route_import && (
                        <span className="text-[11px] text-blue-600 dark:text-blue-400 font-normal">
                          {t('✓ السعر و GPS تلقائي', '✓ Prix & GPS auto')}
                        </span>
                      )}
                    </label>
                    <select
                      value={formData.route_import || ''}
                      onChange={(e) => handleRouteImportChange(e.target.value)}
                      className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring shadow-2xs [color-scheme:light] dark:[color-scheme:dark]"
                    >
                      <option value="">{t('-- اختر مسار العودة --', '-- Sélectionner l\'itinéraire Retour --')}</option>
                      {returnRoutes.map((r) => (
                        <option key={r.id} value={`${r.origin} → ${r.destination}`}>
                          {r.name} {r.distance_km ? `(${r.distance_km} ${t('كم', 'km')})` : ''} {r.cost ? `— [${r.cost.toLocaleString()} MAD]` : ''}
                        </option>
                      ))}
                    </select>
                    {formData.route_import && (
                      <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[11px] space-y-1">
                        <div className="flex items-center justify-between font-semibold text-foreground">
                          <span className="flex items-center gap-1">
                            <Coins className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            {t('سعر الشحن المرجعي للعودة:', 'Prix de fret Retour :')}
                          </span>
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                            {(formData.price_import || 0).toLocaleString()} MAD
                          </span>
                        </div>
                        <p className="text-muted-foreground text-[10px]">
                          {t('يشمل المحروقات (على الطرق البرية فقط وفق معدل الشاحنة)، الباخرة، التريبتك، ترانزيت ألميريا، مرسى المغرب والتعشير', 'Comprend carburant routier selon le camion, bateau, triptyque, transit, port et dédouanement')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('رقم CMR الاستيراد (CMR Retour)', 'N° CMR Retour')}</label>
                    <Input
                      value={formData.cmr_import_number || ''}
                      onChange={(e) => setFormData({ ...formData, cmr_import_number: e.target.value })}
                      placeholder="CMR-IMP-001"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('تاريخ الشحن بأوروبا (Chargement)', 'Date chargement Europe')}</label>
                    <Input
                      type="date"
                      value={formData.loading_date_import || ''}
                      onChange={(e) => setFormData({ ...formData, loading_date_import: e.target.value })}
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('تاريخ تفريغ العودة بالمغرب', 'Date déchargement Maroc')}</label>
                    <Input
                      type="date"
                      value={formData.unloading_date_import || ''}
                      onChange={(e) => setFormData({ ...formData, unloading_date_import: e.target.value })}
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('سعر شحن العودة (MAD/EUR)', 'Prix fret Retour (MAD/EUR)')}</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.price_import || ''}
                      onChange={(e) => handlePriceImportChange(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('شركة العبّارة للعودة (Bateau Retour)', 'Compagnie maritime Retour')}</label>
                    <Input
                      value={formData.ferry_company_import || ''}
                      onChange={(e) => setFormData({ ...formData, ferry_company_import: e.target.value })}
                      placeholder="FRS / Balearia"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('رقم حجز باخرة العودة (Localizador)', 'N° réservation ferry Retour')}</label>
                    <Input
                      value={formData.ferry_localizador_import || ''}
                      onChange={(e) => setFormData({ ...formData, ferry_localizador_import: e.target.value })}
                      placeholder="LOC-IMP-8842"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('وصف بضاعة الاستيراد', 'Description marchandise Retour')}</label>
                    <Input
                      value={formData.goods_description_import || ''}
                      onChange={(e) => setFormData({ ...formData, goods_description_import: e.target.value })}
                      placeholder={t('مواد أولية، آلات صناعية، فارغة (Vide)...', 'Matières premières, machines, vide...')}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('الوزن التقريبي (طن)', 'Poids estimé (T)')}</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.weight_import || ''}
                      onChange={(e) => setFormData({ ...formData, weight_import: parseFloat(e.target.value) || undefined })}
                      placeholder={t('مثال: 18.0', 'Ex: 18.0')}
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">📍 {t('منطقة التفريغ (GPS)', 'Lieu de déchargement (GPS)')}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">{t('خط العرض', 'Latitude')}</label>
                      <Input
                        type="number"
                        step="any"
                        value={formData.unloading_latitude ?? ''}
                        onChange={(e) => setFormData({ ...formData, unloading_latitude: e.target.value ? parseFloat(e.target.value) : undefined })}
                        placeholder={t('منطقة التفريغ', 'Lieu de déchargement')}
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">{t('خط الطول', 'Longitude')}</label>
                      <Input
                        type="number"
                        step="any"
                        value={formData.unloading_longitude ?? ''}
                        onChange={(e) => setFormData({ ...formData, unloading_longitude: e.target.value ? parseFloat(e.target.value) : undefined })}
                        placeholder={t('منطقة التفريغ', 'Lieu de déchargement')}
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{t('يتم تحديد إحداثيات الشحن والتفريغ لكل رحلة على حدة (غير مرتبطة ببيانات العميل)', 'Coordonnées GPS spécifiques à ce voyage')}</p>
                </div>
              </div>
            )}

            {/* TAB 3: FLEET, DRIVER & STATUS */}
            {activeTab === 'fleet' && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
                  <span className="font-semibold flex items-center gap-1.5">
                    <TruckIcon className="w-4 h-4 text-amber-600" />
                    {t('تعيين طاقم الرحلة والأسطول والحالة التشغيلية', 'Affectation équipage, flotte et statut opérationnel')}
                  </span>
                  <span className="font-mono font-bold text-sm">
                    {t('إجمالي إيراد الدورة:', 'Revenu total du cycle :')} {((formData.price_export || 0) + (formData.price_import || 0)).toLocaleString()} MAD
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('السائق المسؤول *', 'Chauffeur responsable *')}</label>
                    <select
                      value={formData.driver_id || ''}
                      onChange={(e) => handleDriverChange(e.target.value)}
                      className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring shadow-2xs [color-scheme:light] dark:[color-scheme:dark]"
                      required
                    >
                      <option value="">{t('-- اختر السائق --', '-- Sélectionner le chauffeur --')}</option>
                      {uniqueDrivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <TruckIcon className="w-4 h-4 text-blue-500" />
                      {t('الشاحنة المخصصة (Tracteur) *', 'Tracteur assigné *')}
                    </label>
                    <select
                      value={formData.truck_id || ''}
                      onChange={(e) => handleTruckChange(e.target.value)}
                      className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring shadow-2xs [color-scheme:light] dark:[color-scheme:dark]"
                      required
                    >
                      <option value="">{t('-- اختيار الشاحنة --', '-- Sélectionner le camion --')}</option>
                      {availableTrucks.map((truck) => (
                        <option key={truck.id} value={truck.id}>
                          {truck.plate_number} {truck.model ? `(${truck.model})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <TrailerIcon className="w-4 h-4 text-purple-500" />
                      {t('المقطورة (Remorque / Frigo)', 'Remorque (Frigo / Bâchée)')}
                    </label>
                    <select
                      value={formData.trailer_id || ''}
                      onChange={(e) => setFormData({ ...formData, trailer_id: parseInt(e.target.value) || undefined })}
                      className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring shadow-2xs [color-scheme:light] dark:[color-scheme:dark]"
                    >
                      <option value="">{t('-- اختيار المقطورة --', '-- Sélectionner la remorque --')}</option>
                      {availableTrailers.map((trailer) => (
                        <option key={trailer.id} value={trailer.id}>
                          {trailer.plate_number} {trailer.model ? `(${trailer.model})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('حالة مسار الرحلة', 'Statut du voyage')}</label>
                    <select
                      value={formData.status || 'pending'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring shadow-2xs [color-scheme:light] dark:[color-scheme:dark]"
                    >
                      <option value="pending">{t('قيد التجهيز (Pending)', 'En préparation (Pending)')}</option>
                      <option value="en_route_outbound">{t('في طريق الذهاب (En route Aller / Export)', 'En route Aller (Export)')}</option>
                      <option value="at_destination_export">{t('وصل وجهة التصدير (At Export Destination)', 'Arrivé destination Export')}</option>
                      <option value="en_route_inbound">{t('في طريق العودة (En route Retour / Import)', 'En route Retour (Import)')}</option>
                      <option value="at_customs">{t('في جمرك الميناء (At Customs)', 'En douane portuaire')}</option>
                      <option value="completed">{t('مكتملة ومفرغة (Completed)', 'Terminé & Déchargé')}</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t('نوع التسعير / العملة', 'Devise')}</label>
                    <select
                      value={formData.price_type || 'MAD'}
                      onChange={(e) => setFormData({ ...formData, price_type: e.target.value })}
                      className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring shadow-2xs [color-scheme:light] dark:[color-scheme:dark]"
                    >
                      <option value="MAD">{t('درهم مغربي (MAD)', 'Dirham marocain (MAD)')}</option>
                      <option value="EUR">{t('يورو (EUR)', 'Euro (EUR)')}</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Total summary banner */}
            <div className="p-3 bg-muted/50 rounded-xl border border-border flex items-center justify-between text-xs">
              <div className="flex items-center gap-4">
                <span>🛫 {t('ذهاب:', 'Aller :')} <strong className="text-foreground">{(formData.price_export || 0).toLocaleString()}</strong></span>
                <span>🛬 {t('عودة:', 'Retour :')} <strong className="text-foreground">{(formData.price_import || 0).toLocaleString()}</strong></span>
              </div>
              <div className="text-sm font-bold text-primary font-mono">
                {t('الإجمالي:', 'Total :')} {((formData.price_export || 0) + (formData.price_import || 0)).toLocaleString()} {formData.price_type || 'MAD'}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-border">
              <Button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />
                {loading ? t('جاري الحفظ...', 'Enregistrement...') : initialData ? t('تحديث بيانات الرحلة', 'Mettre à jour le voyage') : t('حفظ وتأكيد الرحلة الدولية', 'Confirmer et créer le voyage')}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                {t('إلغاء', 'Annuler')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
