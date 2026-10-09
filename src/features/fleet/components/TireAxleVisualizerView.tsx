'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '@/components/language-provider';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { MatriculeBadge } from '@/components/ui/matricule-badge';
import {
  Disc,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  PlusCircle,
  Truck,
  RotateCcw,
  Gauge,
  Thermometer,
  Layers,
  DollarSign,
  AlertOctagon,
  CheckCircle2,
  Sliders,
} from 'lucide-react';
import { formatCurrency } from '@/lib/forex';
import {
  getFleetTireDataAction,
  recordTireInspectionAction,
  mountTireAction,
  rotateTiresAction,
  type FleetTireDataResponse,
} from '../services/tire-management.actions';
import type {
  FleetTire,
  TireAxlePosition,
  TireConditionHealth,
  TpmsAlertFlag,
} from '../types/tire-fleet.types';

export function TireAxleVisualizerView() {
  const { t, dir } = useLanguage();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [tireData, setTireData] = useState<FleetTireDataResponse | null>(null);

  // Filters
  const [selectedVehicleType, setSelectedVehicleType] = useState<'all' | 'truck' | 'trailer'>('all');
  const [selectedTruckId, setSelectedTruckId] = useState<number | undefined>(undefined);
  const [selectedTrailerId, setSelectedTrailerId] = useState<number | undefined>(undefined);
  const [conditionFilter, setConditionFilter] = useState<string>('all');

  // Inspection Modal State
  const [selectedTireForInspection, setSelectedTireForInspection] = useState<FleetTire | null>(null);
  const [inspectTreadDepth, setInspectTreadDepth] = useState<string>('12.5');
  const [inspectPressure, setInspectPressure] = useState<string>('8.8');
  const [inspectTemp, setInspectTemp] = useState<string>('55');
  const [inspectKm, setInspectKm] = useState<string>('0');
  const [inspectNotes, setInspectNotes] = useState<string>('');
  const [isSubmittingInspection, setIsSubmittingInspection] = useState(false);

  // Mount Tire Modal State
  const [isMountModalOpen, setIsMountModalOpen] = useState(false);
  const [mountSerial, setMountSerial] = useState('');
  const [mountBrand, setMountBrand] = useState('Michelin');
  const [mountModel, setMountModel] = useState('X Multi D');
  const [mountSize, setMountSize] = useState('315/80R22.5');
  const [mountVehicleType, setMountVehicleType] = useState<'truck' | 'trailer'>('truck');
  const [mountTruckId, setMountTruckId] = useState<number | ''>('');
  const [mountTrailerId, setMountTrailerId] = useState<number | ''>('');
  const [mountPosition, setMountPosition] = useState<TireAxlePosition>('1L');
  const [mountInitialDepth, setMountInitialDepth] = useState('16.0');
  const [mountCost, setMountCost] = useState('4500.00');
  const [mountKm, setMountKm] = useState('0');
  const [isSubmittingMount, setIsSubmittingMount] = useState(false);

  // Rotate Modal State
  const [isRotateModalOpen, setIsRotateModalOpen] = useState(false);
  const [rotateTire1Id, setRotateTire1Id] = useState<string>('');
  const [rotateTire2Id, setRotateTire2Id] = useState<string>('');
  const [rotateReason, setRotateReason] = useState('موازنة تآكل المداس الدوري (Routine axle rotation)');
  const [isSubmittingRotate, setIsSubmittingRotate] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getFleetTireDataAction({
        vehicle_type: selectedVehicleType,
        truck_id: selectedTruckId,
        trailer_id: selectedTrailerId,
        condition: conditionFilter as any,
      });

      if (res.success && res.data) {
        setTireData(res.data);
      } else {
        toast({
          title: t('خطأ', 'Erreur', 'Error'),
          description: res.error || t('فشل تحميل بيانات الإطارات', 'Échec du chargement des pneus'),
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error';
      toast({ title: t('خطأ', 'Erreur', 'Error'), description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [selectedVehicleType, selectedTruckId, selectedTrailerId, conditionFilter, toast, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open Inspection Modal pre-populated with tire's current data
  const handleOpenInspection = (tire: FleetTire) => {
    setSelectedTireForInspection(tire);
    setInspectTreadDepth(tire.current_tread_depth_mm || '12.0');
    setInspectPressure(tire.latest_telematics?.pressure_bar || '8.8');
    setInspectTemp(tire.latest_telematics?.temperature_c || '50');
    setInspectKm(String(tire.current_km || tire.installed_km || 0));
    setInspectNotes('');
  };

  const handleSubmitInspection = async () => {
    if (!selectedTireForInspection) return;
    setIsSubmittingInspection(true);
    try {
      const res = await recordTireInspectionAction({
        tire_id: selectedTireForInspection.id,
        tread_depth_mm: Number(inspectTreadDepth),
        pressure_bar: Number(inspectPressure),
        temperature_c: Number(inspectTemp),
        current_km: Number(inspectKm),
        notes: inspectNotes.trim() || undefined,
      });

      if (res.success) {
        toast({
          title: t('تم تسجيل الفحص بنجاح', 'Inspection enregistrée avec succès', 'Inspection recorded successfully'),
          description: t(
            `تم تحديث عمق المداس إلى ${inspectTreadDepth} مم والضغط إلى ${inspectPressure} بار`,
            `Usure mise à jour: ${inspectTreadDepth} mm, pression: ${inspectPressure} bar`,
            `Updated depth to ${inspectTreadDepth} mm and pressure to ${inspectPressure} bar`
          ),
        });
        setSelectedTireForInspection(null);
        fetchData();
      } else {
        toast({ title: t('خطأ', 'Erreur', 'Error'), description: res.error, variant: 'destructive' });
      }
    } finally {
      setIsSubmittingInspection(false);
    }
  };

  const handleSubmitMount = async () => {
    if (!mountSerial.trim()) {
      toast({
        title: t('تنبيه', 'Attention', 'Warning'),
        description: t('يرجى إدخال الرقم التسلسلي للإطار', 'Veuillez saisir le numéro de série', 'Please enter serial number'),
        variant: 'destructive',
      });
      return;
    }

    setIsSubmittingMount(true);
    try {
      const res = await mountTireAction({
        serial_number: mountSerial.trim(),
        brand: mountBrand.trim(),
        model: mountModel.trim(),
        size: mountSize.trim(),
        vehicle_type: mountVehicleType,
        truck_id: mountTruckId ? Number(mountTruckId) : null,
        trailer_id: mountTrailerId ? Number(mountTrailerId) : null,
        axle_position: mountPosition,
        initial_tread_depth_mm: Number(mountInitialDepth),
        purchase_cost_mad: Number(mountCost),
        installed_km: Number(mountKm),
      });

      if (res.success) {
        toast({
          title: t('تم تركيب الإطار بنجاح', 'Pneu monté avec succès', 'Tire mounted successfully'),
          description: t(
            `تم تسجيل الإطار ${mountSerial} في الموضع ${mountPosition}`,
            `Pneu ${mountSerial} assigné en position ${mountPosition}`,
            `Tire ${mountSerial} assigned to position ${mountPosition}`
          ),
        });
        setIsMountModalOpen(false);
        setMountSerial('');
        fetchData();
      } else {
        toast({ title: t('خطأ', 'Erreur', 'Error'), description: res.error, variant: 'destructive' });
      }
    } finally {
      setIsSubmittingMount(false);
    }
  };

  const handleSubmitRotate = async () => {
    if (!rotateTire1Id || !rotateTire2Id || rotateTire1Id === rotateTire2Id) {
      toast({
        title: t('تنبيه', 'Attention', 'Warning'),
        description: t('يرجى اختيار إطارين مختلفين للتدوير', 'Veuillez sélectionner deux pneus distincts', 'Please select two distinct tires'),
        variant: 'destructive',
      });
      return;
    }

    setIsSubmittingRotate(true);
    try {
      const res = await rotateTiresAction({
        tire_id_1: rotateTire1Id,
        tire_id_2: rotateTire2Id,
        reason: rotateReason.trim(),
      });

      if (res.success) {
        toast({
          title: t('تم تدوير الإطارات بنجاح', 'Permutation effectuée avec succès', 'Tires rotated successfully'),
          description: t('تم تبديل مواضع الإطارات المحددة', 'Positions inversées avec succès', 'Positions swapped successfully'),
        });
        setIsRotateModalOpen(false);
        fetchData();
      } else {
        toast({ title: t('خطأ', 'Erreur', 'Error'), description: res.error, variant: 'destructive' });
      }
    } finally {
      setIsSubmittingRotate(false);
    }
  };

  const summary = tireData?.summary;
  const tires = tireData?.tires || [];
  const trucks = tireData?.trucks || [];
  const trailers = tireData?.trailers || [];
  const dualPairs = tireData?.dualPairs || [];

  // Group tires of the active selected vehicle for the Axle Diagram
  const activeVehicleTires = useMemo(() => {
    if (selectedTruckId) {
      return tires.filter((t) => t.vehicle_type === 'truck' && t.truck_id === selectedTruckId);
    }
    if (selectedTrailerId) {
      return tires.filter((t) => t.vehicle_type === 'trailer' && t.trailer_id === selectedTrailerId);
    }
    // Default to first truck with tires if any
    const firstTruck = trucks[0];
    if (firstTruck) {
      return tires.filter((t) => t.vehicle_type === 'truck' && t.truck_id === firstTruck.id);
    }
    return tires;
  }, [tires, selectedTruckId, selectedTrailerId, trucks]);

  const tiresByPosition = useMemo(() => {
    const map = new Map<TireAxlePosition, FleetTire>();
    for (const t of activeVehicleTires) {
      map.set(t.axle_position, t);
    }
    return map;
  }, [activeVehicleTires]);

  const getConditionBadge = (cond?: TireConditionHealth) => {
    switch (cond) {
      case 'optimal':
        return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 font-bold">{t('ممتاز', 'Optimal', 'Optimal')}</Badge>;
      case 'good':
        return <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 font-bold">{t('جيد', 'Bon', 'Good')}</Badge>;
      case 'warning':
        return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 font-bold">{t('تحذير', 'Attention', 'Warning')}</Badge>;
      case 'critical':
        return <Badge className="bg-rose-500/15 text-rose-600 border-rose-500/30 font-bold">{t('حرج (< 3mm)', 'Critique', 'Critical')}</Badge>;
      case 'legal_limit':
        return <Badge variant="destructive" className="font-extrabold animate-pulse">{t('الحد الأدنى (1.6mm)', 'Limite légale', 'Legal limit')}</Badge>;
      default:
        return <Badge variant="outline">—</Badge>;
    }
  };

  const getTpmsBadge = (flags?: TpmsAlertFlag[]) => {
    if (!flags || flags.length === 0 || (flags.length === 1 && flags[0] === 'normal')) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
          <CheckCircle2 className="w-3 h-3" />
          {t('طبيعي', 'Normal', 'Normal')}
        </span>
      );
    }

    if (flags.includes('critical_low_pressure')) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] text-rose-600 font-extrabold animate-pulse">
          <AlertOctagon className="w-3 h-3" />
          {t('ضغط هابط حرج!', 'Sous-gonflage sévère!', 'Critical Low Pressure!')}
        </span>
      );
    }

    if (flags.includes('overheating')) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] text-rose-600 font-bold">
          <Thermometer className="w-3 h-3" />
          {t('حرارة مفرطة (>85°C)', 'Surchauffe', 'Overheating')}
        </span>
      );
    }

    if (flags.includes('low_pressure')) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-bold">
          <AlertTriangle className="w-3 h-3" />
          {t('ضغط منخفض', 'Basse pression', 'Low Pressure')}
        </span>
      );
    }

    return null;
  };

  // Axle Visualizer Tire Tile Sub-component
  const renderTireTile = (pos: TireAxlePosition, label: string) => {
    const tire = tiresByPosition.get(pos);
    const depth = tire ? Number(tire.current_tread_depth_mm) : 0;
    const isLegalLimit = depth <= 1.6;
    const isCritical = depth <= 3.0 && depth > 1.6;
    const isWarning = depth <= 5.0 && depth > 3.0;

    let borderClass = 'border-dashed border-border/80 bg-muted/20';
    if (tire) {
      if (isLegalLimit) borderClass = 'border-red-600 bg-red-500/10 shadow-xs ring-1 ring-red-500';
      else if (isCritical) borderClass = 'border-rose-500 bg-rose-500/10';
      else if (isWarning) borderClass = 'border-amber-500 bg-amber-500/10';
      else borderClass = 'border-emerald-500/60 bg-emerald-500/5 hover:border-emerald-500';
    }

    return (
      <div
        onClick={() => tire && handleOpenInspection(tire)}
        className={`p-2.5 rounded-xl border flex flex-col items-center justify-between transition-all ${
          tire ? 'cursor-pointer hover:scale-[1.02]' : 'opacity-60'
        } ${borderClass}`}
      >
        <div className="flex items-center justify-between w-full mb-1">
          <span className="font-mono font-black text-[11px] px-1.5 py-0.5 rounded-md bg-background border border-border">
            {pos}
          </span>
          <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
        </div>

        {tire ? (
          <div className="flex flex-col items-center text-center my-1 w-full">
            <span className="text-xs font-bold text-foreground truncate max-w-[95px]">
              {tire.brand}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`text-base font-black font-mono ${isLegalLimit ? 'text-red-600' : isCritical ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-emerald-600'}`}>
                {tire.current_tread_depth_mm}
              </span>
              <span className="text-[10px] text-muted-foreground">mm</span>
            </div>

            {/* Depth bar indicator */}
            <div className="w-full bg-muted rounded-full h-1.5 mt-1 overflow-hidden">
              <div
                className={`h-full ${isLegalLimit ? 'bg-red-600' : isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(100, (depth / 16) * 100)}%` }}
              />
            </div>

            {/* TPMS Quick Telemetry */}
            <div className="flex items-center justify-between w-full mt-2 pt-1 border-t border-border/40 text-[10px] font-mono text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <Gauge className="w-2.5 h-2.5 text-sky-500" />
                {tire.latest_telematics?.pressure_bar || '8.8'}b
              </span>
              <span className="flex items-center gap-0.5">
                <Thermometer className="w-2.5 h-2.5 text-rose-500" />
                {tire.latest_telematics?.temperature_c || '50'}°
              </span>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center">
            <Disc className="w-5 h-5 text-muted-foreground/40 mx-auto mb-1" />
            <span className="text-[10px] text-muted-foreground block">{t('شاغر', 'Vide', 'Empty')}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6" dir={dir}>
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-amiri text-foreground flex items-center gap-2">
            <Disc className="w-5 h-5 text-sky-500" />
            <span>
              {t(
                'إدارة أسطول الإطارات وتتبع تآكل المداس الذكي (Tire TPMS & Axle Lifecycle)',
                'Gestion des Pneus & Télémétrie d\'Usure TPMS',
                'Tire Fleet Management & TPMS Wear Telematics'
              )}
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(
              'مراقبة عمق المداس، موازنة العجلات المزدوجة، رصد التسريب البطيء، واحتساب كلفة الكيلومتر بدقة Decimal.js',
              'Contrôle de l\'usure, équilibrage jumelé, surveillance de pression et coût au kilomètre (CPK)',
              'Tread depth monitoring, dual-wheel balancing, TPMS pressure alerts, and Tire CPK precision'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="rounded-xl text-xs gap-1.5 h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t('تحديث', 'Actualiser', 'Refresh')}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRotateModalOpen(true)}
            className="rounded-xl text-xs gap-1.5 h-9 font-medium"
          >
            <RotateCcw className="w-3.5 h-3.5 text-indigo-500" />
            <span>{t('تدوير الإطارات', 'Permuter', 'Rotate Tires')}</span>
          </Button>

          <Button
            onClick={() => setIsMountModalOpen(true)}
            className="rounded-xl text-xs gap-1.5 h-9 font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-xs"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{t('تركيب إطار جديد', 'Monter un pneu', 'Mount Tire')}</span>
          </Button>
        </div>
      </div>

      {/* Bento Grid KPI Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Average Tread Depth */}
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {t('متوسط عمق مداس إطارات الأسطول', 'Profondeur Moyenne', 'Fleet Avg Tread Depth')}
              </p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold font-mono text-foreground">
                  {summary?.average_tread_depth_mm || '0.00'}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">mm</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Tires Below Safety Threshold */}
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {t('إطارات دون حد الأمان (< 3.0mm)', 'Pneus < 3.0 mm (Critiques)', 'Tires Below Safety (< 3mm)')}
              </p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold font-mono text-rose-600">
                  {summary?.tires_below_safety_threshold || 0}
                </span>
                {summary?.tires_at_legal_limit ? (
                  <span className="text-[11px] font-bold text-red-700 bg-red-100 dark:bg-red-950/40 px-1.5 py-0.5 rounded">
                    {summary.tires_at_legal_limit} {t('عند الحد القانوني 1.6mm', 'limite légale', 'legal limit')}
                  </span>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Active TPMS Alerts */}
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {t('إنذارات ضغط وحرارة TPMS النشطة', 'Alertes TPMS Actives', 'Active TPMS Alerts')}
              </p>
              <p className="text-2xl font-bold font-mono text-amber-600 mt-0.5">
                {summary?.active_tpms_alerts_count || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Tire CPK & Replacement Budget */}
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {t('كلفة الكيلومتر وميزانية الاستبدال', 'Coût CPK & Budget Remplacement', 'Tire CPK & Budget')}
              </p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-base font-bold font-mono text-foreground">
                  {summary?.fleet_average_tire_cpk_mad || '0.0000'}
                </span>
                <span className="text-[10px] text-muted-foreground me-2">MAD/km</span>
                <span className="text-xs font-mono font-bold text-emerald-600">
                  {formatCurrency(Number(summary?.total_projected_tire_replacement_budget_mad || '0'), 'MAD')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Visualizer Area: Axle Layout & Dual Pairing Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Interactive Digital Axle Visualizer */}
        <Card className="lg:col-span-2 border-border overflow-hidden">
          <CardHeader className="border-b border-border/70 py-3.5 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Truck className="w-4 h-4 text-sky-500" />
                <span>
                  {t(
                    'مخطط تموضع المحاور الرقمي الحي (Digital Axle Twin)',
                    'Visualiseur Numérique des Essieux',
                    'Digital Axle Twin Visualizer'
                  )}
                </span>
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {activeVehicleTires.length} {t('إطار مركب', 'pneus montés', 'mounted')}
              </Badge>
            </div>

            {/* Vehicle Selector for Axle Twin */}
            <div className="flex items-center gap-2">
              <select
                value={selectedTruckId || ''}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : undefined;
                  setSelectedTruckId(val);
                  setSelectedTrailerId(undefined);
                }}
                className="h-8 text-xs rounded-lg border border-border bg-background px-2.5 font-medium"
              >
                <option value="">{t('-- عرض شاحنة (رأس جر 4x2) --', '-- Choisir un camion (4x2) --', '-- Select Truck (4x2) --')}</option>
                {trucks.map((trk) => (
                  <option key={trk.id} value={trk.id}>
                    {trk.plate_number} {trk.model ? `(${trk.model})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-8 bg-muted/10">
            {/* Axle 1: Steer Axle (محور التوجيه الأمامي) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-border/60 pb-1">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-muted-foreground" />
                  {t('المحور الأول: محور التوجيه الأمامي (Steer Axle 1)', 'Essieu 1: Directionnel avant', 'Axle 1: Front Steer')}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">1L / 1R (Single 315/80 R22.5)</span>
              </div>
              <div className="grid grid-cols-2 gap-8 max-w-md mx-auto pt-2">
                {renderTireTile('1L', t('أمامي يسار', 'Avant Gauche', 'Front Left'))}
                {renderTireTile('1R', t('أمامي يمين', 'Avant Droit', 'Front Right'))}
              </div>
            </div>

            {/* Axle 2: Drive Axle Duals (محور الجر الخلفي المزدوج) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-border/60 pb-1">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-muted-foreground" />
                  {t('المحور الثاني: محور الجر المزدوج (Drive Axle 2 Duals)', 'Essieu 2: Moteur jumelé', 'Axle 2: Drive Duals')}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">2LO / 2LI | 2RI / 2RO</span>
              </div>
              <div className="grid grid-cols-4 gap-3 pt-2">
                {renderTireTile('2LO', t('يسار خارجي', 'Gauche Externe', 'Left Outer'))}
                {renderTireTile('2LI', t('يسار داخلي', 'Gauche Interne', 'Left Inner'))}
                {renderTireTile('2RI', t('يمين داخلي', 'Droite Interne', 'Right Inner'))}
                {renderTireTile('2RO', t('يمين خارجي', 'Droite Externe', 'Right Outer'))}
              </div>
            </div>

            {/* Tri-Axle Trailer representation (if trailer selected or viewing) */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between border-b border-border/60 pb-1">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                  {t('محاور المقطورة الثلاثية (Tri-Axle Semi-Trailer)', 'Essieux Semi-Remorque (Tri-Axle)', 'Tri-Axle Semi-Trailer')}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">T1..T3 (Single 385/65 R22.5)</span>
              </div>
              <div className="grid grid-cols-6 gap-2 pt-2">
                {renderTireTile('T1L', 'T1-L')}
                {renderTireTile('T1R', 'T1-R')}
                {renderTireTile('T2L', 'T2-L')}
                {renderTireTile('T2R', 'T2-R')}
                {renderTireTile('T3L', 'T3-L')}
                {renderTireTile('T3R', 'T3-R')}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Dual Tire Mismatch Radar & Wear Legend */}
        <div className="space-y-6">
          {/* Dual Mismatch Radar */}
          <Card className="border-border overflow-hidden">
            <CardHeader className="border-b border-border/70 py-3.5 px-5">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-500" />
                <span>
                  {t(
                    'رادار موازنة العجلات المزدوجة (Dual Pair Radar)',
                    'Radar de Jumelage des Pneus',
                    'Dual Tire Matching Radar'
                  )}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {dualPairs.length > 0 ? (
                dualPairs.map((pair, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                      pair.is_mismatched
                        ? 'border-rose-500/50 bg-rose-500/5'
                        : 'border-border bg-card/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">{pair.axle}</span>
                      {pair.is_mismatched ? (
                        <Badge variant="destructive" className="text-[10px] font-bold">
                          {t('فارق خطير (>= 2mm)', 'Écart critique', 'Mismatched')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                          {t('متوازن ومطابق', 'Équilibré', 'Balanced')}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-muted-foreground pt-1">
                      <span>{t('فارق عمق المداس:', 'Écart:', 'Depth Delta:')}</span>
                      <span className="font-mono font-bold text-foreground">
                        {pair.depth_delta_mm} mm
                      </span>
                    </div>

                    {pair.is_mismatched && pair.warning_message_ar && (
                      <p className="text-[11px] text-rose-600 font-medium leading-relaxed pt-1 border-t border-rose-500/20">
                        {pair.warning_message_ar}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  {t('لا توجد مجموعات عجلات مزدوجة نشطة حالياً.', 'Aucun essieu jumelé actif.', 'No active dual axle pairs.')}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tread Wear Color Legend & Guide */}
          <Card className="border-border">
            <CardHeader className="py-3 px-4 border-b border-border">
              <CardTitle className="text-xs font-bold text-muted-foreground">
                {t('دليل مستويات استهلاك مداس الإطارات', 'Légende d\'Usure des Pneus', 'Tread Depth Scale')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span>{t('مداس ممتاز (جديد)', 'Neuf / Optimal', 'New / Optimal')}</span>
                </span>
                <span className="font-mono font-bold text-emerald-600">&gt; 10.0 mm</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span>{t('حالة جيدة تشغيلية', 'Bon état', 'Good Condition')}</span>
                </span>
                <span className="font-mono font-bold text-blue-600">5.0 - 10.0 mm</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span>{t('تنبيه: يُوصى بالتدوير', 'Attention (Permutation)', 'Warning (Rotation)')}</span>
                </span>
                <span className="font-mono font-bold text-amber-600">3.0 - 5.0 mm</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <span>{t('خطر حرج: جدولة الاستبدال', 'Critique (Remplacement)', 'Critical')}</span>
                </span>
                <span className="font-mono font-bold text-rose-600">1.6 - 3.0 mm</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-700 animate-pulse" />
                  <span>{t('توقف إجباري (الحد القانوني)', 'Limite légale (Arrêt)', 'Legal Limit (Stop)')}</span>
                </span>
                <span className="font-mono font-bold text-red-700">&le; 1.6 mm</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Complete Tires Fleet Assets Table */}
      <Card className="border-border overflow-hidden">
        <CardHeader className="border-b border-border/70 py-3.5 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-500" />
              <span>
                {t(
                  'سجل أصول الإطارات وتفاصيل الأداء الميداني',
                  'Inventaire des Pneus & Télémétrie Moteur',
                  'Fleet Tire Asset Registry & Telematics'
                )}
              </span>
            </CardTitle>
            <Badge variant="outline" className="text-xs">{tires.length}</Badge>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedVehicleType}
              onChange={(e) => setSelectedVehicleType(e.target.value as any)}
              className="h-8 text-xs rounded-lg border border-border bg-background px-2 font-medium"
            >
              <option value="all">{t('كافة الآليات', 'Tous véhicules', 'All Vehicles')}</option>
              <option value="truck">{t('الشاحنات فقط', 'Camions uniquement', 'Trucks only')}</option>
              <option value="trailer">{t('المقطورات فقط', 'Remorques uniquement', 'Trailers only')}</option>
            </select>

            <select
              value={conditionFilter}
              onChange={(e) => setConditionFilter(e.target.value)}
              className="h-8 text-xs rounded-lg border border-border bg-background px-2 font-medium"
            >
              <option value="all">{t('كافة حالات المداس', 'Toutes conditions', 'All Conditions')}</option>
              <option value="optimal">{t('ممتاز', 'Optimal', 'Optimal')}</option>
              <option value="good">{t('جيد', 'Bon', 'Good')}</option>
              <option value="warning">{t('تحذير', 'Warning', 'Warning')}</option>
              <option value="critical">{t('حرج (< 3mm)', 'Critique', 'Critical')}</option>
              <option value="legal_limit">{t('حد قانوني (1.6mm)', 'Limite légale', 'Legal limit')}</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {tires.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2.5 px-4 text-start font-semibold">{t('الرقم التسلسلي والعلامة', 'Pneu / Marque', 'Tire / Brand')}</th>
                    <th className="py-2.5 px-4 text-start font-semibold">{t('المركبة والموضع', 'Véhicule & Essieu', 'Vehicle & Axle')}</th>
                    <th className="py-2.5 px-4 text-start font-semibold">{t('عمق المداس', 'Profondeur', 'Tread Depth')}</th>
                    <th className="py-2.5 px-4 text-start font-semibold">{t('حالة TPMS', 'TPMS', 'TPMS')}</th>
                    <th className="py-2.5 px-4 text-start font-semibold">{t('المسافة التقديرية المتبقية', 'Km Restants', 'Remaining Km')}</th>
                    <th className="py-2.5 px-4 text-start font-semibold">{t('كلفة CPK', 'Coût CPK', 'CPK')}</th>
                    <th className="py-2.5 px-4 text-end font-semibold">{t('إجراء', 'Action', 'Action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tires.map((tire) => (
                    <tr key={tire.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-foreground">{tire.serial_number}</span>
                          <span className="text-[11px] text-muted-foreground">{tire.brand} {tire.model} ({tire.size})</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {tire.truck && <MatriculeBadge plate={tire.truck.plate_number} />}
                          {tire.trailer && <MatriculeBadge plate={tire.trailer.plate_number} />}
                          <span className="font-mono font-black text-xs px-1.5 py-0.5 rounded bg-muted border border-border">
                            {tire.axle_position}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-foreground">
                            {tire.current_tread_depth_mm} mm
                          </span>
                          {getConditionBadge(tire.metrics?.health_condition)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2 font-mono text-[11px]">
                            <span>{tire.latest_telematics?.pressure_bar || '8.80'} bar</span>
                            <span>{tire.latest_telematics?.temperature_c || '50'} °C</span>
                          </div>
                          <div>{getTpmsBadge(tire.latest_telematics?.alert_flags)}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-foreground">
                        {tire.metrics?.projected_remaining_km ? `${tire.metrics.projected_remaining_km.toLocaleString()} km` : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-foreground">
                        {tire.metrics?.tire_cpk_mad ? `${tire.metrics.tire_cpk_mad} MAD` : '—'}
                      </td>
                      <td className="py-3 px-4 text-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenInspection(tire)}
                          className="h-7 text-xs px-2 text-sky-600 hover:text-sky-700"
                        >
                          {t('تسجيل فحص', 'Inspecter', 'Inspect')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-muted-foreground">
              {t('لا توجد إطارات مسجلة تطابق التصفية الحالية.', 'Aucun pneu trouvé.', 'No tires found.')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inspection & TPMS Modal */}
      <Dialog open={!!selectedTireForInspection} onOpenChange={() => setSelectedTireForInspection(null)}>
        <DialogContent className="sm:max-w-md" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Gauge className="w-4 h-4 text-sky-500" />
              <span>{t('تسجيل فحص دوري أو قراءة حساس TPMS', 'Enregistrer Contrôle Pneu / TPMS', 'Record Tire / TPMS Inspection')}</span>
            </DialogTitle>
          </DialogHeader>

          {selectedTireForInspection && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-muted/40 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm text-foreground">
                    {selectedTireForInspection.serial_number} ({selectedTireForInspection.brand})
                  </span>
                  <Badge variant="outline">{selectedTireForInspection.axle_position}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t('المسافة المركبة:', 'Km monté:', 'Installed km:')} {selectedTireForInspection.installed_km.toLocaleString()} km
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    {t('عمق المداس المقاس (mm)', 'Profondeur mesurée (mm)', 'Tread Depth (mm)')}
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    value={inspectTreadDepth}
                    onChange={(e) => setInspectTreadDepth(e.target.value)}
                    className="h-9 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    {t('عداد الكيلومتر الحالي (Km)', 'Odomètre actuel (Km)', 'Odometer (Km)')}
                  </label>
                  <Input
                    type="number"
                    value={inspectKm}
                    onChange={(e) => setInspectKm(e.target.value)}
                    className="h-9 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    {t('ضغط الهواء (bar)', 'Pression (bar)', 'Pressure (bar)')}
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    value={inspectPressure}
                    onChange={(e) => setInspectPressure(e.target.value)}
                    className="h-9 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">
                    {t('درجة الحرارة (°C)', 'Température (°C)', 'Temperature (°C)')}
                  </label>
                  <Input
                    type="number"
                    value={inspectTemp}
                    onChange={(e) => setInspectTemp(e.target.value)}
                    className="h-9 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  {t('ملاحظات الفحص الميداني', 'Notes de contrôle', 'Inspection Notes')}
                </label>
                <Input
                  value={inspectNotes}
                  onChange={(e) => setInspectNotes(e.target.value)}
                  placeholder={t('مثال: تآكل منتظم، لا توجد شقوق جانبية', 'Ex: Usure régulière, flanc intact', 'e.g. Regular wear, intact sidewall')}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedTireForInspection(null)}
              disabled={isSubmittingInspection}
              className="text-xs"
            >
              {t('إلغاء', 'Annuler', 'Cancel')}
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitInspection}
              disabled={isSubmittingInspection}
              className="text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white"
            >
              {isSubmittingInspection ? t('جاري الحفظ...', 'Enregistrement...', 'Saving...') : t('تأكيد وحفظ الفحص', 'Confirmer', 'Confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mount Tire Modal */}
      <Dialog open={isMountModalOpen} onOpenChange={setIsMountModalOpen}>
        <DialogContent className="sm:max-w-md" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-sky-500" />
              <span>{t('تركيب إطار جديد في الأسطول', 'Monter un Nouveau Pneu', 'Mount New Tire')}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">{t('الرقم التسلسلي (DOT / Serial)', 'N° de Série', 'Serial Number')}</label>
                <Input
                  value={mountSerial}
                  onChange={(e) => setMountSerial(e.target.value.toUpperCase())}
                  placeholder="e.g. MICH-2490-88"
                  className="h-8 font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">{t('العلامة التجارية', 'Marque', 'Brand')}</label>
                <Input
                  value={mountBrand}
                  onChange={(e) => setMountBrand(e.target.value)}
                  placeholder="Michelin, Goodyear, etc."
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">{t('المقاس (Size)', 'Dimension', 'Size')}</label>
                <select
                  value={mountSize}
                  onChange={(e) => setMountSize(e.target.value)}
                  className="w-full h-8 rounded-lg border border-border bg-background px-2 text-xs font-mono"
                >
                  <option value="315/80R22.5">315/80R22.5 (Drive/Steer)</option>
                  <option value="385/65R22.5">385/65R22.5 (Trailer/Single)</option>
                  <option value="295/80R22.5">295/80R22.5</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">{t('الموديل (Pattern)', 'Modèle', 'Model')}</label>
                <Input
                  value={mountModel}
                  onChange={(e) => setMountModel(e.target.value)}
                  placeholder="X Multi D, Kmax, etc."
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">{t('نوع الآلية', 'Type Véhicule', 'Vehicle Type')}</label>
                <select
                  value={mountVehicleType}
                  onChange={(e) => setMountVehicleType(e.target.value as 'truck' | 'trailer')}
                  className="w-full h-8 rounded-lg border border-border bg-background px-2 text-xs"
                >
                  <option value="truck">{t('شاحنة (Tractor)', 'Camion', 'Truck')}</option>
                  <option value="trailer">{t('مقطورة (Trailer)', 'Remorque', 'Trailer')}</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  {mountVehicleType === 'truck' ? t('اختر الشاحنة', 'Camion', 'Truck') : t('اختر المقطورة', 'Remorque', 'Trailer')}
                </label>
                {mountVehicleType === 'truck' ? (
                  <select
                    value={mountTruckId}
                    onChange={(e) => setMountTruckId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full h-8 rounded-lg border border-border bg-background px-2 text-xs"
                  >
                    <option value="">{t('-- اختر شاحنة --', '-- Camion --', '-- Truck --')}</option>
                    {trucks.map((trk) => (
                      <option key={trk.id} value={trk.id}>{trk.plate_number}</option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={mountTrailerId}
                    onChange={(e) => setMountTrailerId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full h-8 rounded-lg border border-border bg-background px-2 text-xs"
                  >
                    <option value="">{t('-- اختر مقطورة --', '-- Remorque --', '-- Trailer --')}</option>
                    {trailers.map((trl) => (
                      <option key={trl.id} value={trl.id}>{trl.plate_number}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">{t('موضع المحور', 'Position', 'Position')}</label>
                <select
                  value={mountPosition}
                  onChange={(e) => setMountPosition(e.target.value as TireAxlePosition)}
                  className="w-full h-8 rounded-lg border border-border bg-background px-2 font-mono text-xs font-bold"
                >
                  <option value="1L">1L (Steer Left)</option>
                  <option value="1R">1R (Steer Right)</option>
                  <option value="2LO">2LO (Drive Left Outer)</option>
                  <option value="2LI">2LI (Drive Left Inner)</option>
                  <option value="2RI">2RI (Drive Right Inner)</option>
                  <option value="2RO">2RO (Drive Right Outer)</option>
                  <option value="T1L">T1L (Trailer 1 Left)</option>
                  <option value="T1R">T1R (Trailer 1 Right)</option>
                  <option value="T2L">T2L (Trailer 2 Left)</option>
                  <option value="T2R">T2R (Trailer 2 Right)</option>
                  <option value="T3L">T3L (Trailer 3 Left)</option>
                  <option value="T3R">T3R (Trailer 3 Right)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">{t('العمق الأصلي (mm)', 'Profondeur', 'Initial mm')}</label>
                <Input
                  type="number"
                  step="0.5"
                  value={mountInitialDepth}
                  onChange={(e) => setMountInitialDepth(e.target.value)}
                  className="h-8 font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">{t('سعر الشراء (MAD)', 'Prix', 'Cost MAD')}</label>
                <Input
                  type="number"
                  value={mountCost}
                  onChange={(e) => setMountCost(e.target.value)}
                  className="h-8 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMountModalOpen(false)}
              disabled={isSubmittingMount}
              className="text-xs"
            >
              {t('إلغاء', 'Annuler', 'Cancel')}
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitMount}
              disabled={isSubmittingMount || !mountSerial.trim()}
              className="text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white"
            >
              {isSubmittingMount ? t('جاري التركيب...', 'Enregistrement...', 'Mounting...') : t('تأكيد التركيب', 'Confirmer Montage', 'Confirm Mount')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rotate Tires Modal */}
      <Dialog open={isRotateModalOpen} onOpenChange={setIsRotateModalOpen}>
        <DialogContent className="sm:max-w-md" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-indigo-500" />
              <span>{t('تدوير وتبديل مواضع الإطارات (Rotation Reversal)', 'Permutation des Pneus', 'Tire Rotation Reversal')}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              {t(
                'يساعد تدوير الإطارات بين محاور الجر والمقطورة على موازنة التآكل غير المتكافئ وإطالة عمر الإطار بنسبة تصل إلى 20%.',
                'La permutation entre essieux permet d\'équilibrer l\'usure et d\'accroître la durée de vie jusqu\'à 20%.',
                'Rotating tires between axles helps balance uneven wear and extends casing lifespan by up to 20%.'
              )}
            </p>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">{t('اختر الإطار الأول', 'Premier pneu', 'First Tire')}</label>
              <select
                value={rotateTire1Id}
                onChange={(e) => setRotateTire1Id(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs"
              >
                <option value="">{t('-- اختر الإطار الأول --', '-- Premier pneu --', '-- Select First Tire --')}</option>
                {tires.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.serial_number} ({t.axle_position}) - {t.brand} {t.current_tread_depth_mm}mm
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">{t('اختر الإطار المقابل للتبديل معه', 'Second pneu', 'Second Tire to Swap')}</label>
              <select
                value={rotateTire2Id}
                onChange={(e) => setRotateTire2Id(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs"
              >
                <option value="">{t('-- اختر الإطار الثاني --', '-- Second pneu --', '-- Select Second Tire --')}</option>
                {tires.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.serial_number} ({t.axle_position}) - {t.brand} {t.current_tread_depth_mm}mm
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">{t('سبب وتوثيق التدوير', 'Motif de permutation', 'Reason for rotation')}</label>
              <Input
                value={rotateReason}
                onChange={(e) => setRotateReason(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRotateModalOpen(false)}
              disabled={isSubmittingRotate}
              className="text-xs"
            >
              {t('إلغاء', 'Annuler', 'Cancel')}
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitRotate}
              disabled={isSubmittingRotate || !rotateTire1Id || !rotateTire2Id}
              className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isSubmittingRotate ? t('جاري التبديل...', 'Permutation...', 'Swapping...') : t('تأكيد التدوير والتبديل', 'Confirmer la Permutation', 'Confirm Rotation')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

