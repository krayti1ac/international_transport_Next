'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Save, Navigation, PlaneTakeoff, PlaneLanding, Layers } from 'lucide-react';
import { TruckIcon, TrailerIcon } from '@/components/icons/vehicle-icons';
import type { TripOrder, Client, Driver, Truck, Trailer, TransportRoute } from '@/types/database';
import { DEFAULT_CLIENTS, DEFAULT_DRIVERS, DEFAULT_TRUCKS, DEFAULT_TRAILERS, fallbackArray } from '@/lib/default-data';

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

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'fleet'>('export');

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
    goods_description_export: '',
    goods_description_import: '',
    weight_export: undefined,
    weight_import: undefined,
    shipping_latitude: undefined,
    shipping_longitude: undefined,
    unloading_latitude: undefined,
    unloading_longitude: undefined,
  });

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

  const handleTruckChange = (truckIdStr: string) => {
    const tId = parseInt(truckIdStr);
    const selectedTruck = trucks.find((t) => t.id === tId);

    setFormData((prev) => ({
      ...prev,
      truck_id: tId || undefined,
      driver_id: prev.driver_id || selectedTruck?.default_driver_id || undefined,
      trailer_id: prev.trailer_id || selectedTruck?.default_trailer_id || undefined,
    }));
  };

  const handlePriceExportChange = (val: number) => {
    setFormData((prev) => {
      const exp = val || 0;
      const imp = prev.price_import || 0;
      return {
        ...prev,
        price_export: exp,
        price: exp + imp,
      };
    });
  };

  const handlePriceImportChange = (val: number) => {
    setFormData((prev) => {
      const exp = prev.price_export || 0;
      const imp = val || 0;
      return {
        ...prev,
        price_import: imp,
        price: exp + imp,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const fullRoute = formData.route_export && formData.route_import
      ? `${formData.route_export} ⇄ ${formData.route_import}`
      : formData.route_export || formData.route || 'مسار دولي';

    const totalPrice = (formData.price_export || 0) + (formData.price_import || 0);

    const payload: Partial<TripOrder> = {
      ...formData,
      route: fullRoute,
      price: totalPrice > 0 ? totalPrice : (formData.price || 0),
      cmr_number: formData.cmr_export_number || formData.cmr_number,
      shipping_latitude: formData.shipping_latitude,
      shipping_longitude: formData.shipping_longitude,
      unloading_latitude: formData.unloading_latitude,
      unloading_longitude: formData.unloading_longitude,
    };

    try {
      await onSubmit(payload);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto"
      dir="rtl"
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
              {initialData ? 'تعديل دورة الرحلة الدولية' : 'تسجيل رحلة دولية (ذهاب + عودة)'}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              إدارة رحلة التصدير (Aller) ورحلة الاستيراد (Retour) في نفس الدورة
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
            1. رحلة الذهاب (تصدير - Aller)
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
            2. رحلة العودة (استيراد - Retour)
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
            3. السائق والأسطول والحالة
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
                    بيانات الشحنة المصدرة من المغرب إلى أوروبا (Export Leg)
                  </span>
                  <span className="font-mono font-bold">
                    سعر الذهاب: {(formData.price_export || 0).toLocaleString()} MAD
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground flex items-center justify-between">
                      <span>عميل التصدير (رحلات الذهاب) *</span>
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <PlaneTakeoff className="w-3 h-3" />
                        عملاء الذهاب فقط
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
                      <option value="">-- اختر عميل رحلة الذهاب --</option>
                      {exportClients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.city ? `- (${c.city})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">مسار الذهاب (Route Aller) *</label>
                    <select
                      value={formData.route_export || ''}
                      onChange={(e) => setFormData({ ...formData, route_export: e.target.value })}
                      className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring shadow-2xs [color-scheme:light] dark:[color-scheme:dark]"
                      required
                    >
                      <option value="">-- اختر مسار الذهاب --</option>
                      {outboundRoutes.map((r) => (
                        <option key={r.id} value={`${r.origin} → ${r.destination}`}>
                          {r.name} {r.distance_km ? `(${r.distance_km} كم)` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">رقم CMR التصدير (CMR Aller) *</label>
                    <Input
                      value={formData.cmr_export_number || ''}
                      onChange={(e) => setFormData({ ...formData, cmr_export_number: e.target.value })}
                      placeholder="CMR-EXP-001"
                      required
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">تاريخ الانطلاق (Départ) *</label>
                    <Input
                      type="date"
                      value={formData.departure_date || ''}
                      onChange={(e) => setFormData({ ...formData, departure_date: e.target.value })}
                      required
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">تاريخ تفريغ التصدير (Déchargement)</label>
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
                    <label className="text-sm font-medium text-foreground">سعر شحن الذهاب (MAD/EUR) *</label>
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
                    <label className="text-sm font-medium text-foreground">شركة العبّارة للذهاب (Bateau Aller)</label>
                    <Input
                      value={formData.ferry_company || ''}
                      onChange={(e) => setFormData({ ...formData, ferry_company: e.target.value })}
                      placeholder="FRS / Balearia"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">رقم حجز باخرة الذهاب (Localizador)</label>
                    <Input
                      value={formData.ferry_localizador || ''}
                      onChange={(e) => setFormData({ ...formData, ferry_localizador: e.target.value })}
                      placeholder="LOC-EXP-9921"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">وصف بضاعة التصدير (Marchandise)</label>
                    <Input
                      value={formData.goods_description_export || ''}
                      onChange={(e) => setFormData({ ...formData, goods_description_export: e.target.value })}
                      placeholder="خضروات، فواكه، نسيج، قطع غيار..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">الوزن التقريبي (طن)</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.weight_export || ''}
                      onChange={(e) => setFormData({ ...formData, weight_export: parseFloat(e.target.value) || undefined })}
                      placeholder="مثال: 22.5"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-2">📍 منطقة الشحن (GPS)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">خط العرض</label>
                      <Input
                        type="number"
                        step="any"
                        value={formData.shipping_latitude ?? ''}
                        onChange={(e) => setFormData({ ...formData, shipping_latitude: e.target.value ? parseFloat(e.target.value) : undefined })}
                        placeholder="منطقة الشحن"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">خط الطول</label>
                      <Input
                        type="number"
                        step="any"
                        value={formData.shipping_longitude ?? ''}
                        onChange={(e) => setFormData({ ...formData, shipping_longitude: e.target.value ? parseFloat(e.target.value) : undefined })}
                        placeholder="منطقة الشحن"
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">يتم تحديد إحداثيات الشحن والتفريغ لكل رحلة على حدة (غير مرتبطة ببيانات العميل)</p>
                </div>
              </div>
            )}

            {/* TAB 2: IMPORT / RETOUR */}
            {activeTab === 'import' && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-between text-xs text-blue-900 dark:text-blue-200">
                  <span className="font-semibold flex items-center gap-1.5">
                    <PlaneLanding className="w-4 h-4 text-blue-600" />
                    بيانات الشحنة المستوردة من أوروبا إلى المغرب (Import Leg)
                  </span>
                  <span className="font-mono font-bold">
                    سعر العودة: {(formData.price_import || 0).toLocaleString()} MAD
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground flex items-center justify-between">
                      <span>عميل الاستيراد (رحلات العودة)</span>
                      <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
                        <PlaneLanding className="w-3 h-3" />
                        عملاء العودة فقط
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
                      <option value="">-- اختر عميل رحلة العودة (إن وُجد) --</option>
                      {importClients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.city ? `- (${c.city})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">مسار العودة (Route Retour)</label>
                    <select
                      value={formData.route_import || ''}
                      onChange={(e) => setFormData({ ...formData, route_import: e.target.value })}
                      className="w-full h-10 px-3 py-2 border border-input bg-card text-foreground rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring shadow-2xs [color-scheme:light] dark:[color-scheme:dark]"
                    >
                      <option value="">-- اختر مسار العودة --</option>
                      {returnRoutes.map((r) => (
                        <option key={r.id} value={`${r.origin} → ${r.destination}`}>
                          {r.name} {r.distance_km ? `(${r.distance_km} كم)` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">رقم CMR الاستيراد (CMR Retour)</label>
                    <Input
                      value={formData.cmr_import_number || ''}
                      onChange={(e) => setFormData({ ...formData, cmr_import_number: e.target.value })}
                      placeholder="CMR-IMP-001"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">تاريخ الشحن بأوروبا (Chargement)</label>
                    <Input
                      type="date"
                      value={formData.loading_date_import || ''}
                      onChange={(e) => setFormData({ ...formData, loading_date_import: e.target.value })}
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">تاريخ تفريغ العودة بالمغرب</label>
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
                    <label className="text-sm font-medium text-foreground">سعر شحن العودة (MAD/EUR)</label>
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
                    <label className="text-sm font-medium text-foreground">شركة العبّارة للعودة (Bateau Retour)</label>
                    <Input
                      value={formData.ferry_company_import || ''}
                      onChange={(e) => setFormData({ ...formData, ferry_company_import: e.target.value })}
                      placeholder="FRS / Balearia"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">رقم حجز باخرة العودة (Localizador)</label>
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
                    <label className="text-sm font-medium text-foreground">وصف بضاعة الاستيراد</label>
                    <Input
                      value={formData.goods_description_import || ''}
                      onChange={(e) => setFormData({ ...formData, goods_description_import: e.target.value })}
                      placeholder="مواد أولية، آلات صناعية، فارغة (Vide)..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">الوزن التقريبي (طن)</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.weight_import || ''}
                      onChange={(e) => setFormData({ ...formData, weight_import: parseFloat(e.target.value) || undefined })}
                      placeholder="مثال: 18.0"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">📍 منطقة التفريغ (GPS)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">خط العرض</label>
                      <Input
                        type="number"
                        step="any"
                        value={formData.unloading_latitude ?? ''}
                        onChange={(e) => setFormData({ ...formData, unloading_latitude: e.target.value ? parseFloat(e.target.value) : undefined })}
                        placeholder="منطقة التفريغ"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">خط الطول</label>
                      <Input
                        type="number"
                        step="any"
                        value={formData.unloading_longitude ?? ''}
                        onChange={(e) => setFormData({ ...formData, unloading_longitude: e.target.value ? parseFloat(e.target.value) : undefined })}
                        placeholder="منطقة التفريغ"
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">يتم تحديد إحداثيات الشحن والتفريغ لكل رحلة على حدة (غير مرتبطة ببيانات العميل)</p>
                </div>
              </div>
            )}

            {/* TAB 3: FLEET, DRIVER & STATUS */}
            {activeTab === 'fleet' && (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
                  <span className="font-semibold flex items-center gap-1.5">
                    <TruckIcon className="w-4 h-4 text-amber-600" />
                    تعيين طاقم الرحلة والأسطول والحالة التشغيلية
                  </span>
                  <span className="font-mono font-bold text-sm">
                    إجمالي إيراد الدورة: {((formData.price_export || 0) + (formData.price_import || 0)).toLocaleString()} MAD
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">السائق المسؤول *</label>
                    <select
                      value={formData.driver_id || ''}
                      onChange={(e) => handleDriverChange(e.target.value)}
                      className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring shadow-2xs [color-scheme:light] dark:[color-scheme:dark]"
                      required
                    >
                      <option value="">-- اختر السائق --</option>
                      {availableDrivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.name} {driver.phone ? `(${driver.phone})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <TruckIcon className="w-4 h-4 text-blue-500" />
                      الشاحنة المخصصة (Tracteur) *
                    </label>
                    <select
                      value={formData.truck_id || ''}
                      onChange={(e) => handleTruckChange(e.target.value)}
                      className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring shadow-2xs [color-scheme:light] dark:[color-scheme:dark]"
                      required
                    >
                      <option value="">-- اختيار الشاحنة --</option>
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
                      المقطورة (Remorque / Frigo)
                    </label>
                    <select
                      value={formData.trailer_id || ''}
                      onChange={(e) => setFormData({ ...formData, trailer_id: parseInt(e.target.value) || undefined })}
                      className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring shadow-2xs [color-scheme:light] dark:[color-scheme:dark]"
                    >
                      <option value="">-- اختيار المقطورة --</option>
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
                    <label className="text-sm font-medium text-foreground">حالة مسار الرحلة</label>
                    <select
                      value={formData.status || 'pending'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring shadow-2xs [color-scheme:light] dark:[color-scheme:dark]"
                    >
                      <option value="pending">قيد التجهيز (Pending)</option>
                      <option value="en_route_outbound">في طريق الذهاب (En route Aller / Export)</option>
                      <option value="at_destination_export">وصل وجهة التصدير (At Export Destination)</option>
                      <option value="en_route_inbound">في طريق العودة (En route Retour / Import)</option>
                      <option value="at_customs">في جمرك الميناء (At Customs)</option>
                      <option value="completed">مكتملة ومفرغة (Completed)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">نوع التسعير / العملة</label>
                    <select
                      value={formData.price_type || 'MAD'}
                      onChange={(e) => setFormData({ ...formData, price_type: e.target.value })}
                      className="w-full h-10 px-3 py-2 border border-input bg-card rounded-lg text-sm text-foreground focus:ring-2 focus:ring-ring shadow-2xs [color-scheme:light] dark:[color-scheme:dark]"
                    >
                      <option value="MAD">درهم مغربي (MAD)</option>
                      <option value="EUR">يورو (EUR)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Total summary banner */}
            <div className="p-3 bg-muted/50 rounded-xl border border-border flex items-center justify-between text-xs">
              <div className="flex items-center gap-4">
                <span>🛫 ذهاب: <strong className="text-foreground">{(formData.price_export || 0).toLocaleString()}</strong></span>
                <span>🛬 عودة: <strong className="text-foreground">{(formData.price_import || 0).toLocaleString()}</strong></span>
              </div>
              <div className="text-sm font-bold text-primary font-mono">
                الإجمالي: {((formData.price_export || 0) + (formData.price_import || 0)).toLocaleString()} {formData.price_type || 'MAD'}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-border">
              <Button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />
                {loading ? 'جاري الحفظ...' : initialData ? 'تحديث بيانات الرحلة' : 'حفظ وتأكيد الرحلة الدولية'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                إلغاء
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
